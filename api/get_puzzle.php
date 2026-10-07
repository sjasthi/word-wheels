<?php
// ============================================================
// Word Wheel — Get Puzzle by ID Endpoint
// ============================================================
// Method:  GET
// Expects: ?id=<puzzle_id>
// Returns: { success: true, puzzle: { id, word, arrangement,
//             direction, hidden_count, center_letter, language,
//             status, scheduled_date, created_date } }
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
        SELECT id, word, arrangement, direction, hidden_count,
               center_letter, language, status, scheduled_date, created_date
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

    echo json_encode(['success' => true, 'puzzle' => $puzzle]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve puzzle.']);
}
?>
