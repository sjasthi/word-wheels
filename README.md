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
- Admin login and dashboard for publishing, scheduling, and deleting puzzles
- Player page (site root) showing today's published, scheduled puzzle
- **Mass generate** (admin only) — import a `.txt` file, filter words by length (any range within 3–12), generate up to 100 wheels with shared or randomized settings, and print them one per page with a solutions page at the end (browser print / Save as PDF). Optionally save them all to the database.

### Not yet implemented
- Player streak tracking and limiting play to once per day
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
- `sql/migrate_add_layout.sql` — adds the saved wheel layout columns (`start_slot`, `ring_order`, `hidden_indexes`). Puzzles saved before this migration still load, but get a new random layout.

The root `.htaccess` tells Apache to make browsers revalidate `.html`, `.js`, and `.css` files on every load, so edits show up without a hard refresh.

---

## How to Use

### Admin dashboard (`admin/dashboard.php`)

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
10. In **Manage Puzzles**, publish a puzzle and give it today's date to make it the daily puzzle

### Mass generate (`admin/batch.php`, linked from the dashboard header)

1. Choose a `.txt` file. Any text works: one word per line, a comma-separated list, or a passage from a book. Punctuation, numbers, and spaces separate words, and repeated words are listed once.
2. Set the min and max length (anywhere from 3 to 12). Words in range appear as checkboxes, with the first 100 selected.
3. Pick "Same settings for every word" and set them, or "Randomize settings for each word"
4. Click **Mass generate** to see every puzzle, followed by a solutions list
5. Click **Print / Save as PDF**. Each puzzle prints on its own page, and the solutions start on a new page.
6. Optionally enter a name prefix (e.g. "Animals" → "Animals #1", "Animals #2", …) and click **Save all to database**

### Player page (site root)

Shows today's published puzzle. Type a guess and click **Check**, or **Reveal** the answer.

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
- The save API doesn't check the admin session yet, and the list/load APIs return answers to anyone
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
