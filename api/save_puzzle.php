<?php
// ============================================================
// Word Wheel — Save Puzzle Endpoint
// ============================================================
// Method:  POST
// Expects: JSON body {
//            name (optional), word, arrangement, direction,
//            hidden_count, center_letter, language,
//            start_slot, ring_order, hidden_indexes   (optional layout)
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
$name          = trim((string)($data['name'] ?? ''));
$name          = $name === '' ? null : $name;               // blank = unnamed
$word          = trim($data['word']);
$arrangement   = json_encode($data['arrangement']);         // store array as JSON string
$direction     = $data['direction']    ?? 'cw';
$hidden_count  = (int)($data['hidden_count']  ?? 0);
$center_letter = (bool)($data['center_letter'] ?? true);
$language      = $data['language']     ?? 'en';
$created_by    = $_SESSION['user_id']  ?? null;            // null if not logged in

// Validate name length (matches the VARCHAR(100) column)
if ($name !== null && mb_strlen($name, 'UTF-8') > 100) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Name must be 100 characters or fewer.']);
    exit;
}

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

// Optional wheel layout — all three fields are saved together or not at all
$start_slot     = null;
$ring_order     = null;
$hidden_indexes = null;

if (isset($data['start_slot'], $data['ring_order'], $data['hidden_indexes'])) {
    $letter_count = count($data['arrangement']);
    $ring_size    = $center_letter ? $letter_count - 1 : $letter_count;
    $is_index     = function ($v) use ($letter_count) {
        return is_int($v) && $v >= 0 && $v < $letter_count;
    };

    if (!is_int($data['start_slot']) || $data['start_slot'] < 0 || $data['start_slot'] >= $ring_size
        || !is_array($data['ring_order']) || count($data['ring_order']) !== $ring_size
        || count(array_filter($data['ring_order'], $is_index)) !== $ring_size
        || !is_array($data['hidden_indexes']) || count($data['hidden_indexes']) !== $hidden_count
        || count(array_filter($data['hidden_indexes'], $is_index)) !== $hidden_count) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid wheel layout.']);
        exit;
    }

    $start_slot     = $data['start_slot'];
    $ring_order     = json_encode(array_values($data['ring_order']));
    $hidden_indexes = json_encode(array_values($data['hidden_indexes']));
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare("
        INSERT INTO puzzles (name, word, arrangement, direction, hidden_count, center_letter,
                             start_slot, ring_order, hidden_indexes, language, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$name, $word, $arrangement, $direction, $hidden_count, $center_letter,
                    $start_slot, $ring_order, $hidden_indexes, $language, $created_by]);

    echo json_encode([
        'success' => true,
        'id'      => (int)$pdo->lastInsertId()
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save puzzle.']);
}
?>
