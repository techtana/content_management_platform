# Content Management Platform

## 1) Goal & Scope

A lightweight Node.js web app that lets a user authenticate with **GitHub** and visually manage Markdown content in their **GitHub Pages** repository. Users can browse, edit, draft, and publish content for three modules: **Blogs, Journal, Photo**. The app commits changes back to the repo via the GitHub API.

### Top-level user flows

* **First visit (Homepage):** GitHub OAuth → app requests repo access and profile info (name, avatar).
* **Dashboard:** Buttons for **Blogs**, **Journal**, **Photo**. Header shows user avatar (click to upload to GCS), right-side settings (dark mode toggle, logout, delete authentication data).
* **Content list:** Table of Markdown files in the chosen module (drafts or published), with **Date** and **Title** parsed from filenames `YYYY-MM-DD-<title>.md`.
* **Content detail:** Markdown editor + frontmatter fields. Actions: **Cancel**, **Save as Draft**, **Publish** → app commits to the appropriate directory in GitHub.

---

## 2) Content Model & Repo Conventions

To keep things consistent across modules, use **paired directories** per module:

| Module  | Published dir | Draft dir           |
| ------- | ------------- | ------------------- |
| Blogs   | `_blogs/`     | `_blogs_drafts/`    |
| Journal | `_journals/`  | `_journals_drafts/` |
| Photo\* | `_photos/`    | `_photos_drafts/`   |

\* “Photo” entries are Markdown posts that reference images (which may live in GCS or inside the repo under `assets/`).
**Filename convention (required):** `YYYY-MM-DD-slug.md` (e.g., `2025-09-07-fall-colors.md`).

**Front matter (YAML example):**

```yaml
---
title: "Fall Colors"
date: "2025-09-07"
tags: ["nature","boise"]
cover_image: "https://storage.googleapis.com/<bucket>/photos/fall-colors.webp" # optional
draft: false
---
```

---

## 3) Architecture

### 3.1 Tech stack

* **Frontend**: Next.js (App Router) + React + TypeScript + TailwindCSS
* **Auth**: NextAuth (Auth.js) with **GitHub OAuth** provider
* **Backend**: Next.js API routes (Node.js 20), Octokit (GitHub REST API)
* **Storage**:

  * **Primary data** lives in the user’s GitHub repo (content).
  * **App metadata** (user settings, avatar URL, dark-mode pref) in a **tiny Postgres** (Neon/Supabase) or SQLite (for simplest self-host).
  * **Images/avatars** in **GCS** via **signed URLs** for direct browser uploads.
* **Queue/Jobs**: None required for MVP (synchronous operations). Optional BullMQ later for image processing.
* **Deployment**: Vercel/Render/Fly.io. Managed Postgres + GCS bucket.
* **Observability**: Sentry for errors, simple access logs.

### 3.2 Security & compliance

* Store OAuth tokens encrypted at rest (KMS or libsodium).
* Minimum GitHub scopes: `read:user`, **contents\:write** on the selected repo (prefer a **GitHub App** install for least privilege).
* HTTPS only; secure cookies; CSRF protection; rate-limit mutations.
* XSS mitigation: sanitize Markdown preview; strictly parse front matter.

### 3.3 Minimal data model (Prisma suggestion)

```prisma
model User {
  id            String   @id @default(cuid())
  githubId      String   @unique
  email         String?  @unique
  name          String?
  avatarUrl     String?
  darkMode      Boolean  @default(false)
  repoOwner     String
  repoName      String
  providerToken String?  @db.Text  // encrypted at rest
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  target    String?
  details   Json?
  createdAt DateTime @default(now())
}
```

---

## 4) Key Features & Acceptance Criteria

### 4.1 Homepage (Login)

* **Feature**: “Sign in with GitHub” button.
* **Accept**: User completes OAuth; app asks for repo access and stores repo selection (owner/name). If repo missing required folders, the app can create them via a one-time commit.

