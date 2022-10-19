import hints from './hints.json' assert {type: 'json'};
import images from './images.json' assert {type: 'json'};
import config from './config.json' assert {type: 'json'};
const imageFiles = new Map();
const imageNames = new Array();
const currentImageHints = new Array();
const canvas = document.getElementById("canvas");
const width = canvas.getBoundingClientRect().width;
const height = canvas.getBoundingClientRect().height;
const aspect = width/height;
const font = new FontFace("bilbo", "url(BilboSwashCaps-Regular.ttf)");
const slideTime = config.slideTime;
const hintTime = config.hintTime;
var currentHint = "";
var currentHintIndex = 0;
var hintChangedThisFrame = false;
var imageChangedThisFrame = false;
var imageName = "";
var currentImageTitle = "";
var currentImageLicense = "";

const displayImage = {
	// This object contains the current image's display properties
	img: null,
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	w_orig: 0,
	h_orig: 0,
	a: 1
};
const imageAnimation = {
	// This object contains the current animation data
	startTime: new Date(),
	animationFunction: staticAnim
};

const nearMatchAnimations = new Map(Object.entries({
	"zoomIn": zoomInAnim,
	"zoomOut": zoomOutAnim
}));

const portraitAnimations = new Map(Object.entries({
	"panDown": panDownAnim,
	"panUp": panUpAnim
}));

const landscapeAnimations = new Map(Object.entries({
	"panLeft": panLeftAnim,
	"panRight": panRightAnim
}));

const allAnimations = new Map([...nearMatchAnimations, ...portraitAnimations, ...landscapeAnimations]);

export function start() {
	/**
	 * Sets up the canvas stuff
	 */
	console.log(`Canvas dimensions: w = ${width} h = ${height}`)
	canvas.width = width;
	canvas.height = height;
	load_images();
	canvas.getContext("2d").clearRect(0, 0, width, height);
	font.load().then( () => {
		document.fonts.add(font);
		draw();
		}
	)
}

function load_images() {
	/**
	 * Loads the image data into a map that is easier to process and has known values for every field
	 */
	images.forEach(img => {
		let imgFile = new Image();
		imgFile.src = img.file;
		let name = img.name ?? img.file;
		let hintCategories = img.categories ?? null;
		let animations = img.animations ?? null;
		let title = img.title ?? "";
		let license = img.license ?? "";
		imageFiles.set(name, {
			file: imgFile,
			categories: hintCategories,
			animations: animations,
			title: title,
			license: img.license
		});
		imageNames.push(name);
	});
	changeSlide();
	currentHintIndex = Math.floor(Math.random() * currentImageHints.length);
	currentHint = currentImageHints[currentHintIndex];
}
function draw() {
	/**
	 * The main draw loop
	 */
    const ctx = canvas.getContext("2d");
	ctx.globalAlpha = 1;
	const time = new Date();
	let textAlpha = 1;

	let elapsed = time.getTime() - imageAnimation.startTime.getTime();
	let seconds = Math.floor(elapsed/1000);
	let millis = elapsed % 1000;
	// Hint change
	if (seconds % hintTime == 0) {
		if (!hintChangedThisFrame) {
			changeHint();
		}
		textAlpha = millis / 1000;
	}
	else if (seconds % hintTime == hintTime-1) {
		textAlpha = 1.0 - (millis/1000);
	}
	else {
		hintChangedThisFrame = false;
	}
	//Image change
	if (seconds % slideTime == 0) {
		if (!imageChangedThisFrame) {
			changeSlide();
			imageChangedThisFrame = true;
		}
		displayImage.a = millis / 1000;
		textAlpha = millis / 1000;
	}
	else if (seconds % slideTime == slideTime-1) {
		displayImage.a = 1.0 - (millis / 1000);
		textAlpha = 1.0 - (millis/1000);
	}
	else {
		imageChangedThisFrame = false;
	}
	
	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
	ctx.fillRect(0, 0, width, height);
	ctx.save();

	imageAnimation.animationFunction(imageAnimation.startTime, time);

	showImage(ctx);
	drawHint(ctx, textAlpha);


	window.requestAnimationFrame(draw);
}

function changeHint() {
	/**
	 * Picks a new hint from the current selection
	 */
	let newHintIdx;
	do {
		newHintIdx = Math.floor(Math.random() * currentImageHints.length);
	} while (newHintIdx == currentHintIndex);
	currentHintIndex = newHintIdx;
	currentHint = currentImageHints[newHintIdx];
	hintChangedThisFrame = true;


}

