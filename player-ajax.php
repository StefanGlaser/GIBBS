<?php
header('Content-Type: application/json');

include 'player_definitions.php';


// Check if log file path exists and a path-parameter is set
if (!file_exists(LOG_DIR) || !isset($_GET['path'])) {
	echo json_encode(null);
	exit();
}

$path = trim($_GET['path'], "/");
$depth = substr_count($path, "/");

if ($path != "") {
	$depth++;
	$path = "/" . $path;
}

if (isPathValid($path)) {
	$result = getNextDirListing(LOG_DIR . $path);
	$result['depth'] = $depth;
  
	echo json_encode($result);
} else {
	echo json_encode(null);
}

?>
