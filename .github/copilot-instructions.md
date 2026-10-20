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

1. The creator supplies a 7-, 8-, or 9-character word on the dashboard. Mass generation lets the admin pick any length range within 3–12. Current input validation accepts letters only and does not support spaces; do not silently broaden that contract.
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
- When random layout is selected with a center character, the first character
  of the target word must always remain the center character; only the
  remaining characters are shuffled around the outer ring.
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
- **Puzzle storage:** persist target answer, optional puzzle name, language, layout direction, center-character setting, hidden-character count, generated layout data (`start_slot`, `ring_order`, `hidden_indexes`), and timestamps. Loading a saved puzzle must show the same wheel that was saved; only **New layout** or **Generate wheel** creates a new layout.
- **Daily puzzle:** select and display one deterministic or explicitly assigned puzzle per day; do not change the answer merely because the wheel is re-rendered.
- **Batch processing:** accept up to 100 words, validate each independently, report row-level errors, and avoid partially claiming success for failed rows.
- **PDF export:** generate a printable puzzle book from saved puzzles, with answers handled intentionally (for example, a separate answer section) rather than exposing answers accidentally in the player view.

Keep admin operations and visitor operations distinct in authorization and in UI. Never trust client-side validation alone once PHP/MySQL persistence is introduced; repeat validation and authorization checks on the server.

## Repository layout

- `index.html` — the **player** page (site root). It loads today's published, scheduled puzzle from `api/get_daily.php` and offers guess and reveal only. Its engine code is inline in the page.
- `admin/dashboard.php` + `admin/dashboard.js` — the **creator** page (session-protected). The top section is a three-column row on `lg` screens and up: **Configuration** (`col-lg-3`), the wheel preview (`col-lg-5`), and **Save & Load** (`col-lg-4`). Columns stack below `lg`. The Save & Load card holds the save form (`#saveForm`: optional `#nameInput` plus the submit button `#saveBtn`), the **Load saved puzzles** button, `#savedStatus`, and `#savedList`. Keep save/load controls in this card, not in the preview panel. Below it, **Manage Puzzles** is a server-rendered table for publish/unpublish, scheduling, and delete. The header links to **Mass generate**.
- `admin/batch.php` + `admin/batch.js` — the **Mass generate** page (session-protected). See "Mass generation" below.
- `admin/login.php`, `admin/logout.php` — admin session handling. Pages check `$_SESSION['admin']`.
- `wheel.js` + `wheel.css` — shared puzzle engine (`window.WordWheel`) and wheel styles. Currently used only by `admin/batch.php`.
- `script.js` — the old combined creator page script. Nothing loads it anymore; its logic now lives in `admin/dashboard.js`.
- `api/` — JSON endpoints built on PDO. `db.php` exposes `get_db()` (utf8mb4, exceptions, `FETCH_ASSOC`, real prepared statements).
- `sql/wordwheel_schema.sql` — MySQL schema for `users` and `puzzles`, plus a default admin seed. Fresh installs use this file.
- `sql/migrate_*.sql` — one-time `ALTER TABLE` migrations for databases created from an older schema (`migrate_add_name.sql`, `migrate_add_layout.sql`). When adding a column, update `wordwheel_schema.sql` **and** add a matching migration.
- `.htaccess` — sends `Cache-Control: no-cache` for `.html`, `.js`, and `.css` so browsers revalidate front-end files on every load.

The site must be served by PHP with MySQL (for example XAMPP or Bluehost). Every page now depends on the API or an admin session.

The engine functions (`toChars`, `buildPuzzle`, `tilePosition`, rendering) are currently duplicated in `admin/dashboard.js`, the inline script in `index.html`, and `wheel.js`. Any change to layout or grapheme logic must be made in all three until those pages are moved onto `wheel.js`.

## Frontend puzzle engine contract

`admin/dashboard.js` (the creator) keeps all state inside one jQuery ready closure:

