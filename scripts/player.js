/*
 *	Robocup TXT player
 *	Copyright 2012: Edward Moore, Oliver Obst, Mikhail Prokopenko
 *	Copyright 2015: Stefan Glaser
 *	
 *	A javascript program that will read a file on the server that has been processed by the rcg2replay converter.
*/

// General constants
var AUTO_RESIZE 		= true;
var PLAYER_STATES = Object.freeze({ERROR: -1, EMPTY: 0, LOADING: 1, PAUSE: 2, PLAY: 3});
var LINES_PER_CYCLE		= 24;		// 2 info + 22 player lines
var CANVAS_WIDTH		= 800;		// The width of the 2D canvas
var CANVAS_HEIGHT		= 500;		// The height of the 2D canvas
var SCALING	 			= 7.0;		// The scaling from pixels to field coordinates
var FIELD_RATIO			= 1.6;		// The ratio of the field
var REAL_FIELD_WIDTH	= 120.0;	// The real field width (in meter with field border)
var PLAYER_SIZE			= 7;		// The render size of a player
var CBG					= 40;		// Cycles Before Goal - the precending offset when jumping to goals

var LOG_PREFIX			= "";		// Dynamically read from the loaded document (once)
var LOCATION_PREFIX		= "";		// Dynamically generated from the window.location object (once)

// Loading indicator
var LOADING_BARS	= 13;			// The number of loading bars
var LOADING_TRAIL	= 9;			// The number of loading bars along the color gradient is distributed
var loadingStep		= 0;			// A counter, counting the cycles since we started loading

// Error indicator
var errorString		= "Some error!";

// Rendering definitions
var L_COLOUR	= "#FFFF00";
var LG_COLOUR 	= "#8B008B";
var R_COLOUR	= "#FF0000";
var RG_COLOUR	= "#7FFF00";
var B_COLOUR	= "#FFFFFF";

// Variables
var goalsLeft	= 0;				// The number of goals of the left team
var goalsRight	= 0;				// The number of goals of the right team
var teamLeft	= "LEFT";			// The name of the left team
var teamRight	= "RIGHT";			// The name of the right team
var context;						// The 2D rendering context
var replayData;						// The replay-file data array
var replayIdx 	= 0;				// The current index within the replay-file data array
var replaySize	= 0;				// The number of cycles in the replay-file data array
var intervalID;						// The ID of the interval object (the player thread)
var playerState	= PLAYER_STATES.EMPTY;	// The state of the player
var filePath	= "";				// The currently selected remote file path
var gameName	= "";				// The name of the currently selected replay file
var jqGameXHR;						// The ajax request for loading the replay file (for aborting)

// General settings
var AUTOLOAD_REPLAY_FILES	= false;	// Automatically load replay files on selection
var AUTOPLAY_REPLAY_FILES	= false;	// Automatically play replay files on selection



// ========== Settings functions ==========
function toggleAutoLoad()
{
	AUTOLOAD_REPLAY_FILES = !AUTOLOAD_REPLAY_FILES;
	document.getElementById('autoloadCheckBox').checked = AUTOLOAD_REPLAY_FILES;
}

function toggleAutoPlay()
{
	AUTOPLAY_REPLAY_FILES = !AUTOPLAY_REPLAY_FILES;
	document.getElementById('autoplayCheckBox').checked = AUTOPLAY_REPLAY_FILES;
}



// ========== General functions ==========
function InitPlayer()
{
	// Fetch log prexix
	LOG_PREFIX = document.getElementById("baseFolder").value;
	console.log("Logfile prefix: " + LOG_PREFIX);
	LOCATION_PREFIX = document.location.protocol + '//' + document.location.host + document.location.pathname;
	console.log("Player location: " + LOCATION_PREFIX);

	// Fetch render context
	var field = document.getElementById("field");
	context = field.getContext("2d");
	field.addEventListener("keydown", canvasKeyAction, true);

	// Fetch initial file path
	updateFilePath();

	// Initialize settings menu
	document.getElementById('autoloadCheckBox').checked = AUTOLOAD_REPLAY_FILES;
	document.getElementById('autoplayCheckBox').checked = AUTOPLAY_REPLAY_FILES;

	// Autoresize components
	if (AUTO_RESIZE) {
		window.onresize = onWindowResize;
		onWindowResize();
	}
	resizeDDMenus();
	
	// Render contents
	renderContents();
}

