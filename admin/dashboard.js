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
  let puzzle = null;   // settings + { startSlot, ringOrder, hidden:Set, solved }

  function buildPuzzle(s) {
    const ringSize = s.centralCharacter ? s.chars.length - 1 : s.chars.length;
    const ringIndexes = s.centralCharacter
      ? Array.from({ length: ringSize }, (_, i) => i + 1)
      : Array.from({ length: ringSize }, (_, i) => i);
    return {
      ...s,
      startSlot: Math.floor(Math.random() * ringSize),
      ringOrder:
        s.direction === "random" ? shuffle([...ringIndexes]) : ringIndexes,
      hidden: new Set(shuffle([...ringIndexes]).slice(0, s.hiddenCount)),
      solved: false,
    };
  }

  // Rebuild a puzzle from a saved layout ({ startSlot, ringOrder, hiddenIndexes }).
  // Returns null when the layout is missing or doesn't fit the settings,
  // so callers can fall back to buildPuzzle().
  function restorePuzzle(s, layout) {
    if (!layout) return null;
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
    const angle = ((-90 + (slot * 360) / ringSize) * Math.PI) / 180;
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
        .text(message)
    );
  }

  // Pass a saved layout to show that exact wheel; omit it (New Layout,
  // Create) to generate a fresh random layout from the current settings.
  function startPuzzle(savedLayout) {
    puzzle = restorePuzzle(settings, savedLayout) || buildPuzzle(settings);
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

  // Mirror loaded settings into the "Create a puzzle" form so Generate
  // wheel recreates the same puzzle (with a fresh layout).
  function fillCreateForm(s) {
    $("#wordInput").val(s.chars.join("")).removeClass("is-invalid");
    $("#wordFeedback").text("");
    $('input[name="direction"]')
      .filter(function () {
        return this.value === s.direction;
      })
      .prop("checked", true);
    $(s.centralCharacter ? "#centralYes" : "#centralNo").prop("checked", true);
    $("#hiddenSelect").val(String(s.hiddenCount));
  }

  // ---- Form handlers ----

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
    if (settings) startPuzzle(); // no layout → new random wheel
  });

  // ---- Saved puzzles (PHP API in api/) ----

  const DEFAULT_LANGUAGE = "en";

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

  function showSavedStatus(type, message) {
    $("#savedStatus").html(
      $('<div class="alert py-2 mb-0"></div>')
        .addClass("alert-" + type)
        .text(message)
    );
  }

  $("#saveForm").on("submit", function (e) {
    e.preventDefault();
    if (!puzzle) {
      return showSavedStatus("warning", "Generate a wheel first.");
    }
    const $btn = $("#saveBtn").prop("disabled", true);
    $("#savedStatus").empty();

    $.ajax({
      url: "../api/save_puzzle.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({
        name: $("#nameInput").val().trim(),
        word: puzzle.chars.join(""),
        arrangement: puzzle.chars,
        direction: puzzle.direction,
        hidden_count: puzzle.hiddenCount,
        center_letter: puzzle.centralCharacter,
        start_slot: puzzle.startSlot,
        ring_order: puzzle.ringOrder,
        hidden_indexes: [...puzzle.hidden],
        language: DEFAULT_LANGUAGE,
      }),
    })
      .done(function (res) {
        if (res && res.success) {
          $("#nameInput").val("");
          showSavedStatus("success", "Puzzle saved!");
          loadSavedPuzzles(res.id);
        } else {
          showSavedStatus(
            "danger",
            (res && res.error) || "Could not save the puzzle."
          );
        }
      })
      .fail(function (xhr) {
        showSavedStatus("danger", apiError(xhr, "Could not save the puzzle."));
      })
      .always(function () {
        $btn.prop("disabled", false);
      });
  });

  // MySQL TIMESTAMP "YYYY-MM-DD HH:MM:SS" → e.g. "Oct 13, 2026, 2:05 PM"
  function formatSavedDate(raw) {
    const date = new Date(String(raw || "").replace(" ", "T"));
    return isNaN(date)
      ? String(raw || "")
      : date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }

  function savedPuzzleItem(p) {
    const details = [p.word, "saved " + formatSavedDate(p.created_date)].join(
      " · "
    );

    const $title = p.name
      ? $('<div class="fw-semibold"></div>').text(p.name)
      : $('<div class="fst-italic text-body-tertiary"></div>').text("Unnamed");

    return $(
      '<button type="button" class="list-group-item list-group-item-action"></button>'
    )
      .attr("data-id", p.id)
      .append($title)
      .append($('<small class="text-muted"></small>').text(details));
  }

  function loadSavedPuzzles(activeId) {
    const $btn = $("#loadSavedBtn").prop("disabled", true);
    const $list = $("#savedList").empty();

    $.ajax({
      url: "../api/get_all.php",
      method: "GET",
      dataType: "json",
      cache: false,
    })
      .done(function (res) {
        if (!res || !res.success) {
          return showSavedStatus(
            "danger",
            (res && res.error) || "Could not load saved puzzles."
          );
        }
        if (!res.puzzles || !res.puzzles.length) {
          return showSavedStatus("secondary", "No saved puzzles yet.");
        }
        res.puzzles.forEach(function (p) {
          const $item = savedPuzzleItem(p);
          if (p.id == activeId) {
            $item.addClass("active").attr("aria-current", "true");
          }
          $list.append($item);
        });
      })
      .fail(function (xhr) {
        showSavedStatus(
          "danger",
          apiError(xhr, "Could not load saved puzzles.")
        );
      })
      .always(function () {
        $btn.prop("disabled", false);
      });
  }

  $("#loadSavedBtn").on("click", function () {
    $("#savedStatus").empty();
    loadSavedPuzzles();
  });

  $("#savedList").on("click", ".list-group-item", function () {
    const $item = $(this);
    $("#savedStatus").empty();

    $.ajax({
      url: "../api/get_puzzle.php",
      method: "GET",
      data: { id: $item.data("id") },
      dataType: "json",
    })
      .done(function (res) {
        const p = res && res.success ? res.puzzle : null;
        if (!p || !Array.isArray(p.arrangement) || !p.arrangement.length) {
          return showSavedStatus(
            "danger",
            (res && res.error) || "That puzzle could not be loaded."
          );
        }

        settings = {
          chars: p.arrangement,
          direction: p.direction,
          centralCharacter: p.center_letter,
          hiddenCount: p.hidden_count,
        };
        fillCreateForm(settings);
        startPuzzle({
          startSlot: p.start_slot,
          ringOrder: p.ring_order,
          hiddenIndexes: p.hidden_indexes,
        });

        $item
          .addClass("active")
          .attr("aria-current", "true")
          .siblings()
          .removeClass("active")
          .removeAttr("aria-current");
        showSavedStatus("success", "Puzzle loaded.");
      })
      .fail(function (xhr) {
        showSavedStatus(
          "danger",
          apiError(xhr, "That puzzle could not be loaded.")
        );
      });
  });

  // ---- Puzzle management table (publish/unpublish, schedule, delete) ----

  $(document).on("click", ".toggle-btn", function () {
    const $btn    = $(this);
    const id      = $btn.data("id");
    const current = $btn.data("status");
    const next    = current === "published" ? "draft" : "published";

    $.ajax({
      url: "../api/update_puzzle.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({ id: id, status: next }),
    }).done(function (res) {
      if (res && res.success) {
        $btn.data("status", next);
        $btn.text(next === "published" ? "Unpublish" : "Publish");
        $btn.toggleClass("btn-outline-success btn-outline-secondary");
        const $badge = $btn.closest("tr").find(".badge");
        $badge.text(next);
        $badge
          .removeClass("bg-success bg-secondary")
          .addClass(next === "published" ? "bg-success" : "bg-secondary");
      } else {
        alert("Error: " + ((res && res.error) || "Could not update puzzle."));
      }
    });
  });

  $(document).on("change", ".date-input", function () {
    const id   = $(this).data("id");
    const date = $(this).val() || null;

    $.ajax({
      url: "../api/update_puzzle.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({ id: id, scheduled_date: date }),
    }).done(function (res) {
      if (res && !res.success) {
        alert("Error saving date: " + (res.error || "Unknown error."));
      }
    });
  });

  $(document).on("click", ".delete-btn", function () {
    const id   = $(this).data("id");
    const word = $(this).data("word");

    if (!confirm('Delete puzzle "' + word + '"? This cannot be undone.')) return;

    $.ajax({
      url: "../api/delete_puzzle.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({ id: id }),
    }).done(function (res) {
      if (res && res.success) {
        $("#row-" + id).fadeOut(300, function () {
          $(this).remove();
        });
      } else {
        alert("Error: " + ((res && res.error) || "Could not delete puzzle."));
      }
    });
  });
});
