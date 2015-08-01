<?php
header('Content-Type: text/html');

include 'player_definitions.php';


// Check if definitions are valid
if (!file_exists(LOG_DIR)) {
  echo "Error";
  exit();
}

?>
<!DOCTYPE html>
<html>
<head>
  <title>Chaosscripting - RoboCup 2D Simulation Online RePlayer</title>
  <meta charset="utf-8">
  <script language="JavaScript" src="scripts/jquery.js"></script>
  <script language="JavaScript" src="scripts/player.js"></script>
  <link rel="stylesheet" type="text/css" href="logplay.css" />
</head>
<body>
<div id="body_box">
<div id="navi_box">
<input type="hidden" id="baseFolder" value="<?php echo LOG_DIR; ?>"/>
<nav id="configBar">
	<ul class="ddMenu configNavi">
		<li><span><div class="ui-icon ui-icon-config"></div></span><ul>
				<li><a href="javascript:void(0);" onClick="toggleAutoLoad();" title="Toggle automatic loading of replay files."><input id="autoloadCheckBox" type="checkbox" />&nbsp;Autoload&nbsp;replay&nbsp;files</a></li>
				<li><a href="javascript:void(0);" onClick="toggleAutoPlay();" title="Toggle automatic playing of replay files."><input id="autoplayCheckBox" type="checkbox" />&nbsp;Autoplay&nbsp;replay&nbsp;files</a></li>
			</ul>
		</li>
	</ul>
</nav>
<nav id="fileBar">
	<ul id="fileNavi" class="ddMenu fileNavi">
<?php
	$preSelection = array();
	if (isset($_GET['path']) && $_GET['path'] != "") {
		$preSelection = split("/", trim($_GET['path'], "/"));
	}
	echo makeFileMenu($preSelection, LOG_DIR);
?>
	</ul>
	<ul class="ddMenu fileNavi" style="float: right;">
		<li><a id="downloadLink" href="" title="Download selected replay file" target="_blank" download><div class="ui-icon ui-icon-download"></div></a></li>
	</ul>
</nav>
</div>

<div id="game_box">
  <div id="Lteam">LEFT&nbsp;&nbsp;0</div>
  <div id="Rteam">RIGHT&nbsp;&nbsp;0</div>
  <div id="cycles">0</div>

  <canvas id="field" style="margin: auto;" width="800" height="500" onClick="canvasAction();" tabindex="1">Your browser doesn't support HTML5 canvas.</canvas>
</div>

<div id="controls_box">
	<input id="cycleSlider" type="range" min="0" max="6000" value="0" step="1" onChange="jumpToCycle(this.value);" onInput="jumpToCycle(this.value);"/>
	<div id="buttons_box">
		<button id="ppBtn" class="playerBtn" onClick="PlayPause();" title="Play / Pause"><span class="ui-icon ui-icon-play"></span></button>
		<button class="playerBtn" onClick="Restart();" title="Jump to start"><span class="ui-icon ui-icon-jump-begin"></span></button>
		<button class="playerBtn" onClick="PrevGoal();" title="Jump to previous goal"><span class="ui-icon ui-icon-prev-goal"></span></button>
		<button class="playerBtn" onClick="RPlayOne();" title="Step backwards"><span class="ui-icon ui-icon-step-back"></span></button>
		<button class="playerBtn" onClick="PlayOne();" title="Step forwards"><span class="ui-icon ui-icon-step-fwd"></span></button>
		<button class="playerBtn" onClick="NextGoal();" title="Jump to next goal"><span class="ui-icon ui-icon-next-goal"></span></button>
		<button class="playerBtn" onClick="End();" title="Jump to end"><span class="ui-icon ui-icon-jump-end"></span></button>
	</div>
	<div id="info_box">
		powered by <a href="http://www.chaosscripting.net" target="_blank">chaosscripting.net</a> &amp; <a href="https://github.com/OliverObst/GIBBS" target="_blank">GIBBS</a>
	</div>
</div>
</div>
</body>
<script language="javascript">
  InitPlayer();
</script>
</html>