function onWindowResize() {
	var width = window.innerWidth || (window.document.documentElement.clientWidth || window.document.body.clientWidth);
	var height = window.innerHeight || (window.document.documentElement.clientHeight || window.document.body.clientHeight);
	var naviHeight = document.getElementById('navi_box').offsetHeight;
	var gameInfoHeight = document.getElementById('cycles').offsetHeight;
	var controlsHeight = document.getElementById('controls_box').offsetHeight;

	width -= 2; // subtract left/right border
	var remainingHeight = height - naviHeight - gameInfoHeight - controlsHeight - 1;
  
	if (width > remainingHeight * FIELD_RATIO) {
		CANVAS_WIDTH = parseInt(remainingHeight * FIELD_RATIO);
		CANVAS_HEIGHT = parseInt(remainingHeight);
	} else {
		CANVAS_WIDTH = parseInt(width);
		CANVAS_HEIGHT = parseInt(width / FIELD_RATIO);
	}

	// Resize body-box, canvas and ddMenu max-height
	var body_box = document.getElementById('body_box');
	var canvas = document.getElementById('field');
	body_box.style.width = "" + CANVAS_WIDTH + "px";
	canvas.width = CANVAS_WIDTH;
	canvas.height = CANVAS_HEIGHT;
	canvas.style.width = "" + CANVAS_WIDTH + "px";
	canvas.style.height = "" + CANVAS_HEIGHT + "px";
	resizeDDMenus();

	SCALING = CANVAS_WIDTH / REAL_FIELD_WIDTH;
	PLAYER_SIZE = SCALING;

	renderContents();
}

function resizeDDMenus() {
	$('ul.ddMenu ul').css('max-height', CANVAS_HEIGHT + 20);
}



// ========== Player Controls ==========
function Play() {
	if (playerState == PLAYER_STATES.PAUSE) {
		setPlayerState(PLAYER_STATES.PLAY);
	}
}

function Pause() {
	if (playerState == PLAYER_STATES.PLAY) {
		setPlayerState(PLAYER_STATES.PAUSE);
	}
}

function PlayPause()
{
	if (playerState == PLAYER_STATES.PAUSE) {
		setPlayerState(PLAYER_STATES.PLAY);
	} else if (playerState == PLAYER_STATES.PLAY) {
		setPlayerState(PLAYER_STATES.PAUSE);
	}
}

function Restart()
{
	if (isPlayerActive()) {
		Pause();
		replayIdx = 0;
		renderContents();
	}
}

function PlayOne()
{
	if (isPlayerActive()) {
		incrementReplayIndex();
		renderContents();
	}
}

function RPlayOne()
{
	if (isPlayerActive()) {
		decrementReplayIndex();
		renderContents();
	}
}

function End()
{
	if (isPlayerActive()) {
		Pause();
		replayIdx = replaySize - 1;
		renderContents();
	}
}

function PrevGoal()
{
	if (isPlayerActive()) {
		if (replayIdx > 0) {
			var line = replayData[1 + (replayIdx * LINES_PER_CYCLE)].split(" ");
			if (line.length > 1) {
				var goalPreviously = line[2] == "goal_l" || line[2] == "goal_r";
        
				for (var i = replayIdx - 1; i > 0; i--) {
					line = replayData[1 + (i * LINES_PER_CYCLE)].split(" ");
					var goalNow = line[2] == "goal_l" || line[2] == "goal_r";
					if (goalPreviously && !goalNow) {
						Pause();
						replayIdx = i - CBG;
						renderContents();
						return;
					}

					goalPreviously = goalNow;
				}
			}
		}

		window.status = "No next goals found.";
	}
}

