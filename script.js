$(function () {
  const MIN_CHARS = 7;
  const MAX_CHARS = 9;
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

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let settings = null; // { chars, direction, centralCharacter, hiddenCount }
  let puzzle = null; // settings + { startSlot, ringOrder, hidden:Set, solved }

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

  function tilePosition(charIndex) {
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

  function render() {
    const $wheel = $("#wheel");
    $wheel.find(".tile").remove();

    let svg = `<circle cx="50" cy="50" r="${RING_RADIUS}"></circle>`;

    puzzle.chars.forEach((ch, i) => {
      const { x, y } = tilePosition(i);
      if (puzzle.centralCharacter && i > 0) {
        svg += `<line x1="50" y1="50" x2="${x}" y2="${y}"></line>`;
      }

      const isHidden = puzzle.hidden.has(i) && !puzzle.solved;
      const $tile = $('<div class="tile"></div>')
        .toggleClass("hub", puzzle.centralCharacter && i === 0)
        .toggleClass("blank", isHidden)
        .toggleClass("revealed", puzzle.hidden.has(i) && puzzle.solved)
        .css({ left: x + "%", top: y + "%" })
        .text(isHidden ? "?" : ch);
      $wheel.append($tile);
    });

    $wheel.find("svg").html(svg);
  }

  function showResult(type, message) {
    $("#result").html(
      $('<div class="alert py-2 mb-0"></div>')
        .addClass("alert-" + type)
        .text(message),
    );
  }

  function startPuzzle() {
    puzzle = buildPuzzle(settings);
    render();
    $("#guessInput").val("").prop("disabled", false);
    $("#result").empty();
    $("#emptyState").addClass("d-none");
    $("#puzzleArea").removeClass("d-none");
  }

  function validateWord(raw) {
    const word = raw.trim();
    if (!word) return "Enter a word.";
    if (/\s/.test(word)) return "Single words only for now (no spaces).";
    if (!/^[\p{L}\p{M}]+$/u.test(word))
      return "Letters only — no numbers or punctuation.";
    const count = toChars(word).length;
    if (count < MIN_CHARS || count > MAX_CHARS) {
      return `Word must be ${MIN_CHARS}–${MAX_CHARS} letters (this one has ${count}).`;
    }
    return null;
  }

  $("#createForm").on("submit", function (e) {
    e.preventDefault();
    const raw = $("#wordInput").val();
    const error = validateWord(raw);

    $("#wordInput").toggleClass("is-invalid", !!error);
    $("#wordFeedback").text(error || "");
    if (error) return;

    settings = {
      chars: toChars(raw.trim()),
      direction: $('input[name="direction"]:checked').val(),
      centralCharacter:
        $('input[name="centralCharacter"]:checked').val() === "yes",
      hiddenCount: parseInt($("#hiddenSelect").val(), 10),
    };
    startPuzzle();
  });

  $("#guessForm").on("submit", function (e) {
    e.preventDefault();
    if (!puzzle || puzzle.solved) return;

    const guess = toChars($("#guessInput").val().trim())
      .join("")
      .toLocaleLowerCase();
    if (!guess) return showResult("warning", "Type your answer first.");

    const answer = puzzle.chars.join("").toLocaleLowerCase();
    if (guess === answer) {
      puzzle.solved = true;
      render();
      $("#guessInput").prop("disabled", true);
      showResult("success", "Correct! 🎉");
    } else {
      showResult("danger", "Not quite — try again.");
    }
  });

  $("#revealBtn").on("click", function () {
    if (!puzzle) return;
    puzzle.solved = true;
    render();
    $("#guessInput").prop("disabled", true);
    showResult("secondary", "Answer: " + puzzle.chars.join(""));
  });

  $("#relayoutBtn").on("click", function () {
    if (settings) startPuzzle();
  });
});
