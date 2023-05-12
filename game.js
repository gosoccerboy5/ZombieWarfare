// if technical debt was a tangible thing, i would be an indentured servant by now
let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");
if (ctx.roundRect === undefined) ctx.roundRect = ctx.rect;

let m4a4Sound = audio("assets/m4a4.mp3"), headshotSound = audio("assets/headshot.mp3"), hitSound = audio("assets/hit.mp3"), music = audio("assets/onemanarmy.mp3"), reloadSound = audio("assets/reload.mp3"), zombieDeath = audio("assets/robloxDeath.mp3"), footstep = audio("assets/footstep.mp3"), lose = audio("assets/lose.mp3") /*tf2 lose soundtrack*/, win = audio("assets/win.mp3") /*tf2 main theme*/;

let gun = load("assets/gun.png");
let bush = load("assets/bush.png");
let cloud = load("assets/cloud.png");
let zombie = load("assets/zombie.png");
let damage = load("assets/damage.png");

let cameraAngle = Math.PI/4, lastPos = playerPos = [-47.5, -47.5], horizonPoint = canvas.height * .5, cameraPitch = 0,
	fov = Math.PI/2.5, velocity = new Vector2d(0, 0), playerRadius = 1.5, 
	fireMode = 0, recoilFactor = 0, cooldown = 0,
	ammo = maxammo = 30, reloading = false, reloadTime = 70, reloadStart = null,
	radarFogFactor = 30, health = 100,
	endAnimationFrame = 0;
let playerheight = 1, wallheight = 4;
let sizeFactor = 1500*1000/canvas.height, heightPercent = 1-playerheight/wallheight;

class Enemy {
	static enemies = [];
	constructor(pos, speed=0.2, health=5) {
		this.pos = pos;
		this.radius = 0.6;
		this.hitboxRadius = 0.3;
		Enemy.enemies.push(this);
		this.health = health;
		this.speed = speed;
		this.offAngle = (Math.random() - 0.5)*1;
		this.activated = false;
	}
	damage(amount) {
		this.health -= amount;
		if (this.health <= 0) {
			Enemy.enemies.splice(Enemy.enemies.indexOf(this), 1);
			playSound(zombieDeath, 1);
		}
	}
	update() {
		let angle = Math.atan2(playerPos[1] - this.pos[1], playerPos[0] - this.pos[0]) + this.offAngle;
		let relativeVec = new Vector2d(Math.cos(angle), Math.sin(angle)).unit().timesScalar(this.speed).asList;
		this.pos = this.pos.map((c, i) => c+relativeVec[i]);
		wallCollision(this.pos, this.radius);
		let contactPlayer = false;
		while (getDistance(...this.pos, ...playerPos) <= 1) {
			contactPlayer = true;
			this.pos[0] -= relativeVec[0]*0.2;
			this.pos[1] -= relativeVec[1]*0.2;
		}
		if (contactPlayer) {
			let angle = projectPoint(this.pos, playerPos, cameraAngle, fov).relativeAngle;
			damages.add(angle);
			health -= 1;
		}
	}
}

function spawnEnemies() {
	for (let i = -45; i < 45; i+=10) {
		for (let j = -45; j < 45; j+=10) {
			if (Math.random() < 0.7) {
				let enemy = new Enemy([i+(Math.random()-0.5)*8, j+(Math.random()-0.5)*8]);
				if (!walls.some(wall => segmentsCollide(wall[0], wall[1], playerPos, enemy.pos))) {
					Enemy.enemies.splice(Enemy.enemies.indexOf(enemy));
				}
				if (Math.random() < 0.3) {
					enemy.activated = true; //constantly chases at a slow speed
				} else {
					enemy.speed = 0.4; // ambushes at high speed
				}
			}
		}
	}
}

let borders = [[[-50, -50], [-50, 50]], [[-50, -50], [50, -50]], [[50, -50], [50, 50]], [[50, 50], [-50, 50]]];

