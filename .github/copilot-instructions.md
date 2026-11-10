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
- **Daily puzzle:** display the puzzles explicitly assigned to the day (published with that `scheduled_date`; one or more), in a fixed order; do not change the answer merely because the wheel is re-rendered.
- **Batch processing:** accept up to 100 words, validate each independently, report row-level errors, and avoid partially claiming success for failed rows.
- **PDF export:** generate a printable puzzle book from saved puzzles, with answers handled intentionally (for example, a separate answer section) rather than exposing answers accidentally in the player view.

Keep admin operations and visitor operations distinct in authorization and in UI. Never trust client-side validation alone once PHP/MySQL persistence is introduced; repeat validation and authorization checks on the server.

## Repository layout

- `index.html` — the **player** page (site root). Uses `wheel.js` and `wheel.css`; all page logic is in an inline script. Two modes share one play area (`#playArea`):
  - **Daily:** loads today's published puzzles from `api/get_daily.php`. Several puzzles can share a day; when there is more than one, `#dailyNav` shows ‹ › arrows and one numbered pill per puzzle, colored by status. Each puzzle can be checked, revealed, or skipped. Solved/revealed status is stored per day in `localStorage` under `wordwheel.player.v1`, so a refresh can't undo a Reveal. When every daily puzzle is finished, `#dailyDone` shows a summary and offers free play.
  - **Free play:** published puzzles from past days (or unscheduled) from `api/get_freeplay.php`, in random batches with `?exclude=` for ids already shown this session. Not saved and never counts toward the streak.
  - **Streak:** a day counts once any daily puzzle is solved without Reveal. It continues if the last counted day is the server's `previous_date` (the most recent earlier day with puzzles), so days with nothing scheduled don't break it. Shown in `#streakBadge`. Per-browser only.
  - Guesses use `WordWheel.checkGuess`. A row without a saved layout gets a fresh layout in `toPlayable` (a fallback for puzzles saved before the layout migration).
- `sandbox.html` + `sandbox.js` — the **Sandbox** player page, linked from the bottom of `index.html`. The player pastes a word bank and picks settings; wheels are built in the browser from random bank words and never saved. Setup IDs are prefixed `sb`; the play area reuses `index.html`'s IDs (`#wheel`, `#guessForm`, `#guessInput`, `#revealBtn`, `#result`, `#puzzleArea`). See "Sandbox" below.
- `admin/dashboard.php` — the admin page (session-protected), split into three Bootstrap tabs:
  - **Create Puzzle** (`#pane-create`): a three-column row on `lg` screens and up — **Configuration** (`col-lg-3`), the wheel preview (`col-lg-5`), and **Save & Load** (`col-lg-4`). Columns stack below `lg`. The Save & Load card holds the save form (`#saveForm`: optional `#nameInput` plus the submit button `#saveBtn`), the **Load saved puzzles** button, `#savedStatus`, and `#savedList`. Keep save/load controls in this card, not in the preview panel.
  - **Batch Generate** (`#pane-batch`): mass generation. All its IDs are prefixed `batch` (`#batchFileInput`, `#batchSheet`, …). See "Mass generation" below.
  - **Manage Puzzles** (`#pane-manage`): server-rendered table. Clicking a row expands a detail row with a wheel preview, scheduled date, Publish/Unpublish, Print, and Delete. Row checkboxes drive a bulk toolbar (Print selected / Delete selected).
  - **Print modal** (`#printModal`): asks for puzzles per page (1–8), then calls `printPuzzles`. Shared by Manage and Batch Generate.
