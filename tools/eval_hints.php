<?php
// ============================================================
// Word Wheel — offline eval for AI hints
// ============================================================
// Runs a fixed word list through the real hint pipeline and scores the
// results, so prompt or model changes can be compared run to run.
//
// Run from the repo root:
//   php tools/eval_hints.php                      (tools/eval_words.txt)
//   php tools/eval_hints.php --no-judge --delay=3000 my_words.txt
//
// For each word it measures:
//   * pipeline    — recognized vs expected, first-try pass, latency, tokens
//   * code checks — theme word count, definition reading level
//   * solver      — can a model guess the word from the letters alone?
//                   From hint 1 alone (no letters)? From both hints (no
//                   letters)? Hint 1 should be solved less often than
//                   both: "cold, then warm". Letters are left out of the
//                   hint tests because models unscramble most of these
//                   words without any hints.
//   * judge       — a model grades accuracy, kid-friendliness, and
//                   whether the theme is vaguer than the definition
//                   (skip with --no-judge)
// The judge and solver use the same model that wrote the hints, so
// treat their scores as rough signals, not ground truth.
//
// Saves a JSON file per run in tools/eval-results/ (git-ignored).
// Uses the free-tier quota: about 5 calls per word.
// ============================================================

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/hints.php';

// ---- Options ----
$judge = true;
$delayMs = 1500;
$file = __DIR__ . '/eval_words.txt';
foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--no-judge') $judge = false;
    elseif (str_starts_with($arg, '--delay=')) $delayMs = max(0, (int)substr($arg, 8));
    else $file = $arg;
}

if (!hints_enabled()) {
    echo "AI hints are off: set HINTS_API_KEY in api/config.local.php.\n";
    exit(1);
}
if (!is_file($file)) {
    echo "Word list not found: $file\n";
    exit(1);
}

$words = [];
foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#') continue;
    [$word, $expected] = array_map('trim', explode(',', $line) + [1 => 'real']);
    $words[] = ['word' => $word, 'expected' => $expected === 'reject' ? 'reject' : 'real'];
}

// ---- Helpers ----
function pause(int $ms): void {
    if ($ms > 0) usleep($ms * 1000);
}

// llm_json() with one wait-and-retry when the free tier says "slow down".
function ask(string $system, string $user, array $schema): array {
    $reply = llm_json($system, $user, $schema);
    if (!$reply['ok'] && $reply['status'] === 429) {
        echo "    (rate limited, waiting 30 s)\n";
        sleep(30);
        $reply = llm_json($system, $user, $schema);
    }
    return $reply;
}

function word_count(string $text): int {
    return count(preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY));
}

// Rough English syllable count: vowel groups, minus a silent final "e".
function syllables(string $word): int {
    $word = preg_replace('/[^a-z]/', '', strtolower($word));
    if ($word === '') return 0;
    $count = preg_match_all('/[aeiouy]+/', $word);
    if (preg_match('/[^aeiouy]e$/', $word) && !preg_match('/[^aeiouy]le$/', $word)) $count--;
    return max(1, $count);
}

// Flesch-Kincaid grade level: about the school grade that can read it.
function grade_level(string $text): float {
    $words = preg_split('/[^\p{L}\']+/u', $text, -1, PREG_SPLIT_NO_EMPTY);
    if (!$words) return 0.0;
    $sentences = max(1, preg_match_all('/[.!?]+/', $text));
    $syl = array_sum(array_map('syllables', $words));
    return round(0.39 * (count($words) / $sentences) + 11.8 * ($syl / count($words)) - 15.59, 1);
}

function scrambled(string $word): string {
    preg_match_all('/\X/u', mb_strtoupper($word), $m);
    $letters = $m[0];
    do {
        shuffle($letters);
    } while (count($letters) > 1 && implode('', $letters) === mb_strtoupper($word));
    return implode(' ', $letters);
}

