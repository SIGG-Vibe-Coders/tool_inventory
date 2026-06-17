# SIGG Tool Inventory

A simple, bookmarkable catalogue of the scripts and tools used at SIGG — what they
do, where they live, how to use them, who owns them, and who the user group is.

The site is **static** and runs on **GitHub Pages**. There is no database and no
server to maintain. All data lives in one file in this repo: [`data/tools.json`](data/tools.json).

- **Anyone** can view the inventory.
- **Repo collaborators** can add, edit, or remove tools.
- Every change is a normal Git commit, so the full history is reviewable and reversible.

---

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | The inventory people browse and search. |
| `editor.html` | A form for collaborators to add/edit/remove tools and download an updated `data/tools.json`. |

---

## Adding or editing a tool

You do **not** edit the JSON by hand. Use the editor page:

1. Open **`editor.html`** (the **Add / edit tools** button on the inventory).
2. Click **Add tool**, or **Edit**/**Delete** an existing row.
3. Fill in the form and **Save tool**. Repeat for as many changes as you like.
4. Click **Download tools.json**. Your browser saves the updated file.
5. In GitHub, open [`data/tools.json`](data/tools.json) → **⋯ / Upload files** (or the
   pencil → replace contents) → drop in the file you just downloaded → **Commit changes**.

That commit publishes automatically (GitHub Pages rebuilds in a minute or two).

> Tip: the editor only changes a working copy in your browser. Nothing is saved
> until you download the file and commit it to GitHub.

### Editing the JSON directly (optional)

You can still edit [`data/tools.json`](data/tools.json) by hand if you prefer. Keep it
valid JSON (no trailing commas) and matching [`data/schema.json`](data/schema.json).
The validation workflow (below) will flag mistakes on a pull request.

---

## Tool fields

Each entry in `data/tools.json` looks like this:

```json
{
  "id": "riparian-buffer-tool",
  "name": "Riparian Buffer Tool",
  "description": "What the tool does.",
  "location": "\\\\sigg-gis\\Tools\\RiparianBuffer\\RiparianBuffer.pyt",
  "howTo": "https://example.com/docs/howto",
  "contact": { "name": "Jane Smith", "email": "jane.smith@example.gov.bc.ca" },
  "userGroup": "Planning foresters",
  "version": "2.1",
  "lastUpdated": "2026-05-12",
  "status": "active",
  "tags": ["riparian", "buffer"],
  "links": [
    { "label": "Demo video", "url": "https://example.com/videos/demo" }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Unique slug: lowercase, hyphens (e.g. `block-area-report`). |
| `name` | yes | Display name. |
| `description` | yes | What it does. |
| `location` | yes | Network path or URL. |
| `contact` | yes | `{ "name": ..., "email": ... }` (email optional). |
| `userGroup` | yes | Intended audience. |
| `status` | yes | `active`, `in-development`, or `deprecated`. |
| `lastUpdated` | yes | `YYYY-MM-DD`. |
| `howTo` | no | Link to instructions. |
| `version` | no | Version label. |
| `tags` | no | Keywords for search/filter. |
| `links` | no | List of `{ "label", "url" }` for videos, docs, etc. |

---

## Running it locally

Because the pages fetch `data/tools.json`, open them through a local web server
(not by double-clicking the HTML file):

```powershell
# from the repo root
python -m http.server 8000
```

Then visit <http://localhost:8000/>.

---

## Enabling GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose your branch (e.g. `main`) and folder **`/ (root)`**, then **Save**.
5. After a minute, the site is live at `https://<org-or-user>.github.io/<repo>/`.
   Bookmark that URL.

The `.nojekyll` file tells Pages to serve the files as-is.

---

## Validation

[`.github/workflows/validate.yml`](.github/workflows/validate.yml) checks that
`data/tools.json` is valid JSON and matches [`data/schema.json`](data/schema.json)
on every push and pull request, so a malformed edit can't silently break the live page.
