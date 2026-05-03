const CLASSIC_SCOPES = [
  { scope: 'repo', desc: 'Full read/write access to repos — required to commit files' },
  { scope: 'read:user', desc: 'Read your username and avatar for the profile card' },
];

const FINEGRAINED_SCOPES = [
  { scope: 'Resource owner', desc: 'Your GitHub username (or org that owns the repo)' },
  { scope: 'Repository access', desc: 'Only select repositories — pick the repos this CMS will manage' },
  { scope: 'Contents', desc: 'Read and write — lets the CMS read and commit files' },
  { scope: 'Metadata', desc: 'Read-only — required by GitHub for all fine-grained tokens' },
  { scope: 'Profile information', desc: 'Read-only (Account permissions) — lets the CMS read your username' },
  { scope: 'Pages', desc: 'Read and write — only needed if you use "Create new repo" from Settings' },
];

function ScopeList({ scopes }) {
  return (
    <div className="help-scope-list">
      {scopes.map(({ scope, desc }) => (
        <div key={scope} className="help-scope-row">
          <code className="help-scope-badge">{scope}</code>
          <span className="text-sm" style={{ color: 'var(--text-2)' }}>{desc}</span>
        </div>
      ))}
    </div>
  );
}

export default function GithubTokenHelp() {
  return (
    <div className="help-steps">
      <div className="help-step">
        <div className="help-step-num">1</div>
        <div className="help-step-body">
          <div className="help-step-title">Open GitHub token settings</div>
          <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            Go to <strong>github.com → Settings → Developer settings → Personal access tokens</strong>.
            Choose <em>Tokens (classic)</em> for simplicity or <em>Fine-grained tokens</em> for tighter scope.
          </p>
        </div>
      </div>

      <div className="help-step">
        <div className="help-step-num">2</div>
        <div className="help-step-body">
          <div className="help-step-title">Grant the required permissions</div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            <strong>Classic token</strong> — click <em>Generate new token (classic)</em> and tick:
          </p>
          <ScopeList scopes={CLASSIC_SCOPES} />

          <p className="text-sm mb-2 mt-4" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            <strong>Fine-grained token</strong> — click <em>Generate new token (fine-grained)</em> and set:
          </p>
          <ScopeList scopes={FINEGRAINED_SCOPES} />

          <div className="alert mt-3" style={{ background: 'var(--warn-soft)', color: 'var(--warn-text)', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
            <strong>Contents: Read and write</strong> is required — without it the CMS cannot save or publish files.
            For fine-grained tokens, <strong>Profile information: Read</strong> must also be enabled under <em>Account permissions</em> or token validation will fail.
          </div>
        </div>
      </div>

      <div className="help-step">
        <div className="help-step-num">3</div>
        <div className="help-step-body">
          <div className="help-step-title">Copy the token immediately</div>
          <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            GitHub shows the token only once. Copy it and paste it into the setup wizard.
            Tokens start with <code className="help-scope-badge">ghp_</code> (classic) or <code className="help-scope-badge">github_pat_</code> (fine-grained).
          </p>
        </div>
      </div>

      <div className="help-step">
        <div className="help-step-num">4</div>
        <div className="help-step-body">
          <div className="help-step-title">Set a sensible expiry</div>
          <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            GitHub recommends 90 days or less. When a token expires, re-run the setup wizard with a fresh token.
            Fine-grained tokens can be set to <em>No expiration</em> for personal single-user use.
          </p>
        </div>
      </div>
    </div>
  );
}
