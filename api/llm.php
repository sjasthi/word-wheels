<?php
// ============================================================
// Word Wheel — LLM provider (Google Gemini, generateContent)
// ============================================================
// The only file that talks to the LLM. Everything else calls
// llm_generate_hints() and never sees the provider's request or
// response format, so switching providers only changes this file.
//
// Settings come from config.local.php (git-ignored); see
// config.example.php.
// ============================================================

if (is_file(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}
if (!defined('HINTS_API_KEY')) define('HINTS_API_KEY', '');
if (!defined('HINTS_MODEL'))   define('HINTS_MODEL', 'gemini-3.5-flash-lite');

// Bump whenever the prompt or schema below changes, so saved hints
// record which prompt wrote them.
const HINT_PROMPT_VERSION = 'v3';

const HINTS_TIMEOUT_SECONDS = 20;

// AI hints are switched off until a key is configured.
function hints_enabled(): bool {
    return HINTS_API_KEY !== '';
}

function llm_system_prompt(): string {
    return <<<PROMPT
You write hints for a word-guessing game played by grade-school students (ages 7 to 11).
The student sees the letters of one target word arranged on a wheel and tries to guess the word.
Write two hints for the target word. The student sees the first hint, then the second, so the first
must be clearly vaguer than the second.

- theme: a short clue in the style of an easy crossword clue, 2 to 5 words. It is a phrase, not a sentence,
  with no period at the end. It points to the general area (a place, a time, a kind of thing), loosely
  enough that several different words could fit. Do not describe what the thing is or does.
  Examples: "umbrella" -> "Rainy day helper". "pumpkin" -> "Autumn patch find".
- definition: a short, kid-friendly definition of the word, as one sentence of at most 15 words.

Rules for both hints:
- Never use the target word, any form of it (plural, -ing, -ed, -er), or any word that contains it.
- Use simple words a 3rd or 4th grader can read.
- Keep everything appropriate for young children.
- If the word has more than one common meaning, use the most common everyday meaning for both hints.
- If a rule makes a hint hard to write, describe the idea another way. For "fishing", say
  "animals that live in water" instead of "fish".

The target word can be any form of a word, such as a plural (apples), -ing (fishing), or -ed (jumped).
Those are real words.

"recognized" only says whether the target word is a real English word. Set it to true for any real word,
even when the hints are hard to write. Set it to false only for typos, gibberish, or names you don't know,
and then leave both hints as empty strings.
PROMPT;
}

// The JSON shape the model must return (JSON Schema).
function llm_hint_schema(): array {
    return [
        'type'       => 'object',
        'properties' => [
            'recognized' => ['type' => 'boolean', 'description' => 'True if this is a real English word you know.'],
            'theme'      => ['type' => 'string',  'description' => 'Crossword-style clue of 2 to 5 words, no period. Empty if not recognized.'],
            'definition' => ['type' => 'string',  'description' => 'Kid-friendly definition. Empty if not recognized.'],
        ],
        'required'             => ['recognized', 'theme', 'definition'],
        'additionalProperties' => false,
    ];
}

// The generateContent request body. $feedback explains why a previous
// attempt was rejected, so a retry can fix it.
function llm_request_body(string $word, ?string $feedback = null): array {
    $userText = "Target word: " . $word;
    if ($feedback !== null) {
        $userText .= "\n\nYour previous hints were rejected: " . $feedback
                   . "\nWrite new hints that follow every rule.";
    }

    return [
        'systemInstruction' => ['parts' => [['text' => llm_system_prompt()]]],
        'contents'          => [['role' => 'user', 'parts' => [['text' => $userText]]]],
        'generationConfig'  => [
            'responseMimeType'   => 'application/json',
            'responseJsonSchema' => llm_hint_schema(),
            'maxOutputTokens'    => 2048,
        ],
    ];
}

// POST a body to the model. Returns
//   [ 'status' => HTTP code (0 if unreachable),
//     'json'   => decoded response or null,
//     'raw'    => response text,
//     'error'  => cURL error or null ]
function llm_send(array $body): array {
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
         . rawurlencode(HINTS_MODEL) . ':generateContent';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . HINTS_API_KEY,
        ],
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => HINTS_TIMEOUT_SECONDS,
    ]);
    $raw    = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error  = $raw === false ? curl_error($ch) : null;

    return [
        'status' => $status,
        'json'   => is_string($raw) ? json_decode($raw, true) : null,
        'raw'    => is_string($raw) ? $raw : '',
        'error'  => $error,
    ];
}

// A message a teacher can act on, for a failed HTTP call.
function llm_http_error(array $res): string {
    if ($res['error'] !== null || $res['status'] === 0) {
        return "Couldn't reach the AI service. Check the server's internet connection and try again.";
    }
    switch (true) {
        case $res['status'] === 400:
            $detail = $res['json']['error']['message'] ?? '';
            return 'The AI service rejected the request.' . ($detail !== '' ? " ($detail)" : '');
        case $res['status'] === 401 || $res['status'] === 403:
            return 'The AI service rejected the API key. Check HINTS_API_KEY in api/config.local.php.';
        case $res['status'] === 404:
            return 'The AI model "' . HINTS_MODEL . '" was not found. Check HINTS_MODEL in api/config.local.php.';
        case $res['status'] === 429:
            return 'The AI service is busy (free-tier limit reached). Wait a minute and try again.';
        default:
            return 'The AI service had a problem (HTTP ' . $res['status'] . '). Try again in a moment.';
    }
}

// Ask the model for hints. Returns
//   [ 'ok' => bool, 'error' => string|null,
//     'raw' => decoded hint JSON from the model (or null),
//     'model' => model version that answered, 'usage' => token counts ]
function llm_generate_hints(string $word, ?string $feedback = null): array {
    $fail = fn(string $msg) => ['ok' => false, 'error' => $msg, 'raw' => null, 'model' => HINTS_MODEL, 'usage' => null];

    if (!hints_enabled()) {
        return $fail('AI hints are switched off: no API key is configured.');
    }

    $body = llm_request_body($word, $feedback);
    $res  = llm_send($body);

    // Temporary problems on the provider's side (overloaded, timed
    // out) usually clear within a second, so try once more.
    if ($res['status'] === 0 || $res['status'] >= 500) {
        sleep(1);
        $res = llm_send($body);
    }

    if ($res['status'] !== 200 || !is_array($res['json'])) {
        return $fail(llm_http_error($res));
    }

    $data = $res['json'];
    if (!empty($data['promptFeedback']['blockReason'])) {
        return $fail('The AI service declined to write hints for this word.');
    }

    $candidate = $data['candidates'][0] ?? null;
    $finish    = $candidate['finishReason'] ?? '';
    if (!$candidate || $finish !== 'STOP') {
        return $fail('The AI reply was cut off or blocked' . ($finish !== '' ? " ($finish)" : '') . '. Try again.');
    }

    // Join the answer's text parts, skipping any "thought" parts.
    $text = '';
    foreach ($candidate['content']['parts'] ?? [] as $part) {
        if (empty($part['thought']) && isset($part['text'])) {
            $text .= $part['text'];
        }
    }

    $hints = json_decode($text, true);
    if (!is_array($hints)) {
        return $fail('The AI reply was not valid JSON. Try again.');
    }

    return [
        'ok'    => true,
        'error' => null,
        'raw'   => $hints,
        'model' => $data['modelVersion'] ?? HINTS_MODEL,
        'usage' => $data['usageMetadata'] ?? null,
    ];
}
?>