function NextGoal()
{
	if (isPlayerActive()) {
		var i = replayIdx + CBG + 1;

		if (i < replaySize - 1) {
			var line = replayData[1 + (i * LINES_PER_CYCLE)].split(" ");
			if (line.length > 1) {
				var goalPreviously = line[2] == "goal_l" || line[2] == "goal_r";
				i++;
        
				for (; i < replaySize; i++) {
					line = replayData[1 + (i * LINES_PER_CYCLE)].split(" ");
					var goalNow = line[2] == "goal_l" || line[2] == "goal_r";
					if (!goalPreviously && goalNow) {
						Pause();
						replayIdx = i - CBG;
						renderContents();
						return;
					}

					goalPreviously = goalNow;
				}
			}
		}

		window.status = "No next goals found.";
	}
}


function jumpToCycle(value)
{
	if (isPlayerActive()) {
		replayIdx = parseInt(value);
		renderContents();
	}
}

function canvasAction()
{
	if (isPlayerActive()) {
		PlayPause();
	}else if (playerState == PLAYER_STATES.LOADING) {
		jqGameXHR.abort();
	} else if (playerState == PLAYER_STATES.EMPTY && gameName != "") {
		LoadReplay();
	}
}

function canvasKeyAction(e)
{
	switch (e.keyCode) {
		case 37:
		case 65:
			RPlayOne();
			break;
		case 39:
		case 68:
			PlayOne();
			break;
		case 40:
		case 83:
			PrevGoal();
			break;
		case 38:
		case 87:
			NextGoal();
			break;
		case 32:
		case 13:
			PlayPause();
			break;
		case 34:
			Restart();
			break;
		case 33:
			End();
			break;
		default:
			break;
	}
}

function LoadReplay()
{
	if (filePath == null || filePath == "" || filePath.indexOf(".replay", filePath.length - 7) === -1) {
		setPlayerState(PLAYER_STATES.EMPTY);
		return;
	}

	// Set the player state to "loading"
	setPlayerState(PLAYER_STATES.LOADING);

	// Load the Game
	jqGameXHR = $.ajax({
		url: LOG_PREFIX + filePath,
		dataType: "text",
		async: true,
		cache: true,
		type: "GET",
		success: function(data) {
			if (data != null && data.slice(0, 2) == "T ") {
				console.log("Received replay data.");
				replayData = data.split("\n");

				// Set Slider size
				replaySize = (replayData.length - (replayData.length % LINES_PER_CYCLE)) / LINES_PER_CYCLE;
				replayIdx = 0;
				var slider = document.getElementById("cycleSlider");
				slider.max = replaySize - 1;
				slider.value = 0;

				//Get the team info (assumed to be in first line)
				teamLeft = replayData[0].split(" ")[1].slice(1, -1);
				teamRight = replayData[0].split(" ")[2].slice(1, -1);

				if (AUTOPLAY_REPLAY_FILES) {
					setPlayerState(PLAYER_STATES.PLAY);
				} else {
					setPlayerState(PLAYER_STATES.PAUSE);
				}
			} else {
				console.log("Received empty/invalid data.");
				erorString = "Invalid replay data!";
				setPlayerState(PLAYER_STATES.ERROR);
			}
		},
		error: function(jqXHR, textStatus, errorThrown) {
			if (errorThrown == "abort") {
				setPlayerState(PLAYER_STATES.EMPTY);
			} else {
				console.log("ERROR: " + errorThrown);
				errorString = "Ajax: " + errorThrown;
				setPlayerState(PLAYER_STATES.ERROR);
			}
		}
	});
}

