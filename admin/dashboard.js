$(function () {
  const MIN_CHARS = 7;
  const MAX_CHARS = 9;

  // Pull shared engine from wheel.js (window.WordWheel)
  const { toChars, buildPuzzle, puzzleFromApi, puzzleToApi, apiError, renderWheel } =
    window.WordWheel;

  // ── Puzzle state (Create tab) ──────────────────────────────
  let settings = null;
  let puzzle   = null;

  // Convenience: render current puzzle into the Create tab wheel
  function render() { renderWheel(puzzle, $("#wheel")); }

  function showResult(type, message) {
    $("#result").html(
      $('<div class="alert py-2 mb-0"></div>').addClass("alert-" + type).text(message)
    );
  }

  // Generate wheel / New layout: a fresh random layout from `settings`.
  function startPuzzle() {
    showPuzzle(buildPuzzle(settings));
  }

  // Put a built or loaded puzzle on the Create tab wheel, ready to play.
  function showPuzzle(p) {
    puzzle = p;
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
    if (!/^[\p{L}\p{M}]+$/u.test(word)) return "Letters only — no numbers or punctuation.";
    const count = toChars(word).length;
    if (count < MIN_CHARS || count > MAX_CHARS)
      return `Word must be ${MIN_CHARS}–${MAX_CHARS} letters (this one has ${count}).`;
    return null;
  }

  function fillCreateForm(s) {
    $("#wordInput").val(s.chars.join("")).removeClass("is-invalid");
    $("#wordFeedback").text("");
    $('input[name="direction"]').filter(function () {
      return this.value === s.direction;
    }).prop("checked", true);
    $(s.centralCharacter ? "#centralYes" : "#centralNo").prop("checked", true);
    $("#hiddenSelect").val(String(s.hiddenCount));
  }

  // ── Create tab handlers ────────────────────────────────────
  $("#createForm").on("submit", function (e) {
    e.preventDefault();
    const raw   = $("#wordInput").val();
    const error = validateWord(raw);
    $("#wordInput").toggleClass("is-invalid", !!error);
    $("#wordFeedback").text(error || "");
    if (error) return;

    settings = {
      chars:            toChars(raw.trim()),
      direction:        $('input[name="direction"]:checked').val(),
      centralCharacter: $('input[name="centralCharacter"]:checked').val() === "yes",
      hiddenCount:      parseInt($("#hiddenSelect").val(), 10),
    };
    startPuzzle();
  });

  $("#guessForm").on("submit", function (e) {
    e.preventDefault();
    if (!puzzle || puzzle.solved) return;
    const guess  = toChars($("#guessInput").val().trim()).join("").toLocaleLowerCase();
    if (!guess) return showResult("warning", "Type your answer first.");
    const answer = puzzle.chars.join("").toLocaleLowerCase();
    if (guess === answer) {
      puzzle.solved = true; render();
      $("#guessInput").prop("disabled", true);
      showResult("success", "Correct! 🎉");
    } else {
      showResult("danger", "Not quite — try again.");
    }
  });

  $("#revealBtn").on("click", function () {
    if (!puzzle) return;
    puzzle.solved = true; render();
    $("#guessInput").prop("disabled", true);
    showResult("secondary", "Answer: " + puzzle.chars.join(""));
  });

  $("#relayoutBtn").on("click", function () {
    if (settings) startPuzzle();
  });

  // ── Save / Load ────────────────────────────────────────────
  function showSavedStatus(type, message) {
    $("#savedStatus").html(
      $('<div class="alert py-2 mb-0"></div>').addClass("alert-" + type).text(message)
    );
  }

  $("#saveForm").on("submit", function (e) {
    e.preventDefault();
    if (!puzzle) return showSavedStatus("warning", "Generate a wheel first.");
    const $btn = $("#saveBtn").prop("disabled", true);
    $("#savedStatus").empty();

    $.ajax({
      url: "../api/save_puzzle.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(puzzleToApi(puzzle, $("#nameInput").val().trim())),
    })
      .done(function (res) {
        if (res && res.success) {
          $("#nameInput").val("");
          showSavedStatus("success", "Puzzle saved!");
          loadSavedPuzzles(res.id);
        } else {
          showSavedStatus("danger", (res && res.error) || "Could not save the puzzle.");
        }
      })
      .fail(function (xhr) {
        showSavedStatus("danger", apiError(xhr, "Could not save the puzzle."));
      })
      .always(function () { $btn.prop("disabled", false); });
  });

  function formatSavedDate(raw) {
    const date = new Date(String(raw || "").replace(" ", "T"));
    return isNaN(date) ? String(raw || "")
      : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function savedPuzzleItem(p) {
    const details = [p.word, "saved " + formatSavedDate(p.created_date)].join(" · ");
    const $title  = p.name
      ? $('<div class="fw-semibold"></div>').text(p.name)
      : $('<div class="fst-italic text-body-tertiary"></div>').text("Unnamed");
    return $('<button type="button" class="list-group-item list-group-item-action"></button>')
      .attr("data-id", p.id)
      .append($title)
      .append($('<small class="text-muted"></small>').text(details));
  }

  function loadSavedPuzzles(activeId) {
    const $btn  = $("#loadSavedBtn").prop("disabled", true);
    const $list = $("#savedList").empty();

    $.ajax({ url: "../api/get_all.php", method: "GET", dataType: "json", cache: false })
      .done(function (res) {
        if (!res || !res.success)
          return showSavedStatus("danger", (res && res.error) || "Could not load saved puzzles.");
        if (!res.puzzles || !res.puzzles.length)
          return showSavedStatus("secondary", "No saved puzzles yet.");
        res.puzzles.forEach(function (p) {
          const $item = savedPuzzleItem(p);
          if (p.id == activeId) $item.addClass("active").attr("aria-current", "true");
          $list.append($item);
        });
      })
      .fail(function (xhr) {
        showSavedStatus("danger", apiError(xhr, "Could not load saved puzzles."));
      })
      .always(function () { $btn.prop("disabled", false); });
  }

  $("#loadSavedBtn").on("click", function () {
    $("#savedStatus").empty();
    loadSavedPuzzles();
  });

  $("#savedList").on("click", ".list-group-item", function () {
    const $item = $(this);
    $("#savedStatus").empty();

    $.ajax({ url: "../api/get_puzzle.php", method: "GET",
             data: { id: $item.data("id") }, dataType: "json" })
      .done(function (res) {
        if (!res || !res.success || !res.puzzle)
          return showSavedStatus("danger", (res && res.error) || "That puzzle could not be loaded.");
        const loaded = puzzleFromApi(res.puzzle);
        if (!loaded)
          return showSavedStatus("danger", "That puzzle's saved layout is invalid.");

        const { chars, direction, centralCharacter, hiddenCount } = loaded;
        settings = { chars, direction, centralCharacter, hiddenCount };
        fillCreateForm(settings);
        showPuzzle(loaded);

        $item.addClass("active").attr("aria-current", "true")
             .siblings().removeClass("active").removeAttr("aria-current");
        showSavedStatus("success", "Puzzle loaded.");
      })
      .fail(function (xhr) {
        showSavedStatus("danger", apiError(xhr, "That puzzle could not be loaded."));
      });
  });

  // ── Manage tab — expandable rows ──────────────────────────
  const previewCache = {};

  $(document).on("click", ".puzzle-row", function () {
    const id      = $(this).data("id");
    const $detail = $("#detail-" + id);
    const isOpen  = !$detail.hasClass("d-none");

    $(".detail-row").not($detail).addClass("d-none");

    if (isOpen) {
      $detail.addClass("d-none");
      return;
    }

    $detail.removeClass("d-none");

    if (previewCache[id]) {
      renderPreview(id, previewCache[id]);
    } else {
      $.ajax({ url: "../api/get_puzzle.php", method: "GET",
               data: { id: id }, dataType: "json" })
        .done(function (res) {
          if (!res || !res.success || !res.puzzle) {
            $("#preview-loading-" + id).text("Could not load preview.");
            return;
          }
          previewCache[id] = res.puzzle;
          renderPreview(id, res.puzzle);
        })
        .fail(function () {
          $("#preview-loading-" + id).text("Could not load preview.");
        });
    }
  });

  function renderPreview(id, p) {
    const preview = puzzleFromApi(p);
    if (!preview) {
      $("#preview-loading-" + id).text("This puzzle's saved layout is invalid.");
      return;
    }
    renderWheel(preview, $("#preview-wheel-" + id));
    $("#preview-loading-" + id).addClass("d-none");
  }

  // API puzzles → print-ready puzzles (with names for the print labels).
  // Warns about and skips any whose saved layout is invalid.
  function printablePuzzles(apiPuzzles) {
    const printable = [];
    apiPuzzles.forEach(function (p) {
      const built = puzzleFromApi(p);
      if (built) printable.push({ ...built, name: p.name || null });
    });
    const skipped = apiPuzzles.length - printable.length;
    if (skipped) alert(skipped + " puzzle(s) skipped: saved layout is invalid.");
    return printable;
  }

  // ── Manage tab — publish / unpublish ──────────────────────
  $(document).on("click", ".toggle-btn", function (e) {
    e.stopPropagation();
    const $btn    = $(this);
    const id      = $btn.data("id");
    const current = $btn.data("status");
    const next    = current === "published" ? "draft" : "published";

    $.ajax({
      url: "../api/update_puzzle.php", method: "POST",
      contentType: "application/json", dataType: "json",
      data: JSON.stringify({ id: id, status: next }),
    }).done(function (res) {
      if (res && res.success) {
        $btn.data("status", next)
            .text(next === "published" ? "Unpublish" : "Publish")
            .toggleClass("btn-outline-success btn-outline-secondary");
        const $badge = $("#row-" + id).find(".badge");
        $badge.text(next)
              .removeClass("bg-success bg-secondary")
              .addClass(next === "published" ? "bg-success" : "bg-secondary");
      } else {
        alert("Error: " + ((res && res.error) || "Could not update puzzle."));
      }
    });
  });

  // ── Manage tab — schedule date ─────────────────────────────
  $(document).on("change", ".date-input", function (e) {
    e.stopPropagation();
    const id   = $(this).data("id");
    const date = $(this).val() || null;

    $.ajax({
      url: "../api/update_puzzle.php", method: "POST",
      contentType: "application/json", dataType: "json",
      data: JSON.stringify({ id: id, scheduled_date: date }),
    }).done(function (res) {
      if (res && !res.success)
        alert("Error saving date: " + (res.error || "Unknown error."));
    });
  });

  // ── Manage tab — single delete ─────────────────────────────
  $(document).on("click", ".delete-btn", function (e) {
    e.stopPropagation();
    const id   = $(this).data("id");
    const word = $(this).data("word");
    if (!confirm('Delete puzzle "' + word + '"? This cannot be undone.')) return;
    deletePuzzle(id);
  });

  function deletePuzzle(id) {
    return $.ajax({
      url: "../api/delete_puzzle.php", method: "POST",
      contentType: "application/json", dataType: "json",
      data: JSON.stringify({ id: id }),
    }).done(function (res) {
      if (res && res.success) {
        $("#row-" + id).add("#detail-" + id).fadeOut(300, function () { $(this).remove(); });
        delete previewCache[id];
        updateBulkToolbar();
      } else {
        alert("Error: " + ((res && res.error) || "Could not delete puzzle."));
      }
    });
  }

  // ── Manage tab — checkboxes & bulk toolbar ─────────────────
  function selectedIds() {
    return $(".row-checkbox:checked").map(function () {
      return parseInt(this.value, 10);
    }).get();
  }

  function updateBulkToolbar() {
    const ids = selectedIds();
    if (ids.length > 0) {
      $("#bulkCount").text(ids.length + " selected");
      $("#bulkToolbar").addClass("visible");
    } else {
      $("#bulkToolbar").removeClass("visible");
    }
    const total   = $(".row-checkbox").length;
    const checked = $(".row-checkbox:checked").length;
    $("#selectAll").prop("indeterminate", checked > 0 && checked < total);
    $("#selectAll").prop("checked", checked === total && total > 0);
  }

  $(document).on("change", ".row-checkbox", function () {
    updateBulkToolbar();
  });

  $("#selectAll").on("change", function () {
    $(".row-checkbox").prop("checked", this.checked);
    updateBulkToolbar();
  });

  $("#bulkClearBtn").on("click", function () {
    $(".row-checkbox").prop("checked", false);
    $("#selectAll").prop("checked", false).prop("indeterminate", false);
    updateBulkToolbar();
  });

  $("#bulkDeleteBtn").on("click", function () {
    const ids = selectedIds();
    if (!ids.length) return;
    if (!confirm("Delete " + ids.length + " puzzle(s)? This cannot be undone.")) return;

    let chain = Promise.resolve();
    ids.forEach(function (id) {
      chain = chain.then(function () { return deletePuzzle(id); });
    });
    chain.then(function () {
      $(".row-checkbox").prop("checked", false);
      updateBulkToolbar();
    });
  });

  // ── Print — single puzzle from detail row ─────────────────
  $(document).on("click", ".print-one-btn", function (e) {
    e.stopPropagation();
    const id = $(this).data("id");
    if (!previewCache[id]) return;
    const printable = printablePuzzles([previewCache[id]]);
    if (printable.length) openPrintModal(printable);
  });

  // ── Print — bulk from toolbar ──────────────────────────────
  $("#bulkPrintBtn").on("click", function () {
    const ids = selectedIds();
    if (!ids.length) return;

    const fetches = ids.map(function (id) {
      if (previewCache[id]) return Promise.resolve(previewCache[id]);
      return $.ajax({ url: "../api/get_puzzle.php", method: "GET",
                      data: { id: id }, dataType: "json" })
        .then(function (res) {
          if (res && res.success && res.puzzle) {
            previewCache[id] = res.puzzle;
            return res.puzzle;
          }
          return null;
        });
    });

    Promise.all(fetches).then(function (puzzles) {
      const printable = printablePuzzles(puzzles.filter(Boolean));
      if (printable.length) openPrintModal(printable);
    });
  });

  // ── Print modal — shared by manage tab and batch tab ──────
  // Takes built puzzles (puzzleFromApi / buildPuzzle, optional .name).
  // batch.js calls window.openPrintModal(puzzles) to queue batch puzzles.
  let _printQueue = [];
  const printModal = new bootstrap.Modal(document.getElementById("printModal"));

  function openPrintModal(puzzles) {
    _printQueue = puzzles;
    printModal.show();
  }

  // Expose globally so batch.js can open the modal with its puzzles
  window.openPrintModal = openPrintModal;

  $("#printConfirmBtn").on("click", function () {
    printModal.hide();
    const perPage = parseInt($("#printPerPageSelect").val(), 10) || 1;
    printPuzzles(_printQueue, { perPage: perPage });
  });
});
