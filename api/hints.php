<?php
// ============================================================
// Word Wheel — hint drafts (LLM call + guardrails + one retry)
// ============================================================
// generate_hint_draft($word) is what the admin endpoints call.
// It never saves anything: a draft only becomes real hints after a
// teacher approves it.
// ============================================================

require_once __DIR__ . '/llm.php';
require_once __DIR__ . '/hint_checks.php';

// Returns
//   [ 'ok'             => bool,
//     'error'          => message for the teacher, or null,
//     'hints'          => shared hint shape (empty on failure),
//     'generated'      => the model's last JSON reply, as returned,
//     'model'          => model version that answered,
//     'prompt_version' => HINT_PROMPT_VERSION,
//     'attempts'       => LLM calls made (1 or 2),
//     'usage'          => token counts for each attempt ]
function generate_hint_draft(string $word): array {
    $draft = [
        'ok' => false, 'error' => null, 'hints' => [], 'generated' => null,
        'model' => HINTS_MODEL, 'prompt_version' => HINT_PROMPT_VERSION,
        'attempts' => 0, 'usage' => [],
    ];

    if (!hint_word_is_valid($word)) {
        $draft['error'] = 'Hints can only be written for words of '
            . HINT_WORD_MIN . '–' . HINT_WORD_MAX . ' letters.';
        return $draft;
    }

    $feedback = null;
    for ($attempt = 1; $attempt <= 2; $attempt++) {
        $reply = llm_generate_hints($word, $feedback);
        $draft['attempts'] = $attempt;
        $draft['model']    = $reply['model'];
        $draft['usage'][]  = $reply['usage'];

        if (!$reply['ok']) {
            $draft['error'] = $reply['error'];      // service problems aren't retried
            return $draft;
        }

        $draft['generated'] = $reply['raw'];
        $checked = hints_from_model($reply['raw'], $word);
        $draft['hints'] = $checked['hints'];

        if ($checked['ok']) {
            $draft['ok'] = true;
            $draft['error'] = null;
            return $draft;
        }
        if ($checked['recognized'] === false) {
            $draft['error'] = "The AI didn't recognize this word, so it wrote no hints. "
                . 'Check the spelling, or write the hints yourself.';
            return $draft;
        }

        // The checks failed: tell the model why and try once more.
        $draft['error'] = implode(' ', $checked['errors']);
        $feedback = $draft['error'];
    }

    $draft['error'] = 'The AI hints failed the checks twice: ' . $draft['error']
        . ' Edit them yourself or try again.';
    return $draft;
}
?>
