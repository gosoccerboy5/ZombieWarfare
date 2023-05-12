class Graph {
	constructor() {
		this.map = Object.create(null);
	}
	add(from, to, weight) {
		if (this.map[from] === undefined) {
			this.map[from] = {};
		}
		this.map[from][to] = weight;
		if (this.map[to] === undefined) {
			this.map[to] = {};
		}
		this.map[to][from] = weight;
	}
	lookup(from, to) {
		if (to !== undefined) {
			if (this.map[from] === undefined) {
				return undefined;
			}
			return this.map[from][to];
		} else {
			return this.map[from] || {};
		}
	}
	gen(start) {
		let parent = [start];
		let visited = [start];
		let nodes = [];
		while (parent.length > 0) {
			let curr = parent.at(-1);
			visited.push(curr);
			let possible = Object.getOwnPropertyNames(this.lookup(curr)).filter(node => !visited.includes(node));
			if (possible.length === 0) {
				parent.pop();
			} else {
				let next = possible[Math.floor(Math.random() * possible.length)];
				parent.push(next);
				nodes.push([curr, next]);
			}
		}
		return nodes;
	}
}

class Vector2d {
	constructor(a, b) {
		[this.x, this.y] = [a, b];
	}
	get asList() {return [this.x, this.y];}
  	get magnitude() {return Math.sqrt(this.x**2+this.y**2);}
	get angle() {return Math.atan2(this.y, this.x);}
	plus(other) {
		return new Vector2d(this.x + other.x, this.y + other.y);
	}
	minus(other) {
		return new Vector2d(this.x - other.x, this.y - other.y);
	}
	timesScalar(n) {
		return new Vector2d(this.x * n, this.y * n);
	}
	unit() {
		return new Vector2d(this.x/this.magnitude, this.y/this.magnitude);
	}
	dot(other) {
		return this.asList.map((val, idx) => other.asList[idx] * val).reduce((a, b) => a+b);
	}
}

class Button {
	static buttons = [];
	constructor(left, top, width, height, fill, text, event=function(){}) {
		this.props = {left, top, width, height, fill, text, event};
		Button.buttons.push(this);
		this.visible = true;
	}
	isHovering(x, y) {
		return this.visible && x >= this.props.left && x <= this.props.left + this.props.width && y >= this.props.top && y <= this.props.top + this.props.height;
	}
	draw() {
		ctx.beginPath();
		ctx.fillStyle = this.isHovering(...mousePos) ? "grey" : this.props.fill;
		ctx.roundRect(this.props.left, this.props.top, this.props.width, this.props.height, 3);
		ctx.fill();
		ctx.textAlign = "center";
		ctx.textBaseline = 'middle';
		text(ctx, this.props.text.value, this.props.left+this.props.width/2, this.props.top+this.props.height/2, this.props.text.font, "black");
		ctx.textBaseline = 'alphabetic';
		if (this.isHovering(...mousePos)) cursor("pointer");
	}
}

class Slider {
	static sliders = [];
	constructor(leftX, y, rightX, textFn) {
		this.currX = rightX;
		this.dragging = false;
		Object.assign(this, {leftX, y, rightX, textFn});
		Slider.sliders.push(this);
	}
	get percent() {
		return (this.currX-this.leftX)/(this.rightX-this.leftX);
	}
	isHovering(x, y) {
		return getDistance(x, y, this.currX, this.y) < 10;
	}
	update() {
		if (!mouseDown) this.dragging = false;
		if (this.dragging) {
			this.currX = clamp(mousePos[0], this.leftX, this.rightX);
		}
	}
	draw() {
		ctx.strokeStyle = "rgb(100, 100, 100)";
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.roundRect(this.leftX, this.y-2, this.rightX-this.leftX, 4, 2);
		ctx.stroke();
		if (this.dragging) cursor("grabbing");
		else if (this.isHovering(...mousePos)) cursor("grab");
		circle(ctx, [this.currX, this.y], 10, this.dragging ? "rgb(20, 20, 20, 0.8)" : this.isHovering(...mousePos) ? "rgb(20, 20, 20, 0.6)" : "rgb(176, 176, 176, 1)");
		ctx.textAlign = "center";
		text(ctx, this.textFn(this.percent), (this.leftX+this.rightX)/2, this.y-20, "15px Helvetica");
	}
}

function cursor(type) {
	canvas.style.cursor = type;
}

let mousePos = [0, 0], mouseDown = false, mouseSens = 1, globalVolume = 1;

function getDistance(a, b, c, d) {
	return Math.sqrt((a-c)**2+(b-d)**2);
}

function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

function load(url) {
	let img = new Image();
	img.src = url; img.hasLoaded = false;
	img.onload = () => img.hasLoaded = true;
	return img;
}
let audio = (url) => {
	let el = document.createElement("audio");
	el.src = url;
	return el;
}

function text(ctx, value, x, y, font, color="black") {
	ctx.font = font; ctx.fillStyle = color;
	ctx.fillText(value, x, y);
}

