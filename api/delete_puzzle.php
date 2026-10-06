<?php
// ============================================================
// Word Wheel — Delete Puzzle Endpoint (Admin)
// ============================================================
// Method:  POST
// Expects: JSON body { id: <puzzle_id> }
// Returns: { success: true }
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

// Admin only endpoint
if (empty($_SESSION['admin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorised.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

// Validate puzzle ID
if (empty($data['id']) || !is_numeric($data['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Valid puzzle ID required.']);
    exit;
}

$id = (int)$data['id'];

try {
    $pdo  = get_db();
    $stmt = $pdo->prepare("DELETE FROM puzzles WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Puzzle not found.']);
        exit;
    }

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to delete puzzle.']);
}
?>
