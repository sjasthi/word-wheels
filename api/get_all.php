<?php
// ============================================================
// Word Wheel — Get All Puzzles Endpoint
// ============================================================
// Method:  GET
// Expects: optional ?status=draft|published
// Returns: { success: true, puzzles: [ ... ] }
//       or { success: false, error: <message> }
// ============================================================

require_once 'db.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

// Optional status filter
$status       = $_GET['status'] ?? null;
$valid_status = ['draft', 'published'];

try {
    $pdo = get_db();

    if ($status && in_array($status, $valid_status)) {
        $stmt = $pdo->prepare("
            SELECT id, word, direction, hidden_count, center_letter,
                   language, status, scheduled_date, created_date
            FROM puzzles
            WHERE status = ?
            ORDER BY created_date DESC
        ");
        $stmt->execute([$status]);
    } else {
        $stmt = $pdo->prepare("
            SELECT id, word, direction, hidden_count, center_letter,
                   language, status, scheduled_date, created_date
            FROM puzzles
            ORDER BY created_date DESC
        ");
        $stmt->execute();
    }

    $puzzles = $stmt->fetchAll();

    // Cast types for clean JSON output
    foreach ($puzzles as &$p) {
        $p['center_letter'] = (bool)$p['center_letter'];
        $p['hidden_count']  = (int)$p['hidden_count'];
    }

    echo json_encode(['success' => true, 'puzzles' => $puzzles]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve puzzles.']);
}
?>