function spawnWalls() {
	let graph = new Graph();
	for (let i = 0; i < 20; i+=1) {
		for (let j = 0; j < 20; j+=1) {
			if (j >= 1) graph.add([i, j], [i, j-1]);
			if (i >= 1) graph.add([i, j], [i-1, j]);
		}
	}
	let nodes = graph.gen([0, 0].toString());
	nodes = nodes.map(wall => wall.map(pos => pos.split(",").map(Number).map(coord => coord*5-50+2.5)))
	
	let walls = [];
	for (let i = 0; i < 20; i+=1) {
		for (let j = 0; j < 20; j+=1) {
			let pair = [[[i*5-50, j*5-50], [i*5-50, j*5-50+5]], [[i*5-50, j*5-50], [i*5-50+5, j*5-50]]];
			for (let wall of pair) {
				if (Math.random() < 0.9 && !nodes.some(node => segmentsCollide(...wall, ...node))) {
					walls.push(wall);
				}
			}
		}
	}
	return walls;
}
function generateSmallerWallChunks(wall, desiredLength) {
	let wallLength = getDistance(...wall[0], ...wall[1]);
	let times = Math.ceil(wallLength/desiredLength);
	let [actualXLength, actualYLength] = [(wall[1][0]-wall[0][0])/times, (wall[1][1]-wall[0][1])/times];
	let chunks = [];
	for (let i = 0; i < times; i++) {
		chunks.push([[i*actualXLength+wall[0][0], i*actualYLength+wall[0][1]], [(i+1)*actualXLength+wall[0][0], (i+1)*actualYLength+wall[0][1]]]);
	}
	return chunks;
}

let walls = spawnWalls().concat(borders);
spawnEnemies();

let bushes = [];
let clouds = [];

let movementFrame = 0, gunSwing = 0, bloom = 1;

function setup() {
	movementFrame = 0; gunSwing = 0; bloom = 1; cameraAngle = Math.PI/4, health = 100;
	ammo = maxammo = 30; reloading = false; reloadStart = null;
	playerPos = [-47.5, -47.5]; horizonPoint = canvas.height * .5; cameraPitch = 0;
	velocity = new Vector2d(0, 0); lastPos = playerPos; 
	walls = spawnWalls().concat(borders);
	Enemy.enemies = [];
	animating = false;
	spawnEnemies();
        clouds = []; bushes = [];
	for (let i = 0; i < 100; i++) {
		clouds.push([Math.random() * 50 - 25, Math.random() * 50 - 25]);
	}
	for (let i = 0; i < 100; i++) {
		bushes.push([Math.random() * 100 - 50, Math.random() * 100 - 50]);
	}
}

setup();

function projectPoint(pointpos, campos, camangle, fov) {
	let angleToPoint = Math.atan2(pointpos[1] - campos[1], pointpos[0] - campos[0]);
	let v1 = new Vector2d(pointpos[0] - campos[0], pointpos[1] - campos[1]).unit(), v2 = new Vector2d(Math.cos(camangle), Math.sin(camangle));
	let perp = new Vector2d(v1.y, -v1.x);
	let [x, y] = [v1.dot(v2), perp.dot(v2)];
	let relativeAngle = Math.atan2(y, x);
	if (Math.abs(Math.PI*2-relativeAngle) < Math.abs(relativeAngle)) {
		relativeAngle = Math.PI*2-relativeAngle;
	}
	let distance = getDistance(campos[0], campos[1], pointpos[0], pointpos[1]);
	return {
		relativeAngle,
		x: ((relativeAngle+fov/2)/fov),
		distance,
		zDistance: Math.cos(relativeAngle) * distance,
	};
}
function onMouseMove(dx, dy) {
	cameraAngle += dx * Math.PI/1800;
	cameraPitch = Math.min(Math.max(cameraPitch-dy*Math.PI/360, -Math.PI/3), Math.PI/2);
	horizonPoint = canvas.height * .5 + cameraPitch*360/Math.PI;
	gunSwing = dx/5;
}
function onKeyHold(keys) {
	let speed = 0.2;
	if (keys["shift"]) speed /= 3;
	let accelVector = new Vector2d(0, 0);
	if (keys["w"]) {
		accelVector.x += Math.cos(cameraAngle) * speed;
		accelVector.y += Math.sin(cameraAngle) * speed;
	}
	if (keys["s"]) {
		accelVector.x -= Math.cos(cameraAngle) * speed;
		accelVector.y -= Math.sin(cameraAngle) * speed;
	}
	if (keys["a"]) {
		accelVector.x += Math.sin(cameraAngle) * speed;
		accelVector.y -= Math.cos(cameraAngle) * speed;
	}
	if (keys["d"]) {
		accelVector.x -= Math.sin(cameraAngle) * speed;
		accelVector.y += Math.cos(cameraAngle) * speed;
	}
	if (accelVector.magnitude > 0) {
		accelVector = accelVector.unit().timesScalar(speed);
		velocity = velocity.plus(accelVector);
	}
	if (keys["arrowleft"]) cameraAngle -= 0.05;
	if (keys["arrowright"]) cameraAngle += 0.05;
}

