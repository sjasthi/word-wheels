# Word Wheel: developer notes

Setup, deployment and how the code works. For how to play and how teachers use the site, see the [README](../README.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Bootstrap 5.3 |
| Interactivity | JavaScript (ES6+), jQuery 3.7 |
| Backend | PHP |
| Database | MySQL |
| AI hints | Google Gemini API (free tier), called from PHP with cURL; no SDK |
| Hosting (planned) | Bluehost |
| Version Control | GitHub |

---

## How to run locally

No build step is required. Bootstrap and jQuery are loaded from CDN.

1. Clone the repository
```
git clone https://github.com/sjasthi/word-wheels.git
```
2. Serve the project folder with PHP (for example from XAMPP's `htdocs`)
3. Import `sql/wordwheel_schema.sql` into MySQL and set the credentials in `api/db.php`
4. Open the site root for the player page (`index.php`), or `admin/login.php` to log in as a teacher
5. Optional, for AI hints: copy `api/config.example.php` to `api/config.local.php` and put a Gemini API key from [Google AI Studio](https://aistudio.google.com) in `HINTS_API_KEY`. `config.local.php` is git-ignored and Apache refuses to serve it. Without a key, AI hints are off and teachers can still write hints by hand.

If your database was created from an older version of the schema, run the migrations in `sql/` once instead of re-importing:

- `sql/migrate_add_name.sql` — adds the optional puzzle `name` column
- `sql/migrate_remove_status.sql` — removes the draft/published `status` column. Drafts become live, so read the notes at the top of the file and delete unwanted drafts first.
- `sql/migrate_add_layout.sql` — adds the saved wheel layout columns (`start_slot`, `ring_order`, `hidden_indexes`). Every puzzle must have a layout, so delete and re-create any puzzles saved before this migration; they show an "invalid layout" message.
- `sql/migrate_add_hints.sql` — adds the `puzzle_hints` table for AI hints. **Required:** the player pages read this table, so run it before updating the code. Safe to run twice.

The root `.htaccess` tells Apache to make browsers revalidate `.html`, `.js`, and `.css` files on every load, so edits show up without a hard refresh.

### Deploying to Bluehost

Upload every file that changed together; pages break if one shared file (for example `wheel.js`, `theme.css`, or `partials/layout.php`) is older than the pages that use it. `git diff --name-only <last-deployed-commit> HEAD` lists them. Never upload your local `api/db.php` over the server's copy: it holds the database credentials.

"Today" (which puzzles are daily, upcoming or free play) is the database server's date, `CURDATE()`, so every player and the dashboard agree on it. On shared hosting that server's clock may be in another time zone, so daily puzzles change at the server's midnight, which may not be local midnight.

After installing, change the admin password: `sql/wordwheel_schema.sql` creates the account with a well-known default (`ics499admin`), which is public in this repository. Store a new `password_hash()` value in the `users` table.

The root `.htaccess` also makes `index.php` the home page. `index.html` and `sandbox.html` are only small forwarding pages for old links and can be deleted once nothing points at them.

For AI hints on the server: run `sql/migrate_add_hints.sql` first, then create `api/config.local.php` on the server with the key (never upload a local copy). The hint code needs PHP 8.0 or newer with the cURL extension, and the server must be allowed to make outbound HTTPS requests to `generativelanguage.googleapis.com`. The `tools/` folder is for command-line use only and is blocked from the web by `tools/.htaccess`.

---

## Code map

| Part | Files |
|---|---|
| Shared puzzle engine (graphemes, layouts, rendering, guess checking) | `wheel.js`, `wheel.css` |
| Shared look, header and footer | `theme.css`, `partials/layout.php` |
| Player page (Daily, Free Play) | `index.php`, `player.js` |
| Sandbox tab | `sandbox.js` |
| Teacher dashboard | `admin/dashboard.php`, `admin/dashboard.js` (Create Puzzle, tabs, print modal), `admin/calendar.js`, `admin/manage.js`, `admin/batch.js`, `admin/print.js`, `admin/hint-editor.js` (hint editor shared by Manage and the Calendar pop-up) |
| API, one endpoint per use case | `api/*.php`; admin endpoints check the session with `api/admin_only.php` |
| Database | `sql/wordwheel_schema.sql`, migrations in `sql/` |

---

## Multilanguage support

The application uses the browser's `Intl.Segmenter` API with NFC normalization to correctly split input into user-perceived characters (graphemes). This means non-Latin scripts — including Japanese, Chinese, Korean, and others — are handled correctly out of the box without any language-specific configuration.

Where `Intl.Segmenter` is unavailable (older browsers), the app falls back to `Array.from()` which handles most Unicode characters correctly.

---

## AI hints: how it works

A teacher-reviewed LLM feature: the AI drafts, code checks, a teacher approves, and players only ever see approved hints. English only for now.

```
Teacher: Generate ─► api/generate_hints.php ─► Gemini (JSON schema) ─► guardrails ─► draft
         edit + Approve ─► api/save_hints.php ─► guardrails again ─► puzzle_hints table
Player:  get_daily / get_freeplay ─► puzzle + approved hints ─► 💡 Hint button (no AI calls)
```

| Piece | Where |
|---|---|
| The only code that talks to the provider (prompt, JSON schema, raw HTTPS call, retries with backoff, error messages); `hints_enabled()` is the on/off switch | `api/llm.php` |
| Guardrails, run on AI drafts **and** teacher edits: letters-only target word (3–12), no answer or answer forms (fish/fisherman, early/earlier), theme ≤ 5 words, ≤ 150 characters | `api/hint_checks.php` |
| Draft = LLM call + checks + one retry that tells the model what failed | `api/hints.php` |
| Admin endpoints | `api/generate_hints.php`, `api/save_hints.php` |
| Storage: what the AI wrote, what the teacher approved, prompt version, model | `puzzle_hints` table |

**Design decisions**
- **Human approval gate.** Generation never publishes. Only `save_hints.php`, behind the admin session, writes hints players can see.
- **Generate once, serve many.** Hints are stored per puzzle and delivered with the puzzle, so students never trigger LLM calls and everyone sees the same hints.
- **Honest records.** On approval, "what the AI wrote" comes from the server's own copy of the draft (kept in the PHP session), not from the browser, so the edit-rate report can be trusted.
- **Prompt versioning.** `HINT_PROMPT_VERSION` (now `v3`) is stored with every approved set. v1 → v2 fixed the model refusing words like "fishing"; v2 → v3 made hint 1 a short crossword-style clue so it's colder than hint 2.
- **Small blast radius.** Only logged-in teachers can trigger the AI, the target word is limited to 3–12 letters (no room for prompt injection), the model has no tools or data access, and its output must match a JSON schema and pass the checks.

**Tools (command line, from the repo root, e.g. `C:\xampp\php\php.exe tools\…`)**

| Command | What it does |
|---|---|
| `php tools/test_hint_checks.php` | Offline tests for the guardrails (no API calls) |
| `php tools/try_hints.php [--raw] word …` | Runs words through the real pipeline; `--raw` prints the HTTP request and response |
| `php tools/eval_hints.php [--no-judge]` | Scores the prompt on a fixed word list (`tools/eval_words.txt`); saves results to `tools/eval-results/` (git-ignored) |
| `php tools/hint_report.php` | From the database: how often teachers kept or edited the AI's hints, per prompt version |

**Latest eval** (prompt v3, `gemini-3.5-flash-lite`, 17 real words + 3 typos, Nov 2026):

| Measure | Result |
|---|---|
| Real words recognized / typos refused | 17/17 · 3/3 |
| Passed the checks on the first try | 94–100% |
| Average theme length · definition reading level | 2.9 words · about grade 4 |
| A model guesses the word from **hint 1 only** · from **both hints** | 41% · 82% |
| A model unscrambles the letters with no hints | 94% |

Hint 1 alone leads to the word much less often than both hints together, which is the intended "cold, then warm" order. The LLM judge (same model) rated every set accurate and kid-friendly, which says more about a model grading its own work than about the hints; treat the teacher's edits (`tools/hint_report.php`) as the real quality signal.

---

## Technical limitations

- The player endpoints send each puzzle's letters in answer order, and its approved hints, so the browser can check guesses; both can be read from the network response.
- Saved puzzles are always tagged with language `en` (there is no language picker).
- Editing a puzzle's hints in two tabs or browsers at once: the last save wins, with no warning. In one browser, two drafts for the same puzzle can also make the "what the AI wrote" record show the newer draft. Fix if needed: a version check on save and draft ids.
- AI hints use Gemini's free tier: requests are rate-limited and sometimes fail briefly (retried automatically; otherwise the teacher sees "try again"), and Google may use free-tier inputs to improve its products. Only the target word is sent, never student data.

---

## Future work

What we'd do next, and what each would take.

### AI hints in more languages

The first language to add is Telugu. Today `api/hints.php` asks Gemini for English hints, and `api/hint_checks.php` guards them with English-specific rules. Supporting another language needs:

1. **A language for each puzzle.** Puzzles are always saved as `en`. Bring back a language picker in Create Puzzle and Batch Generate, store it in `puzzles.language`, and offer **Generate hints** only for languages that have the pieces below.
2. **Per-language "doesn't give away the answer" checks.** `hint_answer_forms()` knows English endings (-ing, -ed, plurals, y → i). Each language needs its own word forms; for example, Spanish plurals and verb endings, or Vietnamese, where words are written as separate syllables.
3. **Word splitting for languages without spaces.** `hint_word_count()` and the token split in `hint_leaks_answer()` split on spaces, so a Chinese, Japanese or Thai sentence counts as one word: the 5-word clue limit never triggers, and a short answer in the middle of a sentence isn't caught. Server-side, PHP's `IntlBreakIterator::createWordInstance()` splits these the way `Intl.Segmenter` does in the browser.
4. **Prompts per language.** Ask for the hints in the puzzle's language, with the same rules (no answer, a vague clue, then one kid-friendly sentence).
5. **Test words per language.** Add word lists to `tools/eval_words.txt` (or one file per language) and rerun `tools/eval_hints.php` to measure pass rates. Turn a language on only once its results are good enough.

Hints written by hand already work in any language: the checks that run on save count graphemes and compare normalized text, so they accept any script. They're just weaker for languages without spaces (point 3), so the teacher's review matters more there.

### Other ideas

| Feature | What it would take |
|---|---|
| AI-themed puzzle sets | A teacher or student picks a theme ("Animals", "Space"); a new endpoint asks the LLM for a list of fitting words, checks each one with the same letters-only and length rules, and hands the list to the Sandbox or Batch Generate word bank. Words aren't stored until a teacher saves puzzles, and the theme text needs the same care as hints (kid-appropriate, no personal data). |
| Teachers can override the answer-leak check | `check_hint_list()` would return the "gives away the answer" result as a warning instead of an error. The hint editor shows it with an "Approve anyway" button, and `save_hints.php` accepts an override flag (recorded with the hints). The length and word-count rules stay hard limits. |
| Hints on printed puzzle sets | An option in the print window to include each puzzle's approved hints: the clue under the wheel, and the meaning with the answer key. `admin/print.js` would read the hints `get_all.php` already returns. |
| Check answers on the server | A `check_guess.php` endpoint that compares the guess and returns correct or wrong; hints fetched one at a time; the player page gets only the scrambled tiles. About a day, mostly in `player.js`. |
| Progress on any device | A class code plus nickname (no email or password), a progress table keyed by class and nickname, save and load endpoints, and the streak logic moved to the server. Needs a privacy review first (FERPA, and COPPA for under-13s). |
| Chinese/Japanese word lists in Batch Generate | Use `Intl.Segmenter` with `granularity: "word"` (the same API the wheel uses for letters) when splitting the imported text in `admin/batch.js`. |
| Phrases with spaces | Decide how a space appears on the wheel (a gap tile or a separator), ignore spaces when checking guesses, and update the length and hidden-letter rules in `wheel.js`. |
| Center letter other than the first | Store the center letter's position in a new column, and let the layout code use any position. |
| Spelling warning | A word list or dictionary API per language; warn instead of block, since names and topic words won't be listed. |
| Screen-reader-friendly wheel | Labels on the tiles and a text version of each wheel. Reading the ring in order would give clockwise puzzles away, so this needs its own design (for example, letters in alphabetical order plus the direction). |
| Safer editing by two teachers | A version number on each puzzle; reject a save made from an out-of-date copy. |
| Login protection | Throttle repeated failed logins and add CSRF tokens on admin requests. |
| One word-length setting | Create Puzzle allows 7–9 letters while Batch Generate and Sandbox allow 3–12; one admin setting could control all three. |

---

## Project roadmap

| Iteration | Goal |
|---|---|
| FP3 | Core puzzle engine, wheel display, configurations, guess validation |
| FP4 | Basic UI improvements and configuration refinements |
| FP5 | Database layer — MySQL schema, puzzle persistence, admin interface |
| FP6 | Daily puzzle feature; playable puzzle improvements |
| FP7 | Batch processing (up to 100 words); multilanguage word pool groundwork |
| FP8 | PDF export — puzzle book generation via PHP |
| FP9 | Bluehost deployment; integration testing on live environment |
| FP10 / Final (current) | Polish, accessibility, documentation, final submission |
