<?php
// ============================================================
// Word Wheel — Save Puzzle Endpoint
// ============================================================
// Method:  POST
// Expects: JSON body {
//            word, arrangement, direction,
//            hidden_count, center_letter, language
//          }
// Returns: { success: true, id: <puzzle_id> }
//       or { success: false, error: <message> }
// ============================================================

session_start();
require_once 'db.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

// Get and decode the JSON body sent from the frontend
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (empty($data['word']) || empty($data['arrangement'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields.']);
    exit;
}

// Sanitize and set defaults
$word          = trim($data['word']);
$arrangement   = json_encode($data['arrangement']);         // store array as JSON string
$direction     = $data['direction']    ?? 'cw';
$hidden_count  = (int)($data['hidden_count']  ?? 0);
$center_letter = (bool)($data['center_letter'] ?? true);
$language      = $data['language']     ?? 'en';
$created_by    = $_SESSION['user_id']  ?? null;            // null if not logged in

// Validate direction value
if (!in_array($direction, ['cw', 'ccw', 'random'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid direction value.']);
    exit;
}

// Validate hidden_count range
if ($hidden_count < 0 || $hidden_count > 3) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Hidden count must be between 0 and 3.']);
    exit;
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare("
        INSERT INTO puzzles (word, arrangement, direction, hidden_count, center_letter, language, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$word, $arrangement, $direction, $hidden_count, $center_letter, $language, $created_by]);

    echo json_encode([
        'success' => true,
        'id'      => (int)$pdo->lastInsertId()
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save puzzle.']);
}
?>
