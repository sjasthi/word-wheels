<?php
// ============================================================
// Word Wheel — Save Hints Endpoint (Admin)
// ============================================================
// Method:  POST
// Expects: JSON body {
//            id,
//            hints: [ { type: "theme", text }, { type: "definition", text } ]
//                   or null to remove the puzzle's hints,
//            use_draft: true when these hints came from Generate (optional)
//          }
// Returns: { success: true, hints: [...] }   // the saved hints ([] after removing)
//       or { success: false, error: <message> }
//            400 bad id or hints that fail the checks · 403 not logged in
//            404 no such puzzle
//
// Approving is the teacher's decision, so this is the only way hints
// reach players. The same guardrails as AI drafts run on every save.
//
// Where the "what the AI wrote" columns come from:
//   * use_draft and a draft from generate_hints.php in this session → that
//     draft (the browser can only choose to use it, not change it)
//   * no draft, hints already saved (an edit)          → kept as they were
//   * no draft, no saved hints (written by hand)       → NULL
// ============================================================

require_once 'admin_only.php';
require_once 'db.php';
require_once 'hint_checks.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$id   = is_array($data) && isset($data['id']) && is_numeric($data['id']) ? (int)$data['id'] : 0;
if ($id <= 0 || !array_key_exists('hints', $data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Valid puzzle ID and hints required.']);
    exit;
}

try {
    $pdo  = get_db();
    $stmt = $pdo->prepare("SELECT word FROM puzzles WHERE id = ?");
    $stmt->execute([$id]);
    $word = $stmt->fetchColumn();

    if ($word === false) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Puzzle not found.']);
        exit;
    }

    // Remove
    if ($data['hints'] === null) {
        $pdo->prepare("DELETE FROM puzzle_hints WHERE puzzle_id = ?")->execute([$id]);
        unset($_SESSION['hint_drafts'][$id]);
        echo json_encode(['success' => true, 'hints' => []]);
        exit;
    }

    // Keep only the fields we store, trimmed
    $hints = $data['hints'];
    if (is_array($hints)) {
        $hints = array_map(function ($h) {
            return is_array($h)
                ? ['type' => $h['type'] ?? null, 'text' => is_string($h['text'] ?? null) ? trim($h['text']) : null]
                : $h;
        }, array_values($hints));
    }

    $errors = check_hint_list($hints, $word);
    if ($errors) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => implode(' ', $errors)]);
        exit;
    }

    $final = json_encode($hints, JSON_UNESCAPED_UNICODE);
    $draft = !empty($data['use_draft']) ? ($_SESSION['hint_drafts'][$id] ?? null) : null;

    if ($draft) {
        $generated = json_encode($draft['hints'], JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare("
            INSERT INTO puzzle_hints (puzzle_id, generated_hints, final_hints, prompt_version, model)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                generated_hints = ?, final_hints = ?, prompt_version = ?, model = ?, approved_at = NOW()
        ");
        $stmt->execute([
            $id, $generated, $final, $draft['prompt_version'], $draft['model'],
            $generated, $final, $draft['prompt_version'], $draft['model'],
        ]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO puzzle_hints (puzzle_id, final_hints)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE final_hints = ?, approved_at = NOW()
        ");
        $stmt->execute([$id, $final, $final]);
    }

    unset($_SESSION['hint_drafts'][$id]);
    echo json_encode(['success' => true, 'hints' => $hints]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save the hints.']);
}
?>