function onRightClick() {
	if (!reloading) fireMode = (fireMode + 1) % 2;
}
function onMousePress() {
	if (gameState === "playing") {
		if (fireMode === 1 && cooldown === 0 && !reloading) {
			shoot();
		}
	} else if (gameState === "menu") {
		for (let button of Button.buttons) {
			if (button.isHovering(...mousePos)) {
				button.props.event();
			}
		}
	}
}

function onPause() {
	ctx.fillStyle = "white";
	ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
	ctx.beginPath();
	ctx.roundRect(canvas.width/2-150, canvas.height/2-75, 300, 150, 5);
	ctx.fill();
	ctx.textAlign = "center";
	text(ctx, "Paused!", canvas.width/2, canvas.height/2-20, "40px Helvetica", "black");
	text(ctx, "Click anywhere to resume", canvas.width/2, canvas.height/2+10, "20px Helvetica", "black");
	text(ctx, "Press 'm' to return to the menu", canvas.width/2, canvas.height/2+40, "20px Helvetica", "black");
}

function shoot() {
	if (ammo > 0) {
		let hit = raycast(playerPos, cameraAngle+(Math.random()-0.5)*bloom/4, (cameraPitch+(Math.random()-0.5)*bloom)/10, 1, 200);
		let hitTarget = hit[3];
		if (hitTarget instanceof Enemy) {
			if (1/0.3*(playerheight-hit[2]) < 0.25) {
				hitTarget.damage(2); //headshot damage
				headshotSound.volume = 0.2;
				playSound(headshotSound, 0.2);
			} else {
				hitTarget.damage(1); 
				playSound(hitSound);
			}
		}
		let projected = projectPoint(hit.slice(0, 2), playerPos, cameraAngle, fov);
		let position = [projected.x * canvas.width, horizonPoint+sizeFactor/2.6*(playerheight-hit[2])/projected.zDistance];
		if (projected.zDistance > 0) {
			circle(ctx, position, 50/projected.zDistance, "yellow");
			let oldline = ctx.strokeStyle, gunPos = getGunPos();
			drawShape(ctx, [position, [gunPos[0]+gunPos[2]*0.29, gunPos[1]+gunPos[3]*0.2], position], "yellow", "yellow", 2);
			minimap.add(() => drawShape(ctx, [[playerPos[0]+50, playerPos[1]+50], hit.map(e=>clamp(e, -50, 50)+50), [playerPos[0]+50, playerPos[1]+50]], "yellow", "yellow", 2));
			ctx.strokeStyle = oldline;
			ctx.lineWidth=1;
		}
		onMouseMove((Math.random()-0.5)*5, -20);
		recoilFactor += 3;
		cooldown = 2;
		ammo -= 1;
		playSound(m4a4Sound, 1, 0.4);
	}
}
function reload() {
	reloading = true;
	reloadStart = frames;
	ammo = 0;
	playSound(reloadSound);
}
function onKeyPress(key) {
	if (key === "r" && !reloading && ammo !== maxammo) {
		reload();
	} 
}

function drawBloom(bloom) {
	circle(ctx, [canvas.width/2, canvas.height/2], 1, "black");
	if (!reloading) {
		let visBloom = bloom * canvas.width/Math.PI/2;
		ctx.fillRect(canvas.width/2 + visBloom+3, canvas.height/2-1, 5, 2);
		ctx.fillRect(canvas.width/2 - visBloom-3, canvas.height/2-1, -5, 2);
		ctx.fillRect(canvas.width/2-1, canvas.height/2 + visBloom+3, 2, 5);
		ctx.fillRect(canvas.width/2-1, canvas.height/2 - visBloom-3, 2, -5);
	}
}