- `admin/dashboard.js` — Create tab, Save & Load, Manage tab, and the print modal (`window.openPrintModal(puzzles)`).
- `admin/batch.js` — Batch Generate tab logic.
- `admin/print.js` — `printPuzzles(puzzles, { perPage })`: opens a print window with the puzzles grouped `perPage` to a page, then a solutions page, and calls `print()`. Wheels are drawn with `WordWheel.renderWheel` and styled by linking `wheel.css`.
- `admin/login.php`, `admin/logout.php` — admin session handling. Pages check `$_SESSION['admin']`.
- `wheel.js` + `wheel.css` — the shared puzzle engine (`window.WordWheel`) and wheel styles. Every page that shows a wheel uses them; there are no other copies of the layout or grapheme logic.
- `api/` — JSON endpoints built on PDO. `db.php` exposes `get_db()` (utf8mb4, exceptions, `FETCH_ASSOC`, real prepared statements). `player_puzzle.php` is a shared include for the player endpoints: `PLAYER_PUZZLE_COLUMNS` and `player_puzzle($row)` give `get_daily.php` and `get_freeplay.php` the same puzzle shape.
- `sql/wordwheel_schema.sql` — MySQL schema for `users` and `puzzles`, plus a default admin seed. Fresh installs use this file.
- `sql/migrate_*.sql` — one-time `ALTER TABLE` migrations for databases created from an older schema (`migrate_add_name.sql`, `migrate_add_layout.sql`). When adding a column, update `wordwheel_schema.sql` **and** add a matching migration.
- `.htaccess` — sends `Cache-Control: no-cache` for `.html`, `.js`, and `.css` so browsers revalidate front-end files on every load.

The site must be served by PHP with MySQL (for example XAMPP or Bluehost). Every page now depends on the API or an admin session.

Keep all puzzle-domain logic (layout, grapheme handling, API ↔ puzzle conversion, save payload) in `wheel.js`. Pages should call it rather than reimplement it.

## Create tab contract (`admin/dashboard.js`)

The Create tab keeps its state inside the dashboard's jQuery ready closure:

- `settings = { chars, direction, centralCharacter, hiddenCount }` is the puzzle definition. `chars` is the target word's graphemes **in answer order**.
- `startPuzzle()` builds a fresh random layout from `settings` (Generate wheel, New layout). `showPuzzle(puzzle)` puts a built or loaded puzzle on the wheel and resets the guess UI. `render()` redraws the current puzzle. `showResult(type, message)` writes a Bootstrap alert into `#result`.
- To show a puzzle loaded from the database: `puzzleFromApi(res.puzzle)`. If it returns `null`, report an invalid layout. Otherwise set `settings` from it, call `fillCreateForm(settings)` so the Configuration form mirrors it, then `showPuzzle(loaded)`.
- `loadSavedPuzzles(activeId)` fetches and renders the saved list and marks `activeId` as active. After a successful save, the list refreshes with the new puzzle highlighted and the name field clears.
- Saved-list items show the puzzle name (or an italic "Unnamed"), then the word and a localized save date/time (`formatSavedDate`). Do not show the database `id`, direction, hidden count, or draft/published status in the main-page list; the `id` is only kept on the element for loading.
- `#result` sits inside `#puzzleArea`, which stays hidden until a puzzle exists. Saved-puzzles messages (including save success/failure) go to `#savedStatus` through `showSavedStatus`, not `#result`.
- The direction radios list **Random** first and it is the default.

## Shared engine (`wheel.js`)

`window.WordWheel` exposes:

