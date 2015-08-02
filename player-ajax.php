<!-- 
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
-->
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