function segmentsCollide(a, b, c, d) {
	function ccw(a, b, c) {
    	return (c[1]-a[1])*(b[0]-a[0]) > (b[1]-a[1])*(c[0]-a[0]);
	}
	return ccw(a,c,d) !== ccw(b,c,d) && ccw(a,b,c) !== ccw(a,b,d);
	//black magic stuff from stackoverflow
}

function circleHitsLine(ccenter, cradius, line, getVector=false) {
	if (getDistance((line[0][0]+line[1][0])/2, (line[0][1]+line[1][1])/2, ...ccenter) + cradius > getDistance(line[0][0], line[0][1], line[1][0], line[1][1])) {
		return getVector ? [false, null] : false;
	}
	line = line.flat();
	let lcenter = [(line[0]+line[2])/2, (line[1]+line[3])/2];
	let vec = new Vector2d(ccenter[0]-lcenter[0], ccenter[1]-lcenter[1]);
	let distance = vec.magnitude;
	let relativeAngle = Math.acos((new Vector2d(line[2]-line[0], line[3]-line[1])).unit().dot(vec.unit()));
	let smallerRelativeAngle = Math.min(relativeAngle, Math.PI-relativeAngle);
	let perpendicularDistance = Math.sin(smallerRelativeAngle) * distance;
	if (perpendicularDistance < cradius) {
		let parallelDistance = Math.cos(smallerRelativeAngle) * distance;
		if (parallelDistance > getDistance(line[0], line[1], line[2], line[3]) / 2) {
			for (let endpoint of [[line[0], line[1]], [line[2], line[3]]]) {
				let dist = getDistance(ccenter[0], ccenter[1], endpoint[0], endpoint[1]);
				if (dist < cradius) {
					return getVector ? [true, (new Vector2d(ccenter[0]-endpoint[0], ccenter[1]-endpoint[1])).unit()] : true;
				}
			}
		} else {
			let perpVec = new Vector2d(line[3] - line[1], line[0]-line[2]).unit();
			return getVector ? [true, (perpVec.timesScalar(perpVec.dot(vec.unit()) > 0 ? 1 : -1))] : true;
		}
	}
	return getVector ? [false, null] : false;
}

function raycast(pos, dir, yangle, height, dist) {
	let newPos = [...pos, height], step = 0.1;
	for (let i = 0; i < dist; i+=step) {
		newPos[0] = pos[0] + i * Math.cos(dir);
		newPos[1] = pos[1] + i * Math.sin(dir);
		newPos[2] = height + i * Math.sin(yangle);
		let currdist = getDistance(newPos[0], newPos[1], playerPos[0], playerPos[1]);
		if (newPos[2] <= 0) {
			newPos.push("ground");
			return newPos;
		}
		for (let wall of walls) {
			if (-(heightPercent) < 1/2.6*(playerheight-newPos[2]) &&
				circleHitsLine(newPos, step/2, wall)) {
				// don't ask me where that comes from. I have no clue
				newPos.push(wall);
				return newPos;
			}
		}
		for (let enemy of Enemy.enemies) {
			if (getDistance(newPos[0], newPos[1], enemy.pos[0], enemy.pos[1]) < enemy.hitboxRadius && 
			  -(heightPercent) < 1/0.3*(playerheight-newPos[2])) {
				newPos.push(enemy);
				return newPos;
			}
		}
	}
	newPos.push(null);
	return newPos;
}

let renderScheduler = (function() {
	let renders = [];
	function schedule(distance, position, instruction) {
		let object = {distance, position, instruction};
		for (let i = 0; i < renders.length; i++) {
			if (object.distance > renders[i].distance) {
				renders.splice(i, 0, object);
				return;
			}
		}
		renders.push(object);
	}
	function execute() {
		for (let scheduled of renders) {
			scheduled.instruction();
		}
		renders = [];
	}
	return {
		schedule,
		execute,
	}
})();

