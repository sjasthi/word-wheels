# Word Wheel Puzzle Generator

A web-based Word Wheel puzzle generator and player. A puzzle creator supplies a 7–9 character word, and the application generates a visual word wheel where the letters are scrambled around a circular layout. Visitors attempt to identify the hidden target word from the wheel.

---

## Project Status

**Current iteration: FP3**

This is an active capstone project. Admins create, save, schedule, and mass-generate puzzles on session-protected admin pages; players solve the daily puzzle on the site root. Both run on a PHP/MySQL backend. Hosting on Bluehost is planned for an upcoming iteration.

### What's working
- Word input and validation (7–9 characters, letters only, no spaces)
- Word wheel generation with an optional first-letter center hub
- Configurable direction — clockwise, anticlockwise, or random
- Center character toggle — when enabled, the first character remains in the
  center, including for random layouts
- Difficulty setting — hide 0, 1, 2, or 3 letters from the wheel
- Randomized starting position for outer ring letters each time a puzzle is generated
- Random layout — shuffles outer-ring characters while preserving the answer
- "New layout" button re-randomizes letter positions without re-entering the word
- Guess input with correct/incorrect feedback
- Reveal button — shows the full answer and highlights previously hidden letters in green
- Multilanguage support — correctly handles non-Latin scripts including Japanese, Chinese, Korean, and other Unicode character sets via `Intl.Segmenter`
- Three-column layout on wide screens — creator, wheel, and saved puzzles side by side, so a saved puzzle can be picked without scrolling away from the wheel
- MySQL schema and PHP API for saving, listing, loading, updating, and deleting puzzles
- **Saved puzzles** panel (requires PHP/MySQL):
  - **Save puzzle** with an optional puzzle name (up to 100 characters; blank shows as "Unnamed")
  - Saved list shows each puzzle's name, word, and a readable save date/time; the list refreshes and highlights the puzzle after saving
  - Loading a puzzle shows the exact same wheel that was saved (same starting position, letter order, and hidden letters)
  - Loading a puzzle also fills the **Create a puzzle** form with its word and settings, so **Generate wheel** recreates it with a fresh layout
- Tabbed admin dashboard: **Create Puzzle**, **Batch Generate**, and **Manage Puzzles** (filters, sortable columns, wheel preview, scheduling, and bulk schedule/unschedule/print/delete). The open tab is kept in the URL, so a refresh returns to it, and the Manage table updates by itself after puzzles are saved.
- No draft/published status: every saved puzzle is live. Scheduled for today = a daily puzzle; scheduled later = hidden until that day; unscheduled or past = in the free play pool. Delete puzzles you don't want.
- Player page (site root) with today's scheduled puzzles (several per day, with numbered pills to move between them), **free play** with unscheduled and past puzzles, and a daily streak kept in the player's browser
- **Batch Generate** (admin only) — import a `.txt` file, filter words by length (any range within 3–12), generate up to 100 wheels with the same or varied settings, pick which ones to keep, and print or save them to the database
- Short words and hidden letters: Batch Generate and Sandbox disable hidden-letter choices the shortest word can't support and explain why, and the save API rejects a puzzle that hides too many letters (at least one ring letter always stays visible)
- **Sandbox** (`sandbox.html`) — players paste their own word bank, choose length, direction, center letter, and hidden letters, and play wheels built from random words in the bank. Nothing is saved to the server.
- Word lists (Batch Generate and Sandbox) keep letters-only words; words with apostrophes, hyphens, or numbers are skipped and listed so they can be fixed
- Printing (browser print / Save as PDF) from Batch Generate or Manage Puzzles, with 1–8 puzzles per page and a solutions page at the end
- One shared puzzle engine (`wheel.js` / `wheel.css`) used by every page, so a saved wheel looks the same everywhere: dashboard, preview, printout, and player page

