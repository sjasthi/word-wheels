# Word Wheel

Word Wheel is a word puzzle game for the classroom. Each puzzle is a wheel of letters, and the goal is to find the word hidden in it. Teachers make the puzzles and pick which ones are the daily puzzles. Students play them on any computer, tablet or phone, with no account needed.

This guide explains how to play and how to run the game as a teacher. To install or deploy the site, see the [developer notes](docs/developer.md).

**Contents**

- [How to read a word wheel](#how-to-read-a-word-wheel)
- [For players](#for-players): [Daily](#daily) · [Streaks](#streaks) · [Free Play](#free-play) · [Sandbox](#sandbox) · [Hints](#hints) · [Printing a puzzle](#printing-a-puzzle) · [Where your progress is kept](#where-your-progress-is-kept)
- [For teachers](#for-teachers): [Logging in](#logging-in) · [How scheduling works](#how-scheduling-works) · [Calendar](#calendar) · [Create Puzzle](#create-puzzle) · [Batch Generate](#batch-generate) · [Manage Puzzles](#manage-puzzles) · [Hints for players](#hints-for-players) · [Printing worksheets](#printing-worksheets)
- [Limits at a glance](#limits-at-a-glance)
- [Known limitations](#known-limitations)

---

## How to read a word wheel

The letters of one word are placed around a circle. Find the word and type it in.

- **Center letter.** Some wheels have a letter in the yellow center. It is always the **first letter** of the word.
- **Direction.** The rest of the letters sit around the ring. On a **clockwise** or **anticlockwise** wheel they spell the word in order going that way, but the starting letter isn't marked: finding it is part of the puzzle. On a **random** wheel the ring letters are scrambled, so you have to unscramble them.
- **Hidden letters.** A dashed circle with **?** is a missing letter. A wheel can hide up to 3 letters, and at least one ring letter always stays visible.
- **Checking.** Capital letters don't matter. Only the puzzle's own word counts: another real word made from the same letters is marked "Not quite".
- **After solving.** Every letter appears. Letters that were hidden show in teal.

---

## For players

The game has three tabs: **Daily**, **Free Play** and **Sandbox**. Each tab works on its own, and the page remembers which tab you had open.

### Daily

The daily puzzles are the ones your teacher picked for today.

- There may be one puzzle or several. With more than one, use the numbered circles or the **‹ ›** arrows to move between them. A line underneath shows how many you've finished (for example, "2 of 3 puzzles completed today").
- Type your answer and press **Check**. You can keep guessing as many times as you like.
- **Skip** moves to the next puzzle you haven't finished. You can come back to a skipped puzzle at any time.
- **Reveal** shows the answer. A revealed puzzle is finished: you can't guess it again, even after refreshing the page.
- Finished puzzles get a ✓ (solved) or a grey circle (revealed). When every puzzle is finished you get a summary for the day.
- New puzzles appear each day, going by the website's date. If there is no daily puzzle, the tab says so; try Free Play instead.

### Streaks

Your streak counts the days in a row that you solved a daily puzzle.

- **Solve at least one daily puzzle without Reveal** to count the day. Solving more puzzles the same day doesn't add more.
- Revealing a puzzle never counts, but it doesn't end your streak either. Solving another puzzle that day still counts.
- **Days with no daily puzzle don't break your streak.** For example, if there are no puzzles over the weekend, a streak from Friday continues on Monday.
- Missing a day that had puzzles starts the streak over at the next solve.
- Free Play and Sandbox never count toward the streak.
- The streak badge appears above the puzzle once you have one. The end-of-day summary also shows your best streak.

### Free Play

Free Play is for practice. It's always open, even when there's no daily puzzle.

- It gives you puzzles from earlier days and puzzles that were never scheduled, one at a time, in random order.
- It never shows today's daily puzzles or upcoming ones, so it can't spoil them.
- **Check**, **Reveal** and **Skip** work like in Daily. After a puzzle is finished, **Next puzzle →** moves on.
- You won't see the same puzzle twice until you've played them all; then they're shuffled and start again.
- The "Solved this visit" counter starts at 0 each time you open the page. Nothing in Free Play is saved.

### Sandbox

Sandbox lets you make your own wheels from any list of words.

**How to use it**

1. Paste words into the **Word bank**: one per line, separated by commas, or a whole paragraph.
2. In **Settings**, choose the word lengths to use (between 3 and 12 letters), the direction, whether to show a center letter, and how many letters to hide.
3. Press **Generate wheel** and play it like any other puzzle.
4. **New word** picks another word from your bank. Every word comes up once before any repeats. **New layout** rearranges the same word.
5. **Show** opens the word bank and settings again. They're folded away while you play so the answer isn't next to the wheel.

A word bank with one word makes a single custom puzzle, which is handy for making a puzzle for a friend.

**What Sandbox can't do**

- **Words must be letters only.** Words with apostrophes, hyphens or numbers (`don't`, `well-known`, `abc123`) are skipped. Words shorter or longer than your chosen lengths and repeated words are also skipped. The status line tells you how many words fit and lists some that didn't.
- **Hidden letters depend on the shortest word.** If the shortest allowed word is too short to hide that many letters, the option is turned off and the reason is shown.
- **Words aren't checked against a dictionary.** If you paste a typo, the wheel uses the typo.
- **Nothing is shared or saved online.** Your teacher can't see Sandbox wheels, they don't count toward streaks, and they have no hints. Your word bank and settings are remembered only on the device and browser you used.

### Hints

Some puzzles have a **💡 Hint** button. Your teacher has approved these hints, so they're safe and accurate.

- The first press shows a short clue. The second shows what the word means.
- Using hints doesn't affect your streak.
- After a puzzle is solved or revealed, a **What it means** note explains the word.
- Hints are in English. A puzzle without a Hint button has no hints yet.

### Printing a puzzle

The **Print** button (or Ctrl+P / ⌘P) prints only the puzzle on screen: the wheel and a blank answer line. The answer isn't printed. A puzzle you've already solved or revealed prints with all its letters showing.

### Where your progress is kept

Your daily progress, streak and Sandbox word bank are saved in your browser on that device, not in an account. They don't move to another device or browser, and clearing your browser's site data resets them.

---

## For teachers

### Logging in

Press **Teacher login** at the top of any page. After logging in, the top bar shows **Dashboard** on player pages, and **Player view** (which opens the game) on the dashboard, along with **Log out**. The Word Wheel logo always goes to the game.

The dashboard has four tabs: **Calendar**, **Create Puzzle**, **Batch Generate** and **Manage Puzzles**. It opens on the Calendar, and a refresh keeps you on the tab you were using.

If you're logged out while working (for example, after a long break), the dashboard says so with a link to log in again.

### How scheduling works

There are no drafts: every saved puzzle is live somewhere.

| A puzzle's date | Where players see it |
|---|---|
| Today | **Daily** tab |
| A future day | Nowhere until that day; then it's a daily puzzle |
| A past day | **Free Play** |
| No date (unscheduled) | **Free Play** |

- **A puzzle has one date.** Giving it a new date moves it. To reuse a past puzzle as a daily puzzle, give it an upcoming date.
- **A day can have any number of puzzles.** Players see them in the order they were created.
- **Changes to today take effect immediately**, so the dashboard asks before you change today's puzzles.
- To stop players seeing a puzzle at all, delete it.

### Calendar

The Calendar is the teacher's home page: a month view of the daily puzzles.

- Each day shows how many puzzles it has and their words. On phones, only the number shows.
- **Today** has a thick outline. **Upcoming days with no puzzle** have a dashed outline and say "No puzzle yet". The bar at the top says how many of the next 7 days have a puzzle.
- **‹ ›** changes the month and **Today** comes back to this month.

**Changing a day**

Click a day to open it.

1. **Scheduled for this day** lists its puzzles. **✕ Remove** marks a puzzle for removal, and **Undo** takes it back. Removed puzzles go to Free Play; they aren't deleted.
2. **Add puzzles** lists puzzles you can add. Search by name or word, then tick the ones you want.
   - **Unscheduled only** lists puzzles with no date.
   - **Show all** also lists puzzles on other days. Ticking one of those **moves** it to this day, and its label warns you first ("would move"). This is how you reuse a past puzzle.
3. Click a puzzle's line (not its checkbox) to preview its wheel and settings, and to see or edit its hints. One line opens at a time.
4. Press **Save changes**. Nothing on the schedule changes until you do. The dashboard asks first before:
   - changing **today**, because players see it right away;
   - moving **today's** puzzle to another day;
   - closing the day with unsaved changes.
5. **Manage puzzles for this day →** opens Manage Puzzles showing just that day's puzzles.

**Limits:** past days open read-only; you can look but not change them. Hints are the exception: approving hints in the pop-up saves them immediately, separate from **Save changes**.

### Create Puzzle

Make one puzzle at a time and fine-tune it.

1. Type a word of **7 to 9 letters** (letters only, no spaces).
2. Choose the **direction** (random, clockwise or anticlockwise), whether to show a **center letter**, and how many letters to **hide** (0–3).
3. Press **Generate wheel**. Try it yourself with **Check** and **Reveal**.
4. **New layout** rearranges the letters of the same word until you like the wheel.
5. Optionally give it a **name** (up to 100 characters), then press **Save**. Players see exactly the wheel you saved. New puzzles are unscheduled (Free Play) until you give them a date.
6. **Load saved puzzles** opens a saved wheel and fills the form with its settings.

Words in other languages and scripts (Vietnamese, Japanese, Korean and more) work. Each character, including accented letters, counts as one letter.

### Batch Generate

Make up to 100 puzzles at once from a word list.

1. Choose a **.txt file**. Any text works: one word per line, a comma-separated list, or a passage from a book. Repeated words are listed once.
2. Set the **word lengths** (anywhere from 3 to 12 letters). Words in range appear with checkboxes, and the first 100 are ticked.
3. Pick **Same settings for every word**, or **Vary settings for each word** to give each wheel a random direction, center letter and number of hidden letters.
4. Press **Mass generate** to preview every wheel.
5. Untick **Include** on any you don't want. **New layout** re-rolls one wheel.
6. **Print** them, or add an optional name prefix and press **Save to database**. Saved puzzles are numbered in order ("Animals #1", "Animals #2", …), skipping none.

**Limits**

- Only `.txt` files. Words with apostrophes, hyphens or numbers are skipped and named so you can fix them (for example, change `children's` to `children`).
- Languages written without spaces between words (Chinese, Japanese) come out as whole phrases, so put one word per line for those.
- With **Same settings**, hidden-letter choices the shortest word can't support are turned off, with the reason shown.
- Unsaved puzzles are lost if you leave or refresh the page.

### Manage Puzzles

A table of every saved puzzle.

- **Filter** by name or word, schedule (unscheduled, today, upcoming, past), a specific date, hints (has hints or not) and length. **More filters** adds hidden letters, center letter and direction. **Reset filters** clears them all.
- Click a **column header** to sort, and click again to reverse. Your filters and sorting are remembered in your browser.
- **Click a row** to preview the wheel, set or clear its date, print it, delete it, or edit its hints.
- **Tick rows** to **Schedule**, **Unschedule**, **Print** or **Delete** several at once. The box in the header ticks only the rows currently shown.
- The **Hints** column shows ✓ for puzzles with approved hints.
- Deleting can't be undone, so the dashboard asks first. Moving or unscheduling today's puzzles also asks first.

### Hints for players

Hints are optional, and a puzzle has none until you approve some. Each puzzle has two:

1. **A short clue** of up to 5 words, vaguer than the second hint.
2. **What it means**: one kid-friendly sentence.

You can work on hints from a puzzle's row in **Manage Puzzles** or from its line in the **Calendar** pop-up.

- **Generate hints** asks the AI for a draft. Nothing is saved yet: read it, edit either line if needed, then press **Approve hints**.
- **Write hints yourself** lets you type them without the AI.
- Approved hints can be **edited**, **regenerated** or **removed**. Players see changes right away.

**Rules (checked when you approve):** neither hint may contain the answer or a form of it (for "fish", not "fishing" or "fisherman"), the clue is at most 5 words, and each hint is at most 150 characters.

**Limits**

- AI hints are **English only**. You can still write hints by hand for other words.
- The **Generate hints** button appears only when the site has an AI key set up. Without one, you can still write hints yourself.
- The AI can be busy and occasionally fails. Wait a moment and try again.
- The AI sometimes picks the less common meaning of a word, so read each draft before approving it.
- Only the puzzle's word is sent to the AI, never anything about students.

### Printing worksheets

**Print** in Batch Generate or Manage Puzzles makes a worksheet: choose **1 to 8 puzzles per page**, then print or save as PDF from the browser's print window. Each puzzle has a blank answer line, and the answers are on a separate page at the end, so you can remove it before handing out copies.

---

## Limits at a glance

| | Limit |
|---|---|
| Word length: Create Puzzle | 7–9 letters |
| Word length: Batch Generate and Sandbox | 3–12 letters (you choose the range) |
| Hidden letters | 0–3, always leaving at least one ring letter visible |
| Characters allowed in a word | Letters only: no spaces, apostrophes, hyphens or numbers |
| Puzzles per batch | 100 |
| Puzzle name | Up to 100 characters (optional) |
| Puzzles per day | No limit |
| Puzzles per printed page | 1–8 |
| Hints per puzzle | 2 (a short clue of up to 5 words, then a meaning); up to 150 characters each |
| AI hint language | English |

## Known limitations

- **Player progress stays in one browser.** Streaks, daily progress and Sandbox word banks don't follow a student to another device, and clearing browser data resets them. There are no student accounts.
- **Answers aren't hidden from technical users.** The browser receives each puzzle's answer and hints so it can check guesses instantly. A student who knows how to use the browser's developer tools could find them.
- **Words aren't spell-checked.** The game uses the word exactly as typed, for teachers and in Sandbox.
- **One word per puzzle.** Phrases with spaces aren't supported.
- **The center letter is always the word's first letter.**
- **Two people editing the same puzzle's hints at once:** the last one to approve wins, with no warning.

---

## Team

- **Course:** ICS 499 – Capstone Project
- **Instructor:** Siva Jasthi
- **Team:** Austin Nguyen, Henry Nguyen