let minimap = (function() {
	let items = [];
	function add(fn) {
		items.push(fn);
	}
	function draw() {
		ctx.fillStyle = "steelblue";
		ctx.fillRect(0, 0, 100, 100);
		items.forEach(item => item());
		items = [];
	}
	return {add, draw};
})();

let damages = (function() {
	let items = [];
	function add(deg) {
		items.push(deg-Math.PI/2);
	}
	function draw() {
		for (let deg of items) {
			ctx.translate(canvas.width/2+200*Math.cos(deg), canvas.height/2+200*Math.sin(deg));
			ctx.rotate(deg);
			ctx.translate(-damage.width/2,-damage.height/2);
			ctx.drawImage(damage,0,0);
			ctx.translate(damage.width/2,damage.height/2);
			ctx.rotate(-deg);
			ctx.translate(-canvas.width/2-200*Math.cos(deg), -canvas.height/2-200*Math.sin(deg));
			//thx https://stackoverflow.com/a/46921702/15938577
		}
		items = [];
	}
	return {add, draw};
})();

function wallCollision(pos, radius) {
		let hitWall = false;
		for (let wall of walls) {
			let vec = circleHitsLine(pos, radius, wall, true);
			if (vec[0]) {
				vec[1] = vec[1].unit().timesScalar(0.01);
				while (circleHitsLine(pos, radius, wall)) {
					pos[0] += vec[1].asList[0];
					pos[1] += vec[1].asList[1];
				}
			}
		}
}

function getGunPos() {
	let gunWidth = canvas.width/2.5, gunHeight = canvas.width/6;
	let foo = (frames - reloadStart)/reloadTime*gunHeight*4;
	return [canvas.width - gunWidth + Math.sin(movementFrame) * 10 + gunSwing, 
		canvas.height - gunHeight + Math.abs(Math.sin(movementFrame)) * -5 + 15 - recoilFactor + (reloading ? Math.min(foo, gunHeight*4-foo) : 0),
	  gunWidth, gunHeight];
}

let footstepFrames = 0;

