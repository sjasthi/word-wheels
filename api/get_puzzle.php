<?php
// ============================================================
// Word Wheel — Get Puzzle by ID Endpoint
// ============================================================
// Method:  GET
// Expects: ?id=<puzzle_id>
// Returns: { success: true, puzzle: { id, name, word, arrangement,
//             direction, hidden_count, center_letter,
//             start_slot, ring_order, hidden_indexes, language,
//             status, scheduled_date, created_date } }
//          (layout fields are null for puzzles saved without one)
//       or { success: false, error: <message> }
// ============================================================

require_once 'db.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

// Validate id parameter
if (empty($_GET['id']) || !is_numeric($_GET['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Valid puzzle ID required.']);
    exit;
}

$id = (int)$_GET['id'];

try {
    $pdo  = get_db();
    $stmt = $pdo->prepare("
        SELECT id, name, word, arrangement, direction, hidden_count,
               center_letter, start_slot, ring_order, hidden_indexes,
               language, status, scheduled_date, created_date
        FROM puzzles
        WHERE id = ?
    ");
    $stmt->execute([$id]);
    $puzzle = $stmt->fetch();

    if (!$puzzle) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Puzzle not found.']);
        exit;
    }

    // Decode arrangement from JSON string back to array
    $puzzle['arrangement']   = json_decode($puzzle['arrangement']);
    $puzzle['center_letter'] = (bool)$puzzle['center_letter'];
    $puzzle['hidden_count']  = (int)$puzzle['hidden_count'];

    // Saved wheel layout (null for older puzzles)
    $puzzle['start_slot']     = $puzzle['start_slot'] === null ? null : (int)$puzzle['start_slot'];
    $puzzle['ring_order']     = $puzzle['ring_order'] === null ? null : json_decode($puzzle['ring_order']);
    $puzzle['hidden_indexes'] = $puzzle['hidden_indexes'] === null ? null : json_decode($puzzle['hidden_indexes']);

    echo json_encode(['success' => true, 'puzzle' => $puzzle]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve puzzle.']);
}
?>
