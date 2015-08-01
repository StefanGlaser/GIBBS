<?php

// ========== Player constants ==========
define("LOG_DIR",	"./replays");



// ========== Helper Methods ==========
function isPathValid($path)
{
	if ($path === ""
	    || (strrpos($path, "..", -2) === false
			&& strrpos($path, "../") === false
			&& file_exists(LOG_DIR . $path))) {
		return true;
	}

	return false;
}

function listFoldersAndReplays($path)
{
	$folders = array();
	$replays = array();

	$dirIter = new DirectoryIterator($path);
	
	if ($dirIter->valid()) {
		$folderIdx = 0;
		$replayIdx = 0;

		foreach ($dirIter as $fn) {
			$fileName = $fn->getFilename();
			if ($fn->isDir() && !$fn->isDot()) {
				$folders[$folderIdx] = $fileName;
				$folderIdx++;
			} else if (!$fn->isDot() && substr($fileName, -7) == ".replay") {
				$replays[$replayIdx] = $fileName;
				$replayIdx++;
			}
		}

		sort($folders, SORT_STRING);
		sort($replays, SORT_STRING);
	}

	$result = array();
	$result['folders'] = $folders;
	$result['replays'] = $replays;

	return $result;
}

function getNextDirListing($path)
{
	$result = listFoldersAndReplays($path);
	$subPath = "";
	$cnt = 0;
	while ($cnt < 100
			&& count($result['folders']) == 1
			&& count($result['replays']) == 0) {
		$subPath = $subPath . "/" . $result['folders'][0];
		
		$result = listFoldersAndReplays($path . $subPath);
		$cnt++;
	}
	$result['subPath'] = $subPath;
	
	return $result;
}

function beginNaviItem($liClass, $inputValue, $name)
{
	return "<li class=\"" . $liClass . "\"><input type=\"hidden\" value=\"" . $inputValue . "\" /><span>" . $name . "</span><ul>\n";
}

function makeSubNavi($subFolder, $folders, $replays)
{
	$result = "";
	
	foreach($folders as $folder) {
		$result .= "\t\t\t<li><input type=\"hidden\" value=\"" . $subFolder . "/" . $folder . "\" /><a href=\"javascript:void(0);\" onClick=\"folderSelect(this)\">" . $folder . "</a></li>\n";
	}
	
	foreach($replays as $replay) {
		$result .= "\t\t\t<li><input type=\"hidden\" value=\"" . $subFolder . "/" . $replay . "\" /><a href=\"javascript:void(0);\" onClick=\"replaySelect(this)\">" . $replay . "</a></li>\n";
	}
	
	return $result;
}

function endNaviItem()
{
	return "\t\t</ul></li>";
}

function makeFileMenu($preSelection, $path, $depth = 0, $subPath = "")
{
	$result = "";
	$pathListing = listFoldersAndReplays($path);
	$folderSize = count($pathListing['folders']);
	$replaySize = count($pathListing['replays']);
	$preSelectionSize = count($preSelection);
	
	if ($depth < $preSelectionSize && in_array($preSelection[$depth], $pathListing['folders'])) {
		// Found preselected folder
		if ($folderSize + $replaySize > 1) {
			$result .= beginNaviItem("naviFolder", $subPath . "/" . $preSelection[$depth], $preSelection[$depth]);
			$result .= makeSubNavi($subPath, $pathListing['folders'], $pathListing['replays']);
			$result .= endNaviItem();
			$subPath = "";
		} else {
			$subPath .= "/" . $preSelection[$depth];
		}
		// Create next sub menu
		$path .= "/" . $preSelection[$depth];
		$result .= makeFileMenu($preSelection, $path, $depth + 1, $subPath);
	} else if ($depth < $preSelectionSize && in_array($preSelection[$depth], $pathListing['replays'])) {
		// Found preselected replay
		$result .= beginNaviItem("naviReplay", $subPath . "/" . $preSelection[$depth], $preSelection[$depth]);
		$result .= makeSubNavi($subPath, $pathListing['folders'], $pathListing['replays']);
		$result .= endNaviItem();
	} else {
		// No matching preselection found
		$preSelection = array();
		if ($depth < 100 && $folderSize == 1 && $replaySize == 0) {
			$subPath .= "/" . $pathListing['folders'][0];
			$path .= "/" . $pathListing['folders'][0];
			$result .= makeFileMenu($preSelection, $path, $depth + 1, $subPath);
		} else {
			if ($depth == 0 && $folderSize > 0 && $replaySize == 0) {
				$folderName = $pathListing['folders'][0];
				$result .= beginNaviItem("naviFolder", $subPath . "/" . $folderName, $folderName);
				$result .= makeSubNavi($subPath, $pathListing['folders'], $pathListing['replays']);
				$result .= endNaviItem();
				$path .= "/" . $folderName;
				$result .= makeFileMenu($preSelection, $path, $depth + 1);
			} else if ($folderSize + $replaySize > 0) {
				$result .= beginNaviItem("naviEmpty", "", "Please Select");
				$result .= makeSubNavi($subPath, $pathListing['folders'], $pathListing['replays']);
				$result .= endNaviItem();
			} else {
				$result .= beginNaviItem("naviDisabled", "", "No replays available");
				$result .= endNaviItem();
			}
		}
	}
	
	return $result;
}
?>