function setPlayerState(newState)
{
	if (playerState != newState) {
		var previousState = playerState;
		playerState = newState;

		switch(playerState) {
			case PLAYER_STATES.LOADING:
				document.getElementById("ppBtn").innerHTML = "<span class=\"ui-icon ui-icon-play\"></span>";
				resetPlayer();
				startInterval();
				break;
			case PLAYER_STATES.PLAY:
				document.getElementById("ppBtn").innerHTML = "<span class=\"ui-icon ui-icon-pause\"></span>";
				startInterval();
				break;
			case PLAYER_STATES.ERROR:
			case PLAYER_STATES.EMPTY:
				resetPlayer();
			case PLAYER_STATES.PAUSE:
			default:
				document.getElementById("ppBtn").innerHTML = "<span class=\"ui-icon ui-icon-play\"></span>";
				stopInterval();
				break;
		}
	}

	renderContents();
}

function resetPlayer()
{
	goalsLeft = 0;
	goalsRight = 0;
	teamLeft = "LEFT";
	teamRight = "RIGHT";
	document.getElementById("cycles").innerHTML = "0";
	document.getElementById("cycleSlider").value = 0;
}

function isPlayerActive()
{
	return playerState == PLAYER_STATES.PLAY || playerState == PLAYER_STATES.PAUSE;
}

function incrementReplayIndex()
{
	if (replayIdx < replaySize - 1) {
		replayIdx++;
	} else {
		replayIdx = replaySize - 1;
	}
}

function decrementReplayIndex()
{
	if (replayIdx > 0) {
		replayIdx--;
	} else {
		replayIdx = 0;
	}
}

function startInterval()
{
	if (!intervalID) {
		intervalID = setInterval(function()
		{
			incrementReplayIndex();
			loadingStep++;
			renderContents();
		}, 100);
	}
}

function stopInterval()
{
	if (intervalID) {
		clearInterval(intervalID);
		intervalID = false;
	}
}



