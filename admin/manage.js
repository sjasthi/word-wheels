// ============================================================
// Word Wheel — Manage Puzzles tab
// ============================================================
// Loads every puzzle from api/get_all.php and draws the table in the
// browser, so it can:
//   * filter (search, schedule status, scheduled date, language, length,
//     + more filters)
//   * sort by clicking a column header
//   * refresh after saves in the Create / Batch tabs without a reload
//     (they call window.refreshManage())
// Bulk actions go through api/bulk_update.php in one request, and only
// ever apply to selected rows that are currently shown.
// Filters and sort are remembered in this browser (localStorage).
// ============================================================

$(function () {
  const { toChars, buildPuzzle, puzzleFromApi, renderWheel, apiError } = window.WordWheel;

  const STORE_KEY = "wordwheel.admin.manage.v1";
  const DIRECTION_LABELS = { random: "Random", cw: "Clockwise", ccw: "Anticlockwise" };
  const COLUMN_COUNT = 11;
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

  const DEFAULT_FILTERS = {
    search: "", schedule: "", date: "", language: "", lengthMin: "", lengthMax: "",
    hidden: "", center: "", direction: "",
  };
  const MORE_FILTER_KEYS = ["hidden", "center", "direction"];

  // filter key → input element
  const FILTER_INPUTS = {
    search: "#filterSearch", schedule: "#filterSchedule", date: "#filterDate", language: "#filterLanguage",
    lengthMin: "#filterLengthMin", lengthMax: "#filterLengthMax",
    hidden: "#filterHidden", center: "#filterCenter", direction: "#filterDirection",
  };

  // ── State ──────────────────────────────────────────────────
  let puzzles = [];          // rows from get_all.php, plus .length
  let today = null;          // server date "YYYY-MM-DD"
  let openId = null;         // expanded row
  let request = null;        // in-flight get_all request
  const selected = new Set(); // ids of ticked rows (always a subset of shown rows)
  let hintsEnabled = false;  // the server has an AI key (get_all.php)
  // Open hint editors, by puzzle id. Kept here, not in the page, so typed
  // text survives re-renders: { hints: [{ type, text }], error, busy, fromAi }
  const hintDrafts = new Map();

  let filters = { ...DEFAULT_FILTERS };
  let sort = { key: "created", dir: "desc" };
  let moreOpen = false;

  // ── Sorting ────────────────────────────────────────────────
  // Each comparator sorts ascending; descending just flips it.
  // Blank names and unscheduled dates always go last.
  const SORTERS = {
    id:        (a, b) => a.id - b.id,
    name:      (a, b) => collator.compare(a.name || "", b.name || ""),
    word:      (a, b) => collator.compare(a.word, b.word),
    length:    (a, b) => a.length - b.length,
    language:  (a, b) => collator.compare(a.language || "", b.language || ""),
    direction: (a, b) => collator.compare(DIRECTION_LABELS[a.direction] || "", DIRECTION_LABELS[b.direction] || ""),
    hidden:    (a, b) => a.hidden_count - b.hidden_count,
    center:    (a, b) => Number(a.center_letter) - Number(b.center_letter),
    scheduled: (a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""),
    created:   (a, b) => String(a.created_date).localeCompare(String(b.created_date)),
  };
  const EMPTY_LAST = {
    name: (p) => !p.name,
    scheduled: (p) => !p.scheduled_date,
  };

  function compareRows(a, b) {
    const isEmpty = EMPTY_LAST[sort.key];
    if (isEmpty && isEmpty(a) !== isEmpty(b)) return isEmpty(a) ? 1 : -1;
    const result = SORTERS[sort.key](a, b) * (sort.dir === "asc" ? 1 : -1);
    return result || b.id - a.id; // newest first on ties
  }

  // ── Saved preferences ──────────────────────────────────────
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!saved || typeof saved !== "object") return;
      Object.keys(DEFAULT_FILTERS).forEach(function (k) {
        if (saved.filters && typeof saved.filters[k] === "string") filters[k] = saved.filters[k];
      });
      if (saved.sort && SORTERS[saved.sort.key]) {
        sort = { key: saved.sort.key, dir: saved.sort.dir === "asc" ? "asc" : "desc" };
      }
      moreOpen = !!saved.moreOpen;
    } catch (_) {
      // storage blocked or corrupt: use the defaults
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ filters, sort, moreOpen }));
    } catch (_) {
      // storage blocked: settings last until the page closes
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  function scheduleState(p) {
    if (!p.scheduled_date) return "unscheduled";
    if (p.scheduled_date === today) return "today";
    return p.scheduled_date > today ? "upcoming" : "past";
  }

  function formatDay(ymd) {
    const d = new Date(ymd + "T00:00:00");
    return isNaN(d) ? ymd : d.toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  function formatCreated(raw) {
    const d = new Date(String(raw || "").replace(" ", "T"));
    return isNaN(d) ? String(raw || "") : d.toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function byId(id) {
    return puzzles.find((p) => p.id === id);
  }

  function showStatus(type, message) {
    $("#manageStatus").html(
      $('<div class="alert alert-dismissible py-2 mb-0"></div>')
        .addClass("alert-" + type)
        .text(message)
        .append('<button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="Close"></button>'),
    );
  }

  // API row → puzzle for drawing/printing. Rows saved before the layout
  // migration get a fresh layout, the same as on the player page.
  function toBuilt(p) {
    const saved = puzzleFromApi(p);
    if (saved) return saved;
    if (!p || !Array.isArray(p.arrangement) || p.arrangement.length < 3) return null;
    const ringSize = p.arrangement.length - (p.center_letter ? 1 : 0);
    return buildPuzzle({
      chars: p.arrangement,
      direction: DIRECTION_LABELS[p.direction] ? p.direction : "cw",
      centralCharacter: !!p.center_letter,
      hiddenCount: Math.max(0, Math.min(p.hidden_count || 0, ringSize - 1)),
    });
  }

  function printableFrom(rows) {
    const out = [];
    rows.forEach(function (p) {
      const built = toBuilt(p);
      if (built) out.push({ ...built, name: p.name || null });
    });
    const skipped = rows.length - out.length;
    if (skipped) showStatus("warning", plural(skipped, "puzzle") + " skipped: no letters saved.");
    return out;
  }

  // ── Filtering ──────────────────────────────────────────────
  function matches(p) {
    const q = filters.search.trim().normalize("NFC").toLocaleLowerCase();
    if (q) {
      const name = (p.name || "").normalize("NFC").toLocaleLowerCase();
      const word = p.word.normalize("NFC").toLocaleLowerCase();
      if (!name.includes(q) && !word.includes(q)) return false;
    }
    if (filters.schedule) {
      const state = scheduleState(p);
      if (filters.schedule === "scheduled" ? state === "unscheduled" : state !== filters.schedule) return false;
    }
    if (filters.date && p.scheduled_date !== filters.date) return false;
    if (filters.language && p.language !== filters.language) return false;

    const min = parseInt(filters.lengthMin, 10);
    const max = parseInt(filters.lengthMax, 10);
    if (Number.isInteger(min) && p.length < min) return false;
    if (Number.isInteger(max) && p.length > max) return false;

    if (filters.hidden !== "" && p.hidden_count !== parseInt(filters.hidden, 10)) return false;
    if (filters.center && p.center_letter !== (filters.center === "yes")) return false;
    if (filters.direction && p.direction !== filters.direction) return false;
    return true;
  }

  function visibleRows() {
    return puzzles.filter(matches).sort(compareRows);
  }

  // ── Rendering ──────────────────────────────────────────────
  function scheduleCell(p) {
    const state = scheduleState(p);
    if (state === "unscheduled") {
      return $('<td class="text-muted"></td>').append("— ", $('<small></small>').text("free play"));
    }
    const badge = {
      today: ["text-bg-success", "Today"],
      upcoming: ["text-bg-primary", "Upcoming"],
      past: ["text-bg-light border", "Past"],
    }[state];
    return $("<td></td>").append(
      $("<span></span>").text(p.scheduled_date + " "),
      $('<span class="badge"></span>').addClass(badge[0]).text(badge[1]),
    );
  }

  function summaryRow(p) {
    return $('<tr class="puzzle-row"></tr>')
      .attr({ "data-id": p.id, "aria-expanded": String(openId === p.id) })
      .toggleClass("table-active", openId === p.id)
      .append(
        $('<td class="select-cell"></td>').append(
          $('<input type="checkbox" class="form-check-input row-checkbox">')
            .val(p.id)
            .attr("aria-label", "Select puzzle " + p.id)
            .prop("checked", selected.has(p.id)),
        ),
        $("<td></td>").text(p.id),
        p.name
          ? $("<td></td>").text(p.name)
          : $('<td><span class="fst-italic text-muted">Unnamed</span></td>'),
        $("<td></td>").append(
          $("<strong></strong>").text(p.word),
          p.hints.length ? $('<span class="badge text-bg-success ms-2">Hints</span>') : null,
        ),
        $("<td></td>").text(p.length),
        $("<td></td>").text((p.language || "").toUpperCase()),
        $("<td></td>").text(DIRECTION_LABELS[p.direction] || p.direction),
        $("<td></td>").text(p.hidden_count),
        $("<td></td>").text(p.center_letter ? "Yes" : "No"),
        scheduleCell(p),
        $("<td></td>").text(formatCreated(p.created_date)),
      );
  }

  function detailRow(p) {
    const built = toBuilt(p);
    const $wheel = $('<div class="wheel preview-wheel"></div>');
    if (built) renderWheel(built, $wheel);

    return $('<tr class="detail-row"></tr>').append(
      $("<td></td>").attr("colspan", COLUMN_COUNT).append(
        $('<div class="row g-3 align-items-start"></div>').append(
          $('<div class="col-md-4 text-center"></div>').append(
            built ? $wheel : $('<p class="text-muted small"></p>').text("No preview: this puzzle has no letters saved."),
            built && !puzzleFromApi(p)
              ? $('<p class="text-muted small mt-2 mb-0"></p>').text("Saved before layouts were stored — players get a new layout each time.")
              : null,
          ),
          $('<div class="col-md-8"></div>').append(
            $('<h6 class="fw-semibold mb-3"></h6>').text(p.name || p.word),
            $('<div class="mb-3"></div>').append(
              $('<label class="form-label small text-muted mb-1"></label>')
                .attr("for", "date-" + p.id)
                .text("Scheduled date"),
              $('<div class="d-flex gap-2 align-items-center"></div>').append(
                $('<input type="date" class="form-control form-control-sm date-input" style="max-width:200px">')
                  .attr({ id: "date-" + p.id, "data-id": p.id })
                  .val(p.scheduled_date || ""),
                p.scheduled_date
                  ? $('<button type="button" class="btn btn-sm btn-link unschedule-one-btn"></button>')
                      .attr("data-id", p.id)
                      .text("Unschedule")
                  : $('<small class="text-muted"></small>').text("Unscheduled puzzles are in the free play pool."),
              ),
            ),
            hintSection(p),
            $('<div class="d-flex gap-2 flex-wrap"></div>').append(
              $('<button type="button" class="btn btn-sm btn-outline-primary print-one-btn">Print</button>')
                .attr("data-id", p.id),
              $('<button type="button" class="btn btn-sm btn-outline-danger delete-one-btn">Delete</button>')
                .attr("data-id", p.id),
            ),
          ),
        ),
      ),
    );
  }

  // ── Hints ──────────────────────────────────────────────────
  // Players only see hints a teacher approved. Limits match
  // api/hint_checks.php, which checks again on save.
  const HINT_FIELDS = [
    { type: "theme", label: "Hint 1: short clue", help: "2–5 words, vaguer than hint 2." },
    { type: "definition", label: "Hint 2: what it means", help: "One kid-friendly sentence." },
  ];
  const HINT_MAX_CHARS = 150;

  function copyHints(list) {
    return HINT_FIELDS.map((f, i) => ({ type: f.type, text: (list && list[i] && list[i].text) || "" }));
  }

  function hintButton(cls, style, text, id) {
    return $('<button type="button" class="btn btn-sm"></button>')
      .addClass(cls + " btn-" + style)
      .attr("data-id", id)
      .text(text);
  }

  function hintSection(p) {
    const draft = hintDrafts.get(p.id);
    const $box = $('<div class="mb-3"></div>').append(
      $('<div class="form-label small text-muted mb-1"></div>').text("Hints for players"),
    );

    if (draft) {
      HINT_FIELDS.forEach(function (f, i) {
        const inputId = `hint-${p.id}-${i}`;
        $box.append(
          $('<div class="mb-2"></div>').append(
            $('<label class="form-label small mb-1"></label>').attr("for", inputId).text(f.label),
            $('<input type="text" class="form-control form-control-sm hint-input">')
              .attr({ id: inputId, maxlength: HINT_MAX_CHARS, "data-id": p.id, "data-index": i, "aria-describedby": inputId + "-help" })
              .val(draft.hints[i].text)
              .prop("disabled", draft.busy),
            $('<div class="form-text"></div>').attr("id", inputId + "-help").text(f.help),
          ),
        );
      });
      if (draft.error) {
        $box.append($('<div class="alert alert-warning py-2 small mb-2" role="alert"></div>').text(draft.error));
      }
      $box.append(
        $('<div class="d-flex gap-2 flex-wrap align-items-center"></div>').append(
          hintButton("hint-approve-btn", "primary", "Approve hints", p.id).prop("disabled", draft.busy),
          hintsEnabled
            ? hintButton("hint-generate-btn", "outline-secondary", draft.busy ? "Working…" : "Regenerate", p.id).prop("disabled", draft.busy)
            : null,
          hintButton("hint-cancel-btn", "link", "Cancel", p.id).prop("disabled", draft.busy),
          draft.busy ? $('<span class="spinner-border spinner-border-sm text-muted" role="status" aria-label="Working"></span>') : null,
        ),
      );
      return $box;
    }

    if (p.hints.length) {
      $box.append(
        $('<ol class="small ps-3 mb-2"></ol>').append(p.hints.map((h) => $("<li></li>").text(h.text))),
        $('<div class="d-flex gap-2 flex-wrap"></div>').append(
          hintButton("hint-edit-btn", "outline-secondary", "Edit", p.id),
          hintsEnabled ? hintButton("hint-generate-btn", "outline-secondary", "Regenerate", p.id) : null,
          hintButton("hint-remove-btn", "outline-danger", "Remove", p.id),
        ),
      );
      return $box;
    }

    $box.append(
      $('<p class="small text-muted mb-2"></p>').text(
        hintsEnabled
          ? "No hints yet, so players won't see a Hint button for this puzzle."
          : "No hints yet. AI hints are off on this server (no API key), but you can write hints yourself.",
      ),
      $('<div class="d-flex gap-2 flex-wrap"></div>').append(
        hintsEnabled ? hintButton("hint-generate-btn", "outline-primary", "Generate hints", p.id) : null,
        hintButton("hint-write-btn", "outline-secondary", "Write hints yourself", p.id),
      ),
    );
    return $box;
  }

  function messageRow(content) {
    return $("<tr></tr>").append(
      $('<td class="text-center text-muted py-4"></td>').attr("colspan", COLUMN_COUNT).append(content),
    );
  }

  function render() {
    const rows = visibleRows();
    const shownIds = new Set(rows.map((p) => p.id));

    // Selection never includes rows the filters hide
    [...selected].forEach((id) => { if (!shownIds.has(id)) selected.delete(id); });
    if (openId !== null && !shownIds.has(openId)) openId = null;

    const $body = $("#manageBody").empty();
    if (!puzzles.length) {
      $body.append(messageRow("No puzzles yet. Create one in the Create Puzzle or Batch Generate tab."));
    } else if (!rows.length) {
      $body.append(messageRow([
        document.createTextNode("No puzzles match these filters. "),
        $('<button type="button" class="btn btn-link btn-sm p-0 align-baseline reset-filters-link">Reset filters</button>'),
      ]));
    } else {
      rows.forEach(function (p) {
        $body.append(summaryRow(p));
        if (p.id === openId) $body.append(detailRow(p));
      });
    }

    $("#manageCount").text(
      puzzles.length
        ? rows.length === puzzles.length
          ? `Showing all ${plural(puzzles.length, "puzzle")}`
          : `Showing ${rows.length} of ${plural(puzzles.length, "puzzle")}`
        : "",
    );

    renderSortHeaders();
    updateToolbar();
  }

  function renderSortHeaders() {
    $("#manageTable th.sortable").each(function () {
      const active = $(this).data("sort") === sort.key;
      $(this)
        .attr({
          tabindex: 0,
          "aria-sort": active ? (sort.dir === "asc" ? "ascending" : "descending") : "none",
        })
        .find(".sort-arrow").remove().end()
        .append($('<span class="sort-arrow" aria-hidden="true"></span>').text(active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""));
    });
  }

  function updateToolbar() {
    const shown = $("#manageBody .row-checkbox").length;
    const count = selected.size;
    $("#bulkCount").text(count + " selected");
    $("#bulkToolbar").toggleClass("visible", count > 0);
    $("#selectAll")
      .prop("checked", shown > 0 && count === shown)
      .prop("indeterminate", count > 0 && count < shown)
      .prop("disabled", shown === 0);
  }

  function renderLanguageOptions() {
    const langs = [...new Set(puzzles.map((p) => p.language).filter(Boolean))].sort(collator.compare);
    if (filters.language && !langs.includes(filters.language)) langs.push(filters.language);
    const $select = $("#filterLanguage").empty().append('<option value="">All</option>');
    langs.forEach((l) => $select.append($("<option></option>").val(l).text(l.toUpperCase())));
    $select.val(filters.language);
  }

  function renderMoreFilters() {
    const active = MORE_FILTER_KEYS.filter((k) => filters[k] !== "").length;
    $("#moreFilters").toggleClass("d-none", !moreOpen);
    $("#moreFiltersBtn")
      .attr("aria-expanded", String(moreOpen))
      .text("More filters" + (active ? ` (${active})` : ""))
      .toggleClass("btn-secondary", active > 0)
      .toggleClass("btn-outline-secondary", active === 0);
  }

  function writeFilterInputs() {
    Object.entries(FILTER_INPUTS).forEach(([key, sel]) => $(sel).val(filters[key]));
  }

  // ── Loading ────────────────────────────────────────────────
  function refresh() {
    if (request) request.abort();
    request = $.ajax({ url: "../api/get_all.php", method: "GET", dataType: "json", cache: false })
      .done(function (res) {
        if (!res || !res.success) {
          return showStatus("danger", (res && res.error) || "Could not load puzzles.");
        }
        today = res.today;
        hintsEnabled = !!res.hints_enabled;
        puzzles = (res.puzzles || []).map((p) => ({
          ...p,
          length: toChars(p.word).length,
          hints: Array.isArray(p.hints) ? p.hints : [],
        }));
        const ids = new Set(puzzles.map((p) => p.id));
        [...selected].forEach((id) => { if (!ids.has(id)) selected.delete(id); });
        renderLanguageOptions();
        render();
      })
      .fail(function (xhr, textStatus) {
        if (textStatus === "abort") return;
        if (xhr.status === 403) {
          $("#manageStatus").html(
            $('<div class="alert alert-warning py-2 mb-0"></div>').append(
              "Your admin session has expired. ",
              $('<a href="login.php">Log in again</a>'),
            ),
          );
          return;
        }
        showStatus("danger", apiError(xhr, "Could not load puzzles."));
      })
      .always(function () { request = null; });
    return request;
  }

  // Create and Batch call this after saving so new puzzles show up here
  window.refreshManage = refresh;

  // ── Server actions ─────────────────────────────────────────
  function bulk(action, ids, date) {
    return $.ajax({
      url: "../api/bulk_update.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({ action, ids, date }),
    });
  }

  function missingNote(res) {
    const n = (res && res.missing && res.missing.length) || 0;
    return n ? ` ${plural(n, "puzzle")} had already been deleted.` : "";
  }

  // Runs a bulk action with the toolbar locked, then reports and reloads.
  function runBulk(action, ids, date, describe) {
    const $buttons = $("#bulkToolbar button, #bulkToolbar input").prop("disabled", true);
    return bulk(action, ids, date)
      .done(function (res) {
        if (!res || !res.success) {
          return showStatus("danger", (res && res.error) || "Could not update puzzles.");
        }
        showStatus("success", describe(res.affected) + missingNote(res));
        selected.clear();
        refresh();
      })
      .fail(function (xhr) {
        showStatus("danger", apiError(xhr, "Could not update puzzles. Nothing was changed."));
      })
      .always(function () { $buttons.prop("disabled", false); });
  }

  // Asks before taking puzzles away from today's players.
  function confirmTodayChange(ids, verb) {
    const todays = ids.filter((id) => { const p = byId(id); return p && scheduleState(p) === "today"; }).length;
    if (!todays) return true;
    return confirm(
      `${plural(todays, "puzzle")} ${todays === 1 ? "is" : "are"} today's daily ` +
      `puzzle${todays === 1 ? "" : "s"}. ${verb} ${todays === 1 ? "it" : "them"} ` +
      "removes them from players right away. Continue?",
    );
  }

  function selectedRows() {
    // in the table's current order
    return visibleRows().filter((p) => selected.has(p.id));
  }

  // ── Events: filters, sorting, more filters ─────────────────
  Object.entries(FILTER_INPUTS).forEach(function ([key, sel]) {
    $(sel).on("input change", function () {
      if (filters[key] === this.value) return;
      filters[key] = this.value;
      savePrefs();
      renderMoreFilters();
      render();
    });
  });

  function resetFilters() {
    filters = { ...DEFAULT_FILTERS };
    writeFilterInputs();
    savePrefs();
    renderMoreFilters();
    render();
  }
  $("#resetFiltersBtn").on("click", resetFilters);
  $("#manageBody").on("click", ".reset-filters-link", resetFilters);

  $("#moreFiltersBtn").on("click", function () {
    moreOpen = !moreOpen;
    savePrefs();
    renderMoreFilters();
  });

  function sortBy(key) {
    sort = sort.key === key
      ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
      // text columns start A→Z; numbers and dates start biggest/newest first
      : { key, dir: ["name", "word", "language", "direction"].includes(key) ? "asc" : "desc" };
    savePrefs();
    render();
  }
  $("#manageTable th.sortable")
    .on("click", function () { sortBy($(this).data("sort")); })
    .on("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        sortBy($(this).data("sort"));
      }
    });

  $("#manageRefreshBtn").on("click", function () {
    $("#manageStatus").empty();
    refresh();
  });
  $("#tab-manage").on("shown.bs.tab", refresh); // always fresh when opened

  // ── Events: rows ───────────────────────────────────────────
  $("#manageBody").on("click", ".puzzle-row", function (e) {
    if ($(e.target).closest(".select-cell").length) return; // checkbox cell
    const id = $(this).data("id");
    openId = openId === id ? null : id;
    render();
  });

  $("#manageBody").on("change", ".row-checkbox", function () {
    const id = parseInt(this.value, 10);
    if (this.checked) selected.add(id);
    else selected.delete(id);
    updateToolbar();
  });

  $("#selectAll").on("change", function () {
    const checked = this.checked;
    $("#manageBody .row-checkbox").each(function () {
      this.checked = checked;
      const id = parseInt(this.value, 10);
      if (checked) selected.add(id);
      else selected.delete(id);
    });
    updateToolbar();
  });

  $("#bulkClearBtn").on("click", function () {
    selected.clear();
    $("#manageBody .row-checkbox").prop("checked", false);
    updateToolbar();
  });

  // Single-puzzle date change (detail row)
  function setDate(id, date, $input) {
    const p = byId(id);
    if (p && scheduleState(p) === "today" && date !== today && !confirmTodayChange([id], date ? "Moving" : "Unscheduling")) {
      if ($input) $input.val(p.scheduled_date || "");
      return;
    }
    $.ajax({
      url: "../api/update_puzzle.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({ id, scheduled_date: date }),
    })
      .done(function (res) {
        if (!res || !res.success) return showStatus("danger", (res && res.error) || "Could not save the date.");
        showStatus("success", date ? `Puzzle ${id} scheduled for ${formatDay(date)}.` : `Puzzle ${id} unscheduled.`);
        refresh();
      })
      .fail(function (xhr) {
        showStatus("danger", apiError(xhr, "Could not save the date."));
        refresh();
      });
  }

  $("#manageBody").on("change", ".date-input", function () {
    setDate($(this).data("id"), this.value || null, $(this));
  });

  $("#manageBody").on("click", ".unschedule-one-btn", function () {
    setDate($(this).data("id"), null);
  });

  $("#manageBody").on("click", ".print-one-btn", function () {
    const p = byId($(this).data("id"));
    const printable = p ? printableFrom([p]) : [];
    if (printable.length) window.openPrintModal(printable);
  });

  $("#manageBody").on("click", ".delete-one-btn", function () {
    const p = byId($(this).data("id"));
    if (!p) return;
    if (!confirm(`Delete puzzle "${p.word}"? This cannot be undone.`)) return;
    if (!confirmTodayChange([p.id], "Deleting")) return;
    bulk("delete", [p.id])
      .done(function (res) {
        if (!res || !res.success) return showStatus("danger", (res && res.error) || "Could not delete the puzzle.");
        selected.delete(p.id);
        showStatus("success", `Deleted "${p.word}".`);
        refresh();
      })
      .fail(function (xhr) { showStatus("danger", apiError(xhr, "Could not delete the puzzle.")); });
  });

  // ── Events: hints ──────────────────────────────────────────
  function hintRequest(url, body) {
    return $.ajax({
      url: "../api/" + url,
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(body),
    });
  }

  function hintError(xhr, fallback) {
    if (xhr.status === 403) return "Your admin session has expired. Log in again, then try once more.";
    return apiError(xhr, fallback);
  }

  function openHintEditor(id, hints, fromAi) {
    hintDrafts.set(id, { hints: copyHints(hints), error: null, busy: false, fromAi });
    render();
    $(`#hint-${id}-0`).trigger("focus");
  }

  $("#manageBody").on("click", ".hint-generate-btn", function () {
    const id = $(this).data("id");
    const p = byId(id);
    if (!p) return;
    const before = hintDrafts.get(id);
    const draft = {
      hints: copyHints(before ? before.hints : p.hints),
      error: null,
      busy: true,
      fromAi: before ? before.fromAi : false,
    };
    hintDrafts.set(id, draft);
    render();

    hintRequest("generate_hints.php", { id })
      .done(function (res) {
        if (!res || !res.success) {
          draft.error = (res && res.error) || "Could not write hints. Try again.";
          return;
        }
        draft.hints = copyHints(res.hints);
        draft.fromAi = true;
        draft.error = res.ok ? null : res.error;
      })
      .fail(function (xhr) { draft.error = hintError(xhr, "Could not write hints. Try again."); })
      .always(function () {
        draft.busy = false;
        if (hintDrafts.get(id) === draft) render();
      });
  });

  $("#manageBody").on("click", ".hint-write-btn", function () {
    openHintEditor($(this).data("id"), null, false);
  });

  $("#manageBody").on("click", ".hint-edit-btn", function () {
    const p = byId($(this).data("id"));
    if (p) openHintEditor(p.id, p.hints, false);
  });

  $("#manageBody").on("input", ".hint-input", function () {
    const draft = hintDrafts.get($(this).data("id"));
    if (draft) draft.hints[$(this).data("index")].text = this.value;
  });

  $("#manageBody").on("click", ".hint-cancel-btn", function () {
    hintDrafts.delete($(this).data("id"));
    render();
  });

  $("#manageBody").on("click", ".hint-approve-btn", function () {
    const id = $(this).data("id");
    const p = byId(id);
    const draft = hintDrafts.get(id);
    if (!p || !draft || draft.busy) return;
    draft.busy = true;
    draft.error = null;
    render();

    hintRequest("save_hints.php", { id, hints: draft.hints, use_draft: draft.fromAi })
      .done(function (res) {
        if (!res || !res.success) {
          draft.busy = false;
          draft.error = (res && res.error) || "Could not save the hints.";
          return render();
        }
        hintDrafts.delete(id);
        showStatus("success", `Hints saved for "${p.word}". Players will see a Hint button for it.`);
        refresh();
      })
      .fail(function (xhr) {
        draft.busy = false;
        draft.error = hintError(xhr, "Could not save the hints.");
        render();
      });
  });

  $("#manageBody").on("click", ".hint-remove-btn", function () {
    const p = byId($(this).data("id"));
    if (!p) return;
    if (!confirm(`Remove the hints for "${p.word}"? Players will no longer see a Hint button for it.`)) return;
    hintRequest("save_hints.php", { id: p.id, hints: null })
      .done(function (res) {
        if (!res || !res.success) return showStatus("danger", (res && res.error) || "Could not remove the hints.");
        showStatus("success", `Removed the hints for "${p.word}".`);
        refresh();
      })
      .fail(function (xhr) { showStatus("danger", hintError(xhr, "Could not remove the hints.")); });
  });

  // ── Events: bulk toolbar ───────────────────────────────────
  $("#bulkScheduleBtn").on("click", function () {
    const ids = [...selected];
    const date = $("#bulkDateInput").val();
    if (!ids.length) return;
    if (!date) {
      $("#bulkDateInput").trigger("focus");
      return showStatus("warning", "Pick a date to schedule the selected puzzles.");
    }
    const moving = ids.filter((id) => { const p = byId(id); return p && scheduleState(p) === "today"; });
    if (date !== today && moving.length && !confirmTodayChange(ids, "Moving")) return;
    runBulk("schedule", ids, date, (n) => `Scheduled ${plural(n, "puzzle")} for ${formatDay(date)}.`);
  });

  $("#bulkUnscheduleBtn").on("click", function () {
    const ids = [...selected];
    if (!ids.length) return;
    const scheduled = ids.filter((id) => { const p = byId(id); return p && p.scheduled_date; });
    if (!scheduled.length) return showStatus("secondary", "None of the selected puzzles are scheduled.");
    if (!confirmTodayChange(scheduled, "Unscheduling")) return;
    runBulk("unschedule", scheduled, undefined,
      (n) => `Unscheduled ${plural(n, "puzzle")}. ${n === 1 ? "It is" : "They are"} back in the free play pool.`);
  });

  $("#bulkPrintBtn").on("click", function () {
    const printable = printableFrom(selectedRows());
    if (printable.length) window.openPrintModal(printable);
  });

  $("#bulkDeleteBtn").on("click", function () {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Delete ${plural(ids.length, "puzzle")}? This cannot be undone.`)) return;
    if (!confirmTodayChange(ids, "Deleting")) return;
    runBulk("delete", ids, undefined, (n) => `Deleted ${plural(n, "puzzle")}.`);
  });

  // ── Start ──────────────────────────────────────────────────
  loadPrefs();
  writeFilterInputs();
  renderMoreFilters();
  renderSortHeaders();
  refresh();
});