- `settings = { chars, direction, centralCharacter, hiddenCount }` is the puzzle definition. `chars` is the target word's graphemes **in answer order**.
- `buildPuzzle(settings)` derives a fresh random layout (`startSlot`, `ringOrder`, `hidden`, `solved`). `restorePuzzle(settings, layout)` rebuilds a puzzle from a saved layout `{ startSlot, ringOrder, hiddenIndexes }`, and returns `null` if the layout is missing or doesn't fit the settings. `render()` draws the wheel. `showResult(type, message)` writes a Bootstrap alert into `#result`.
- `startPuzzle(savedLayout)` renders from `settings`. With a saved layout it shows that exact wheel (falling back to `buildPuzzle` when `restorePuzzle` returns `null`, e.g. puzzles saved before layouts were stored). With no argument (Generate wheel, New layout) it builds a new random layout.
- Treat `buildPuzzle`, `restorePuzzle`, `startPuzzle`, `render`, and `showResult` as stable. Add features around them rather than changing them.
- To show a puzzle loaded from the database, set `settings`, call `fillCreateForm(settings)` so the **Create a puzzle** form mirrors it, then call `startPuzzle({ startSlot, ringOrder, hiddenIndexes })` with the saved layout fields.
- `loadSavedPuzzles(activeId)` fetches and renders the saved list and marks `activeId` as active. After a successful save, the list refreshes with the new puzzle highlighted and the name field clears.
- Saved-list items show the puzzle name (or an italic "Unnamed"), then the word and a localized save date/time (`formatSavedDate`). Do not show the database `id`, direction, hidden count, or draft/published status in the main-page list; the `id` is only kept on the element for loading.
- `#result` sits inside `#puzzleArea`, which stays hidden until a puzzle exists. Saved-puzzles messages (including save success/failure) go to `#savedStatus` through `showSavedStatus`, not `#result`.
- The direction radios list **Random** first and it is the default.

## Shared engine (`wheel.js`)

`window.WordWheel` exposes `toChars(text)`, `extractWords(text)`, `buildPuzzle(settings)`, `tilePosition(puzzle, charIndex)`, and `renderWheel(puzzle, $wheel)`. Unlike the closure versions, these take the puzzle as an argument instead of reading a page-level `puzzle`, so one page can draw many wheels. `renderWheel` replaces the contents of a `.wheel` container (SVG ring plus tiles). Style wheels with `wheel.css` and size them by setting `--wheel-size` on the `.wheel` or an ancestor. `.wheel` sets `print-color-adjust: exact` so the blue hub prints.

`extractWords` pulls words out of free text with `/[\p{L}\p{M}]+(?:[‌‍][\p{L}\p{M}]+)*/gu` after NFC normalization: runs of letters and combining marks, keeping zero-width joiners between letters. Spaces, punctuation, digits, and line breaks all act as separators, so word-per-line lists, comma-separated lists, and prose all work without format detection. Telugu vowel signs and virama are combining marks, so Telugu words stay whole. Scripts without spaces between words (Chinese, Japanese) would come out as whole phrases.

## Mass generation (`admin/batch.php`)

Admin-only page that turns a text file into a printable puzzle set. The flow is:

1. **Import:** `.txt` only, at most 5 MB. The file is read in the browser (`File.arrayBuffer` + `TextDecoder`), as UTF-8 unless a UTF-16 byte-order mark is present. No server-side parsing.
2. **Filter:** words are de-duplicated case-insensitively (first spelling wins) and filtered by grapheme length using the page's **Min/Max length** inputs. These default to 7–9 and are limited to 3–12 (`LENGTH_LIMITS`). The status line reports how many were too short, too long, or repeated.
3. **Pick:** words in range appear as checkboxes, with the first 100 checked. **Mass generate** is disabled when 0 or more than 100 are selected (`MAX_PUZZLES`).
4. **Configure:** either "Same settings for every word" (direction, center character, hidden count) or "Randomize settings for each word". In both modes the hidden count is capped at ring size − 1, so short words always show at least one ring letter, and the capped value is what gets saved.
5. **Generate:** builds each puzzle with `buildPuzzle` and renders `#sheet`. The sheet has one `section.puzzle` per word (heading, instructions, wheel, blank answer line) followed by a `section.solutions` numbered list of answers. The screen view matches the printout: a single column in the same order. A screen-only `.no-print` note under each wheel shows its settings.
6. **Print:** `window.print()`. Print CSS hides `.no-print`, prints one puzzle per page (`break-after: page`), and starts the solutions on a new page. Answers must appear only in the solutions section.
7. **Save all (optional):** posts each puzzle to `api/save_puzzle.php` one at a time with its generated layout, so the saved wheel matches the printout. Names are `"<prefix> #<n>"` when a prefix is given, otherwise unnamed. Failures are listed per puzzle, and clicking **Save all** again retries only the unsaved ones. Changing the file, length range, or selection clears the sheet.