// ========== 2D Rendering ==========
function renderContents()
{
	document.getElementById("Lteam").innerHTML = teamLeft + "&nbsp;&nbsp;" + goalsLeft;
	document.getElementById("Rteam").innerHTML = teamRight + "&nbsp;&nbsp;" + goalsRight;
	document.getElementById("cycleSlider").value = replayIdx;

	// Clear canvas
	context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
	
	if (playerState == PLAYER_STATES.PLAY || playerState == PLAYER_STATES.PAUSE) {
		// Render game content
		context.save();
		context.translate(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5);
		var idx = 1 + (replayIdx * LINES_PER_CYCLE);
		for (var i = 0; i < LINES_PER_CYCLE; i++) {
			MakeMove(replayData[idx + i]);
		}
		context.restore();
	} else {
		// Render overlay background
		context.save();
		context.fillStyle = "rgba(0, 0, 0, 0.5)";
		context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		context.restore();
	}
	
	if (playerState == PLAYER_STATES.PAUSE && replayIdx == 0) {
		// Render controls overlay background (lower 40%)
		context.save();
		context.fillStyle = "rgba(0, 0, 0, 0.5)";
		context.fillRect(0, CANVAS_HEIGHT * 0.6, CANVAS_WIDTH, CANVAS_HEIGHT * 0.4);
		context.restore();
	}

	context.save();
	context.translate(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5);
	switch(playerState) {
		case PLAYER_STATES.LOADING:
			context.save();
			loadingStep %= LOADING_BARS;
			context.lineCap = 'round';
			context.lineWidth = SCALING * 0.9;
			context.strokeStyle = "#eee";
			var step = -2 * Math.PI / LOADING_BARS;
			context.rotate(parseInt(-loadingStep) * step);
			for (var i = 0.0; i < LOADING_BARS; i++) {
				var trailProgress = i / LOADING_TRAIL;
				if (trailProgress < 1) {
					var progress = 80 + parseInt((1 - (i / LOADING_TRAIL)) * 150);
					context.strokeStyle = "rgb(" + progress + ", " + progress + ", " + progress + ")"; 
				}
				context.beginPath();
				context.moveTo(0, 4 * SCALING);
				context.lineTo(0, 7 * SCALING);
				context.stroke();
				context.rotate(step);
			}
			context.restore();

			// Draw replay name
			context.fillStyle = "#FFFFFF";
			context.textAlign = "center";
			context.font = "" + (3 * SCALING) + "pt sans-serif";
			context.fillText("Click to abort", 0, -12 * SCALING);
			context.font = "" + (2.5 * SCALING) + "pt sans-serif";
			context.fillText("loading: ", 0, 14 * SCALING);
			context.font = "" + (2 * SCALING) + "pt sans-serif";
			context.fillText(gameName, 0, 18 * SCALING);
			break;
		case PLAYER_STATES.PAUSE:
			if (replayIdx == 0) {
				context.fillStyle = "#FFFFFF";
				context.textAlign = "center";
				context.font = "" + (2 * SCALING) + "pt sans-serif";
				
				var shift = 15 * SCALING;
				var yShift = 12 * SCALING;
				var yStep = 3 * SCALING;
				context.fillText("Controls:", 0, yShift);
				yShift += yStep + SCALING;
				context.font = "" + (1.5 * SCALING) + "pt sans-serif";
				context.fillText("SPACE, ENTER, Click", -shift, yShift);
				context.fillText("Toggle Play / Pause", shift, yShift);
				yShift += yStep;
				context.fillText("LEFT, A", -shift, yShift);
				context.fillText("Step backwards", shift, yShift);
				yShift += yStep;
				context.fillText("RIGHT, D", -shift, yShift);
				context.fillText("Step forwards", shift, yShift);
				yShift += yStep;
				context.fillText("UP, W", -shift, yShift);
				context.fillText("Jump to next goal", shift, yShift);
				yShift += yStep;
				context.fillText("DOWN, S", -shift, yShift);
				context.fillText("Jump to previous goal", shift, yShift);
				yShift += yStep;
				context.fillText("PIC-UP", -shift, yShift);
				context.fillText("Jump to end", shift, yShift);
				yShift += yStep;
				context.fillText("PIC-DOWN", -shift, yShift);
				context.fillText("Jump to begin", shift, yShift);
			}
			break;
		case PLAYER_STATES.ERROR:
			context.fillStyle = "#FFFFFF";
			context.font = "" + (3 * SCALING) + "pt sans-serif";
			context.textAlign = "center";
			context.fillText("An error occurred!", 0, 1.5 * SCALING);
			context.font = "" + (1.5 * SCALING) + "pt sans-serif";
			context.fillText(errorString, 0, 6 * SCALING);
			break;
		case PLAYER_STATES.EMPTY:
			context.fillStyle = "#FFFFFF";
			context.font = "" + (3 * SCALING) + "pt sans-serif";
			context.textAlign = "center";

			if (gameName != "") {
				context.fillText("Click to load:", 0, -1.5 * SCALING);

				context.font = "" + (2 * SCALING) + "pt sans-serif";
				context.fillText(gameName, 0, 5 * SCALING);
			} else {
				context.fillText("Select a game to play", 0, 1.5 * SCALING);
			}
		case PLAYER_STATES.PLAY:
		default:
			break;
	}
	context.restore();
}

