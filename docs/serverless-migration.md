# Serverless Migration — Architecture Thinking

> Status: not started — kept for future reference

## Goal
Eliminate the Express/SQLite server entirely. Run as a pure static SPA deployed to GitHub Pages. No Node.js runtime at serve time.

---

## Capability Gaps

| Capability | Status | Notes |
|---|---|---|
| **Anthropic Claude** | ✅ Works | Use `anthropic-dangerous-direct-browser-access: true` header |
| **OpenAI** | ✅ Works | CORS-permissive, direct browser fetch |
| **OpenRouter** | ✅ Works | CORS-permissive |
| **Ollama / LM Studio** | ⚠️ Broken on GitHub Pages | `http://localhost` blocked from `https://` (mixed-content). Works if served locally. |
| **API key security** | ⚠️ Changed | Keys in localStorage instead of server-side encrypted SQLite. Add security warning in UI. |
| **Server-side rate limiting** | ➖ Gone | Not relevant for single-user personal tool |
| **Audit log** | ➖ Simplified | Ring-buffer of last 200 entries in localStorage; no SQL |

---

## Target Architecture

### Storage → localStorage
| SQLite table | localStorage key | Value |
|---|---|---|
| `config` | `cms:config` | `{ github_token, github_username, github_avatar, dark_mode }` |
| `sites` | `cms:sites` | `Site[]` |
| `ai_providers` | `cms:ai_providers` | `Provider[]` (api_key encrypted) |
| `ai_instructions` | `cms:ai_instructions` | `Instruction[]` |
| `audit_log` | `cms:audit_log` | last 200 entries |

### Encryption → Web Crypto API
`window.crypto.subtle` with AES-GCM (same algorithm as current Node impl). Key derived via PBKDF2 from a user passphrase set at Setup. Passphrase held in `sessionStorage` for the tab session.

### GitHub API → browser-side Octokit
Swap `@octokit/rest` (Node) for `@octokit/core` (browser-compatible ESM build). All existing function signatures in `services/github.js` stay identical — only the import and token sourcing change.

### AI providers → direct browser fetch
Each provider called directly via `fetch()`. Anthropic requests include `anthropic-dangerous-direct-browser-access: true`. Keys decrypted from localStorage at call time.

### Security warning (new UI)
When user adds/edits an AI provider with an API key, show:
> **API keys are stored in your browser only** — they never leave your device, but any browser extension or script running on this page can read them. Use a key with the minimum permissions needed.

---

## What to Delete (server-only)
- `app.js`
- `routes/` (all logic moves to client services)
- `middleware/`
- `config/db.js`, `config/schema.sql`
- `services/crypto.js` → replaced by browser version
- `services/github.js` → replaced by browser version
- `services/ssgDetector.js` → ported to client
- `services/ai*.js` → ported to client

## What to Create
| File | Purpose |
|---|---|
| `client/src/services/storage.js` | localStorage typed wrappers |
| `client/src/services/crypto.js` | Web Crypto AES-GCM + PBKDF2 |
| `client/src/services/github.js` | Port using `@octokit/core` browser build |
| `client/src/services/ai.js` | Direct fetch to AI providers; Anthropic header auto-injected |
| `client/src/services/ssg.js` | Port of ssgDetector.js |

## What to Rewrite
| File | Change |
|---|---|
| `client/src/api.js` | Delegates to service files instead of fetching `/api/*` |
| `client/src/pages/Setup.jsx` | Add passphrase field for encryption key derivation |
| `client/src/pages/AISettings.jsx` | Add security warning when API key field is used |
| `vite.config.js` | Remove dev proxy; add `base` for GitHub Pages path |
| `package.json` | Remove server deps; add `@octokit/core`; add deploy script |

## What Stays Unchanged
All `client/src/pages/` and `client/src/components/` — UI touches only `api.js`, so the rest is unaffected.

---

## Migration Order
1. `storage.js` — localStorage typed wrappers
2. `crypto.js` (browser) — Web Crypto AES-GCM + PBKDF2
3. `github.js` (browser) — port using `@octokit/core`
4. `ai.js` (browser) — direct fetch, Anthropic header, security warning prop
5. `ssg.js` (browser) — port SSG detector
6. Rewrite `api.js` — each namespace calls service functions
7. Update `Setup.jsx` — add passphrase step
8. Update `AISettings.jsx` — security warning
9. Update `vite.config.js` — remove proxy, set `base`
10. Update `package.json` — remove server deps, add deploy script
11. Delete server code
