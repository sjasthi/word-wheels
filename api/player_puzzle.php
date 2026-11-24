<?php
// ============================================================
// Word Wheel — shared helper for the player-facing endpoints
// ============================================================
// Used by get_daily.php and get_freeplay.php so both return puzzles
// in exactly the same shape.
// ============================================================

require_once __DIR__ . '/hint_checks.php';

// Puzzles plus their approved hints (if any). Use as "FROM " . PLAYER_PUZZLE_FROM.
const PLAYER_PUZZLE_FROM = "puzzles LEFT JOIN puzzle_hints ON puzzle_hints.puzzle_id = puzzles.id";

// The columns the player page needs to draw and check a puzzle.
const PLAYER_PUZZLE_COLUMNS = "id, arrangement, direction, hidden_count,
    center_letter, start_slot, ring_order, hidden_indexes, language,
    puzzle_hints.final_hints AS hints";

// Turn a database row into the JSON shape wheel.js's puzzleFromApi() reads:
// JSON columns decoded, numbers and booleans typed. Layout fields stay
// null for puzzles saved before the layout migration. hints is [] when
// a teacher hasn't approved any.
function player_puzzle(array $row): array {
    return [
        'id'             => (int)$row['id'],
        'arrangement'    => json_decode($row['arrangement']),
        'direction'      => $row['direction'],
        'hidden_count'   => (int)$row['hidden_count'],
        'center_letter'  => (bool)$row['center_letter'],
        'start_slot'     => $row['start_slot'] === null ? null : (int)$row['start_slot'],
        'ring_order'     => $row['ring_order'] === null ? null : json_decode($row['ring_order']),
        'hidden_indexes' => $row['hidden_indexes'] === null ? null : json_decode($row['hidden_indexes']),
        'language'       => $row['language'],
        'hints'          => stored_hints($row['hints']),
    ];
}
?>
