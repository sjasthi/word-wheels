// ============================================================
// Word Wheel — shared puzzle engine
// ============================================================
// Plain script (no build step). Exposes window.WordWheel so every page
// (index.html, admin/dashboard.js, admin/batch.js, admin/print.js)
// builds, converts, and draws wheels with the same code.
// ============================================================

window.WordWheel = (function () {
  const RING_RADIUS = 38; // in SVG viewBox units (0–100)
  const DIRECTIONS = ["cw", "ccw", "random"];
  const DEFAULT_LANGUAGE = "en"; // no language picker in the UI yet

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

  // Rebuild a puzzle from a saved layout ({ startSlot, ringOrder, hiddenIndexes }).
  // Returns null when the layout doesn't fit the settings (wrong length,
  // repeated or out-of-range indexes, or the hub letter marked hidden),
  // so a bad database row is reported instead of drawn wrong.
  function restorePuzzle(s, layout) {
    if (!layout || !DIRECTIONS.includes(s.direction)) return null;
    const { startSlot, ringOrder, hiddenIndexes } = layout;
    const ringSize = s.centralCharacter ? s.chars.length - 1 : s.chars.length;
    const firstRing = s.centralCharacter ? 1 : 0;
    const isRingIndex = (i) =>
      Number.isInteger(i) && i >= firstRing && i < s.chars.length;

    if (
      !Number.isInteger(startSlot) ||
      startSlot < 0 ||
      startSlot >= ringSize ||
      !Array.isArray(ringOrder) ||
      ringOrder.length !== ringSize ||
      new Set(ringOrder).size !== ringSize ||
      !ringOrder.every(isRingIndex) ||
      !Array.isArray(hiddenIndexes) ||
      hiddenIndexes.length !== s.hiddenCount ||
      new Set(hiddenIndexes).size !== s.hiddenCount ||
      !hiddenIndexes.every(isRingIndex)
    ) {
      return null;
    }

    return {
      ...s,
      startSlot,
      ringOrder: [...ringOrder],
      hidden: new Set(hiddenIndexes),
      solved: false,
    };
  }

  // API puzzle (get_puzzle.php / get_daily.php) → puzzle for renderWheel,
  // showing exactly the saved wheel. Returns null when the row is missing
  // its letters or its saved layout is invalid.
  function puzzleFromApi(p) {
    if (!p || !Array.isArray(p.arrangement) || !p.arrangement.length) {
      return null;
    }
    return restorePuzzle(
      {
        chars: p.arrangement,
        direction: p.direction,
        centralCharacter: !!p.center_letter,
        hiddenCount: p.hidden_count,
      },
      {
        startSlot: p.start_slot,
        ringOrder: p.ring_order,
        hiddenIndexes: p.hidden_indexes,
      },
    );
  }

  // Puzzle → JSON body for api/save_puzzle.php, including the wheel
  // layout so loading it later shows the same wheel. Blank name = unnamed.
  function puzzleToApi(puzzle, name) {
    return {
      name: name || "",
      word: puzzle.chars.join(""),
      arrangement: puzzle.chars, // graphemes in answer order
      direction: puzzle.direction,
      hidden_count: puzzle.hiddenCount,
      center_letter: puzzle.centralCharacter,
      start_slot: puzzle.startSlot,
      ring_order: puzzle.ringOrder,
      hidden_indexes: [...puzzle.hidden],
      language: DEFAULT_LANGUAGE,
    };
  }

  // The endpoints answer { success:false, error } with a 4xx/5xx status.
  function apiError(xhr, fallback) {
    let body = xhr.responseJSON;
    if (!body) {
      try {
        body = JSON.parse(xhr.responseText);
      } catch (_) {
        body = null;
      }
    }
    return (body && body.error) || fallback;
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

  return {
    toChars,
    extractWords,
    buildPuzzle,
    restorePuzzle,
    puzzleFromApi,
    puzzleToApi,
    apiError,
    tilePosition,
    renderWheel,
  };
})();