function MakeMove(fileString)
{
	//Split the string into commands
	var line = fileString.split(" ");

	/*
		line[0] = T | S | b | l | L | r | R
		line[1] = stNum | Bl_x | PL_TM
		line[2] = StNam | Bl_y | PL_NUM
		line[3] =		|	   | PL_X
		line[4] =       |      | PL_Y
		line[5] =              | PL_STAMINA
	*/


	if(line[0] == "S") {
		document.getElementById("cycles").innerHTML = line[2] + "&nbsp;&nbsp;" + line[1];

		if (goalsLeft == line[3] && goalsRight == line[4]) {
		    timeout = false;
		} else {
		    goalsLeft = line[3];
		    goalsRight = line[4];
		    document.getElementById("Lteam").innerHTML = teamLeft + "&nbsp;&nbsp;" + goalsLeft;
		    document.getElementById("Rteam").innerHTML = teamRight + "&nbsp;&nbsp;" + goalsRight;
		    timeout = true;
		}
	} else if(line[0] == "b") {
		context.fillStyle = B_COLOUR;
		context.beginPath();
		context.arc(line[1] * SCALING, line[2] * SCALING, PLAYER_SIZE - 2, 0, Math.PI * 2, true);
		context.closePath();
		context.fill();
	} else if(line[0] == "l" || line[0] == "r" || line[0] == "L" || line[0] == "R" ) {

		if (line[0] == "R") {
		    context.fillStyle = RG_COLOUR;
		} else if (line[0] == "r") {
		    context.fillStyle = R_COLOUR;
		} else if (line[0] == "L") {
		    context.fillStyle = LG_COLOUR;
		} else if (line[0] == "l") {
		    context.fillStyle = L_COLOUR;
		}

		context.beginPath();
		context.arc(line[2] * SCALING, line[3] * SCALING, PLAYER_SIZE, 0, Math.PI * 2, true);
		context.closePath();
		context.fill();

		var ang0 = parseFloat(line[4]);
		var ang1 = ang0;
		if (line.length > 5) {
			ang1 = parseFloat(line[5]);
		}
		var x0 = line[2] * SCALING;
		var y0 = line[3] * SCALING;
		var x1 = x0 + PLAYER_SIZE * Math.cos(toRad(ang1));
		var y1 = y0 + PLAYER_SIZE * Math.sin(toRad(ang1));

		if (line.length > 6) {
			context.fillStyle = toGreyRGB(line[6]);
		}
		context.beginPath();
		context.arc(x0, y0, PLAYER_SIZE, toRad(-90.0 + ang0), toRad(90.0 + ang0), true);		
		context.closePath();
		context.fill();

		context.strokeStyle = "#000000";
		context.beginPath();
		context.moveTo(x0, y0);
		context.lineTo(x1, y1);
		context.stroke();	      

		context.fillStyle = "#FFFFFF";
	  	context.font = "" + SCALING + "pt sans-serif";
		context.fillText(line[1], line[2] * SCALING + (PLAYER_SIZE * 1.1), line[3] * SCALING);
	} else if (line[0] == "T") {
	} else {
		console.log("ERROR: (" + line[0] + ") " + fileString);
		Pause();
	}
}

function toRad(angle)
{
	if (angle<0) angle += 360.0;
	if (angle>360) angle -= 360.0;

	return Math.PI * angle / 180.0;
}

function toGreyRGB(stamina)
{
	if (stamina.slice(0, 1) == "#") {
		stamina = stamina.slice(1);
	}
	var max = 8000.0;
	var step = max / 256.0;
	val = Math.min(parseFloat(stamina), max);
	val = Math.min(Math.floor((max - val) / step), 255);
	grey = val.toString(16);
	grey = grey.length == 1 ? "0" + grey : grey;

	return "#" + grey + grey + grey;
}



// ========== File Navigation ==========
function updateFilePath()
{
	var newFilePath = "";

	var naviItems = document.getElementById("fileNavi").childNodes;
	for (i = 0; i < naviItems.length; i++) {
		if (naviItems[i].nodeName == "LI") {
			newFilePath += naviItems[i].getElementsByTagName('input')[0].value;
		}
	}
	
	if (filePath != newFilePath) {
		filePath = newFilePath;

		var dlLink = document.getElementById("downloadLink");
		if (filePath.indexOf(".replay", filePath.length - 7) !== -1) {
			gameName = filePath.substring(filePath.lastIndexOf("/") + 1, filePath.lastIndexOf("."));
			dlLink.className = "visibleItem";
			dlLink.href = LOG_PREFIX + filePath;
		} else {
			gameName = "";
			dlLink.className = "hiddenItem";
			dlLink.href = "";
		}
		
		window.history.replaceState('', document.title, LOCATION_PREFIX + "?path=" + filePath);
	}
}

function getNaviItem(fileNavi, link)
{
	var current = link;
	while (current != null && current.parentNode != fileNavi) {
		current = current.parentNode;
	}

	return current;
}