const SOLVER_SYSTEM = <<<TXT
You are playing a word puzzle. Guess one hidden English word from what you are given: its letters
in scrambled order, hints, or both. If you get letters, the answer uses every letter exactly once.
Reply with your single best guess.
TXT;

const JUDGE_SYSTEM = <<<TXT
You review hints written for a word-guessing game for students aged 7 to 11. Students see hint 1,
then hint 2. Hint 1 (theme) should be a short, vague clue; hint 2 (definition) should be a clear,
kid-friendly definition. Judge strictly and honestly.
TXT;

function solve(string $word, array $hints, bool $letters): ?bool {
    $user = $letters ? "Letters: " . scrambled($word) . "\n" : "No letters.\n";
    $user .= $hints
        ? "Hints:\n" . implode("\n", array_map(fn($i, $h) => ($i + 1) . ". " . $h['text'], array_keys($hints), $hints))
        : "No hints.";
    $reply = ask(SOLVER_SYSTEM, $user, [
        'type' => 'object',
        'properties' => ['guess' => ['type' => 'string']],
        'required' => ['guess'],
        'additionalProperties' => false,
    ]);
    if (!$reply['ok'] || !is_string($reply['raw']['guess'] ?? null)) return null;
    return mb_strtolower(trim($reply['raw']['guess'])) === mb_strtolower($word);
}

function judge(string $word, array $hints): ?array {
    $user = "Target word: $word\nHint 1 (theme): {$hints[0]['text']}\nHint 2 (definition): {$hints[1]['text']}";
    $reply = ask(JUDGE_SYSTEM, $user, [
        'type' => 'object',
        'properties' => [
            'accurate'     => ['type' => 'boolean', 'description' => 'Both hints are correct for the target word.'],
            'kid_friendly' => ['type' => 'boolean', 'description' => 'A 3rd or 4th grader can read and understand both hints.'],
            'theme_vaguer' => ['type' => 'boolean', 'description' => 'Hint 1 gives away clearly less than hint 2.'],
            'note'         => ['type' => 'string',  'description' => 'One short sentence on the biggest problem, or "none".'],
        ],
        'required' => ['accurate', 'kid_friendly', 'theme_vaguer', 'note'],
        'additionalProperties' => false,
    ]);
    return $reply['ok'] ? $reply['raw'] : null;
}

// ---- Run ----
echo "Eval: " . count($words) . " words · model " . HINTS_MODEL . " · prompt " . HINT_PROMPT_VERSION
   . " · judge " . ($judge ? 'on' : 'off') . "\n\n";

$rows = [];
foreach ($words as $i => $w) {
    $word = $w['word'];
    echo sprintf("[%2d/%d] %-10s ", $i + 1, count($words), $word);

    $start = microtime(true);
    $draft = generate_hint_draft($word);
    if ($draft['code'] === 'service') {
        echo "(service error, waiting 30 s) ";
        sleep(30);
        $start = microtime(true);
        $draft = generate_hint_draft($word);
    }
    $row = [
        'word' => $word, 'expected' => $w['expected'], 'code' => $draft['code'],
        'attempts' => $draft['attempts'], 'ms' => (int)round((microtime(true) - $start) * 1000),
        'tokens' => array_sum(array_map(fn($u) => is_array($u) ? ($u['totalTokenCount'] ?? 0) : 0, $draft['usage'])),
        'hints' => $draft['hints'], 'error' => $draft['error'],
    ];
    $row['recognized_ok'] = $w['expected'] === 'real'
        ? in_array($draft['code'], ['ok', 'checks_failed'], true)
        : $draft['code'] === 'unrecognized';
    pause($delayMs);

    if ($draft['ok']) {
        $row['theme_words'] = word_count($draft['hints'][0]['text']);
        $row['definition_grade'] = grade_level($draft['hints'][1]['text']);

        $row['solved_letters'] = solve($word, [], true);                   pause($delayMs);
        $row['solved_hint1']   = solve($word, [$draft['hints'][0]], false); pause($delayMs);
        $row['solved_both']    = solve($word, $draft['hints'], false);      pause($delayMs);
        if ($judge) {
            $row['judge'] = judge($word, $draft['hints']);                 pause($delayMs);
        }
    }

    $rows[] = $row;
    echo $draft['ok']
        ? sprintf("%-13s %s | %s\n", $draft['code'], $draft['hints'][0]['text'], $draft['hints'][1]['text'])
        : sprintf("%-13s %s\n", $draft['code'], $row['recognized_ok'] ? '(expected)' : $draft['error']);
}

