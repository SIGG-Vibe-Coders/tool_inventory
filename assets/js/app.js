/* SIGG Tool Inventory — viewer logic */
(function () {
  "use strict";

  const STATUS_LABELS = {
    active: "Active",
    deprecated: "Deprecated",
    "in-development": "In development",
  };

  const state = {
    tools: [],
    search: "",
    activeStatuses: new Set(),
    activeTags: new Set(),
    sort: "name-asc",
  };

  const els = {
    search: document.getElementById("search-input"),
    sort: document.getElementById("sort-select"),
    statusFilters: document.getElementById("status-filters"),
    tagFilters: document.getElementById("tag-filters"),
    results: document.getElementById("results"),
    resultCount: document.getElementById("result-count"),
    clearFilters: document.getElementById("clear-filters"),
    emptyState: document.getElementById("empty-state"),
    errorState: document.getElementById("error-state"),
    modal: document.getElementById("detail-modal"),
    detailContent: document.getElementById("detail-content"),
  };

  // ---------- Utilities ----------
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Only allow safe link protocols to avoid javascript: injection.
  function safeUrl(value) {
    const url = String(value || "").trim();
    if (/^(https?:|mailto:|file:|\\\\|\/)/i.test(url)) {
      return url;
    }
    return "";
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function statusClass(status) {
    return "status-" + String(status || "").replace(/[^a-z-]/gi, "");
  }

  // ---------- Data loading ----------
  async function loadTools() {
    try {
      const res = await fetch("data/tools.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("tools.json is not an array");
      state.tools = data.filter(isUsableTool);
      buildFilters();
      render();
    } catch (err) {
      console.error("Failed to load tools.json:", err);
      els.errorState.hidden = false;
      els.results.hidden = true;
    }
  }

  // Defensive: skip entries missing the minimum fields so one bad row
  // can't break the whole page.
  function isUsableTool(t) {
    return t && typeof t === "object" && t.name && t.id;
  }

  // ---------- Filters ----------
  function buildFilters() {
    const statuses = ["active", "in-development", "deprecated"];
    els.statusFilters.querySelectorAll(".chip").forEach((c) => c.remove());
    statuses.forEach((status) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = STATUS_LABELS[status] || status;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        toggleSet(state.activeStatuses, status);
        btn.setAttribute("aria-pressed", state.activeStatuses.has(status));
        render();
      });
      els.statusFilters.appendChild(btn);
    });

    const tagSet = new Set();
    state.tools.forEach((t) => (t.tags || []).forEach((tag) => tagSet.add(tag)));
    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

    els.tagFilters.querySelectorAll(".chip").forEach((c) => c.remove());
    if (tags.length === 0) {
      els.tagFilters.hidden = true;
    }
    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = tag;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        toggleSet(state.activeTags, tag);
        btn.setAttribute("aria-pressed", state.activeTags.has(tag));
        render();
      });
      els.tagFilters.appendChild(btn);
    });
  }

  function toggleSet(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
  }

  function clearAllFilters() {
    state.search = "";
    els.search.value = "";
    state.activeStatuses.clear();
    state.activeTags.clear();
    document
      .querySelectorAll('.chip[aria-pressed="true"]')
      .forEach((c) => c.setAttribute("aria-pressed", "false"));
    render();
  }

  // ---------- Filtering + sorting ----------
  function getFiltered() {
    const q = state.search.trim().toLowerCase();
    let list = state.tools.filter((t) => {
      if (state.activeStatuses.size && !state.activeStatuses.has(t.status)) {
        return false;
      }
      if (state.activeTags.size) {
        const tags = t.tags || [];
        for (const tag of state.activeTags) {
          if (!tags.includes(tag)) return false;
        }
      }
      if (q) {
        const haystack = [
          t.name,
          t.description,
          t.userGroup,
          t.contact && t.contact.name,
          (t.tags || []).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      switch (state.sort) {
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "updated-desc":
          return (b.lastUpdated || "").localeCompare(a.lastUpdated || "");
        case "updated-asc":
          return (a.lastUpdated || "").localeCompare(b.lastUpdated || "");
        case "name-asc":
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });

    return list;
  }

  // ---------- Rendering ----------
  function render() {
    const list = getFiltered();
    els.results.innerHTML = "";

    list.forEach((tool) => els.results.appendChild(renderCard(tool)));

    const total = state.tools.length;
    els.resultCount.textContent =
      list.length === total
        ? `${total} tool${total === 1 ? "" : "s"}`
        : `${list.length} of ${total} tools`;

    els.emptyState.hidden = list.length !== 0;
    els.results.hidden = list.length === 0;

    const filtersActive =
      state.search || state.activeStatuses.size || state.activeTags.size;
    els.clearFilters.hidden = !filtersActive;
  }

  function renderCard(tool) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.setAttribute("aria-label", `View details for ${tool.name}`);

    const tags = (tool.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    card.innerHTML = `
      <div class="card-head">
        <h2 class="card-title">${escapeHtml(tool.name)}</h2>
        <span class="status-badge ${statusClass(tool.status)}">${escapeHtml(
      STATUS_LABELS[tool.status] || tool.status || ""
    )}</span>
      </div>
      <p class="card-desc">${escapeHtml(tool.description || "")}</p>
      <div class="card-meta">${escapeHtml(
        tool.userGroup ? "For: " + tool.userGroup : ""
      )}</div>
      <div class="card-tags">${tags}</div>
    `;

    card.addEventListener("click", () => openDetail(tool));
    return card;
  }

  // ---------- Detail modal ----------
  function openDetail(tool) {
    const rows = [];
    const pushRow = (label, html) => {
      if (html) rows.push(`<dt>${escapeHtml(label)}</dt><dd>${html}</dd>`);
    };

    const loc = safeUrl(tool.location);
    if (loc && /^https?:/i.test(loc)) {
      pushRow(
        "Location",
        `<a href="${escapeHtml(loc)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          tool.location
        )}</a>`
      );
    } else {
      pushRow(
        "Location",
        `<span class="code-path">${escapeHtml(tool.location || "")}</span>`
      );
    }

    if (tool.contact) {
      const email = safeUrl(tool.contact.email ? "mailto:" + tool.contact.email : "");
      const contactHtml = email
        ? `${escapeHtml(tool.contact.name)} &middot; <a href="${escapeHtml(
            email
          )}">${escapeHtml(tool.contact.email)}</a>`
        : escapeHtml(tool.contact.name || "");
      pushRow("Contact", contactHtml);
    }

    pushRow("User group", escapeHtml(tool.userGroup || ""));
    pushRow("Version", escapeHtml(tool.version || ""));
    pushRow("Last updated", escapeHtml(tool.lastUpdated || ""));

    const howTo = safeUrl(tool.howTo);
    if (howTo) {
      pushRow(
        "How to use",
        `<a href="${escapeHtml(howTo)}" target="_blank" rel="noopener noreferrer">Instructions</a>`
      );
    }

    let linksHtml = "";
    const links = (tool.links || []).filter((l) => l && l.url && safeUrl(l.url));
    if (links.length) {
      const items = links
        .map(
          (l) =>
            `<li><a href="${escapeHtml(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(
              l.label || l.url
            )}</a></li>`
        )
        .join("");
      linksHtml = `<div class="detail-links"><h3>Links</h3><ul>${items}</ul></div>`;
    }

    els.detailContent.innerHTML = `
      <div class="detail-header">
        <h2 id="detail-title">${escapeHtml(tool.name)}</h2>
        <span class="status-badge ${statusClass(tool.status)}">${escapeHtml(
      STATUS_LABELS[tool.status] || tool.status || ""
    )}</span>
      </div>
      <p class="detail-desc">${escapeHtml(tool.description || "")}</p>
      <dl class="detail-grid">${rows.join("")}</dl>
      ${linksHtml}
    `;

    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    const closeBtn = els.modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeDetail() {
    els.modal.hidden = true;
    document.body.style.overflow = "";
  }

  // ---------- Events ----------
  els.search.addEventListener(
    "input",
    debounce((e) => {
      state.search = e.target.value;
      render();
    }, 180)
  );

  els.sort.addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });

  els.clearFilters.addEventListener("click", clearAllFilters);

  els.modal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeDetail();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.hidden) closeDetail();
  });

  // ---------- Init ----------
  loadTools();
})();