### 4.2 Dashboard

* **Feature**: Buttons: **Blogs**, **Journal**, **Photo**.
* **Header**: Left: circular avatar (click → upload to GCS). Right: settings (dark mode, logout, delete account & data).
* **Accept**: After sign-in, avatar displays correctly; settings update and persist.

### 4.3 Content List (per module)

* **Feature**: Table with rows from the module’s **published** or **draft** directory. Columns: **Date**, **Title**, **Path**, **Last Updated**.
* **Accept**:

  * Files are parsed from filenames `YYYY-MM-DD-slug.md`.
  * Toggle between Drafts/Published tabs.
  * Search by title/slug; paginate if >50 files.

### 4.4 Content Detail (editor)

* **Feature**: Markdown editor + front matter form (title, date, tags, cover image). Actions:

  * **Cancel** → back to list.
  * **Save as Draft** → write file to the module’s `_drafts` directory (create/commit/push).
  * **Publish** → write/move file to the module’s published directory with a valid `YYYY-MM-DD` date (create/commit/push).
* **Accept**:

  * Publish writes to `_blogs/` (or `_journals/`, `_photos/`) with correct filename.
  * Draft writes to `_blogs_drafts/` (etc.).
  * Commit message format:

    * `content(blogs): publish 2025-09-07 fall-colors`
    * `content(journals): save draft 2025-09-07 morning-notes`

---

## 5) API & Integration Design

### 5.1 GitHub Integration (Octokit)

* **List repo tree**: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
* **Read file**: `GET /repos/{owner}/{repo}/contents/{path}`
* **Create/Update file**: `PUT /repos/{owner}/{repo}/contents/{path}` with base64 content and `sha` when updating.

**Filename parser (shared util):**

```ts
export function parseDatedFilename(path: string) {
  // e.g., _blogs/2025-09-07-fall-colors.md
  const m = path.match(/\/(\d{4})-(\d{2})-(\d{2})-([^/]+)\.md$/);
  if (!m) return null;
  const [, y, mo, d, slug] = m;
  return { date: `${y}-${mo}-${d}`, title: slug.replace(/-/g, " "), slug };
}
```

### 5.2 GCS Signed Uploads

* **POST `/api/media/signed-url`** → returns `{ uploadUrl, publicUrl }`
* Browser uploads avatar or photo assets directly to GCS, then stores `publicUrl` in front matter or user profile.

### 5.3 API routes (illustrative)

```
GET    /api/me
POST   /api/auth/callback/github   (NextAuth-managed)
POST   /api/github/select-repo     (owner/name)
POST   /api/repos/sync             (fetch tree, index)
GET    /api/content/:module?status=draft|published
GET    /api/content/:module/:path  (fetch one)
POST   /api/content/:module        (create draft)
PUT    /api/content/:module/:path  (update body/frontmatter)
POST   /api/content/:module/:path/publish
POST   /api/media/signed-url
POST   /api/account/delete
```

**Module enum:** `blogs | journals | photos`
Server maps to directories using:

```ts
const MODULE_DIRS = {
  blogs:    { published: "_blogs",    draft: "_blogs_drafts" },
  journals:{ published: "_journals", draft: "_journals_drafts" },
  photos:  { published: "_photos",   draft: "_photos_drafts" },
} as const;
```

---

## 6) UI Blueprint

### 6.1 Layout

* **Header bar**

  * Left: circular avatar → click to upload → GCS signed URL → update `User.avatarUrl`.
  * Right: settings dropdown (Dark mode toggle, Logout, Delete account & data).
* **Sidebar**

  * Buttons: **Dashboard**, **Blogs**, **Journal**, **Photo**
  * Each module page has tabs: **Published** | **Drafts**
* **Body (Content list)**

  * Table: Date | Title | Path | Last updated | “Open” action

### 6.2 Editor page

