<?php
// ============================================================
// Word Wheel — hint guardrails
// ============================================================
// Checks every hint before it can be shown or saved, whether it came
// from the LLM or from a teacher's edit. Nothing here calls the LLM.
//
// The shared hint shape (what players receive):
//   [ ['type' => 'theme', 'text' => '...'],
//     ['type' => 'definition', 'text' => '...'] ]
// ============================================================

// Hint types, in the order players see them.
const HINT_TYPES = ['theme', 'definition'];

const HINT_MAX_CHARS = 150;

// The theme hint is a short clue, so it stays vaguer than the definition.
const THEME_MAX_WORDS = 5;

// Target words follow the same letters-only rule as the dashboard,
// within the batch length range (3–12 characters).
const HINT_WORD_MIN = 3;
const HINT_WORD_MAX = 12;

function hint_lower(string $text): string {
    if (class_exists('Normalizer')) {
        $text = Normalizer::normalize($text, Normalizer::FORM_C);
    }
    return mb_strtolower(trim($text), 'UTF-8');
}

// Number of user-perceived characters (graphemes), so accented and
// non-Latin letters count once.
function hint_char_count(string $text): int {
    return preg_match_all('/\X/u', $text);
}

function hint_word_count(string $text): int {
    return count(preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY));
}

function hint_word_is_valid(string $word): bool {
    $word = trim($word);
    if (!preg_match('/^[\p{L}\p{M}\x{200D}]+$/u', $word)) {
        return false;
    }
    $count = hint_char_count($word);
    return $count >= HINT_WORD_MIN && $count <= HINT_WORD_MAX;
}

// The answer plus simple English stems: "fishing" → "fish",
// "running" → "run", "baking" → "bak", "bake", "early" → "earli". Used to catch hints
// that give the answer away in another form.
function hint_answer_forms(string $word): array {
    $word  = hint_lower($word);
    $forms = [$word];

    // y → i before an ending: early → earlier, happy → happiest
    if (mb_strlen($word) >= 4 && str_ends_with($word, 'y')) {
        $forms[] = mb_substr($word, 0, -1) . 'i';
    }

    foreach (['ing', 'ed', 'es', 'er', 'ly', 's'] as $suffix) {
        if (!str_ends_with($word, $suffix)) {
            continue;
        }
        $stem = mb_substr($word, 0, mb_strlen($word) - mb_strlen($suffix));
        if (mb_strlen($stem) < 3) {
            continue;
        }
        $forms[] = $stem;

        $len = mb_strlen($stem);
        if ($len >= 4 && mb_substr($stem, -1) === mb_substr($stem, -2, 1)) {
            $forms[] = mb_substr($stem, 0, $len - 1);   // running → run
        }
        if ($suffix === 'ing' || $suffix === 'ed') {
            $forms[] = $stem . 'e';                     // baking → bake
        }
    }

    return array_values(array_unique($forms));
}

function hint_leaks_answer(string $text, string $word): bool {
    $lower = hint_lower($text);
    $word  = hint_lower($word);

    // Long answers inside any longer word ("kingfishing").
    if (mb_strlen($word) >= 5 && mb_strpos($lower, $word) !== false) {
        return true;
    }

    $tokens = preg_split('/[^\p{L}\p{M}]+/u', $lower, -1, PREG_SPLIT_NO_EMPTY);
    foreach (hint_answer_forms($word) as $form) {
        foreach ($tokens as $token) {
            if (mb_strlen($form) >= 4) {
                if (str_starts_with($token, $form)) {
                    return true;                        // fish → fisherman
                }
            } elseif ($token === $form || $token === $form . 's') {
                return true;                            // short forms must match whole words
            }
        }
    }
    return false;
}

// Problems with a list of hints in the shared shape, or [] when it
// passes. Used for LLM drafts and for teacher-edited hints.
function check_hint_list($hints, string $word): array {
    if (!is_array($hints) || count($hints) !== count(HINT_TYPES)) {
        return ['Expected ' . count(HINT_TYPES) . ' hints (' . implode(', ', HINT_TYPES) . ').'];
    }

    $errors = [];
    foreach (array_values($hints) as $i => $hint) {
        $type = HINT_TYPES[$i];
        $text = is_array($hint) && isset($hint['text']) && is_string($hint['text']) ? trim($hint['text']) : null;

        if (!is_array($hint) || ($hint['type'] ?? null) !== $type || $text === null) {
            $errors[] = "Hint " . ($i + 1) . " must be the $type hint.";
            continue;
        }
        if ($text === '') {
            $errors[] = "The $type hint is empty.";
        } elseif (hint_char_count($text) > HINT_MAX_CHARS) {
            $errors[] = "The $type hint is longer than " . HINT_MAX_CHARS . " characters.";
        } elseif ($type === 'theme' && hint_word_count($text) > THEME_MAX_WORDS) {
            $errors[] = "The theme hint has more than " . THEME_MAX_WORDS . " words.";
        } elseif (hint_leaks_answer($text, $word)) {
            $errors[] = "The $type hint gives away the answer.";
        }
    }
    return $errors;
}

// A puzzle_hints JSON column → the shared shape, or [] when there are
// no hints (NULL) or the stored value isn't usable.
function stored_hints(?string $json): array {
    $hints = $json === null ? null : json_decode($json, true);
    if (!is_array($hints)) {
        return [];
    }
    $out = [];
    foreach ($hints as $hint) {
        if (is_array($hint) && is_string($hint['type'] ?? null) && is_string($hint['text'] ?? null)) {
            $out[] = ['type' => $hint['type'], 'text' => $hint['text']];
        }
    }
    return $out;
}

// LLM JSON → { ok, recognized, hints, errors }. The LLM returns
// { recognized, theme, definition }; this turns it into the shared
// shape and runs the same checks as teacher edits.
function hints_from_model($raw, string $word): array {
    if (!is_array($raw) || !is_bool($raw['recognized'] ?? null)) {
        return ['ok' => false, 'recognized' => null, 'hints' => [], 'errors' => ['The AI reply was not in the expected format.']];
    }
    if (!$raw['recognized']) {
        return ['ok' => false, 'recognized' => false, 'hints' => [], 'errors' => ["The AI didn't recognize this word."]];
    }

    $hints = [];
    foreach (HINT_TYPES as $type) {
        $hints[] = ['type' => $type, 'text' => is_string($raw[$type] ?? null) ? trim($raw[$type]) : ''];
    }
    $errors = check_hint_list($hints, $word);
    return ['ok' => !$errors, 'recognized' => true, 'hints' => $hints, 'errors' => $errors];
}
?>
