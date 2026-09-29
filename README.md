# Word Wheel Puzzle Generator

A web-based Word Wheel puzzle generator and player. A puzzle creator supplies a 7–9 character word, and the application generates a visual word wheel where the letters are scrambled around a circular layout. Visitors attempt to identify the hidden target word from the wheel.

---

## Project Status

**Current iteration: FP3**

This is an active capstone project. The current build is a functional frontend prototype. Backend integration (PHP, MySQL) is planned for upcoming iterations.

### What's working
- Word input and validation (7–9 characters, letters only, no spaces)
- Word wheel generation with the first letter as the center hub
- Configurable direction — clockwise or anticlockwise
- Difficulty setting — hide 0, 1, 2, or 3 letters from the wheel
- Randomized starting position for outer ring letters each time a puzzle is generated
- "New layout" button re-randomizes letter positions without re-entering the word
- Guess input with correct/incorrect feedback
- Reveal button — shows the full answer and highlights previously hidden letters in green
- Multilanguage support — correctly handles non-Latin scripts including Japanese, Chinese, Korean, and other Unicode character sets via `Intl.Segmenter`

### Not yet implemented
- Center letter toggle (on/off) — center letter is currently always on
- Randomized letter order option (currently sequential from input word)
- Database persistence — puzzles are not saved between sessions
- Admin interface for managing saved puzzles
- Daily puzzle feature
- Batch puzzle generation
- PDF export
- Bluehost deployment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Bootstrap 5.3 |
| Interactivity | JavaScript (ES6+), jQuery 3.7 |
| Backend (planned) | PHP |
| Database (planned) | MySQL |
| Hosting (planned) | Bluehost |
| Version Control | GitHub |

---

## How to Run (Current Build)

No server or build step required for the current frontend prototype.

1. Clone the repository
```
git clone https://github.com/sjasthi/word-wheels.git
```
2. Open `index.html` directly in a browser

That's it. No dependencies to install — Bootstrap and jQuery are loaded from CDN.

---

## How to Use

1. Enter a word between 7 and 9 letters in the **Create a puzzle** panel
2. Select a direction — clockwise or anticlockwise
3. Choose how many letters to hide (0 = show all, up to 3 for higher difficulty)
4. Click **Generate wheel**
5. The wheel appears in the right panel — type your guess and click **Check**
6. Use **New layout** to re-randomize letter positions for the same word
7. Use **Reveal** to show the answer if stuck

---

## Multilanguage Support

The application uses the browser's `Intl.Segmenter` API with NFC normalization to correctly split input into user-perceived characters (graphemes). This means non-Latin scripts — including Japanese, Chinese, Korean, and others — are handled correctly out of the box without any language-specific configuration.

Where `Intl.Segmenter` is unavailable (older browsers), the app falls back to `Array.from()` which handles most Unicode characters correctly.

---

## Project Roadmap

| Iteration | Goal |
|---|---|
| FP3 (current) | Core puzzle engine, wheel display, configurations, guess validation |
| FP4 | Remaining configurations (center letter toggle, randomized order); basic UI improvements |
| FP5 | Database layer — MySQL schema, puzzle persistence, admin interface |
| FP6 | Daily puzzle feature; playable puzzle improvements |
| FP7 | Batch processing (up to 100 words); multilanguage word pool groundwork |
| FP8 | PDF export — puzzle book generation via PHP |
| FP9 | Bluehost deployment; integration testing on live environment |
| FP10 / Final | Polish, accessibility, documentation, final submission |

---

## Known Limitations

- Puzzles are not saved — refreshing the page loses the current puzzle
- No server-side word validation — the app trusts the user to enter a real word
- Center letter is always the first character of the input word (toggle coming in FP4)
- Single word input only — phrases with spaces are not currently supported

---

## Team

- **Course:** ICS 499 - Capstone Project
- **Instructor:** Siva Jasthi
- **Team:** Austin Nguyen, Henry Nguyen
- **Iteration:** FP3 | September 29th, 2026