- `toChars(text)` — NFC-normalized graphemes (`Intl.Segmenter`, `Array.from` fallback).
- `extractWords(text)` — `{ words, rejected }` from free text (see below).
- `uniqueWords(list)` — `{ unique, repeats }`: drops repeats ignoring case (first spelling wins). Used for both words and rejected tokens.
- `LENGTH_LIMITS` (`{ min: 3, max: 12 }`) and `lengthRangeError(min, max)` — the word-list length range and the error text for an invalid min/max pair (`""` when valid).
- `filterByLength(entries, { min, max })` — splits `[{ word, chars }]` into `{ inRange, tooShort, tooLong }` by grapheme count.
- `maxHidden(length, centralCharacter)` — most letters (0–3) a word of that length can hide while still showing at least one ring letter.
- `applyHiddenLimit($select, minLength, centralCharacter)` — limits a "Hidden letters" `<select>` (options 0–3, each with a `data-label`) to `maxHidden(minLength, center)`: options above it are disabled and labeled "N (needs M+ letters)", and a too-high choice is lowered. Returns the explanatory note, or `""` when nothing is limited (`minLength` null = no limit). Used by Batch Generate and Sandbox.
- `checkGuess(puzzle, rawGuess)` — `"empty"`, `"correct"`, or `"wrong"` (NFC graphemes, locale lower-case, trimmed).
- `buildPuzzle(settings)` — settings + a fresh random layout `{ startSlot, ringOrder, hidden: Set, solved }`.
- `restorePuzzle(settings, { startSlot, ringOrder, hiddenIndexes })` — settings + that exact saved layout, or `null` if the layout doesn't fit: wrong lengths, repeated or out-of-range indexes, the hub letter in the ring or hidden, or an unknown direction.
- `puzzleFromApi(apiPuzzle)` — the **only** API → puzzle conversion. It returns the saved wheel exactly, or `null` for a missing or invalid layout. Callers show an error for `null`; they never substitute a random layout.
- `puzzleToApi(puzzle, name)` — the **only** puzzle → `save_puzzle.php` body, layout included.
- `apiError(xhr, fallback)` — reads `error` from a failed API response.
- `tilePosition(puzzle, charIndex)` and `renderWheel(puzzle, $wheel)`.

All functions take the puzzle as an argument (no page-level state), so one page can draw many wheels. `renderWheel` replaces the contents of a `.wheel` container (SVG ring plus tiles). Style wheels with `wheel.css` and size them by setting `--wheel-size` on the `.wheel` or an ancestor. `.wheel` sets `print-color-adjust: exact` so the blue hub prints.

`extractWords` splits NFC-normalized text into tokens: runs of letters, combining marks, digits, apostrophes (`'` `’` `ʼ`), hyphens, and zero-width joiners. Everything else (spaces, line breaks, commas, periods, quotes, brackets) separates tokens, so word-per-line lists, comma-separated lists, and prose all work without format detection. A token is a word only if it is letters and combining marks, with zero-width joiners allowed between letters — the same letters-only rule as the Create tab. Tokens with an apostrophe, hyphen, or digit inside (`doesn't`, `well-known`, `abc123`) are returned in `rejected` so the page can name them; tokens with no letters (`2024`) are ignored. Words are never split or repaired, so `children's` is rejected rather than becoming `children`. Telugu vowel signs and virama are combining marks, so Telugu words stay whole. Scripts without spaces between words (Chinese, Japanese) would come out as whole phrases.

## Mass generation (Batch Generate tab)

Admin-only tab on `admin/dashboard.php`, logic in `admin/batch.js`. It turns a text file into a printable puzzle set. The flow is:

1. **Import:** `.txt` only, at most 5 MB. The file is read in the browser (`File.arrayBuffer` + `TextDecoder`), as UTF-8 unless a UTF-16 byte-order mark is present. No server-side parsing.
2. **Filter:** words are de-duplicated with `uniqueWords` and filtered with `filterByLength` using the page's **Min/Max length** inputs. These default to 7–9 and are limited to 3–12 (`WordWheel.LENGTH_LIMITS`). The status line reports how many were too short, too long, or repeated, and how many tokens `extractWords` rejected (with up to 5 examples).
3. **Pick:** words in range appear as checkboxes, with the first 100 checked. **Mass generate** is disabled when 0 or more than 100 are selected (`MAX_PUZZLES`).
4. **Configure:** either "Same settings for every word" (`batchMode=same`: direction, center character, hidden count) or "Vary settings for each word" (`batchMode=vary`). The hidden-letter limit matches Sandbox, so the admin adjusts the setting instead of the code silently changing it:
   - **Same:** every listed word is at least Min length, so `applyHiddenLimit` disables `#batchHiddenSelect` options above `maxHidden(min, center)` and explains in `#batchHiddenNote`. It re-runs when Min/Max length or the center letter changes.
   - **Vary:** each word picks its center letter, then a hidden count from `0..maxHidden(word length, center)`.
   - In both modes `settingsFor` still caps `hiddenCount` at `maxHidden(word length, center)` as a safety net, and `save_puzzle.php` rejects anything above it.