function drawHint(ctx, alpha) {
	/**
	 * Draws the hint on the canvas
	 */
	ctx.save();
	let fontSize = Math.floor(0.05*height);
	ctx.font = `${fontSize}px bilbo`;
	ctx.textBaseline = "bottom";
	ctx.textAlign = "center";
	let x = width/2;
	let y = Math.floor(0.95*height);
	ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
	ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
	ctx.lineWidth = Math.floor(0.005*Math.max(width, height));
	ctx.lineJoin = "round";
	ctx.strokeText(currentHint, x, y);
	ctx.fillText(currentHint, x, y);
	ctx.save();
}

function changeSlide() {
	/**
	 * Changes the image
	 */
	let newImageName;
	do {
		let imageIndex = Math.floor(Math.random() * imageNames.length);
		newImageName = imageNames[imageIndex];
	} while (newImageName == imageName);
	imageName = newImageName;
	displayImage.img = imageFiles.get(imageName).file;
	displayImage.w = displayImage.w_orig = displayImage.img.width;
	displayImage.h = displayImage.h_orig = displayImage.img.height;
	imageAnimation.startTime = new Date();

	// Pick an appropriate animation
	let animationSelection = Array();
	if (imageFiles.get(imageName).animations) {
		// A list of possible animations was provided for the image, so use those
		imageFiles.get(imageName).animations.forEach((animationName) =>
			animationSelection.push(allAnimations.get(animationName))
		)
	}
	else {
		let imgAspect = displayImage.w / displayImage.h;
		if (imgAspect < aspect) {
			// The image is taller than the screen so add the vertical pans
			animationSelection.push(...(portraitAnimations.values()));
			if (imgAspect > (0.8 * aspect)) {
				// But not _that_ tall, so we could add the zoom animations
				animationSelection.push(...(nearMatchAnimations.values()));
			}
		}
		else {
			// The image is wider than the screen so add the horizontal pans
			animationSelection.push(...(landscapeAnimations.values()))
			if (imgAspect < 1.2 * aspect) {
				// But not _that_ wide, so we can add the zoom animations
				animationSelection.push(...(nearMatchAnimations.values()));
			}
		};
	}
	imageAnimation.animationFunction = animationSelection[Math.floor(Math.random() * animationSelection.length)];
	// Get the title and license
	currentImageTitle = imageFiles.get(imageName).title;
	currentImageLicense = imageFiles.get(imageName).license;
	// Get the hints
	let hintCategories = imageFiles.get(imageName).categories ?? Object.getOwnPropertyNames(hints);
	currentImageHints.length = 0;
	hintCategories.forEach(hintCat => {
		let categoryHints = hints[hintCat];
		if(categoryHints === undefined) {
			console.log("Warning: hints has no category " + hintCat);
		}
		else {
			currentImageHints.push(...(hints[hintCat]));
		}
	});
	// Pick a hint appropriate for the new image
	changeHint();
}

function showImage(ctx) {
	// Renders the image
	ctx.save();
	if(displayImage.img) {
		ctx.globalAlpha = displayImage.a;
		ctx.drawImage(displayImage.img, displayImage.x, displayImage.y, displayImage.w, displayImage.h)
		ctx.globalAlpha = 1
		if(config.vignette) vignette(ctx);
		// Also render the title in the upper right corner
		let fontSize = Math.floor(0.025*height);
		ctx.font = `${fontSize}px bilbo`;
		ctx.textBaseline = "top";
		ctx.textAlign = "right";
		let x = 0.9875 * width;
		let y = Math.floor(0.0125*height);
		ctx.fillStyle = `rgb(255, 255, 255)`;
		ctx.strokeStyle = `rgb(0, 0, 0)`;
		ctx.lineWidth = Math.floor(0.005*Math.max(width, height));
		ctx.lineJoin = "round";
		ctx.strokeText(currentImageTitle, x, y);
		ctx.fillText(currentImageTitle, x, y);
		// And the license in the upper left if there's any
		ctx.textAlign = "left";
		x = 0.0125 * width;
		ctx.fillStyle = `rgb(255, 255, 255)`;
		ctx.strokeStyle = `rgb(0, 0, 0)`;
		ctx.lineWidth = Math.floor(0.005*Math.max(width, height));
		ctx.lineJoin = "round";
		ctx.strokeText(currentImageLicense, x, y);
		ctx.fillText(currentImageLicense, x, y);
	}

	ctx.save();
	ctx.globalAlpha = 1;
}

