/* SIGG Tool Inventory — editor logic */
(function () {
  "use strict";

  // GitHub repo this editor commits to. Update if the repo moves.
  const CONFIG = {
    owner: "SIGG-Vibe-Coders",
    repo: "tool_inventory",
    branch: "main",
    path: "data/tools.json",
  };

  const TOKEN_KEY = "sigg-ti-gh-token";

  const STATUS_LABELS = {
    active: "Active",
    deprecated: "Deprecated",
    "in-development": "In development",
  };

  const state = {
    tools: [],
    editingId: null, // id of tool being edited, or null when adding
    dirty: false,
    saving: false,
  };

  const els = {
    rows: document.getElementById("tool-rows"),
    addTool: document.getElementById("add-tool"),
    reload: document.getElementById("reload"),
    download: document.getElementById("download"),
    saveGithub: document.getElementById("save-github"),
    dirtyFlag: document.getElementById("dirty-flag"),
    loadError: document.getElementById("load-error"),
    modal: document.getElementById("form-modal"),
    form: document.getElementById("tool-form"),
    formTitle: document.getElementById("form-title"),
    formBanner: document.getElementById("form-banner"),
    linksRows: document.getElementById("links-rows"),
    addLink: document.getElementById("add-link"),
    // GitHub connection
    ghStatus: document.getElementById("gh-status"),
    ghStatusText: document.getElementById("gh-status-text"),
    ghConnect: document.getElementById("gh-connect"),
    ghDisconnect: document.getElementById("gh-disconnect"),
    connectModal: document.getElementById("connect-modal"),
    connectBanner: document.getElementById("connect-banner"),
    tokenInput: document.getElementById("gh-token"),
    saveToken: document.getElementById("gh-save-token"),
    introConnected: document.getElementById("intro-connected"),
    introDisconnected: document.getElementById("intro-disconnected"),
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

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function setDirty(value) {
    state.dirty = value;
    els.dirtyFlag.hidden = !value;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  // ---------- Data loading ----------
  async function loadTools() {
    try {
      const res = await fetch("data/tools.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("not an array");
      state.tools = data;
      els.loadError.hidden = true;
      setDirty(false);
      renderTable();
    } catch (err) {
      console.error("Failed to load tools.json:", err);
      state.tools = [];
      els.loadError.hidden = false;
      renderTable();
    }
  }

  // ---------- Table ----------
  function renderTable() {
    els.rows.innerHTML = "";
    if (state.tools.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" style="text-align:center;color:var(--text-muted);">No tools yet. Click “Add tool”.</td>`;
      els.rows.appendChild(tr);
      return;
    }

    const sorted = state.tools
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    sorted.forEach((tool) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(tool.name || "")}</td>
        <td><span class="status-badge status-${escapeHtml(
          (tool.status || "").replace(/[^a-z-]/gi, "")
        )}">${escapeHtml(STATUS_LABELS[tool.status] || tool.status || "")}</span></td>
        <td>${escapeHtml(tool.userGroup || "")}</td>
        <td>${escapeHtml(tool.lastUpdated || "")}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="icon-btn" data-edit="${escapeHtml(
              tool.id
            )}">Edit</button>
            <button type="button" class="icon-btn danger" data-delete="${escapeHtml(
              tool.id
            )}">Delete</button>
          </div>
        </td>
      `;
      els.rows.appendChild(tr);
    });
  }

  els.rows.addEventListener("click", (e) => {
    const editId = e.target.getAttribute("data-edit");
    const delId = e.target.getAttribute("data-delete");
    if (editId) openForm(editId);
    if (delId) deleteTool(delId);
  });

  function deleteTool(id) {
    const tool = state.tools.find((t) => t.id === id);
    if (!tool) return;
    if (!confirm(`Delete "${tool.name}"? This cannot be undone until you reload.`)) {
      return;
    }
    state.tools = state.tools.filter((t) => t.id !== id);
    setDirty(true);
    renderTable();
  }

  // ---------- Links sub-editor ----------
  function addLinkRow(label, url) {
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML = `
      <input type="text" class="link-label" placeholder="Label (e.g. Demo video)" />
      <input type="text" class="link-url" placeholder="https://…" />
      <button type="button" class="icon-btn danger" data-remove-link>&times;</button>
    `;
    row.querySelector(".link-label").value = label || "";
    row.querySelector(".link-url").value = url || "";
    row.querySelector("[data-remove-link]").addEventListener("click", () => row.remove());
    els.linksRows.appendChild(row);
  }

  els.addLink.addEventListener("click", () => addLinkRow("", ""));

  function collectLinks() {
    const links = [];
    els.linksRows.querySelectorAll(".link-row").forEach((row) => {
      const label = row.querySelector(".link-label").value.trim();
      const url = row.querySelector(".link-url").value.trim();
      if (label || url) links.push({ label, url });
    });
    return links;
  }

  // ---------- Form ----------
  function openForm(id) {
    state.editingId = id || null;
    clearErrors();
    els.formBanner.hidden = true;
    els.form.reset();
    els.linksRows.innerHTML = "";

    if (id) {
      const tool = state.tools.find((t) => t.id === id);
      if (!tool) return;
      els.formTitle.textContent = "Edit tool";
      els.form.name.value = tool.name || "";
      els.form.id.value = tool.id || "";
      els.form.description.value = tool.description || "";
      els.form.location.value = tool.location || "";
      els.form.contactName.value = (tool.contact && tool.contact.name) || "";
      els.form.contactEmail.value = (tool.contact && tool.contact.email) || "";
      els.form.userGroup.value = tool.userGroup || "";
      els.form.status.value = tool.status || "active";
      els.form.version.value = tool.version || "";
      els.form.lastUpdated.value = tool.lastUpdated || "";
      els.form.howTo.value = tool.howTo || "";
      els.form.tags.value = (tool.tags || []).join(", ");
      (tool.links || []).forEach((l) => addLinkRow(l.label, l.url));
    } else {
      els.formTitle.textContent = "Add tool";
      els.form.status.value = "active";
      els.form.lastUpdated.value = todayIso();
    }

    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    els.form.name.focus();
  }

  function closeForm() {
    els.modal.hidden = true;
    document.body.style.overflow = "";
    state.editingId = null;
  }

  function clearErrors() {
    els.form
      .querySelectorAll(".field-error")
      .forEach((el) => (el.textContent = ""));
  }

  function setError(field, message) {
    const el = els.form.querySelector(`[data-error-for="${field}"]`);
    if (el) el.textContent = message;
  }

  function isValidUrlOrPath(value) {
    return /^(https?:\/\/|mailto:|file:|\\\\|\/)/i.test(value.trim());
  }

  function validate(data, idInUse) {
    clearErrors();
    let ok = true;
    const fail = (field, msg) => {
      setError(field, msg);
      ok = false;
    };

    if (!data.name) fail("name", "Name is required.");
    if (!data.id) fail("id", "ID is required.");
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id))
      fail("id", "Use lowercase letters, numbers and hyphens only.");
    else if (idInUse) fail("id", "This ID is already used by another tool.");

    if (!data.description) fail("description", "Description is required.");
    if (!data.location) fail("location", "Location is required.");
    else if (!isValidUrlOrPath(data.location))
      fail("location", "Enter a URL (https://…) or a network path (\\\\… or /…).");

    if (!data.contact.name) fail("contactName", "Contact name is required.");
    if (
      data.contact.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact.email)
    )
      fail("contactEmail", "Enter a valid email address.");

    if (!data.userGroup) fail("userGroup", "User group is required.");
    if (!data.lastUpdated) fail("lastUpdated", "Last updated date is required.");

    if (data.howTo && !isValidUrlOrPath(data.howTo))
      fail("howTo", "Enter a valid URL.");

    return ok;
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = els.form.name.value.trim();
    let id = els.form.id.value.trim();
    if (!id) id = slugify(name);

    const tags = els.form.tags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const contact = { name: els.form.contactName.value.trim() };
    const email = els.form.contactEmail.value.trim();
    if (email) contact.email = email;

    const data = {
      id,
      name,
      description: els.form.description.value.trim(),
      location: els.form.location.value.trim(),
      contact,
      userGroup: els.form.userGroup.value.trim(),
      status: els.form.status.value,
      lastUpdated: els.form.lastUpdated.value.trim(),
    };

    const version = els.form.version.value.trim();
    if (version) data.version = version;
    const howTo = els.form.howTo.value.trim();
    if (howTo) data.howTo = howTo;
    if (tags.length) data.tags = tags;
    const links = collectLinks();
    if (links.length) data.links = links;

    const idInUse = state.tools.some(
      (t) => t.id === id && t.id !== state.editingId
    );

    if (!validate(data, idInUse)) {
      els.formBanner.hidden = false;
      els.formBanner.textContent = "Please fix the highlighted fields.";
      return;
    }

    if (state.editingId) {
      const idx = state.tools.findIndex((t) => t.id === state.editingId);
      if (idx !== -1) state.tools[idx] = data;
    } else {
      state.tools.push(data);
    }

    setDirty(true);
    renderTable();
    closeForm();
    showToast("Tool saved to working copy. Remember to download.");
  });

  // Auto-fill slug suggestion from name when ID is empty (add mode only).
  els.form.name.addEventListener("input", () => {
    if (!state.editingId && !els.form.id.value.trim()) {
      els.form.id.placeholder = slugify(els.form.name.value) || "auto from name";
    }
  });

  // ---------- Serialize ----------
  function serialize() {
    return JSON.stringify(state.tools, null, 2) + "\n";
  }

  // ---------- Download ----------
  function download() {
    const blob = new Blob([serialize()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tools.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Downloaded tools.json — upload it to GitHub to publish.");
  }

  // ---------- GitHub: token storage ----------
  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      /* ignore */
    }
  }

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function isConnected() {
    return !!getToken();
  }

  // ---------- GitHub: API helpers ----------
  function apiUrl(suffix) {
    return `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/${suffix}`;
  }

  function ghHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  // UTF-8 safe base64 for the GitHub Contents API.
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  // ---------- GitHub: UI state ----------
  function updateGhUi() {
    const connected = isConnected();
    els.ghStatus.classList.toggle("connected", connected);
    els.ghStatusText.textContent = connected
      ? `Connected to ${CONFIG.repo}`
      : "Not connected";
    els.ghConnect.hidden = connected;
    els.ghDisconnect.hidden = !connected;
    els.introConnected.hidden = !connected;
    els.introDisconnected.hidden = connected;
    els.saveGithub.disabled = state.saving;
    els.saveGithub.textContent = state.saving ? "Saving…" : "Save to GitHub";
  }

  // ---------- GitHub: connect ----------
  function openConnectModal() {
    els.connectBanner.hidden = true;
    els.tokenInput.value = "";
    els.connectModal.hidden = false;
    document.body.style.overflow = "hidden";
    els.tokenInput.focus();
  }

  function closeConnectModal() {
    els.connectModal.hidden = true;
    document.body.style.overflow = "";
  }

  function connectError(message) {
    els.connectBanner.hidden = false;
    els.connectBanner.textContent = message;
  }

  async function connect() {
    const token = els.tokenInput.value.trim();
    if (!token) {
      connectError("Paste your token first.");
      return;
    }
    els.saveToken.disabled = true;
    els.saveToken.textContent = "Checking…";
    try {
      // Verify the token can read the data file in this repo.
      const res = await fetch(
        apiUrl(`contents/${CONFIG.path}?ref=${CONFIG.branch}`),
        { headers: ghHeaders(token) }
      );
      if (res.status === 401) {
        throw new Error("Token rejected (401). Check it was copied correctly.");
      }
      if (res.status === 404) {
        throw new Error(
          "Can't see this repository/file with that token. Check the repository access and Contents permission."
        );
      }
      if (!res.ok) {
        throw new Error("GitHub error (HTTP " + res.status + ").");
      }
      setToken(token);
      closeConnectModal();
      updateGhUi();
      showToast("Connected to GitHub.");
    } catch (err) {
      connectError(err.message);
    } finally {
      els.saveToken.disabled = false;
      els.saveToken.textContent = "Connect";
    }
  }

  function disconnect() {
    clearToken();
    updateGhUi();
    showToast("Disconnected from GitHub.");
  }

  // ---------- GitHub: save ----------
  async function saveToGitHub() {
    if (!isConnected()) {
      openConnectModal();
      return;
    }
    if (state.saving) return;
    const token = getToken();
    state.saving = true;
    updateGhUi();
    try {
      // Get the current file SHA (required to update an existing file).
      const metaRes = await fetch(
        apiUrl(`contents/${CONFIG.path}?ref=${CONFIG.branch}`),
        { headers: ghHeaders(token) }
      );
      if (metaRes.status === 401) {
        throw new Error("Token rejected. Reconnect with a valid token.");
      }
      if (!metaRes.ok) {
        throw new Error("Could not read the current file (HTTP " + metaRes.status + ").");
      }
      const meta = await metaRes.json();

      const body = {
        message: "Update tool inventory via editor",
        content: utf8ToBase64(serialize()),
        sha: meta.sha,
        branch: CONFIG.branch,
      };

      const putRes = await fetch(apiUrl(`contents/${CONFIG.path}`), {
        method: "PUT",
        headers: ghHeaders(token),
        body: JSON.stringify(body),
      });

      if (putRes.status === 409) {
        throw new Error(
          "The file changed on GitHub since you loaded it. Click “Reload from file”, redo your changes, then save again."
        );
      }
      if (putRes.status === 403) {
        throw new Error(
          "Permission denied. Your token needs Contents: Read and write on this repository."
        );
      }
      if (!putRes.ok) {
        const e = await putRes.json().catch(() => ({}));
        throw new Error(e.message || "Save failed (HTTP " + putRes.status + ").");
      }

      setDirty(false);
      showToast("Saved to GitHub. The live site updates in about a minute.");
    } catch (err) {
      console.error("Save to GitHub failed:", err);
      showToast("Save failed: " + err.message);
    } finally {
      state.saving = false;
      updateGhUi();
    }
  }

  // ---------- Events ----------
  els.addTool.addEventListener("click", () => openForm(null));
  els.download.addEventListener("click", download);
  els.saveGithub.addEventListener("click", saveToGitHub);

  els.ghConnect.addEventListener("click", openConnectModal);
  els.ghDisconnect.addEventListener("click", disconnect);
  els.saveToken.addEventListener("click", connect);
  els.tokenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") connect();
  });
  els.connectModal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close-connect")) closeConnectModal();
  });

  els.reload.addEventListener("click", () => {
    if (
      state.dirty &&
      !confirm("Reload from file and discard unsaved changes?")
    ) {
      return;
    }
    loadTools();
  });

  els.modal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeForm();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!els.connectModal.hidden) closeConnectModal();
    else if (!els.modal.hidden) closeForm();
  });

  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ---------- Init ----------
  updateGhUi();
  loadTools();
})();
