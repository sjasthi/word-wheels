// ============================================================
// Word Wheel — shared puzzle engine
// ============================================================
// Plain script (no build step). Exposes window.WordWheel so any page
// can build and draw wheels without its own copy of the layout logic.
// Currently used by admin/batch.php. admin/dashboard.js and index.html
// still carry their own copies of these functions.
// ============================================================

window.WordWheel = (function () {
  const RING_RADIUS = 38; // in SVG viewBox units (0–100)

  // Split text into user-perceived characters (graphemes) so that
  // non-Latin scripts (e.g. Telugu, Hindi) count and display correctly.
  const segmenter =
    window.Intl && Intl.Segmenter
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;

  function toChars(text) {
    const normalized = text.normalize("NFC");
    return segmenter
      ? Array.from(segmenter.segment(normalized), (s) => s.segment)
      : Array.from(normalized);
  }

  // A word is a run of letters and combining marks (Telugu vowel signs
  // and virama are marks). Zero-width joiners are kept when they sit
  // between letters. Everything else (spaces, punctuation, digits,
  // commas, line breaks) separates words.
  const WORD_PATTERN = /[\p{L}\p{M}]+(?:[‌‍][\p{L}\p{M}]+)*/gu;

  // Pull every word out of free text: one word per line, a
  // comma-separated list, or a paragraph from a book all work.
  function extractWords(text) {
    return text.normalize("NFC").match(WORD_PATTERN) || [];
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // settings = { chars, direction, centralCharacter, hiddenCount }
  // Returns settings + a fresh random layout { startSlot, ringOrder, hidden:Set, solved }.
  function buildPuzzle(s) {
    const ringSize = s.centralCharacter ? s.chars.length - 1 : s.chars.length;
    const ringIndexes = s.centralCharacter
      ? Array.from({ length: ringSize }, (_, i) => i + 1)
      : Array.from({ length: ringSize }, (_, i) => i);
    return {
      ...s,
      startSlot: Math.floor(Math.random() * ringSize), // where the first ring letter lands
      ringOrder:
        s.direction === "random" ? shuffle([...ringIndexes]) : ringIndexes,
      hidden: new Set(shuffle([...ringIndexes]).slice(0, s.hiddenCount)),
      solved: false,
    };
  }

  function tilePosition(puzzle, charIndex) {
    if (puzzle.centralCharacter && charIndex === 0) return { x: 50, y: 50 };
    const ringSize = puzzle.centralCharacter
      ? puzzle.chars.length - 1
      : puzzle.chars.length;
    const step = puzzle.direction === "ccw" ? -1 : 1;
    const sequentialIndex = puzzle.centralCharacter ? charIndex - 1 : charIndex;
    const ringIndex =
      puzzle.direction === "random"
        ? puzzle.ringOrder.indexOf(charIndex)
        : sequentialIndex;
    const slot =
      (((puzzle.startSlot + step * ringIndex) % ringSize) + ringSize) %
      ringSize;
    const angle = ((-90 + (slot * 360) / ringSize) * Math.PI) / 180; // slot 0 = top
    return {
      x: 50 + RING_RADIUS * Math.cos(angle),
      y: 50 + RING_RADIUS * Math.sin(angle),
    };
  }

  // Draw a puzzle into a .wheel container (jQuery object). Replaces
  // whatever the container held, so it can be called again to redraw.
  function renderWheel(puzzle, $wheel) {
    let svg = `<circle cx="50" cy="50" r="${RING_RADIUS}"></circle>`;
    const tiles = [];

    puzzle.chars.forEach((ch, i) => {
      const { x, y } = tilePosition(puzzle, i);
      if (puzzle.centralCharacter && i > 0) {
        svg += `<line x1="50" y1="50" x2="${x}" y2="${y}"></line>`;
      }

      const isHidden = puzzle.hidden.has(i) && !puzzle.solved;
      tiles.push(
        $('<div class="tile"></div>')
          .toggleClass("hub", puzzle.centralCharacter && i === 0)
          .toggleClass("blank", isHidden)
          .toggleClass("revealed", puzzle.hidden.has(i) && puzzle.solved)
          .css({ left: x + "%", top: y + "%" })
          .text(isHidden ? "?" : ch),
      );
    });

    $wheel
      .html(`<svg viewBox="0 0 100 100" aria-hidden="true">${svg}</svg>`)
      .append(tiles);
  }

  return { toChars, extractWords, buildPuzzle, tilePosition, renderWheel };
})();