function getParentLIElement(element)
{
	var current = element;
	while (current != null && current.nodeName != "LI") {
		current = current.parentNode;
	}

	return current;
}

function getLastNaviItem(navi)
{
	var naviItems = navi.childNodes;
	var idx = naviItems.length - 1;
	while (idx > 0 && naviItems[idx].nodeName != "LI") {
		idx--;
	}

	return naviItems[idx];
}

function onLinkAction(navi, link, itemClass)
{
	var linkNaviItem = getNaviItem(fileNavi, link);
	
	linkNaviItem.className = itemClass;
	
	var linkSpan = linkNaviItem.getElementsByTagName('span')[0];
	if (linkSpan.innerHTML != link.innerHTML) {
		var linkInput = linkNaviItem.getElementsByTagName('input')[0];
		var linkValue = getParentLIElement(link).getElementsByTagName('input')[0].value;	
		
		linkSpan.innerHTML = link.innerHTML;
		linkInput.value = linkValue;

		var naviItems = fileNavi.childNodes;
		// Search for the index of the navi item containing the passed link
		var idx = 0;
		while (idx < naviItems.length - 1 && naviItems[idx] != linkNaviItem) {
			idx++;
		}

		// Clear all sub navis after this link
		while (naviItems.length > idx + 1) {
			fileNavi.removeChild(naviItems[idx + 1]);
		}

		// Update the file path resulting from the new menu state
		updateFilePath();

		return true;
	}

	return false;
}

function folderSelect(link)
{
	var fileNavi = document.getElementById("fileNavi");
	if (onLinkAction(fileNavi, link, "naviFolder")) {
		setPlayerState(PLAYER_STATES.EMPTY);
		
		fileNavi.innerHTML += "<li class=\"naviDisabled\"><input type=\"hidden\" value=\"\" /><span>loading...</span><ul style=\"max-height:" + (CANVAS_HEIGHT + 20) + "px\"></ul></li>";

		$.ajax({
			url: "player-ajax.php",
			data: "path=" + filePath,
			type: "GET",
			dataType: "json",
			success: function(data) {
				var fileNavi = document.getElementById("fileNavi");
				var lastNaviItem = getLastNaviItem(fileNavi);
				var newSubNavi = "";
				var naviTitle = "No replays available";
				var naviClass = "naviDisabled";
				var autoLoad = false;

				if (data != null && data['folders'].length + data['replays'].length > 0) {
					naviTitle = "Please Select";
					naviClass = "naviEmpty";
	
					for (i = 0; i < data['folders'].length; i++) {
						newSubNavi += "<li><input type=\"hidden\" value=\"" + data['subPath'] + "/" + data['folders'][i] + "\" />"
										+ "<a href=\"javascript:void(0);\" onClick=\"folderSelect(this)\">" + data['folders'][i] + "</a></li>";
					}
					for (i = 0; i < data['replays'].length; i++) {
						newSubNavi += "<li><input type=\"hidden\" value=\"" + data['subPath'] + "/" + data['replays'][i] + "\" />"
										+ "<a href=\"javascript:void(0);\" onClick=\"replaySelect(this)\">" + data['replays'][i] + "</a></li>";
					}
				}

				// Update navi title and sub menu
				lastNaviItem.className = naviClass;
				lastNaviItem.getElementsByTagName('span')[0].innerHTML = naviTitle;
				lastNaviItem.getElementsByTagName('ul')[0].innerHTML = newSubNavi;
			},
			error: function(xhr, status, errorThrown) {
				console.log("Error: " + errorThrown);
				console.log("Status: " + status);
				console.dir(xhr);
			}
		});
	}

	renderContents();
}

function replaySelect(link)
{
	var fileNavi = document.getElementById("fileNavi");
	if (onLinkAction(fileNavi, link, "naviReplay")) {
		if (AUTOLOAD_REPLAY_FILES) {
			LoadReplay();
		} else {
			setPlayerState(PLAYER_STATES.EMPTY);
		}
	}
}
