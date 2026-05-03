import { Sidebar } from './Dashboard.jsx';

export default function Help() {
  return (
    <div className="app-layout">
      <Sidebar site={null} activeSlug="__help" />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">How it works</span>
        </header>

        <main className="page" style={{ maxWidth: 720 }}>

          {/* Overview */}
          <div className="card mb-4">
            <div className="card-title mb-3">What this CMS does</div>
            <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              Pages CMS manages Markdown content directly inside your GitHub repository.
              Every save, publish, or delete is a real Git commit — no database, no sync step.
              Your repo stays the source of truth and GitHub Pages serves the result automatically.
            </p>
          </div>

          {/* GitHub access */}
          <div className="card mb-4">
            <div className="card-title mb-3">GitHub access &amp; token setup</div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              The CMS writes to your repository using a GitHub <strong>Personal Access Token (PAT)</strong>.
              The token is encrypted before being stored locally and is never sent anywhere except the GitHub API.
            </p>

            <div className="help-steps">
              <div className="help-step">
                <div className="help-step-num">1</div>
                <div className="help-step-body">
                  <div className="help-step-title">Open GitHub token settings</div>
                  <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                    Go to <strong>github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</strong>.
                    Fine-grained tokens also work; see step 2b below.
                  </p>
                </div>
              </div>

              <div className="help-step">
                <div className="help-step-num">2</div>
                <div className="help-step-body">
                  <div className="help-step-title">Choose token type and grant scopes</div>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                    <strong>Classic token (simpler)</strong> — click <em>Generate new token (classic)</em> and tick these scopes:
                  </p>
                  <div className="help-scope-list mb-3">
                    {[
                      { scope: 'repo', desc: 'Full read/write access to repos (required to commit files)' },
                      { scope: 'read:user', desc: 'Read your username and avatar for the profile card' },
                    ].map(({ scope, desc }) => (
                      <div key={scope} className="help-scope-row">
                        <code className="help-scope-badge">{scope}</code>
                        <span className="text-sm" style={{ color: 'var(--text-2)' }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                    <strong>Fine-grained token (more locked-down)</strong> — click <em>Generate new token (fine-grained)</em> and set:
                  </p>
                  <div className="help-scope-list">
                    {[
                      { scope: 'Resource owner', desc: 'Your GitHub username (or the org that owns the repo)' },
                      { scope: 'Repository access', desc: 'Only select repositories — pick the repos this CMS will manage' },
                      { scope: 'Contents', desc: 'Read and write — lets the CMS commit files' },
                      { scope: 'Metadata', desc: 'Read-only — required by GitHub for all fine-grained tokens' },
                      { scope: 'Pages', desc: 'Read and write — only needed if you use "Create new repo" from Settings' },
                    ].map(({ scope, desc }) => (
                      <div key={scope} className="help-scope-row">
                        <code className="help-scope-badge">{scope}</code>
                        <span className="text-sm" style={{ color: 'var(--text-2)' }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="help-step">
                <div className="help-step-num">3</div>
                <div className="help-step-body">
                  <div className="help-step-title">Copy the token immediately</div>
                  <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                    GitHub shows the token only once. Copy it and paste it into the CMS setup wizard (<strong>Settings → Re-run Setup Wizard</strong> if you need to update it).
                    The token starts with <code className="help-scope-badge">ghp_</code> (classic) or <code className="help-scope-badge">github_pat_</code> (fine-grained).
                  </p>
                </div>
              </div>

              <div className="help-step">
                <div className="help-step-num">4</div>
                <div className="help-step-body">
                  <div className="help-step-title">Set a sensible expiry</div>
                  <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                    GitHub recommends 90 days or less. When your token expires the CMS will return auth errors — re-run the setup wizard with a fresh token to fix it.
                    Fine-grained tokens can be set to <em>No expiration</em> for personal single-user use.
                  </p>
                </div>
              </div>
            </div>

            <div className="alert mt-4" style={{ background: 'var(--warn-soft)', color: 'var(--warn-text)', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
              <strong>Token scope and repo visibility:</strong> a classic <code style={{ background: 'rgba(0,0,0,.08)', borderRadius: '3px', padding: '1px 5px' }}>repo</code> token grants access to <em>all</em> your repos.
              If you manage a single public blog, prefer a fine-grained token scoped to just that repository.
            </div>
          </div>

          {/* Folder structure */}
          <div className="card mb-4">
            <div className="card-title mb-3">Repo folder structure</div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              The CMS organises posts into three folders based on their status.
              You can create these folders automatically from <strong>Settings → Initialize Repo Structure</strong>.
            </p>

            <div className="help-tree">
              <div className="help-tree-row">
                <span className="help-tree-icon">📁</span>
                <span className="help-tree-name font-mono">_posts/</span>
                <span className="help-tree-desc">Published — live on your site</span>
              </div>
              <div className="help-tree-row">
                <span className="help-tree-icon">📁</span>
                <span className="help-tree-name font-mono">_drafts/</span>
                <span className="help-tree-desc">Drafts — work in progress, not yet live</span>
              </div>
              <div className="help-tree-row">
                <span className="help-tree-icon">📁</span>
                <span className="help-tree-name font-mono">_archive/</span>
                <span className="help-tree-desc">Archive — removed from the site but kept for reference</span>
              </div>
              <div className="help-tree-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <span className="help-tree-icon">📄</span>
                <span className="help-tree-name font-mono">_posts/2024-06-01-hello-world.md</span>
                <span className="help-tree-desc">Example post filename</span>
              </div>
            </div>

            <div className="alert mt-3" style={{ background: 'var(--brand-soft)', color: 'var(--brand-text)', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
              <strong>Existing content is never moved or deleted</strong> during initialization.
              The CMS only creates the three folders if they don't already exist, by adding a <span className="font-mono">.gitkeep</span> placeholder file.
            </div>
          </div>

          {/* File naming */}
          <div className="card mb-4">
            <div className="card-title mb-3">File naming convention</div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              Every post file follows the pattern <span className="font-mono">YYYY-MM-DD-slug.md</span>.
              The date and slug are extracted from the filename automatically when displaying the list.
            </p>
            <div className="help-examples">
              <div className="help-example-row">
                <span className="font-mono" style={{ color: 'var(--text-1)' }}>2024-06-01-hello-world.md</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
                <span style={{ color: 'var(--text-2)' }}>date: Jun 1, slug: hello-world</span>
              </div>
              <div className="help-example-row">
                <span className="font-mono" style={{ color: 'var(--text-1)' }}>2024-12-25-year-in-review.md</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
                <span style={{ color: 'var(--text-2)' }}>date: Dec 25, slug: year-in-review</span>
              </div>
            </div>
          </div>

          {/* Frontmatter */}
          <div className="card mb-4">
            <div className="card-title mb-3">Post frontmatter</div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              Each Markdown file starts with YAML frontmatter between <span className="font-mono">---</span> delimiters.
              You can add any fields you need — your SSG reads them directly.
              Categories and tags live here, not in separate folders.
            </p>
            <pre className="help-code">{`---
title: Hello World
date: 2024-06-01
tags: [engineering, tutorial]
category: engineering
---

Post content in Markdown goes here.`}</pre>
            <p className="text-sm mt-3" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              Your static site generator (Jekyll, Hugo, etc.) uses these fields to build tag pages, category indexes, and RSS feeds — the CMS just stores and edits the values.
            </p>
          </div>

          {/* Post lifecycle */}
          <div className="card mb-4">
            <div className="card-title mb-3">Post lifecycle</div>
            <div className="help-flow">
              <div className="help-flow-step">
                <div className="help-flow-badge" style={{ background: 'var(--warn-soft)', color: 'var(--warn-text)' }}>Draft</div>
                <div className="text-xs text-3 mt-1">Saved to <span className="font-mono">_drafts/</span></div>
              </div>
              <div className="help-flow-arrow">→</div>
              <div className="help-flow-step">
                <div className="help-flow-badge" style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>Published</div>
                <div className="text-xs text-3 mt-1">Moved to <span className="font-mono">_posts/</span></div>
              </div>
              <div className="help-flow-arrow">→</div>
              <div className="help-flow-step">
                <div className="help-flow-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand-text)' }}>Archive</div>
                <div className="text-xs text-3 mt-1">Moved to <span className="font-mono">_archive/</span></div>
              </div>
            </div>
            <div className="text-sm mt-3" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              Each transition is a Git commit — the file is moved by creating it in the new folder and deleting it from the old one.
              The full history is preserved in Git.
            </div>
          </div>

          {/* Git commits */}
          <div className="card mb-4">
            <div className="card-title mb-3">Every action is a Git commit</div>
            <div className="help-commits">
              {[
                { msg: 'draft: save 2024-06-01-hello-world.md', label: 'Save draft' },
                { msg: 'post: publish 2024-06-01-hello-world.md', label: 'Publish' },
                { msg: 'post: update 2024-06-01-hello-world.md', label: 'Edit published post' },
                { msg: 'post: archive 2024-06-01-hello-world.md', label: 'Archive' },
                { msg: 'post: delete 2024-06-01-hello-world.md', label: 'Delete' },
                { msg: 'init: create _drafts directory', label: 'Repo initialization' },
              ].map(({ msg, label }) => (
                <div key={msg} className="help-commit-row">
                  <span className="help-commit-label">{label}</span>
                  <span className="font-mono help-commit-msg">{msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Snapshot / rollback */}
          <div className="card mb-4">
            <div className="card-title mb-3">Snapshots &amp; safe rollback</div>
            <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              When you run <strong>Initialize Repo Structure</strong> with the snapshot option enabled, the CMS creates an annotated Git tag on the current commit before touching anything.
              If something goes wrong, you can restore the repo to that exact state with:
            </p>
            <pre className="help-code mt-3">{`git checkout cms-snapshot-2024-06-01T12-00-00`}</pre>
            <p className="text-sm mt-3" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              Tags are listed under <strong>Releases</strong> on your GitHub repo page.
            </p>
          </div>

          {/* Multi-site */}
          <div className="card">
            <div className="card-title mb-3">Multiple sites</div>
            <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.75 }}>
              You can connect more than one GitHub Pages repo to this CMS — all sharing the same GitHub personal access token.
              Each site gets its own sidebar group with independent Drafts / Published / Archive views.
              Add or remove sites from <strong>Settings → Connected Sites</strong>.
            </p>
          </div>

        </main>
      </div>
    </div>
  );
}
