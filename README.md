# GitHub Pages CMS — Project Plan & README

A lightweight, local-first content management interface for any **GitHub Pages** site. Runs on your machine, stores data in a single SQLite file, and commits content directly to your GitHub repo via the GitHub API.

No cloud database. No deployment. No OAuth App setup. One command to start.

```bash
npm install -g github-pages-cms
cms start          # opens http://localhost:3000 in your browser
```

---

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Zero cloud dependencies** | SQLite replaces MongoDB; no Atlas, no Postgres |
| **No App registration** | GitHub PAT replaces OAuth — paste a token, done |
| **Works with any GitHub Pages** | Section config is fully user-defined, not hardcoded |
| **AI is optional + local-first** | Ollama/LM Studio run free on your PC; cloud APIs as fallback |
| **Non-destructive** | Never deletes/overwrites without SHA validation; draft dirs always available |

---

## User Flows

### First Launch
1. Browser opens at `http://localhost:3000/setup`
2. **Step 1 — GitHub Token**: Paste a PAT with `repo` + `read:user` scopes ([create one here](https://github.com/settings/tokens/new))
3. **Step 2 — Select Repo**: Pick which GitHub Pages repo to manage
4. **Step 3 — Configure Sections**: CMS auto-detects SSG (Jekyll/Hugo/Eleventy) and proposes sections from your actual directory structure. User can rename, reorder, and set pipeline options per section.
5. **Step 4 — AI Provider** *(optional, skippable)*: Configure Ollama, OpenAI, Anthropic, or any compatible endpoint

### Dashboard
- Sidebar shows each configured section (e.g., Engineering, Journal, Jupyter)
- Header: username/avatar, dark mode toggle, settings

### Content List (per section)
- Table: **Date** | **Title** | **Path** | **Last Updated**
- Toggle tabs: **Published** | **Drafts**
- Search by title/slug; paginate at >50 files
- Files parsed from filename convention `YYYY-MM-DD-slug.md`

### Editor
- Dynamic frontmatter form (fields driven by section config — not hardcoded)
- Markdown body editor
- **Enhance with AI** button (optional) — sends to configured AI provider, shows result inline
- Actions: **Cancel** · **Save as Draft** · **Publish**

---

## Content Model

### Directory Convention

The CMS does not impose any directory structure. You configure it to match your repo. For the reference blog (`techtana.github.io`):

| Section | Published Dir | Draft Dir | Notes |
|---------|--------------|-----------|-------|
| Engineering | `_posts/engineering/` | `_posts_drafts/` | AI-enhanced on publish |
| Career | `_posts/career/` | `_posts_drafts/` | AI-enhanced on publish |
| Journal | `_posts/journal/` | `_posts_drafts/` | Direct publish |
| Jupyter | `_posts/jupyter/` | `_notebook_draft/` | `.ipynb` → `.md` inline |

For a generic Jekyll repo, defaults are auto-proposed from `_posts/` subdirectories. For Hugo, from `content/` subdirectories. For Eleventy, from configurable `input` directories.

### Filename Convention
```
YYYY-MM-DD-slug.md
# e.g. 2025-09-07-fall-colors.md
```
Template/placeholder files (e.g., `__blank__`, `[TEMPLATE]`) are filtered out automatically.

### Frontmatter (YAML)
Fields are **configured per section**, not hardcoded. Example for a Jekyll YAT theme post:
```yaml
---
layout: post
title: "Fall Colors"
subtitle: "Chasing autumn in the hills"
author: Tech Tana
categories: journal
tags: [nature, travel]
banner:
  image: /assets/images/fall-colors.jpg
  opacity: 0.618
---
```
The editor form renders exactly these fields based on the section's `frontmatterFields` config. Adding or removing a field in the section config immediately changes the form — no code changes needed.

---

## Architecture

```
Your Machine
├── CMS (Express 5 + React SPA, localhost:3000)
│   └── ~/.github-pages-cms/data.db   ← SQLite, all local
│
├── AI Provider (your choice)
│   ├── Ollama           localhost:11434  (free, runs locally)
│   ├── LM Studio        localhost:1234   (free, runs locally)
│   ├── OpenAI           api.openai.com   (your API key)
│   ├── Anthropic        api.anthropic.com (your API key)
│   └── OpenRouter / Custom endpoint
│
└── GitHub API (your PAT → Octokit)
    └── Your GitHub Pages repo
```

### Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Express 5 + Node.js 20 | Already scaffolded |
| Frontend | Vite + React + TypeScript | Replaces Handlebars |
| Database | SQLite (`better-sqlite3`) | Single file, no server |
| GitHub API | `@octokit/rest` | PAT-authenticated |
| Frontmatter | `gray-matter` + `js-yaml` | Parse/serialize YAML |
| AI | Custom multi-provider client | OpenAI-compat + Anthropic adapter |
| Auth | GitHub PAT (stored encrypted) | No Passport, no OAuth App |
| Validation | `express-validator` | All POST/PUT routes |
| Rate limiting | `express-rate-limit` | `/api/*` routes |

### Packages to Remove
`mongoose` · `connect-mongo` · `passport` · `passport-github2` · `passport-google-oauth20` · `express-handlebars` · `moment` · `method-override`

### Packages to Add
`better-sqlite3` · `@octokit/rest` · `gray-matter` · `js-yaml` · `express-validator` · `express-rate-limit` · `open`
_(Client)_ `vite` · `react` · `react-dom` · `react-router-dom` · `typescript`

---

## Data Model (SQLite)

```sql
-- GitHub token + app preferences
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL  -- encrypted values prefixed 'enc:'
);
-- Keys: github_token, github_username, github_avatar, dark_mode

-- One row per managed GitHub Pages repo
CREATE TABLE sites (
  id             TEXT PRIMARY KEY,
  repo_owner     TEXT NOT NULL,
  repo_name      TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  ssg_type       TEXT NOT NULL DEFAULT 'unknown',
  sections_json  TEXT NOT NULL,  -- JSON array (schema below)
  created_at     TEXT DEFAULT (datetime('now'))
);

-- Configured AI providers (multiple, one marked default)
CREATE TABLE ai_providers (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  provider_type TEXT NOT NULL,  -- ollama|lmstudio|openai|anthropic|openrouter|custom
  base_url      TEXT NOT NULL,
  api_key       TEXT,           -- NULL for local; encrypted for cloud
  default_model TEXT,
  is_default    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Commit history
CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL,
  action     TEXT NOT NULL,  -- publish|save_draft|delete|ai_enhance
  file_path  TEXT,
  commit_sha TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### `sections_json` Schema
```json
[
  {
    "name": "Engineering",
    "slug": "engineering",
    "publishedDir": "_posts/engineering",
    "draftDir": "_posts_drafts",
    "fileType": "md",
    "aiEnabled": true,
    "aiPolicyDir": "_enhance_policy",
    "frontmatterFields": [
      { "key": "layout",          "label": "Layout",     "type": "text",   "default": "post" },
      { "key": "title",           "label": "Title",      "type": "text",   "required": true },
      { "key": "subtitle",        "label": "Subtitle",   "type": "text" },
      { "key": "categories",      "label": "Category",   "type": "text",   "default": "engineering" },
      { "key": "tags",            "label": "Tags",       "type": "array" },
      { "key": "enhance_policy",  "label": "AI Policy",  "type": "select", "optionsSource": "enhance_policies" }
    ]
  },
  {
    "name": "Jupyter",
    "slug": "jupyter",
    "publishedDir": "_posts/jupyter",
    "draftDir": "_notebook_draft",
    "fileType": "ipynb",
    "aiEnabled": false,
    "frontmatterFields": [
      { "key": "layout",      "label": "Layout",     "type": "text",  "default": "post" },
      { "key": "title",       "label": "Title",      "type": "text",  "required": true },
      { "key": "subtitle",    "label": "Subtitle",   "type": "text" },
      { "key": "categories",  "label": "Categories", "type": "array" }
    ]
  }
]
```

---

## AI Provider System

### Supported Providers

| Provider | Type | Base URL Default | Auth |
|----------|------|-----------------|------|
| Ollama | Local | `http://localhost:11434/v1` | None |
| LM Studio | Local | `http://localhost:1234/v1` | None |
| OpenAI | Cloud | `https://api.openai.com/v1` | API key |
| Anthropic | Cloud | `https://api.anthropic.com` | API key |
| OpenRouter | Cloud | `https://openrouter.ai/api/v1` | API key |
| Custom | Any | User-defined | Optional |

All providers except Anthropic use the **OpenAI-compatible REST format** (`POST /v1/chat/completions`). Anthropic uses a 30-line request/response adapter.

### Model Discovery
- **Ollama**: `GET /api/tags` → list installed models
- **LM Studio**: `GET /v1/models` → list loaded models
- **OpenAI / OpenRouter**: `GET /v1/models` → list available models
- **Anthropic**: Static list (no list endpoint)

### AI Enhancement Flow
1. User writes/edits content in the editor
2. Clicks **"Enhance"** → calls `POST /api/ai/enhance` with `{ content, policy }`
3. Server calls configured provider → streams response
4. Enhanced content displayed inline (optionally as diff against original)
5. User accepts / rejects / edits → then clicks Publish
6. Post committed directly to `section.publishedDir` — no staging directory needed

### Enhance Policy Format
Stored as `.prompt` files in the repo's configured `aiPolicyDir` (e.g., `_enhance_policy/`). The CMS reads these dynamically from GitHub and populates the "AI Policy" dropdown in the editor.

---

## Notebook Conversion

The CMS converts `.ipynb` → `.md` inline (no GitHub Action required):
1. User uploads `.ipynb` file in the Jupyter section editor
2. CMS parses the notebook:
   - First `raw` cell → YAML frontmatter
   - `markdown` cells → included as-is
   - `code` cells → wrapped in ` ```python ``` ` fences
   - Text outputs → appended after their code cell
3. Converted markdown shown for review/editing
4. User clicks Publish → `.md` committed to `_posts/jupyter/`

---

## API Routes

```
Setup
  GET    /api/setup/status
  POST   /api/setup/validate-token   { token } → { username, avatar }
  POST   /api/setup/complete         { token, site }

User
  GET    /api/me
  PATCH  /api/me                     { darkMode }

Repos
  GET    /api/repos                  list user's GitHub repos
  GET    /api/repos/detect           ?owner=X&repo=Y → SSG + proposed sections
  GET    /api/repos/enhance-policies ?owner=X&repo=Y → list _enhance_policy/*.prompt

Sites
  GET    /api/sites
  POST   /api/sites
  GET    /api/sites/:id
  PUT    /api/sites/:id
  DELETE /api/sites/:id

Content  (all paths resolved from sections_json — never hardcoded)
  GET    /api/sites/:siteId/content/:sectionSlug   ?status=draft|published|all
  GET    /api/sites/:siteId/content/:sectionSlug/:encodedPath
  POST   /api/sites/:siteId/content/:sectionSlug
  PUT    /api/sites/:siteId/content/:sectionSlug/:encodedPath
  POST   /api/sites/:siteId/content/:sectionSlug/:encodedPath/publish
  DELETE /api/sites/:siteId/content/:sectionSlug/:encodedPath

AI
  GET    /api/ai/providers
  POST   /api/ai/providers
  PUT    /api/ai/providers/:id
  DELETE /api/ai/providers/:id
  GET    /api/ai/providers/:id/models
  POST   /api/ai/providers/:id/test   → { ok, latencyMs }
  POST   /api/ai/enhance              { content, policy } → { enhanced, model }

Notebook
  POST   /api/notebook/convert        multipart .ipynb → { markdown, frontmatter }
```

### Commit Message Format
```
content(engineering): publish 2025-09-07 fall-colors
content(journal): save draft 2025-09-07 morning-notes
content(jupyter): publish notebook 2025-01-01 r2r-control-basics
```

---

## SSG Auto-Detection

Scans repo root for marker files:

| SSG | Required File | Confirming |
|-----|-------------|-----------|
| Jekyll | `_config.yml` | `Gemfile` or `*.gemspec` |
| Hugo | `hugo.toml` / `hugo.yaml` / `config.toml` | `content/` dir |
| Eleventy | `.eleventy.js` / `eleventy.config.js` | — |
| Unknown | — | fallback |

After detection, proposed sections are built by listing subdirectories of the main content dir. If `_notebook_draft/` exists → Jupyter section proposed with `fileType: ipynb`.

---

## Project Structure

```
content_management_platform/
├── app.js                     # Express server, middleware, route mounting
├── package.json
├── config/
│   ├── db.js                  # SQLite init, schema migrations
│   └── schema.sql             # DDL for all tables
├── middleware/
│   ├── auth.js                # (existing, keep)
│   ├── ensureSetup.js         # redirect to /setup if no PAT configured
│   └── ensureApiAuth.js       # 401 JSON for unauthenticated /api/* calls
├── services/
│   ├── github.js              # Octokit factory + file helpers
│   ├── ssgDetector.js         # Jekyll/Hugo/Eleventy detection
│   ├── frontmatterParser.js   # gray-matter + parseDatedFilename
│   ├── ai.js                  # Multi-provider AI client
│   ├── notebook.js            # .ipynb → markdown conversion
│   └── crypto.js              # AES-256-GCM encrypt/decrypt
├── routes/
│   └── api/
│       ├── setup.js
│       ├── me.js
│       ├── repos.js
│       ├── sites.js
│       ├── content.js
│       ├── ai.js
│       └── notebook.js
├── client/                    # Vite + React SPA source
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js             # fetch wrapper for /api/*
│       ├── pages/
│       │   ├── Setup.jsx      # 4-step wizard
│       │   ├── Dashboard.jsx
│       │   ├── ContentList.jsx
│       │   ├── Editor.jsx
│       │   └── AISettings.jsx
│       └── components/
│           ├── FrontmatterForm.jsx
│           ├── MarkdownEditor.jsx
│           └── EnhanceDiff.jsx
└── public/                    # Vite build output (served as static)
```

---

## Milestones

### M1 — Replace Data Layer
Remove MongoDB/Passport/Handlebars. Add SQLite. `GET /api/setup/status` works.

### M2 — PAT Auth + Setup Wizard
PAT validation → repo picker → SSG detect → section config → AI provider (skippable) → Site saved. Auto-open browser on first start.

### M3 — Content List
GitHub file listing per section. `YYYY-MM-DD-` pattern filter. Published/Drafts tabs.

### M4 — Editor + Publish
Dynamic frontmatter form. Markdown editor. Save Draft → draft dir. Publish → published dir. SHA conflict detection (409). AuditLog.

### M5 — AI Integration
Multi-provider client. Model discovery. Test connection. Enhance button in editor. Anthropic adapter.

### M6 — Packaging
`cms start` CLI command. Vite build pipeline. Docker image. README with all 3 install paths.

---

## Environment Variables (Optional)

The setup wizard handles all configuration through the UI. Env vars are only for CI or advanced users:

```bash
CMS_PORT=3000                      # default 3000
CMS_DATA_DIR=~/.github-pages-cms   # SQLite location
CMS_BIND=127.0.0.1                 # change to 0.0.0.0 for LAN/remote access
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| PAT revoked mid-session | Catch 401 from Octokit → prompt to update token in settings |
| File SHA conflict | Return 409; editor shows "File changed remotely — reload?" |
| `__blank__` / template files in listing | Filter: only list files matching `/^\d{4}-\d{2}-\d{2}-/` |
| Ollama not running | Test on provider add; show "Start Ollama first" tip in UI |
| Large repos (>1000 files in a dir) | Use Git Trees API `?recursive=1` + client-side prefix filter |
| Port 3000 already in use | `cms start --port 3001`; auto-increment fallback |

---

## Definition of Done (MVP)

A user with Node.js installed can:
1. Run `npx github-pages-cms` and reach the setup wizard
2. Paste a GitHub PAT, pick their GitHub Pages repo
3. See their existing posts organized by section
4. Create a new post, save it as a draft, and publish it to the correct section directory — all committed to GitHub without touching git or the GitHub web UI

Optional but usable in MVP: configure an AI provider (Ollama or OpenAI) and use the Enhance button before publishing.

---

## Nice-to-Have (Post-MVP)

- "Move to Draft" (unpublish) a post
- Post scheduling — set a future date, CMS commits on that date
- PR workflow mode — open a PR instead of committing directly
- Image upload: drag image into editor → commit to `assets/` → Markdown link inserted
- Tag browser and analytics (post count per tag, publish frequency)
- Multiple GitHub accounts
- `cms export` — download all content as a zip
