<?php
// ============================================================
// Word Wheel — Get Daily Puzzle Endpoint
// ============================================================
// Method:  GET
// Expects: nothing — uses server's current date automatically
// Returns: { success: true, puzzle: { ... } }
//       or { success: false, error: 'No puzzle today.' }
// ============================================================

require_once 'db.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

try {
    $pdo  = get_db();
    $stmt = $pdo->prepare("
        SELECT id, word, arrangement, direction, hidden_count,
               center_letter, language, scheduled_date
        FROM puzzles
        WHERE scheduled_date = CURDATE()
          AND status = 'published'
        LIMIT 1
    ");
    $stmt->execute();
    $puzzle = $stmt->fetch();

    if (!$puzzle) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No puzzle scheduled for today.']);
        exit;
    }

    // Decode arrangement from JSON string back to array
    $puzzle['arrangement']   = json_decode($puzzle['arrangement']);
    $puzzle['center_letter'] = (bool)$puzzle['center_letter'];
    $puzzle['hidden_count']  = (int)$puzzle['hidden_count'];

    echo json_encode(['success' => true, 'puzzle' => $puzzle]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve daily puzzle.']);
}
?>
