<?php
// ============================================================
// Word Wheel — Bulk Update Endpoint (Admin)
// ============================================================
// Method:  POST
// Expects: JSON body {
//            ids:    [12, 15, 31],                 // 1–1000 puzzle ids
//            action: "schedule" | "unschedule" | "delete",
//            date:   "YYYY-MM-DD"                  // only for "schedule"
//          }
// Returns: { success: true,
//            affected: <number of puzzles changed or deleted>,
//            missing:  [ids that no longer exist] }
//       or { success: false, error: <message> }
//
// One statement inside one transaction, so either every listed puzzle
// is changed or none are. Ids that don't exist (for example, deleted
// in another tab) are reported in `missing` rather than failing the
// whole request.
// ============================================================

require_once 'admin_only.php';
require_once 'db.php';

header('Content-Type: application/json; charset=utf-8');

const BULK_MAX_IDS = 1000;

function bulk_fail(int $code, string $message): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bulk_fail(405, 'Method not allowed.');
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    bulk_fail(400, 'Invalid request body.');
}

// ---- ids: a non-empty list of positive whole numbers ----
$ids = $data['ids'] ?? null;
if (!is_array($ids) || !$ids) {
    bulk_fail(400, 'Select at least one puzzle.');
}
if (count($ids) > BULK_MAX_IDS) {
    bulk_fail(400, 'Too many puzzles at once (' . BULK_MAX_IDS . ' maximum).');
}
foreach ($ids as $id) {
    if (!is_int($id) || $id <= 0) {
        bulk_fail(400, 'Invalid puzzle id.');
    }
}
$ids = array_values(array_unique($ids));

// ---- action (and date for "schedule") ----
$action = $data['action'] ?? '';
if (!in_array($action, ['schedule', 'unschedule', 'delete'], true)) {
    bulk_fail(400, 'Unknown action.');
}

$date = null;
if ($action === 'schedule') {
    $date   = $data['date'] ?? '';
    $parsed = is_string($date) ? DateTime::createFromFormat('!Y-m-d', $date) : false;
    if (!$parsed || $parsed->format('Y-m-d') !== $date) {
        bulk_fail(400, 'Choose a valid date.');
    }
}

$placeholders = implode(',', array_fill(0, count($ids), '?'));

try {
    $pdo = get_db();
    $pdo->beginTransaction();

    // Which of the ids still exist (locked until the transaction ends)
    $stmt = $pdo->prepare("SELECT id FROM puzzles WHERE id IN ($placeholders) FOR UPDATE");
    $stmt->execute($ids);
    $found   = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    $missing = array_values(array_diff($ids, $found));

    if ($action === 'delete') {
        $stmt = $pdo->prepare("DELETE FROM puzzles WHERE id IN ($placeholders)");
        $stmt->execute($ids);
    } else {
        $stmt = $pdo->prepare("UPDATE puzzles SET scheduled_date = ? WHERE id IN ($placeholders)");
        $stmt->execute(array_merge([$date], $ids));
    }

    $pdo->commit();

    echo json_encode([
        'success'  => true,
        'affected' => count($found),
        'missing'  => $missing,
    ]);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    bulk_fail(500, 'Failed to update puzzles. Nothing was changed.');
}
?>