* **Top**: Title input, Date picker, Tags input, Cover image URL (or picker)
* **Middle**: Markdown editor (split view preview optional)
* **Bottom actions**: **Cancel**, **Save as Draft**, **Publish**

---

## 7) Milestones & Timeline

### M1 — Foundations (Auth + Repo handshake)

* Next.js app scaffolding, Tailwind, dark mode
* NextAuth with **GitHub** provider (JWT sessions; no Session table required)
* Postgres (or SQLite) with Prisma for `User` + minimal settings
* “Select Repo” screen: verify Pages repo & required dirs (offer to create)
* **Acceptance**: User logs in, selects repo, sees Dashboard.

### M2 — Content indexing & lists

* GitHub tree scan (default branch) + in-memory/DB index for quick lists
* Module pages with Published/Drafts tabs
* Filename parsing, table view, basic search/pagination
* **Acceptance**: User sees accurate lists with Date/Title extracted.

### M3 — Editor & commit

* Read file, parse front matter (YAML), Markdown editing
* Save as Draft → write to `_drafts` dir (create/commit)
* Publish → write/move to published dir with correct date
* Commit messages; error handling (conflict on `sha`)
* **Acceptance**: Draft and Publish flows commit to GitHub correctly.

### M4 — Media & profile polish

* GCS signed upload flow for avatar (and optional post images)
* Header avatar update; Settings (dark mode, logout, delete account)
* Basic audit logging (who changed what)
* **Acceptance**: Avatar upload works; settings persist.

### M5 — Hardening & Docs

* Input validation (Zod), rate limiting, CSRF; Sentry alerts
* README with setup, envs, and a simple architecture diagram
* E2E tests for critical flows (Playwright)
* **Acceptance**: CI green; deploy to staging; smoke test.

---

## 8) Setup & ENV (pnpm shown; swap to npm if you prefer)

### 8.1 Install & scaffold

```bash
pnpm dlx create-next-app content_management_platform --ts --eslint --tailwind
cd content_management_platform
pnpm add next-auth @octokit/rest yaml gray-matter zod
pnpm add -D @types/node @types/react
# If using Prisma + Postgres for user settings:
pnpm add prisma @prisma/client
pnpm dlx prisma init
# GCS
pnpm add @google-cloud/storage
```

### 8.2 Environment variables (`.env.local`)

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...strong-random...

# GitHub OAuth app
GITHUB_ID=...
GITHUB_SECRET=...

# Repo default fallback (optional if you force user to pick)
DEFAULT_REPO_OWNER=...
DEFAULT_REPO_NAME=...

# Database (optional but recommended)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB

# Google Cloud
GCP_PROJECT=your-project
GCS_BUCKET=your-bucket
GCP_CREDENTIALS_JSON={...}    # or use workload identity
```

---

## 9) Risks & Mitigations

* **Repo structure mismatch** → Provide a “Fix repo” button that opens a PR to add missing dirs.
* **Concurrent edits** → Use file `sha` to detect stale updates; if conflict, open a PR instead of overwriting.
* **Large repos** → Cache tree index; lazy-load by module dir; paginate aggressively.
* **Token security** → Encrypt at rest; never log secrets; short-lived usage; consider GitHub App installs for tighter scopes.

---

## 10) Nice-to-Have (Post-MVP)

* “Move to Draft” (unpublish) and post scheduling (future publish date)
* PR workflow toggle (commit directly vs open PR)
* Image picker that uploads to GCS and inserts Markdown
* Notebook (`.ipynb`) to Markdown conversion pipeline for Blogs/Journal
* Tag filters and module-level analytics

---

## 11) Definition of Done (MVP)

* A new user can sign in with **GitHub**, select their repo, see module lists, open a file, edit content, **Save as Draft** to `_module_drafts/`, and **Publish** to `_module/` with a correctly dated filename — and see changes live on their GitHub repo after commit.
