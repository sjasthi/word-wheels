// ============================================================
// Word Wheel — shared hint editor (admin)
// ============================================================
// The "Hints for players" block: Generate hints (AI draft), Write hints
// yourself, Edit, Regenerate, Remove, Approve, Cancel. Used by the
// Manage Puzzles tab (expanded row) and the Calendar day pop-up, so both
// behave the same and a fix here reaches both.
//
//   const editor = HintEditor.create({
//     root: "#manageBody",            // element the editor is drawn inside
//     idPrefix: "manage",             // keeps input ids unique per page area
//     getPuzzle: (id) => puzzle,      // { id, word, hints: [{type,text}] }
//     isEnabled: () => bool,          // the server has an AI key
//     onChange: () => render(),       // redraw the host (draft state changed)
//     onSaved: (puzzle, message) => …,// hints approved or removed: reload data
//     onMessage: (type, message) => …,// show a status message
//   });
//   editor.section(puzzle)            // → jQuery block to put in the page
//
// Players only see hints a teacher approved. Limits match
// api/hint_checks.php, which checks again on save. Approving saves at
// once (api/save_hints.php); nothing else on the page has to be saved.
// ============================================================

window.HintEditor = (function () {
  const FIELDS = [
    { type: "theme", label: "Hint 1: short clue", help: "2–5 words, vaguer than hint 2." },
    { type: "definition", label: "Hint 2: what it means", help: "One kid-friendly sentence." },
  ];
  const MAX_CHARS = 150;

  function copyHints(list) {
    return FIELDS.map((f, i) => ({ type: f.type, text: (list && list[i] && list[i].text) || "" }));
  }

  function request(url, body) {
    return $.ajax({
      url: "../api/" + url,
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(body),
    });
  }

  function create(opts) {
    const { apiError } = window.WordWheel;
    const $root = $(opts.root);
    const prefix = opts.idPrefix || "hint";
    // Open editors, by puzzle id. Kept here, not in the page, so typed
    // text survives re-renders: { hints: [{ type, text }], error, busy, fromAi }
    const drafts = new Map();

    function errorText(xhr, fallback) {
      if (xhr.status === 403) return "Your admin session has expired. Log in again, then try once more.";
      return apiError(xhr, fallback);
    }

    function button(cls, style, text, id) {
      return $('<button type="button" class="btn btn-sm"></button>')
        .addClass(cls + " btn-" + style)
        .attr("data-id", id)
        .text(text);
    }

    function inputId(id, i) {
      return `${prefix}-hint-${id}-${i}`;
    }

    function section(p) {
      const enabled = opts.isEnabled();
      const draft = drafts.get(p.id);
      const $box = $('<div class="ww-hint-editor mb-3"></div>').append(
        $('<div class="form-label small text-muted mb-1"></div>').text("Hints for players"),
      );

      if (draft) {
        FIELDS.forEach(function (f, i) {
          const fieldId = inputId(p.id, i);
          $box.append(
            $('<div class="mb-2"></div>').append(
              $('<label class="form-label small mb-1"></label>').attr("for", fieldId).text(f.label),
              $('<input type="text" class="form-control form-control-sm hint-input">')
                .attr({ id: fieldId, maxlength: MAX_CHARS, "data-id": p.id, "data-index": i, "aria-describedby": fieldId + "-help" })
                .val(draft.hints[i].text)
                .prop("disabled", draft.busy),
              $('<div class="form-text"></div>').attr("id", fieldId + "-help").text(f.help),
            ),
          );
        });
        if (draft.error) {
          $box.append($('<div class="alert alert-warning py-2 small mb-2" role="alert"></div>').text(draft.error));
        }
        $box.append(
          $('<div class="d-flex gap-2 flex-wrap align-items-center"></div>').append(
            button("hint-approve-btn", "primary", "Approve hints", p.id).prop("disabled", draft.busy),
            enabled
              ? button("hint-generate-btn", "outline-secondary", draft.busy ? "Working…" : "Regenerate", p.id).prop("disabled", draft.busy)
              : null,
            button("hint-cancel-btn", "link", "Cancel", p.id).prop("disabled", draft.busy),
            draft.busy ? $('<span class="spinner-border spinner-border-sm text-muted" role="status" aria-label="Working"></span>') : null,
          ),
        );
        return $box;
      }

      if (p.hints.length) {
        $box.append(
          $('<ol class="small ps-3 mb-2"></ol>').append(p.hints.map((h) => $("<li></li>").text(h.text))),
          $('<div class="d-flex gap-2 flex-wrap"></div>').append(
            button("hint-edit-btn", "outline-secondary", "Edit", p.id),
            enabled ? button("hint-generate-btn", "outline-secondary", "Regenerate", p.id) : null,
            button("hint-remove-btn", "outline-danger", "Remove", p.id),
          ),
        );
        return $box;
      }

      $box.append(
        $('<p class="small text-muted mb-2"></p>').text(
          enabled
            ? "No hints yet, so players won't see a Hint button for this puzzle."
            : "No hints yet. AI hints are off on this server (no API key), but you can write hints yourself.",
        ),
        $('<div class="d-flex gap-2 flex-wrap"></div>').append(
          enabled ? button("hint-generate-btn", "outline-primary", "Generate hints", p.id) : null,
          button("hint-write-btn", "outline-secondary", "Write hints yourself", p.id),
        ),
      );
      return $box;
    }

    function openEditor(id, hints, fromAi) {
      drafts.set(id, { hints: copyHints(hints), error: null, busy: false, fromAi });
      opts.onChange();
      $("#" + inputId(id, 0)).trigger("focus");
    }

    // ── Events (delegated, so re-rendered blocks keep working) ──
    $root.on("click", ".hint-generate-btn", function (e) {
      e.stopPropagation();
      const id = $(this).data("id");
      const p = opts.getPuzzle(id);
      if (!p) return;
      const before = drafts.get(id);
      const draft = {
        hints: copyHints(before ? before.hints : p.hints),
        error: null,
        busy: true,
        fromAi: before ? before.fromAi : false,
      };
      drafts.set(id, draft);
      opts.onChange();

      request("generate_hints.php", { id })
        .done(function (res) {
          if (!res || !res.success) {
            draft.error = (res && res.error) || "Could not write hints. Try again.";
            return;
          }
          draft.hints = copyHints(res.hints);
          draft.fromAi = true;
          draft.error = res.ok ? null : res.error;
        })
        .fail(function (xhr) { draft.error = errorText(xhr, "Could not write hints. Try again."); })
        .always(function () {
          draft.busy = false;
          if (drafts.get(id) === draft) opts.onChange();
        });
    });

    $root.on("click", ".hint-write-btn", function (e) {
      e.stopPropagation();
      openEditor($(this).data("id"), null, false);
    });

    $root.on("click", ".hint-edit-btn", function (e) {
      e.stopPropagation();
      const p = opts.getPuzzle($(this).data("id"));
      if (p) openEditor(p.id, p.hints, false);
    });

    $root.on("input", ".hint-input", function () {
      const draft = drafts.get($(this).data("id"));
      if (draft) draft.hints[$(this).data("index")].text = this.value;
    });

    $root.on("click", ".hint-input", function (e) { e.stopPropagation(); });

    $root.on("click", ".hint-cancel-btn", function (e) {
      e.stopPropagation();
      drafts.delete($(this).data("id"));
      opts.onChange();
    });

    $root.on("click", ".hint-approve-btn", function (e) {
      e.stopPropagation();
      const id = $(this).data("id");
      const p = opts.getPuzzle(id);
      const draft = drafts.get(id);
      if (!p || !draft || draft.busy) return;
      draft.busy = true;
      draft.error = null;
      opts.onChange();

      request("save_hints.php", { id, hints: draft.hints, use_draft: draft.fromAi })
        .done(function (res) {
          if (!res || !res.success) {
            draft.busy = false;
            draft.error = (res && res.error) || "Could not save the hints.";
            return opts.onChange();
          }
          drafts.delete(id);
          opts.onSaved(p, `Hints saved for "${p.word}". Players will see a Hint button for it.`);
        })
        .fail(function (xhr) {
          draft.busy = false;
          draft.error = errorText(xhr, "Could not save the hints.");
          opts.onChange();
        });
    });

    $root.on("click", ".hint-remove-btn", function (e) {
      e.stopPropagation();
      const p = opts.getPuzzle($(this).data("id"));
      if (!p) return;
      if (!confirm(`Remove the hints for "${p.word}"? Players will no longer see a Hint button for it.`)) return;
      request("save_hints.php", { id: p.id, hints: null })
        .done(function (res) {
          if (!res || !res.success) return opts.onMessage("danger", (res && res.error) || "Could not remove the hints.");
          opts.onSaved(p, `Removed the hints for "${p.word}".`);
        })
        .fail(function (xhr) { opts.onMessage("danger", errorText(xhr, "Could not remove the hints.")); });
    });

    return {
      section,
      isOpen: (id) => drafts.has(id),
      reset: () => drafts.clear(),
    };
  }

  return { create };
})();
