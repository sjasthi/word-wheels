<?php
// ============================================================
// Word Wheel — Get Daily Puzzles Endpoint
// ============================================================
// Method:  GET
// Expects: nothing — uses the server's current date
// Returns: { success: true,
//            date: "YYYY-MM-DD",           // the server's "today"
//            previous_date: "YYYY-MM-DD",  // most recent earlier day that
//                                          // had puzzles, or null
//            puzzles: [ { ... }, ... ] }   // today's scheduled puzzles,
//                                          // oldest first; may be empty
//       or { success: false, error: <message> }
//
// An empty puzzles list is not an error: the player page shows free
// play instead. The server's date is used (not the player's clock) so
// progress and streaks agree for everyone. previous_date lets the
// player page keep a streak going across days with no puzzles.
// ============================================================

require_once 'db.php';
require_once 'player_puzzle.php';

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

    // ORDER BY id keeps the order fixed, so "puzzle 2" is always the
    // same puzzle (the player's saved progress depends on it).
    $stmt = $pdo->prepare("
        SELECT " . PLAYER_PUZZLE_COLUMNS . "
        FROM puzzles
        WHERE scheduled_date = ?
        ORDER BY id
    ");
    $stmt->execute([$today]);
    $puzzles = array_map('player_puzzle', $stmt->fetchAll());

    $stmt = $pdo->prepare("
        SELECT MAX(scheduled_date)
        FROM puzzles
        WHERE scheduled_date < ?
    ");
    $stmt->execute([$today]);
    $previous = $stmt->fetchColumn() ?: null;

    echo json_encode([
        'success'       => true,
        'date'          => $today,
        'previous_date' => $previous,
        'puzzles'       => $puzzles,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve daily puzzles.']);
}
?>
