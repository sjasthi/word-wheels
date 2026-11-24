<?php
// ============================================================
// Word Wheel — try AI hints from the command line
// ============================================================
// Run from the repo root:
//   php tools/try_hints.php fishing spring xqzvt
//   php tools/try_hints.php --raw fishing      (also print the HTTP request and response)
//
// Calls the real LLM, so it uses the free-tier quota. Saves nothing.
// ============================================================

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/hints.php';

$args  = array_slice($argv, 1);
$raw   = in_array('--raw', $args, true);
$words = array_values(array_filter($args, fn($a) => $a !== '--raw'));

if (!$words) {
    echo "Usage: php tools/try_hints.php [--raw] word [word ...]\n";
    exit(1);
}
if (!hints_enabled()) {
    echo "AI hints are off: set HINTS_API_KEY in api/config.local.php.\n";
    exit(1);
}

$pretty = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

foreach ($words as $word) {
    echo str_repeat('=', 60) . "\n$word\n" . str_repeat('=', 60) . "\n";

    if ($raw) {
        $body = llm_request_body($word);
        echo "--- Request: POST .../models/" . HINTS_MODEL . ":generateContent\n";
        echo "--- Headers: Content-Type: application/json, x-goog-api-key: (hidden)\n";
        echo json_encode($body, $pretty) . "\n";

        $res = llm_send($body);
        echo "--- Response: HTTP {$res['status']}\n";
        echo ($res['json'] !== null ? json_encode($res['json'], $pretty) : $res['raw']) . "\n\n";
        continue;
    }

    $start = microtime(true);
    $draft = generate_hint_draft($word);
    $ms    = (int)round((microtime(true) - $start) * 1000);

    echo $draft['ok'] ? "OK" : "NOT OK: {$draft['error']}";
    echo "  ({$draft['attempts']} attempt(s), {$ms} ms, {$draft['model']}, prompt {$draft['prompt_version']})\n";
    foreach ($draft['hints'] as $hint) {
        echo "  {$hint['type']}: {$hint['text']}\n";
    }
    foreach ($draft['usage'] as $i => $usage) {
        if (is_array($usage)) {
            echo "  tokens (attempt " . ($i + 1) . "): prompt " . ($usage['promptTokenCount'] ?? '?')
               . ", reply " . ($usage['candidatesTokenCount'] ?? '?')
               . ", thinking " . ($usage['thoughtsTokenCount'] ?? 0) . "\n";
        }
    }
    echo "\n";
}
?>
