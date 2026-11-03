<?php
// ============================================================
// Word Wheel — Get Free Play Puzzles Endpoint
// ============================================================
// Method:  GET
// Expects: ?exclude=12,15,31  (optional — ids already played this
//                              session, so a new batch has no repeats)
// Returns: { success: true, puzzles: [ { ... }, ... ] }
//            a random batch of up to 20 puzzles; empty when every
//            eligible puzzle is excluded (or none exist)
//       or { success: false, error: <message> }
//
// Only published puzzles that are unscheduled or scheduled BEFORE
// today are eligible. Today's daily puzzles and future ones are left
// out so free play never gives away an upcoming daily puzzle, and
// drafts are never shown to players.
// ============================================================

require_once 'db.php';
require_once 'player_puzzle.php';

header('Content-Type: application/json; charset=utf-8');

const FREEPLAY_BATCH_SIZE  = 20;
const FREEPLAY_MAX_EXCLUDE = 1000; // keeps the query a sensible size

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

// "12,15,31" → [12, 15, 31]; anything that isn't a positive whole number is ignored
$exclude = [];
if (isset($_GET['exclude']) && is_string($_GET['exclude'])) {
    foreach (explode(',', $_GET['exclude']) as $part) {
        if (ctype_digit($part) && (int)$part > 0) {
            $exclude[(int)$part] = true;
        }
    }
    $exclude = array_slice(array_keys($exclude), 0, FREEPLAY_MAX_EXCLUDE);
}

try {
    $pdo = get_db();

    $sql = "
        SELECT " . PLAYER_PUZZLE_COLUMNS . "
        FROM puzzles
        WHERE status = 'published'
          AND (scheduled_date IS NULL OR scheduled_date < CURDATE())
    ";
    if ($exclude) {
        $sql .= " AND id NOT IN (" . implode(',', array_fill(0, count($exclude), '?')) . ")";
    }
    // ORDER BY RAND() reads the whole table, which is fine at this
    // project's scale (hundreds to a few thousand puzzles).
    $sql .= " ORDER BY RAND() LIMIT " . FREEPLAY_BATCH_SIZE;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($exclude);

    echo json_encode([
        'success' => true,
        'puzzles' => array_map('player_puzzle', $stmt->fetchAll()),
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve free play puzzles.']);
}
?>