function drawShape(ctx, pts, fill, border, width=0) {
	let old = [ctx.fillStyle, ctx.strokeStyle, ctx.lineWIdth];
	if (pts.length < 3) return;
	ctx.beginPath();
	ctx.fillStyle = fill;
	ctx.strokeStyle = border;
	ctx.lineWidth = width;
	ctx.moveTo(pts[0][0], pts[0][1]);
	for (let i = 1; i < pts.length; i++) {
		ctx.lineTo(pts[i][0], pts[i][1]);
	}
	ctx.lineTo(pts[0][0], pts[0][1]);
	ctx.closePath();
	ctx.fill();
	if (border !== undefined) ctx.stroke();
}
function circle(ctx, pos, size, fill) {
	ctx.beginPath();
	ctx.fillStyle = fill;
	ctx.arc(pos[0], pos[1], size, 0, 2 * Math.PI);
	ctx.fill();
}
function clear(canvas) {
	let ctx = canvas.getContext("2d");
	ctx.beginPath();
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.closePath();
}

let sounds = [];

function playSound(obj, volume=1, time=0) {
	let audio = obj.cloneNode(true);
	audio.currentTime = time;
	audio.volume = volume*globalVolume;
	audio.play();
	sounds.push(audio);
}

function onLock(resume=false) {
	if (gameState === "menu") {
		if (!resume) {
			setup();
			sounds = [];
		}
	}
	gameState = "playing";
	sounds.forEach(sound => sound.play());
	mouseDown = false;
	keys = Object.create(null);
}
function startGame(resume=false) {
	if (document.hasFocus()) {
		let req = canvas.requestPointerLock();
		document.addEventListener("pointerlockchange", function temp() {
			onLock(resume);
			document.removeEventListener("pointerlockchange", temp);
		});
	}
}

canvas.addEventListener("contextmenu", function(e) {
	e.preventDefault();
});

canvas.addEventListener("mousedown", function(e) {
	if (document.pointerLockElement !== null) {
		if (e.which === 1) {
			onMousePress();
			mouseDown = true;
		} else {
			onRightClick();
		}
	} else if (gameState === "menu") {
		onMousePress();
		mouseDown = true;
		for (let slider of Slider.sliders) {
			if (slider.isHovering(...mousePos)) {
				slider.dragging = true;
			}
		}
	} else if (gameState === "paused") {
		startGame();
	} else if (gameState === "premenu") {
		gameState = "menu";
	}
});
document.addEventListener("mouseup", function(e) {
	if (gameState === "playing") {
		onMouseUp();
	}
	mouseDown = false;
});
canvas.addEventListener("mousemove", function(e) {
	if (gameState === "playing") {
		onMouseMove(e.movementX*mouseSens, e.movementY*mouseSens);
	}
	let cvsBdngRect = canvas.getBoundingClientRect();
	mousePos = [e.clientX - cvsBdngRect.left, e.clientY - cvsBdngRect.top];
});
let keys = {};
document.addEventListener("keydown", function(e) {
	if (gameState === "playing") {
		keys[e.key.toLowerCase()] = true;
		onKeyPress(e.key.toLowerCase());
		if (e.key.toLowerCase() === "p") {
			document.exitPointerLock();
		}
	}
	if (e.key === "m" && ["paused", "playing"].includes(gameState)) {
		gameState = "menu";
		if (!animating) {
			resume.visible = true;
		} else {
			animating = false;
			resume.visible = false;
		}
	}
});
document.addEventListener("keyup", function(e) {
	delete keys[e.key.toLowerCase()];
});

function onMouseMove() {}
function onKeyHold() {}
function onKeyPress() {}
function onMousePress() {}
function onMouseUp() {}
function onRightClick() {}
function frame() {}
function onPause() {}

let menuImages = [];

function menu() {
	clear(canvas);
	for (let button of Button.buttons) {
		if (button.visible) button.draw();
	}
	for (let slider of Slider.sliders) {
		slider.update();
		slider.draw();
	}
	mouseSens = sens.percent;
	globalVolume = volumeSlider.percent;
	for (let image of menuImages) {
		if (image.image.hasLoaded) ctx.drawImage(image.image, image.left, image.top, ...(image.width !== undefined && image.height !== undefined ? [image.width, image.height] : []));
	}
}

let gameState = "premenu", animating = false, frames = 0;
let menuMusic = audio("assets/menu.mp3") /*cs:go menu music*/;

let flame = load("assets/flame.png"), logo = load("assets/logo.png");

let frameInterval = setInterval(function() {
	cursor("auto");
	if (gameState === "premenu") {
		if (flame.hasLoaded) ctx.drawImage(flame, 0, 0, canvas.width, canvas.height);
		if (logo.hasLoaded) ctx.drawImage(logo, 0, 0, canvas.width, canvas.height);
	}
	if (gameState === "menu") {
		sounds.forEach(sound => sound.pause());
		if (document.pointerLockElement !== null) {
			document.exitPointerLock();
		}
		menu();
		if (menuMusic.paused) {
			menuMusic.play();
		}
		menuMusic.volume = globalVolume;
	}
	if (!animating && gameState === "playing" && document.pointerLockElement === null) {
		gameState = "paused";
		sounds.forEach(sound => sound.pause());
		onPause();
	}
	if (gameState === "playing") {
		menuMusic.pause();
		menuMusic.currentTime = 0;
		frames++;
		if (Object.getOwnPropertyNames(keys).length > 0) {
			onKeyHold(keys);
		}
		frame();
		sounds.forEach((sound, idx) => {
			if (sound.duration <= sound.currentTime) {
				sounds.splice(idx, 1);
			}
		});
	}
}, 50);
