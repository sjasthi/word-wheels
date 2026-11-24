<?php
// ============================================================
// Word Wheel — Generate Hints Endpoint (Admin)
// ============================================================
// Method:  POST
// Expects: JSON body { id }
// Returns: { success: true,
//            ok: true | false,         // false = the AI hints failed the
//                                      // checks; hints are still returned
//                                      // for the teacher to edit
//            error: <message> | null,
//            hints: [ { type, text }, ... ],
//            model, prompt_version }
//       or { success: false, error: <message> }
//            400 bad id · 403 not logged in · 404 no such puzzle
//            422 word not recognized or not 3–12 letters
//            502 AI service problem · 503 AI hints switched off
//
// Saves nothing. The draft is also kept in the admin's session, so
// save_hints.php records what the AI actually wrote (not what the
// browser says it wrote) when the teacher approves.
// ============================================================

require_once 'admin_only.php';
require_once 'db.php';
require_once 'hints.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

if (!hints_enabled()) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'AI hints are switched off on this server (no API key is configured).']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$id   = is_array($data) && isset($data['id']) && is_numeric($data['id']) ? (int)$data['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Valid puzzle ID required.']);
    exit;
}

try {
    $stmt = get_db()->prepare("SELECT word FROM puzzles WHERE id = ?");
    $stmt->execute([$id]);
    $word = $stmt->fetchColumn();
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to look up the puzzle.']);
    exit;
}

if ($word === false) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Puzzle not found.']);
    exit;
}

$draft = generate_hint_draft($word);

if (!$draft['hints']) {
    $status = in_array($draft['code'], ['unrecognized', 'invalid_word'], true) ? 422 : 502;
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $draft['error']]);
    exit;
}

$_SESSION['hint_drafts'][$id] = [
    'hints'          => $draft['hints'],
    'model'          => $draft['model'],
    'prompt_version' => $draft['prompt_version'],
];

echo json_encode([
    'success'        => true,
    'ok'             => $draft['ok'],
    'error'          => $draft['ok'] ? null : $draft['error'],
    'hints'          => $draft['hints'],
    'model'          => $draft['model'],
    'prompt_version' => $draft['prompt_version'],
]);
?>
