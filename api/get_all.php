<?php
// ============================================================
// Word Wheel — Get All Puzzles Endpoint (Admin)
// ============================================================
// Method:  GET
// Expects: nothing
// Returns: { success: true,
//            today: "YYYY-MM-DD",          // the server's date, so the
//                                          // dashboard agrees with players
//            puzzles: [ { id, name, word, arrangement, direction,
//                         hidden_count, center_letter, start_slot,
//                         ring_order, hidden_indexes, language,
//                         scheduled_date, created_date }, ... ] }
//                                          // newest first
//       or { success: false, error: <message> }
//
// Admin only: the rows include every answer. The dashboard's Manage
// tab and Create tab both read from this, and it includes each saved
// layout so previews and printing need no extra requests.
// ============================================================

require_once 'admin_only.php';
require_once 'db.php';

header('Content-Type: application/json; charset=utf-8');

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

try {
    $pdo   = get_db();
    $today = $pdo->query("SELECT CURDATE()")->fetchColumn();
    $rows  = $pdo->query("
        SELECT id, name, word, arrangement, direction, hidden_count,
               center_letter, start_slot, ring_order, hidden_indexes,
               language, scheduled_date, created_date
        FROM puzzles
        ORDER BY created_date DESC, id DESC
    ")->fetchAll();

    // Decode JSON columns and cast types for clean JSON output
    $puzzles = array_map(function ($p) {
        return [
            'id'             => (int)$p['id'],
            'name'           => $p['name'],
            'word'           => $p['word'],
            'arrangement'    => json_decode($p['arrangement']),
            'direction'      => $p['direction'],
            'hidden_count'   => (int)$p['hidden_count'],
            'center_letter'  => (bool)$p['center_letter'],
            'start_slot'     => $p['start_slot'] === null ? null : (int)$p['start_slot'],
            'ring_order'     => $p['ring_order'] === null ? null : json_decode($p['ring_order']),
            'hidden_indexes' => $p['hidden_indexes'] === null ? null : json_decode($p['hidden_indexes']),
            'language'       => $p['language'],
            'scheduled_date' => $p['scheduled_date'],
            'created_date'   => $p['created_date'],
        ];
    }, $rows);

    echo json_encode(['success' => true, 'today' => $today, 'puzzles' => $puzzles]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve puzzles.']);
}
?>