5. **Generate:** builds each puzzle with `buildPuzzle` and renders a preview card per word into `#batchSheet` (heading, instructions, wheel, blank answer line, and a note with its settings). No answers are shown on screen.
6. **Print:** **Print / Save as PDF** passes the generated puzzles to `window.openPrintModal`. The modal asks for puzzles per page, and `printPuzzles` opens a print window with the puzzles then a solutions page. Answers must appear only in the solutions section.
7. **Save all (optional):** posts each puzzle to `api/save_puzzle.php` one at a time with its generated layout, so the saved wheel matches the printout. Names are `"<prefix> #<n>"` when a prefix is given, otherwise unnamed. Failures are listed per puzzle, and clicking **Save all** again retries only the unsaved ones. Changing the file, length range, or selection clears the sheet.

Not covered yet: a global admin min/max setting for single-puzzle creation (the dashboard still uses 7–9), server-side length validation in `save_puzzle.php`, a single-request batch save endpoint, and file formats other than `.txt`.

## Sandbox (`sandbox.html` + `sandbox.js`)

A visitor-side practice page with no server calls. It is separate from the saved-puzzle "free play" mode on `index.html`.

- **Word bank:** a textarea parsed with `extractWords` on every input, de-duplicated with `uniqueWords`, and filtered with `filterByLength`. The status line reports words ready and words skipped (too short, too long, repeats, rejected tokens with up to 5 examples).
- **Settings:** Min/Max length (3–12, default 7–9), direction (Random default), center letter (Yes default), hidden letters 0–3. Every bank word is at least `min` graphemes, so `applyHiddenLimit` disables hidden options above `maxHidden(min, center)` with the reason in the label; a too-high choice is lowered and explained in `#sbHiddenNote`. Each built puzzle also caps `hiddenCount` at `maxHidden(word length, center)`.
- **Play:** **Generate wheel** starts a fresh shuffled bag, deals a word, and collapses both setup cards. **New word** deals the next word (every word once before repeats; a refilled bag doesn't start with the word on screen). **New layout** keeps the word and re-reads direction, center, and hidden from the form. Check and Reveal use `checkGuess` and match the daily page's feedback. Editing the bank or length leaves the current wheel and refills the bag on the next deal.
- **Persistence:** bank text and settings in `localStorage` under `wordWheel.sandbox`, wrapped in try/catch. The page works without it.
- The setup cards' Hide/Show is a jQuery toggle with `aria-expanded`; the page does not load Bootstrap's JS.

## Puzzle API

Every endpoint returns JSON shaped as `{ success: true, ... }` or `{ success: false, error }` with a matching 4xx/5xx status. Most endpoints do not send a `Content-Type` header (only `get_daily.php` and `get_freeplay.php` do), so jQuery calls must always set `dataType: "json"`. Error handlers should read `error` from `xhr.responseJSON` and fall back to `JSON.parse(xhr.responseText)`. Use relative URLs (`api/...` from the root page, `../api/...` from `admin/`).

| Endpoint | Method | Input | Success payload |
|---|---|---|---|
| `api/save_puzzle.php` | POST JSON | `word, arrangement, direction, hidden_count, center_letter, language, start_slot, ring_order, hidden_indexes`; optional `name`. Build it with `WordWheel.puzzleToApi`. | `id` |
| `api/get_all.php` | GET | optional `?status=draft\|published` | `puzzles[]` (`id, name, word, direction, hidden_count, center_letter, language, status, scheduled_date, created_date`; no arrangement or layout) |
| `api/get_puzzle.php` | GET | `?id=` | `puzzle` with `name`, decoded `arrangement` array, and layout fields; any status (404 if the id doesn't exist) |
| `api/get_daily.php` | GET | none | `date` (server's today), `previous_date` (most recent earlier day with published puzzles, or `null`), and `puzzles[]` — today's published puzzles ordered by `id`; may be empty |
| `api/get_freeplay.php` | GET | optional `?exclude=12,15` (ids already played) | `puzzles[]` — a random batch of up to 20 published puzzles that are unscheduled or scheduled before today; empty when all are excluded |
| `api/update_puzzle.php` | POST JSON | `id` + `status` and/or `scheduled_date` (admin session required) | — |
| `api/delete_puzzle.php` | POST JSON | `id` (admin session required) | — |

`save_puzzle.php` validation:

- `name` is trimmed; blank becomes `NULL` (shown as "Unnamed"). Longer than 100 characters → 400.
- `arrangement` must be an array.
- `hidden_count` must be 0–3 and at most `maxHidden` for the word (ring size − 1, so one ring letter stays visible) → otherwise 400 `This word is too short to hide N letters (at most M).`
- The layout is **required**: a puzzle can only be saved after a wheel has been generated. Missing layout fields → 400 `Missing wheel layout…`.
- The layout must fit the puzzle, using the same rules as `restorePuzzle`, or the request fails with 400 `Invalid wheel layout.`:
  - `start_slot` within the ring size
  - `ring_order` has exactly the ring's indexes (no repeats; excludes index 0 when there is a center letter)
  - `hidden_indexes` has `hidden_count` distinct ring indexes
- On read, `start_slot` is cast to int and the JSON columns are decoded to arrays. The columns are still nullable in MySQL, but every saved puzzle has a layout.

Field mapping between the API (snake_case) and the frontend `settings` (camelCase):

- `arrangement` ↔ `chars` (graphemes in answer order, never the on-screen ring order, because the layout is regenerated on every render)
- `word` = `chars.join("")`
- `direction` ↔ `direction` (`cw`, `ccw`, or `random`)
- `hidden_count` ↔ `hiddenCount` (0–3)
- `center_letter` ↔ `centralCharacter`
- `name` comes from `#nameInput`; it is metadata only and not part of `settings`
- `start_slot` ↔ `puzzle.startSlot`, `ring_order` ↔ `puzzle.ringOrder`, `hidden_indexes` ↔ `[...puzzle.hidden]` (a `Set` on the frontend). These describe one rendered wheel. `puzzleToApi` saves them from the built puzzle (not `settings`), and `puzzleFromApi` reads them back.
- `language` has no UI yet. The frontend sends `"en"`.

### Current scope: admin and player split

- Creating, saving, loading, and mass-generating puzzles happen on session-protected `admin/` pages. The player page (`index.html`) only reads published puzzles: today's daily puzzles and free play. Player endpoints use `player_puzzle()`, which leaves out `word` and `name` but includes `arrangement` (the answer has to reach the browser for `checkGuess`).
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

In place: the MySQL schema and puzzle API, the tabbed admin dashboard (create with save/load, batch generation of up to 100 puzzles from a text file, and puzzle management with preview, scheduling, and bulk actions), browser-print PDF output with 1–8 puzzles per page, a player page with several daily puzzles, free play, and a per-browser streak, the Sandbox practice page, and a single shared engine in `wheel.js`. Still open: server-side or account-based player progress (streaks live in `localStorage` today), a global admin min/max length setting, and the security gaps listed above. Planned work proceeds toward:

1. Remaining wheel configurations and UI improvements.
2. MySQL persistence and an admin interface.
3. Daily puzzle play.
4. Batch generation for up to 100 words and broader language support.
5. PDF puzzle-book export.
6. Bluehost deployment and live integration testing.
7. Accessibility, polish, documentation, and final submission.

When a request conflicts with this roadmap or the single-answer game mechanic, call out the conflict and preserve the clarified mechanic unless the user explicitly changes the requirements.