function updateFrame() {
	clear(canvas);
	lastPos = playerPos;
	playerPos = playerPos.map((c, i) => velocity.asList[i] + c);
	velocity = new Vector2d(...velocity.asList.map(a => a*0.5));
	wallCollision(playerPos, playerRadius);
	ctx.fillStyle = "lightgreen";
	ctx.fillRect(0, horizonPoint, canvas.width, canvas.height);
	ctx.fillStyle = "lightblue";
	ctx.fillRect(0, 0, canvas.width, horizonPoint);
	let sunPos = projectPoint([3, 4], [0, 0], cameraAngle, fov);
	circle(ctx, [sunPos.x * canvas.width, horizonPoint-100], 10, "yellow");
	if (cloud.hasLoaded) {
		for (let cloudPos of clouds) {
			let projected = projectPoint(cloudPos, [0, 0], cameraAngle, fov);
			let size = 1000/projected.distance;
			if (projected.distance < 5) continue;
			ctx.drawImage(cloud, projected.x * canvas.width - cloud.width/2, horizonPoint - projected.distance * 20 - cloud.height/2, size, size);
		}
	}
	let graphicsQuality = graphicsSlider.percent;
	let minChunkSize = 0.7-graphicsQuality*0.5, maxChunkSize = 5, distFactor = 1/(7.5*(graphicsQuality+1));
	let renderableWalls = walls.map(wall => generateSmallerWallChunks(wall, 5).map(chunk => 
		generateSmallerWallChunks(chunk, Math.min(minChunkSize+Math.min(getDistance(...wall[0], ...playerPos), getDistance(...wall[1], ...playerPos))*distFactor, maxChunkSize)))).flat(2);
	for (let wall of renderableWalls) {
		let xs = [], zdists = [], dists = [];
		for (let point of wall) {
			let projected = projectPoint(point, playerPos, cameraAngle, fov);
			xs.push(projected.x * canvas.width);
			zdists.push(projected.zDistance);
			if (projected.zDistance >= 0) dists.push(projected.distance);
		}
		minimap.add(() => {
			ctx.beginPath();
			ctx.strokeStyle = `rgb(0, 0, 0, ${1-Math.min(getDistance(wall[0][0], wall[0][1], ...playerPos), getDistance(wall[1][0], wall[1][1], ...playerPos))/radarFogFactor})`;
			ctx.moveTo(wall[0][0]+50, wall[0][1]+50);
			ctx.lineTo(wall[1][0]+50, wall[1][1]+50);
			ctx.closePath();
			ctx.stroke();
		});
		if (zdists.every(dist => dist < 0)) continue;
		zdists = zdists.map(Math.abs);
		let closest = Math.min(...dists);
		let color = `rgb(${closest}, ${closest}, ${closest*3+100})`;
		renderScheduler.schedule(closest, wall, () => drawShape(ctx, [[xs[0], horizonPoint-sizeFactor*heightPercent/zdists[0]], [xs[1], horizonPoint-sizeFactor*heightPercent/zdists[1]], [xs[1], horizonPoint+sizeFactor*(1-heightPercent)/zdists[1]], [xs[0], horizonPoint+sizeFactor*(1-heightPercent)/zdists[0]]], color, color));
	}
	minimap.add(() => circle(ctx, [playerPos[0] + 50, playerPos[1] + 50], 2, "red"));
	minimap.add(() => circle(ctx, [playerPos[0] + 50 + Math.cos(cameraAngle)*3, playerPos[1] + 50 + Math.sin(cameraAngle)*3], 1.5, "rgb(256, 0, 0, 0.7)"));
	if (bush.hasLoaded) {
		for (let bushPos of bushes) {
			let projected = projectPoint(bushPos, playerPos, cameraAngle, fov);
			if (projected.zDistance < 0) continue;
			renderScheduler.schedule(projected.distance, bushPos, () => ctx.drawImage(bush, projected.x * canvas.width-canvas.width/projected.zDistance, horizonPoint+sizeFactor*(1-heightPercent)/projected.zDistance - canvas.height/1/projected.zDistance, canvas.width/1/projected.zDistance, canvas.height/1/projected.zDistance));
		}
	}
	for (let enemy of Enemy.enemies) {
		let projected = projectPoint(enemy.pos, playerPos, cameraAngle, fov);
		if (!walls.some(wall => segmentsCollide(wall[0], wall[1], playerPos, enemy.pos))) {
			minimap.add(() => circle(ctx, enemy.pos.map(c => c+50), 2, `rgb(255, 165, 0, ${1-getDistance(...enemy.pos, ...playerPos)/radarFogFactor})`));
			enemy.activated = true;
		}
		if (enemy.activated) enemy.update();
		if (projected.zDistance < 0.7) continue;
		renderScheduler.schedule(projected.distance, enemy.pos, () => ctx.drawImage(zombie, projected.x*canvas.width-canvas.width/projected.zDistance*0.7/2, horizonPoint+sizeFactor*(1-heightPercent)/projected.zDistance - canvas.height/projected.zDistance*2, canvas.width/projected.zDistance*0.7, canvas.height/projected.zDistance*2));
	}
	renderScheduler.execute();
	if (gun.hasLoaded) {
		let pos = getGunPos();
		ctx.drawImage(gun, pos[0], pos[1], pos[2], pos[3]);
		ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
		ctx.beginPath();
		ctx.roundRect(canvas.width-100, canvas.height-130, 105, 80, 5);
		ctx.fill();
		ctx.textAlign = "center";
		text(ctx, fireMode ? "Semi-auto" : "Automatic", canvas.width-50, canvas.height-98, "20px Helvetica", "white");
		text(ctx, reloading ? "Reloading" : `${ammo}/${maxammo}`, canvas.width-50, canvas.height-68, reloading ? "17px Helvetica" : "20px Helvetica", ammo === 0 ? "red" : "white");
	}
	gunSwing = 0;
	let posDiff = getDistance(...playerPos, ...lastPos)/2; //if we hit a wall then velocity != ∆position
	movementFrame += posDiff*2;
	footstepFrames += posDiff;
	if (footstepFrames > 1.5) {
		playSound(footstep, 0.5, 4);
		footstepFrames -= 1.5;
	}
	bloom = (posDiff*3)+0.01+recoilFactor/100;
	recoilFactor = Math.max(recoilFactor*0.95-1, 0);
	cooldown = Math.max(cooldown-1, 0);
	if (mouseDown && fireMode === 0 && cooldown === 0 && !reloading) {
		shoot();
	}
	if (reloading && frames - reloadStart >= reloadTime) {
		ammo = maxammo;
		reloading = false;
	}
	drawBloom(bloom);
	minimap.add(() => {ctx.fillStyle = "lightgreen";ctx.fillRect(95, 95, 5, 5);});
	minimap.draw();
	ctx.fillStyle = "beige"; ctx.beginPath(); ctx.roundRect(0, 110, 110, 30, 3); ctx.fill();
	ctx.font = "10px Helvetica";
	ctx.fillStyle = "black";
	ctx.fillText("Objective: reach target", 55, 122);
	ctx.fillText("(marked in green)", 55, 135);
	
	damages.draw();
	ctx.fillStyle = "black";
	ctx.lineWidth = 2;
	ctx.fillRect(canvas.width-122, 18, 104, 24);
	ctx.fillStyle = `rgb(${Math.min((100-health)*255/50, 255)}, ${Math.min(health*255/50, 255)}, 0)`;
	ctx.fillRect(canvas.width-120, 20, Math.max(health, 0), 20);
	if (!sounds.some(sound => sound.src === music.src)) {
		//playSound(music, 0.1);
	}
	let targetZone = [47.5, 47.5];
	if (health <= 0) {
		animating = true;
		playSound(lose, 1, 1);
	} else if (playerPos[0]-playerRadius >= targetZone[0]-2.5 && playerPos[0]+playerRadius <= targetZone[0]+2.5 && playerPos[1]-playerRadius >= targetZone[1]-2.5 && playerPos[1]+playerRadius <= targetZone[1]+2.5) {
		animating = true;
		playSound(win, 1, 0);
	}
}

