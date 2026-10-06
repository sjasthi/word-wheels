<?php
// ============================================================
// Word Wheel — Update Puzzle Endpoint (Admin)
// ============================================================
// Method:  POST
// Expects: JSON body {
//            id,
//            status (optional),
//            scheduled_date (optional, "YYYY-MM-DD" or null)
//          }
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

$id     = (int)$data['id'];
$fields = [];
$values = [];

// Build update query dynamically based on what was sent
if (isset($data['status'])) {
    if (!in_array($data['status'], ['draft', 'published'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid status value.']);
        exit;
    }
    $fields[] = 'status = ?';
    $values[] = $data['status'];
}

if (array_key_exists('scheduled_date', $data)) {
    // Allow null to unschedule a puzzle
    $fields[] = 'scheduled_date = ?';
    $values[] = $data['scheduled_date'] ?: null;
}

if (empty($fields)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No fields to update.']);
    exit;
}

$values[] = $id; // for the WHERE clause

try {
    $pdo  = get_db();
    $sql  = "UPDATE puzzles SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Puzzle not found.']);
        exit;
    }

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to update puzzle.']);
}
?>