### Not yet implemented
- Player progress on the server or tied to an account (streaks and solved/revealed status live in the browser for now)
- A global admin setting for min/max word length on the dashboard (it still accepts 7–9)
- Bluehost deployment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Bootstrap 5.3 |
| Interactivity | JavaScript (ES6+), jQuery 3.7 |
| Backend | PHP |
| Database | MySQL |
| Hosting (planned) | Bluehost |
| Version Control | GitHub |

---

## How to Run (Current Build)

No build step is required. Bootstrap and jQuery are loaded from CDN.

1. Clone the repository
```
git clone https://github.com/sjasthi/word-wheels.git
```
2. Serve the project folder with PHP (for example from XAMPP's `htdocs`)
3. Import `sql/wordwheel_schema.sql` into MySQL and set the credentials in `api/db.php`
4. Open the site root for the player page, or `admin/` to log in as an admin

If your database was created from an older version of the schema, run the migrations in `sql/` once instead of re-importing:

- `sql/migrate_add_name.sql` — adds the optional puzzle `name` column
- `sql/migrate_remove_status.sql` — removes the draft/published `status` column. Drafts become live, so read the notes at the top of the file and delete unwanted drafts first.
- `sql/migrate_add_layout.sql` — adds the saved wheel layout columns (`start_slot`, `ring_order`, `hidden_indexes`). Every puzzle must have a layout, so delete and re-create any puzzles saved before this migration; they show an "invalid layout" message.

The root `.htaccess` tells Apache to make browsers revalidate `.html`, `.js`, and `.css` files on every load, so edits show up without a hard refresh.

---

## How to Use

### Admin dashboard — Create Puzzle tab (`admin/dashboard.php`)

1. Enter a word between 7 and 9 letters in the **Configuration** panel
2. Select a direction — random (the default), clockwise, or anticlockwise
   (with a center character, random keeps the first character in the center)
3. Choose whether to show a center character and how many letters to hide
4. Click **Generate wheel**
5. The wheel appears in the middle panel — type your guess and click **Check**
6. Use **New layout** to re-randomize letter positions for the same word
7. Use **Reveal** to show the answer if stuck
8. In the **Save & Load** panel on the right, optionally type a puzzle name and click **Save** to store the current wheel
9. Click **Load saved puzzles** and pick one — the same wheel appears, and the configuration form fills in with that puzzle's settings
### Batch Generate tab

1. Choose a `.txt` file. Any text works: one word per line, a comma-separated list, or a passage from a book. Spaces, line breaks, and punctuation between words separate them, and repeated words are listed once. Words with an apostrophe, hyphen, or number inside (`doesn't`, `well-known`, `abc123`) are skipped and named in the status line; edit them to letters only (e.g. `children's` → `children`) if you want them.
2. Set the min and max length (anywhere from 3 to 12). Words in range appear as checkboxes, with the first 100 selected.
3. Pick "Same settings for every word" and set them, or "Vary settings for each word". With "Same settings", hidden-letter choices that the shortest word (the min length) can't support are disabled, with the reason shown. With "Vary", each word gets a hidden count it can support.
4. Click **Mass generate** to preview every puzzle
5. Untick **Include** on any puzzle you don't want (or use **Include all** / **Include none**). **New layout** re-rolls one puzzle's wheel without changing its word.
6. Click **Print**, choose how many puzzles per page (1–8), and print. Only included puzzles are printed; the solutions start on a new page.
7. Optionally enter a name prefix and click **Save to database**. Only included puzzles are saved, numbered without gaps ("Animals #1", "Animals #2", … even if some were left out). Saved puzzles are locked in the preview.

### Manage Puzzles tab

1. Filter by name/word, schedule status (unscheduled, today, upcoming, past), a specific scheduled date, language, and length; **More filters** adds hidden letters, center letter, and direction. Filters and sort are remembered in your browser.
2. Click a column header to sort by it; click again to reverse
3. Click a row to preview its wheel, set or clear its scheduled date, print, or delete it. Give a puzzle today's date to make it a daily puzzle.
4. Tick rows (the header checkbox ticks only the rows shown) to **Schedule** them on a date, **Unschedule**, **Print**, or **Delete** them in one step. Changes that affect today's daily puzzles ask first.

### Player page (site root)

1. **Daily puzzles:** today's scheduled puzzles. With more than one, use the numbered pills or ‹ › arrows to move between them. Type a guess and click **Check**, **Reveal** the answer, or **Skip** to the next unfinished puzzle. Solved and revealed puzzles are remembered in this browser, so a refresh can't undo a Reveal.
2. **Streak:** solving any daily puzzle without Reveal counts the day. Days with no puzzles scheduled don't break the streak.
3. **Free play:** after finishing today's puzzles (or when there are none), keep playing unscheduled puzzles and puzzles from earlier days. Upcoming puzzles never appear in free play. Free play doesn't count toward the streak.

### Sandbox (`sandbox.html`)

Linked from the bottom of the player page.

1. Paste words into the **Word bank**: one per line, comma-separated, or a paragraph. The status line shows how many fit and which were skipped (too short, too long, repeats, or apostrophes/hyphens/numbers).
2. In **Settings**, choose the word length (3–12), direction, center letter, and hidden letters. Hidden-letter choices that the shortest allowed word can't support are disabled, with the reason shown.
3. Click **Generate wheel**. Both cards fold away so the word list isn't next to the wheel; click **Show** to open them again.
4. Guess, **Reveal**, or use **New layout** (same word, current settings) and **New word** (next word from the bank). Every word comes up once before any repeats.

A bank with a single word works as a custom puzzle. The bank and settings are remembered in this browser only.

---

## Multilanguage Support

The application uses the browser's `Intl.Segmenter` API with NFC normalization to correctly split input into user-perceived characters (graphemes). This means non-Latin scripts — including Japanese, Chinese, Korean, and others — are handled correctly out of the box without any language-specific configuration.

Where `Intl.Segmenter` is unavailable (older browsers), the app falls back to `Array.from()` which handles most Unicode characters correctly.

---

## Project Roadmap

| Iteration | Goal |
|---|---|
| FP3 (current) | Core puzzle engine, wheel display, configurations, guess validation |
| FP4 | Basic UI improvements and configuration refinements |
| FP5 | Database layer — MySQL schema, puzzle persistence, admin interface |
| FP6 | Daily puzzle feature; playable puzzle improvements |
| FP7 | Batch processing (up to 100 words); multilanguage word pool groundwork |
| FP8 | PDF export — puzzle book generation via PHP |
| FP9 | Bluehost deployment; integration testing on live environment |
| FP10 / Final | Polish, accessibility, documentation, final submission |

---

## Known Limitations

- Unsaved puzzles are lost on refresh, including a mass-generated set that hasn't been saved
- The Sandbox word bank lives in the player's browser (`localStorage`); there is no teacher-managed bank yet
- Player streaks and daily progress are per browser: clearing site data or switching devices starts over
- The player endpoints send each puzzle's letters in answer order so the browser can check guesses, so a determined player could read the answer from the network response
- The save API doesn't check the admin session yet (the list, load, update, delete, and bulk APIs do)
- Mass generate reads `.txt` files only. Languages written without spaces between words (Chinese, Japanese) come out as whole phrases rather than separate words.
- Saved puzzles are always tagged with language `en` (no language picker yet)
- No server-side word validation — the app trusts the user to enter a real word
- When enabled, the center letter is always the first character of the input
  word, including in random layouts
- Single word input only — phrases with spaces are not currently supported

---

## Team

- **Course:** ICS 499 - Capstone Project
- **Instructor:** Siva Jasthi
- **Team:** Austin Nguyen, Henry Nguyen
- **Iteration:** FP3 | September 29th, 2026