function staticAnim(startTime, currentTime) {
	let imgLandscape = (displayImage.w_orig/displayImage.h_orig > aspect);
	let currentScale = imgLandscape ? (height / displayImage.h_orig) : (width / displayImage.w_orig);

	displayImage.w = currentScale * displayImage.w_orig;
	displayImage.h = currentScale * displayImage.h_orig;
	displayImage.x = -(displayImage.w - width)/2;
	displayImage.y = -(displayImage.h - height)/2;
}

function zoomInAnim(startTime, currentTime) {
	let diff = currentTime.getTime() - startTime.getTime();
	let animState = diff / (slideTime * 1000);
	let imgLandscape = (displayImage.w_orig/displayImage.h_orig > aspect);
	let startScale = imgLandscape ? (height / displayImage.h_orig) : (width / displayImage.w_orig);
	let endScale = config.zoomInMax * startScale;
	let currentScale = startScale + (endScale - startScale) * animState;

	displayImage.w = currentScale * displayImage.w_orig;
	displayImage.h = currentScale * displayImage.h_orig;
	displayImage.x = -(displayImage.w - width)/2;
	displayImage.y = -(displayImage.h - height)/2;
}

function zoomOutAnim(startTime, currentTime) {
	let diff = currentTime.getTime() - startTime.getTime();
	let animState = diff / (slideTime * 1000);
	let imgLandscape = (displayImage.w_orig/displayImage.h_orig > aspect);
	let endScale = imgLandscape ? (height / displayImage.h_orig) : (width / displayImage.w_orig);
	let startScale = config.zoomOutMax * endScale;
	let currentScale = startScale + (endScale - startScale) * animState;

	displayImage.w = currentScale * displayImage.w_orig;
	displayImage.h = currentScale * displayImage.h_orig;
	displayImage.x = -(displayImage.w - width)/2;
	displayImage.y = -(displayImage.h - height)/2;
}

function panDownAnim(startTime, currentTime) {
	let scale = width / displayImage.w_orig;
	let diff = currentTime.getTime() - startTime.getTime();
	let animState = diff / (slideTime * 1000);

	displayImage.w = scale * displayImage.w_orig;
	displayImage.h = scale * displayImage.h_orig;
	displayImage.x = 0;
	displayImage.y = -animState * (displayImage.h - height);
}

function panUpAnim(startTime, currentTime) {
	let scale = width / displayImage.w_orig;
	let diff = currentTime.getTime() - startTime.getTime();
	let animState = diff / (slideTime * 1000);

	displayImage.w = scale * displayImage.w_orig;
	displayImage.h = scale * displayImage.h_orig;
	displayImage.x = 0;
	displayImage.y = -(displayImage.h - height) + animState * (displayImage.h - height);
}

function panRightAnim(startTime, currentTime) {
	let scale = height / displayImage.h_orig;
	let diff = currentTime.getTime() - startTime.getTime();
	let animState = diff / (slideTime * 1000);

	displayImage.w = scale * displayImage.w_orig;
	displayImage.h = scale * displayImage.h_orig;
	displayImage.y = 0;
	displayImage.x = -animState * (displayImage.w - width);
}

function panLeftAnim(startTime, currentTime) {
	let scale = height / displayImage.h_orig;
	let diff = currentTime.getTime() - startTime.getTime();
	let animState = diff / (slideTime * 1000);

	displayImage.w = scale * displayImage.w_orig;
	displayImage.h = scale * displayImage.h_orig;
	displayImage.y = 0;
	displayImage.x = -(displayImage.w - width) + animState * (displayImage.w - width);
}

function vignette(ctx) {
	ctx.save();
	// create radial gradient
	var outerRadius = (aspect > 1 ? height : width) * .75;
	var innerRadius = (aspect > 1 ? height : width) * .2;
	var grd = ctx.createRadialGradient(width / 2, height / 2, innerRadius, width / 2, height / 2, outerRadius);
	// light blue
	grd.addColorStop(0, 'rgba(0,0,0,0)');
	// dark blue
	grd.addColorStop(1, 'rgba(0,0,0,' + 0.5 + ')');

	ctx.fillStyle = grd;
	ctx.fillRect(0, 0, width, height);
}