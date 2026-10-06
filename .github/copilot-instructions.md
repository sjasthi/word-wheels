# Word Wheels Copilot Instructions

## Project context

Word Wheels is an educational web application for grade-school students. It lets an administrator create and manage word-wheel puzzles and lets visitors play them in the browser. Preserve the existing frontend prototype while incrementally adding the planned PHP/MySQL backend and public hosting support.

The authoritative project references are:

- `README.md` for the current implementation status, supported behavior, limitations, and roadmap.
- `fp_reviews.txt` for the instructor's original project requirements.
- These instructions for the clarified game mechanic and implementation conventions below.

## Required technology stack

Use the existing stack unless a task explicitly requests a technology change:

- **Frontend markup and styling:** semantic HTML5, CSS3, and Bootstrap 5.3.
- **Frontend behavior:** modern browser JavaScript (ES6+) and jQuery 3.7 where it fits the existing code.
- **Backend:** PHP.
- **Database:** MySQL.
- **Hosting target:** Bluehost-compatible PHP/MySQL hosting.
- **Source control:** GitHub.

Do not introduce a frontend framework, backend framework, build system, or database engine without first confirming that the capstone requirements allow it. Prefer CDN-compatible, server-rendered, or otherwise Bluehost-friendly solutions over infrastructure that requires Node.js or a long-running application server in production.

## Core game mechanic

This is **not** a conventional word-wheel puzzle in which the player tries to find as many words as possible from a pool of letters.

Each puzzle has one target word selected by the puzzle administrator or puzzle creator:

1. The creator supplies a 7-, 8-, or 9-character word. Current input validation accepts letters only and does not support spaces; do not silently broaden that contract.
2. The application lays the target word's characters out as a configurable wheel.
3. The visitor guesses the single target word that the administrator has in mind, similar to hangman.
4. At baseline difficulty, all characters are visible and the challenge is recognizing the correct word from the wheel's layout and ordering.
5. At higher difficulty, exactly 1, 2, or 3 characters may be hidden. Hidden characters must be treated as unknown positions in the target word, not as an invitation to find unrelated words.
6. Guess validation compares the visitor's complete guess with the target answer and gives clear correct/incorrect feedback.
7. Reveal displays the complete target answer and identifies characters that had been hidden.

Keep this single-answer, hangman-like model consistent in UI labels, help text, validation, database fields, API endpoints, tests, and documentation. Avoid wording such as “find as many words,” “word list from the wheel,” or “9-letter word used to make the wheel” unless the feature specifically concerns puzzle creation.

## Puzzle configuration

The puzzle model and UI should support:

- Word length of 7, 8, or 9 characters.
- Clockwise, anticlockwise, or random character arrangement.
- A configurable center character: shown or omitted.
- Full visibility or 1, 2, or 3 hidden characters.
- A randomized starting position for the outer ring.
- Regenerating a new layout for the same target word without requiring re-entry.
- A language associated with each puzzle.

Do not conflate layout randomization with changing the answer. A new layout keeps the same target word and answer.

## Multilanguage and character handling

The application must be designed for languages other than English. Treat “character” as a user-perceived grapheme, not necessarily a JavaScript UTF-16 code unit or an ASCII letter:

- Use NFC normalization and `Intl.Segmenter` when available.
- Keep the existing `Array.from()` fallback for older browsers.
- Do not use ASCII-only regular expressions, string indexing, `.length`, or case conversion in ways that break Japanese, Chinese, Korean, accented Latin, or other supported scripts.
- Store text as Unicode in MySQL using `utf8mb4` and use an appropriate Unicode collation.
- Keep language metadata separate from the target word so future language-specific validation and word pools can be added without redesigning the puzzle model.
- Preserve the current 7–9 grapheme validation contract when changing or extracting the puzzle engine.

## Application areas

When implementing roadmap work, keep responsibilities separated:

- **Puzzle creator/admin:** enter target words, choose configuration, generate puzzles, save and edit puzzles, and run batch generation.
- **Visitor/player:** view the daily or selected puzzle, enter one complete guess, receive feedback, and optionally reveal the answer.
- **Puzzle storage:** persist target answer, language, layout direction, center-character setting, hidden-character count, generated layout data, and timestamps.
- **Daily puzzle:** select and display one deterministic or explicitly assigned puzzle per day; do not change the answer merely because the wheel is re-rendered.
- **Batch processing:** accept up to 100 words, validate each independently, report row-level errors, and avoid partially claiming success for failed rows.
- **PDF export:** generate a printable puzzle book from saved puzzles, with answers handled intentionally (for example, a separate answer section) rather than exposing answers accidentally in the player view.

Keep admin operations and visitor operations distinct in authorization and in UI. Never trust client-side validation alone once PHP/MySQL persistence is introduced; repeat validation and authorization checks on the server.

## Implementation conventions

- Inspect `README.md` before changing behavior and update it when current status, limitations, usage, or roadmap behavior changes.
- Preserve existing behavior unless the task explicitly changes it, especially the current feedback, reveal behavior, randomized layout behavior, and Unicode handling.
- Prefer small, testable puzzle-domain functions over duplicating layout or validation logic in event handlers, PHP pages, and database code.
- Use parameterized MySQL queries (PDO or the repository's established equivalent), explicit input validation, and escaped output.
- Do not put credentials in source code. Use Bluehost/environment configuration for database credentials.
- Make errors visible to the user in an accessible way; do not silently treat malformed input or failed saves as successful operations.
- Use semantic HTML, Bootstrap's responsive components, keyboard-accessible controls, labels, and sufficient visual contrast.
- Keep user-facing text clear and age-appropriate for grade-school learners while keeping administrator controls explicit.
- Avoid unrelated rewrites, dependency additions, or changes to the deployment model.

## Validation expectations

For puzzle-engine changes, verify at minimum:

- 7-, 8-, and 9-grapheme inputs work.
- Invalid lengths and invalid input are rejected consistently.
- Clockwise, anticlockwise, and random layouts preserve the same answer.
- Center-character on/off and 0–3 hidden-character settings are honored.
- A correct complete guess succeeds; an incorrect complete guess fails; partial or unrelated word-list guesses are not treated as success.
- Reveal exposes the intended answer and marks previously hidden characters.
- Non-Latin and combining-character input remains intact.

For PHP/MySQL features, also verify server-side validation, parameterized queries, authorization boundaries, error handling, Unicode storage, and behavior after a page refresh. For batch and PDF features, verify the 100-item boundary, row-level failures, and that generated documents do not leak answers unintentionally.

## Project roadmap awareness

The current frontend prototype is the baseline. Planned work proceeds toward:

1. Remaining wheel configurations and UI improvements.
2. MySQL persistence and an admin interface.
3. Daily puzzle play.
4. Batch generation for up to 100 words and broader language support.
5. PDF puzzle-book export.
6. Bluehost deployment and live integration testing.
7. Accessibility, polish, documentation, and final submission.

When a request conflicts with this roadmap or the single-answer game mechanic, call out the conflict and preserve the clarified mechanic unless the user explicitly changes the requirements.
