<?php
//proxy.php - forwards reprojection requests to OpenContext, bypassing CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

//validate that x and y were actually passed
if (!isset($_GET['x']) || !isset($_GET['y'])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing x or y parameter"]);
    exit;
}

$x = floatval($_GET['x']);
$y = floatval($_GET['y']);

$url = "https://opencontext.org/utilities/reproject?format=geojson&geometry=Point&input-proj=poggio-civitate&output-proj=EPSG:4326&x={$x}&y={$y}";

//file_get_contents works for simple GET requests on most Apache/PHP setups
$response = file_get_contents($url);

if ($response === false) {
    http_response_code(502);
    echo json_encode(["error" => "Failed to reach OpenContext"]);
    exit;
}

echo $response;