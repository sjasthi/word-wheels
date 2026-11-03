// ============================================================
// Word Wheel — print helper
// ============================================================
// printPuzzles(puzzles, options)
//   puzzles  — built puzzles (WordWheel.puzzleFromApi / buildPuzzle),
//              each with an optional .name used as its label
//   options  — { perPage: 1–8 }
//
// Opens a new window, renders each puzzle as a card with wheel + answer
// blank, appends a numbered solutions section, then calls window.print().
// Wheels are drawn by wheel.js and styled by wheel.css, same as on screen.
// ============================================================

// wheel.css sits one folder up from this script; resolve it now, while
// document.currentScript still points at print.js.
const PRINT_WHEEL_CSS = new URL("../wheel.css", document.currentScript.src).href;

function printPuzzles(puzzles, options) {
  const perPage = Math.max(1, Math.min(8, (options && options.perPage) || 1));

  // ── Build the .wheel HTML for one puzzle ──────────────────────────────────
  function buildWheelHTML(puzzle) {
    const $wheel = $('<div class="wheel"></div>');
    WordWheel.renderWheel(puzzle, $wheel);
    return $wheel.prop("outerHTML");
  }

  function puzzleLabel(p, i) {
    return p.name ? escHtml(p.name) : "Puzzle " + (i + 1);
  }

  // ── Build complete HTML for the print window ──────────────────────────────
  function buildHTML(puzzleList) {
    // Wheel size: shrinks as more fit per page so they stay readable
    const wheelSizes = { 1: "340px", 2: "300px", 3: "260px", 4: "220px",
                         5: "200px", 6: "180px", 7: "160px", 8: "150px" };
    const wheelSize  = wheelSizes[perPage] || "150px";

    // Solutions section
    const solutionItems = puzzleList.map(function (p, i) {
      return `<li><strong>${puzzleLabel(p, i)}:</strong> ${escHtml(p.chars.join(""))}</li>`;
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
<link rel="stylesheet" href="${escHtml(PRINT_WHEEL_CSS)}">
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

  /* ── Wheel (shape and tiles come from wheel.css) ── */
  .wheel { margin: 1.5rem auto; }

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
${buildPageGroups(puzzleList, perPage)}
${solutions}
</body>
</html>`;
  }

  // ── Group puzzle cards into .page-group divs for print pagination ─────────
  function buildPageGroups(puzzleList, perPage) {
    const cardArray = puzzleList.map(function (p, i) {
      return `<section class="puzzle">` +
        `<h2>${puzzleLabel(p, i)}</h2>` +
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
  // "load" waits for wheel.css, so the wheels are styled before printing
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
