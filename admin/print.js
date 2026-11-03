// ============================================================
// Word Wheel — print helper
// ============================================================
// printPuzzles(puzzles, options)
//   puzzles  — array of raw puzzle objects from the API (or built by buildPuzzle)
//   options  — { perPage: 1–8 }
//
// Opens a new window, renders each puzzle as a card with wheel + answer
// blank, appends a numbered solutions section, then calls window.print().
// ============================================================

function printPuzzles(puzzles, options) {
  const perPage  = Math.max(1, Math.min(8, (options && options.perPage) || 1));
  const RING_RADIUS = 38;

  // ── Geometry (mirrors wheel.js tilePosition, standalone — no jQuery dep) ──
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
      (((puzzle.startSlot + step * ringIndex) % ringSize) + ringSize) % ringSize;
    const angle = ((-90 + (slot * 360) / ringSize) * Math.PI) / 180;
    return {
      x: 50 + RING_RADIUS * Math.cos(angle),
      y: 50 + RING_RADIUS * Math.sin(angle),
    };
  }

  // ── Build the .wheel HTML for one puzzle ──────────────────────────────────
  function buildWheelHTML(puzzle) {
    let svgInner = `<circle cx="50" cy="50" r="${RING_RADIUS}"></circle>`;
    const tiles  = [];

    puzzle.chars.forEach(function (ch, i) {
      const { x, y } = tilePosition(puzzle, i);
      if (puzzle.centralCharacter && i > 0) {
        svgInner += `<line x1="50" y1="50" x2="${x.toFixed(3)}" y2="${y.toFixed(3)}"></line>`;
      }
      const isHub    = puzzle.centralCharacter && i === 0;
      const isHidden = puzzle.hidden instanceof Set
        ? puzzle.hidden.has(i) && !puzzle.solved
        : Array.isArray(puzzle.hidden_indexes)
          ? puzzle.hidden_indexes.includes(i) && !puzzle.solved
          : false;
      const classes  = ["tile", isHub ? "hub" : "", isHidden ? "blank" : ""].filter(Boolean).join(" ");
      tiles.push(
        `<div class="${escHtml(classes)}" style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%">${escHtml(isHidden ? "?" : ch)}</div>`
      );
    });

    return `<div class="wheel">` +
      `<svg viewBox="0 0 100 100" aria-hidden="true">${svgInner}</svg>` +
      tiles.join("") +
    `</div>`;
  }

  // ── Normalise a raw API puzzle object into the shape tilePosition expects ─
  function normalisePuzzle(p) {
    // Already a built puzzle (has .chars, .ringOrder, .hidden as Set)
    if (p.chars && p.ringOrder && p.hidden instanceof Set) return p;

    const chars           = p.arrangement || p.chars || [];
    const centralCharacter = !!(p.center_letter || p.centralCharacter);
    const direction       = p.direction || "random";
    const ringSize        = centralCharacter ? chars.length - 1 : chars.length;
    const ringOrder       = p.ring_order || p.ringOrder ||
      (centralCharacter
        ? Array.from({ length: ringSize }, (_, i) => i + 1)
        : Array.from({ length: ringSize }, (_, i) => i));
    const hiddenIndexes   = p.hidden_indexes || (p.hidden instanceof Set ? [...p.hidden] : []);

    return {
      chars,
      direction,
      centralCharacter,
      hiddenCount:  p.hidden_count  ?? p.hiddenCount  ?? 0,
      startSlot:    p.start_slot    ?? p.startSlot    ?? 0,
      ringOrder,
      hidden:       new Set(hiddenIndexes),
      solved:       false,
      name:         p.name || null,
    };
  }

  // ── Build complete HTML for the print window ──────────────────────────────
  function buildHTML(puzzleList) {
    const normalised = puzzleList.map(normalisePuzzle);

    // Wheel size: shrinks as more fit per page so they stay readable
    const wheelSizes = { 1: "340px", 2: "300px", 3: "260px", 4: "220px",
                         5: "200px", 6: "180px", 7: "160px", 8: "150px" };
    const wheelSize  = wheelSizes[perPage] || "150px";

    // Puzzle cards
    const cards = normalised.map(function (p, i) {
      const label = p.name ? escHtml(p.name) : "Puzzle " + (i + 1);
      return `<section class="puzzle">` +
        `<h2>${label}</h2>` +
        `<p class="instruction">Read the letters around the wheel to find the hidden word.</p>` +
        buildWheelHTML(p) +
        `<p class="answer-line">Answer: ______________________</p>` +
      `</section>`;
    }).join("\n");

    // Solutions section
    const solutionItems = normalised.map(function (p, i) {
      const label = p.name ? escHtml(p.name) : "Puzzle " + (i + 1);
      return `<li><strong>${label}:</strong> ${escHtml(p.chars.join(""))}</li>`;
    }).join("\n");

    const solutions = `<section class="solutions">` +
      `<h2>Solutions</h2>` +
      `<ol>${solutionItems}</ol>` +
    `</section>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Word Wheel — Print</title>
<style>
  :root { --wheel-size: ${wheelSize}; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: system-ui, sans-serif;
    background: #fff;
    color: #212529;
  }

  /* ── Screen layout ── */
  .puzzle, .solutions {
    max-width: 700px;
    margin: 0 auto 1.5rem;
    padding: 2rem;
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 0.5rem;
    text-align: center;
  }
  .puzzle h2, .solutions h2 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }
  .instruction {
    color: #6c757d;
    margin-bottom: 0;
  }
  .answer-line {
    font-size: 1.1rem;
    margin-top: 1rem;
  }
  .solutions {
    text-align: left;
  }
  .solutions ol {
    columns: 2;
    font-size: 1rem;
    margin-top: 0.75rem;
    padding-left: 1.25rem;
  }
  .solutions li {
    margin-bottom: 0.25rem;
  }

  /* ── Wheel ── */
  .wheel {
    position: relative;
    width: var(--wheel-size);
    aspect-ratio: 1;
    margin: 1.5rem auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .wheel svg {
    position: absolute; inset: 0; width: 100%; height: 100%;
  }
  .wheel svg circle { fill: #f8f9fa; stroke: #adb5bd; stroke-width: 0.6; }
  .wheel svg line   { stroke: #ced4da; stroke-width: 0.5; }
  .tile {
    position: absolute;
    width: 17%; aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: #fff; border: 2px solid #0d6efd;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700;
    font-size: calc(var(--wheel-size) * 0.08);
    text-transform: uppercase; user-select: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .tile.hub   { width: 20%; background: #0d6efd; color: #fff; }
  .tile.blank { border-style: dashed; color: #adb5bd; }

  /* ── Print layout ── */
  @page { margin: 1.5cm; }

  @media print {
    body { background: #fff !important; }

    .puzzle, .solutions {
      max-width: none;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
    }

    /* Group puzzles into pages based on perPage */
    .page-group {
      break-after: page;
      break-inside: avoid;
      display: grid;
      grid-template-columns: repeat(${perPage <= 2 ? 1 : 2}, 1fr);
      gap: 1cm;
      align-items: start;
    }
    .page-group:last-of-type { break-after: avoid; }

    .solutions {
      break-before: page;
      break-inside: avoid;
    }
    .solutions ol { columns: 3; }
  }
</style>
</head>
<body>
${buildPageGroups(normalised, perPage, cards)}
${solutions}
</body>
</html>`;
  }

  // ── Group puzzle cards into .page-group divs for print pagination ─────────
  function buildPageGroups(normalised, perPage, cardsHTML) {
    // Re-build cards as an array so we can chunk them
    const cardArray = normalised.map(function (p, i) {
      const label = p.name ? escHtml(p.name) : "Puzzle " + (i + 1);
      return `<section class="puzzle">` +
        `<h2>${label}</h2>` +
        `<p class="instruction">Read the letters around the wheel to find the hidden word.</p>` +
        buildWheelHTML(p) +
        `<p class="answer-line">Answer: ______________________</p>` +
      `</section>`;
    });

    const groups = [];
    for (let i = 0; i < cardArray.length; i += perPage) {
      groups.push(
        `<div class="page-group">${cardArray.slice(i, i + perPage).join("\n")}</div>`
      );
    }
    return groups.join("\n");
  }

  // ── Open print window ─────────────────────────────────────────────────────
  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked — please allow pop-ups for this site and try again.");
    return;
  }

  win.document.open();
  win.document.write(buildHTML(puzzles));
  win.document.close();
  win.addEventListener("load", function () { win.print(); });
}

// ── Utility ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