function frame() {
	if (animating) {
		ctx.fillStyle = "rgb(0, 0, 0, 0.1)";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.textAlign = "center";
		if (health <= 0) {
			text(ctx, "You Died.", canvas.width/2, canvas.height/2-30, "40px monospace", "rgb(255, 0, 0, 0.1)");
			text(ctx, "Better luck next time...", canvas.width/2, canvas.height/2, "20px monospace", "rgb(255, 0, 0, 0.1)");
		} else {
			text(ctx, "You Win!", canvas.width/2, canvas.height/2-30, "40px monospace", "rgb(10, 255, 10, 0.1)");
			text(ctx, "Prepare for your next mission, Agent.", canvas.width/2, canvas.height/2, "20px monospace", "rgb(10, 255, 10, 0.1)");
		}
		text(ctx, "Press 'm' to return to the menu", canvas.width/2, canvas.height-20, "15px monospace", "rgb(255, 255, 255, 0.1)");
	} else {
		updateFrame();
	}
}

let play = new Button(canvas.width/2-50, 100, 150, 75, "lightgrey", {value: "Play!", x: 5, y: 5, font: "20px Helvetica"}, startGame);
let resume = new Button(canvas.width/2-50, 200, 150, 75, "lightgrey", {value: "Resume previous", x: 5, y: 5, font: "15px Helvetica"}, () => startGame(true));
resume.visible = false;
let sens = new Slider(canvas.width/2-75, 350, canvas.width/2+125, percent => `Mouse sensitivity: ${Math.round(percent*100)}%`);
let volumeSlider = new Slider(canvas.width/2-75, 400, canvas.width/2+125, percent => `Volume: ${Math.round(percent*100)}%`);
let graphicsSlider = new Slider(canvas.width/2-75, 450, canvas.width/2+125, percent => `Graphics quality: ${Math.round(percent*100)}%`);

let sas = load("assets/sas.png"), zombieMenu = load("assets/zombie-menu.png");
menuImages.push({image: sas, left: -50, top: 0});
menuImages.push({image: zombieMenu, left: canvas.width-330, top: 0, height: 500, width: 350});

