# GitHub Pages CMS

A lightweight, local-first content management interface for **GitHub Pages** sites. Runs on your machine, commits directly to your GitHub repo via the API, and stores all config in a single SQLite file.

No cloud database. No OAuth App setup. One command to start.

---

## Requirements

- **Node.js 22+** and **pnpm**
- A GitHub account with a Personal Access Token (see [GitHub Token](#github-token))

---

## Quick Start

```bash
pnpm install
pnpm build          # build the React client
pnpm start          # http://127.0.0.1:3000
```

For development (hot-reload on both server and client):

```bash
pnpm dev
```

The browser opens at `http://127.0.0.1:3000`. On first launch you are taken to the setup wizard.

---

## GitHub Token

Create a **Personal Access Token** at `github.com → Settings → Developer settings → Personal access tokens`.

### Classic token (simpler)
Tick these scopes:
- `repo` — read/write access to repos (required to commit files)
- `read:user` — read your username and avatar

### Fine-grained token (more locked-down)
Set under **Repository permissions**:
- `Contents` — **Read and write** (required to commit files)
- `Metadata` — Read-only (required by GitHub for all fine-grained tokens)
- `Pages` — Read and write (only if you use "Create new repo" from Settings)

Set under **Account permissions**:
- `Profile information` — Read-only (required to validate the token)

> The token is encrypted with AES-256-GCM before being stored locally. It is never sent anywhere except the GitHub API.

---

## Setup Wizard

Four steps, runs on first launch or from **Settings → Re-run Setup Wizard**:

1. **GitHub Token** — paste your PAT; an inline guide explains required scopes
2. **Repo & Type** — pick a GitHub Pages repo and choose Blog / Wiki / Mixed
3. **Set Up Repo** — creates `_posts/`, `_drafts/`, `_archive/` (and `_pages/` for wiki), optionally creates a landing page and a Git snapshot tag
4. **AI Provider** — configure an AI provider (skippable; can be done later from Settings)

---

## Features

### Content Management
- **Blog posts** — draft → publish → archive workflow; each action is a real Git commit
- **Wiki pages** — markdown pages in `_pages/`
- **Mixed sites** — blog + wiki side by side
- **Tags & categories** — entered inline with a chip input; stored in YAML frontmatter
- **Conflict detection** — SHA-based check catches remote changes before overwriting
- **Jupyter notebooks** — upload `.ipynb`, converted to Markdown inline (no GitHub Action needed)

### AI Enhancement
- Providers: **Ollama**, **LM Studio**, **OpenAI**, **Anthropic**, **OpenRouter**, or any custom OpenAI-compatible endpoint
- **AI Instructions** — reusable prompt templates; assign a default per section
- **Enhance button** in the editor — sends content + instruction to the provider, shows result inline
- Model discovery: auto-fetched from Ollama/LM Studio/OpenAI; static list for Anthropic

### Settings
- **Profile** — GitHub avatar and username from your PAT
- **Connected Sites** — add/remove GitHub Pages repos; all share the same token
- **Initialize Repo Structure** — create missing folders and a landing page; optional Git snapshot tag for safe rollback
- **Create New Repo** — create a GitHub Pages repo with Pages enabled from within the CMS
- **Dark mode** toggle
- **Reset CMS** — wipes all local data (token, sites, AI config); your GitHub repos are untouched

---

## Data Storage

All data is stored **locally on your machine** in a SQLite database:

```
~/.github-pages-cms/data.db
```

Override the location with the `CMS_DATA_DIR` environment variable.

| Table | Contents |
|---|---|
| `config` | GitHub token (encrypted), username, avatar, dark mode |
| `sites` | Connected repos, branch, SSG type, section config |
| `ai_providers` | Provider configs, API keys (encrypted) |
| `ai_instructions` | Reusable AI prompt templates |
| `audit_log` | Action history (commit SHAs, file paths) |

---

## Environment Variables

All optional — the setup wizard handles everything through the UI.

```bash
CMS_PORT=3000                       # default 3000
CMS_BIND=127.0.0.1                  # set to 0.0.0.0 for LAN/remote access
CMS_DATA_DIR=~/.github-pages-cms    # SQLite location
CMS_SECRET_KEY=your-secret-key      # AES encryption key; change from default in production
```

Stored in `config/config.env` (not committed to git).

---

## Project Structure

```
├── app.js                      # Express server, middleware, route mounting
├── config/
│   ├── db.js                   # SQLite init + schema migrations
│   ├── schema.sql              # Table definitions
│   └── config.env              # Local env vars (gitignored)
├── middleware/
│   ├── ensureApiAuth.js        # 401 for unauthenticated /api/* calls
│   └── ensureSetup.js          # Redirect to /setup if no token configured
├── services/
│   ├── github.js               # Octokit helpers (read, write, delete, list)
│   ├── ssgDetector.js          # Jekyll / Hugo / plain detection + section proposals
│   ├── ai.js                   # Multi-provider AI client
│   ├── notebook.js             # .ipynb → Markdown conversion
│   └── crypto.js               # AES-256-GCM encrypt/decrypt
├── routes/api/
│   ├── setup.js                # Token validation, setup complete, reset
│   ├── me.js                   # Profile + dark mode
│   ├── repos.js                # Repo listing, SSG detect, folder init
│   ├── sites.js                # Site CRUD
│   ├── posts.js                # Blog post CRUD + publish/archive/unarchive
│   ├── content.js              # Generic section content CRUD
│   ├── ai.js                   # Provider CRUD, model list, enhance
│   └── notebook.js             # Notebook conversion endpoint
├── client/src/
│   ├── App.jsx                 # Routes + auth gate
│   ├── api.js                  # fetch wrapper for /api/*
│   ├── pages/
│   │   ├── Setup.jsx           # 4-step wizard
│   │   ├── Dashboard.jsx       # Landing + Sidebar component
│   │   ├── PostsList.jsx       # Draft / Published / Archive tabs
│   │   ├── PostEditor.jsx      # Blog post editor
│   │   ├── WikiPagesList.jsx   # Pages list
│   │   ├── WikiPageEditor.jsx  # Page editor
│   │   ├── ContentList.jsx     # Generic section list
│   │   ├── Settings.jsx        # Preferences + site management
│   │   ├── AISettings.jsx      # Provider + instruction management
│   │   └── Help.jsx            # How-to guide
│   └── components/
│       ├── FrontmatterForm.jsx
│       └── GithubTokenHelp.jsx # Shared token setup guide
└── docs/
    └── serverless-migration.md # Architecture notes for future client-only port
```

---

## Troubleshooting

**`better-sqlite3` compiled against wrong Node version**
Happens when switching Node versions. Fix:
```bash
pnpm rebuild better-sqlite3
```

**Port already in use**
Set `CMS_PORT` in `config/config.env` or pass it inline:
```bash
CMS_PORT=3001 pnpm start
```

**Token expired / auth errors**
Go to **Settings → Re-run Setup Wizard** and paste a fresh token. Or use **Settings → Reset CMS** to start over.
