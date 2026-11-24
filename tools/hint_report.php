<?php
// ============================================================
// Word Wheel — how often do teachers change the AI's hints?
// ============================================================
// Run from the repo root:  php tools/hint_report.php
//
// Reads puzzle_hints (no API calls) and compares what the AI wrote
// (generated_hints) with what the teacher approved (final_hints).
// A low "kept as written" rate for a prompt version means teachers
// are fixing a lot of its hints. That's the real-world counterpart to
// tools/eval_hints.php.
// ============================================================

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../api/hint_checks.php';

$rows = get_db()->query("
    SELECT p.word, h.generated_hints, h.final_hints, h.prompt_version, h.model
    FROM puzzle_hints h
    JOIN puzzles p ON p.id = h.puzzle_id
    ORDER BY h.approved_at
")->fetchAll();

if (!$rows) {
    echo "No approved hints yet.\n";
    exit;
}

$byVersion = [];
$edited = [];
$byHand = 0;

foreach ($rows as $r) {
    if ($r['generated_hints'] === null) {
        $byHand++;
        continue;
    }
    $ai    = stored_hints($r['generated_hints']);
    $final = stored_hints($r['final_hints']);
    $changed = [];
    foreach ($final as $i => $hint) {
        if (($ai[$i]['text'] ?? null) !== $hint['text']) {
            $changed[] = $hint['type'];
        }
    }

    $key = ($r['prompt_version'] ?? '?') . ' · ' . ($r['model'] ?? '?');
    $byVersion[$key] ??= ['total' => 0, 'kept' => 0, 'theme' => 0, 'definition' => 0];
    $byVersion[$key]['total']++;
    if (!$changed) $byVersion[$key]['kept']++;
    foreach ($changed as $type) $byVersion[$key][$type]++;
    if ($changed) $edited[] = ['word' => $r['word'], 'ai' => $ai, 'final' => $final, 'changed' => $changed];
}

$pct = fn($n, $d) => $d ? round(100 * $n / $d) . '%' : 'n/a';

echo "Approved puzzles with hints: " . count($rows) . " (" . (count($rows) - $byHand) . " from the AI, $byHand written by hand)\n\n";
echo sprintf("%-34s %6s %10s %14s %16s\n", 'Prompt · model', 'AI', 'Kept as is', 'Theme edited', 'Definition edited');
foreach ($byVersion as $key => $v) {
    echo sprintf("%-34s %6d %10s %14s %16s\n", $key, $v['total'],
        $pct($v['kept'], $v['total']), $pct($v['theme'], $v['total']), $pct($v['definition'], $v['total']));
}

if ($edited) {
    echo "\nEdited by a teacher:\n";
    foreach ($edited as $e) {
        echo "  {$e['word']}\n";
        foreach ($e['final'] as $i => $hint) {
            if (in_array($hint['type'], $e['changed'], true)) {
                echo "    {$hint['type']}: \"" . ($e['ai'][$i]['text'] ?? '') . "\" → \"{$hint['text']}\"\n";
            }
        }
    }
}
?>