Not covered yet: a global admin min/max setting for single-puzzle creation (the dashboard still uses 7–9), server-side length validation in `save_puzzle.php`, a single-request batch save endpoint, and file formats other than `.txt`.

## Puzzle API

Every endpoint returns JSON shaped as `{ success: true, ... }` or `{ success: false, error }` with a matching 4xx/5xx status. The endpoints do not send a `Content-Type` header, so jQuery calls must set `dataType: "json"`. Error handlers should read `error` from `xhr.responseJSON` and fall back to `JSON.parse(xhr.responseText)`. Use relative URLs (`api/...` from the root page, `../api/...` from `admin/`).

| Endpoint | Method | Input | Success payload |
|---|---|---|---|
| `api/save_puzzle.php` | POST JSON | `word, arrangement, direction, hidden_count, center_letter, language`; optional `name`; optional layout `start_slot, ring_order, hidden_indexes` | `id` |
| `api/get_all.php` | GET | optional `?status=draft\|published` | `puzzles[]` (`id, name, word, direction, hidden_count, center_letter, language, status, scheduled_date, created_date`; no arrangement or layout) |
| `api/get_puzzle.php` | GET | `?id=` | `puzzle` with `name`, decoded `arrangement` array, and layout fields; any status (404 if the id doesn't exist) |
| `api/get_daily.php` | GET | none | today's published, scheduled `puzzle`, including layout fields |
| `api/update_puzzle.php` | POST JSON | `id` + `status` and/or `scheduled_date` (admin session required) | — |
| `api/delete_puzzle.php` | POST JSON | `id` (admin session required) | — |

`save_puzzle.php` validation:

- `name` is trimmed; blank becomes `NULL` (shown as "Unnamed"). Longer than 100 characters → 400.
- The three layout fields are saved together or not at all. If all three are sent, they must fit the puzzle (`start_slot` within the ring size, `ring_order` length equal to the ring size, `hidden_indexes` length equal to `hidden_count`, all indexes inside `arrangement`), or the request fails with 400 `Invalid wheel layout.`
- On read, layout fields are `null` for puzzles saved without a layout; `start_slot` is cast to int and the JSON columns are decoded to arrays.

Field mapping between the API (snake_case) and the frontend `settings` (camelCase):

- `arrangement` ↔ `chars` (graphemes in answer order, never the on-screen ring order, because the layout is regenerated on every render)
- `word` = `chars.join("")`
- `direction` ↔ `direction` (`cw`, `ccw`, or `random`)
- `hidden_count` ↔ `hiddenCount` (0–3)
- `center_letter` ↔ `centralCharacter`
- `name` comes from `#nameInput`; it is metadata only and not part of `settings`
- `start_slot` ↔ `puzzle.startSlot`, `ring_order` ↔ `puzzle.ringOrder`, `hidden_indexes` ↔ `[...puzzle.hidden]` (a `Set` on the frontend). These describe one rendered wheel. Save them from `puzzle`, not `settings`, and pass them back as `{ startSlot, ringOrder, hiddenIndexes }` when loading.
- `language` has no UI yet. The frontend sends `"en"`.

### Current scope: admin and player split

- Creating, saving, loading, and mass-generating puzzles happen on session-protected `admin/` pages. The player page (`index.html`) only reads today's puzzle.
- New puzzles are stored with `status = 'draft'`. Publishing and a `scheduled_date` of today make a puzzle the daily puzzle. Do not show draft/published state in the Save & Load list; the Manage Puzzles table shows it.
- `update_puzzle.php` and `delete_puzzle.php` check the admin session. These known gaps remain: `save_puzzle.php` does not check the admin session; `get_all.php` and `get_puzzle.php` return target words to anyone; and `db.php` holds XAMPP default credentials in source.

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

In place: the MySQL schema and puzzle API, the admin creator dashboard with save/load and puzzle management, a player page for the daily puzzle, and mass generation of up to 100 puzzles from a text file with browser-print PDF output. Still open: player streak tracking (one play per day), a global admin min/max length setting, and the security gaps listed above. Planned work proceeds toward:

1. Remaining wheel configurations and UI improvements.
2. MySQL persistence and an admin interface.
3. Daily puzzle play.
4. Batch generation for up to 100 words and broader language support.
5. PDF puzzle-book export.
6. Bluehost deployment and live integration testing.
7. Accessibility, polish, documentation, and final submission.

When a request conflicts with this roadmap or the single-answer game mechanic, call out the conflict and preserve the clarified mechanic unless the user explicitly changes the requirements.