// ---- Summary ----
$real    = array_filter($rows, fn($r) => $r['expected'] === 'real');
$reject  = array_filter($rows, fn($r) => $r['expected'] === 'reject');
$scored  = array_filter($rows, fn($r) => $r['code'] === 'ok');
$pct     = fn($n, $d) => $d ? round(100 * $n / $d) . '%' : 'n/a';
$countIf = fn($list, $fn) => count(array_filter($list, $fn));
$avg     = fn($list, $key) => $list ? round(array_sum(array_column($list, $key)) / count($list), 1) : 0;
$solvedRate = fn($key) => $pct($countIf($scored, fn($r) => ($r[$key] ?? null) === true), count($scored));

$summary = [
    'real words recognized'          => $countIf($real, fn($r) => $r['recognized_ok']) . '/' . count($real),
    'typos/gibberish refused'        => $countIf($reject, fn($r) => $r['recognized_ok']) . '/' . count($reject),
    'passed checks on first try'     => $pct($countIf($real, fn($r) => $r['code'] === 'ok' && $r['attempts'] === 1), count($real)),
    'passed checks (any try)'        => $pct(count($scored), count($real)),
    'avg theme length (words)'       => $avg($scored, 'theme_words'),
    'avg definition grade level'     => $avg($scored, 'definition_grade'),
    'solver: letters only'           => $solvedRate('solved_letters'),
    'solver: hint 1 only'            => $solvedRate('solved_hint1'),
    'solver: both hints'             => $solvedRate('solved_both'),
];
if ($judge) {
    $judged = array_filter(array_column($scored, 'judge'));
    $summary['judge: accurate']     = $pct($countIf($judged, fn($j) => $j['accurate']), count($judged));
    $summary['judge: kid-friendly'] = $pct($countIf($judged, fn($j) => $j['kid_friendly']), count($judged));
    $summary['judge: theme vaguer'] = $pct($countIf($judged, fn($j) => $j['theme_vaguer']), count($judged));
}
$summary['avg latency (ms)'] = $avg($rows, 'ms');
$summary['tokens (hint writing)'] = array_sum(array_column($rows, 'tokens'));

echo "\n" . str_repeat('-', 46) . "\n";
foreach ($summary as $label => $value) {
    echo sprintf("%-32s %s\n", $label, $value);
}

if ($judge) {
    $notes = array_filter($scored, fn($r) => isset($r['judge']['note']) && !preg_match('/^none\.?$/i', trim($r['judge']['note'])));
    if ($notes) {
        echo "\nJudge notes:\n";
        foreach ($notes as $r) echo "  {$r['word']}: {$r['judge']['note']}\n";
    }
}

$dir = __DIR__ . '/eval-results';
if (!is_dir($dir)) mkdir($dir);
$out = $dir . '/' . date('Ymd-His') . '-' . HINT_PROMPT_VERSION . '.json';
file_put_contents($out, json_encode([
    'model' => HINTS_MODEL, 'prompt_version' => HINT_PROMPT_VERSION, 'judge' => $judge,
    'summary' => $summary, 'rows' => $rows,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
echo "\nSaved " . str_replace(__DIR__ . '/', 'tools/', $out) . "\n";
?>
