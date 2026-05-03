const express = require('express');
const router = express.Router();
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { listUserRepos, getToken, getFile, upsertFile, createRepo, enablePages, createTag } = require('../../services/github');
const { detectSsg, proposeSections } = require('../../services/ssgDetector');

router.use(ensureApiAuth);

router.get('/', async (req, res) => {
  try {
    const token = req.headers['x-setup-token'] || getToken();
    const repos = await listUserRepos(token);
    const ghPages = repos.filter(r => r.has_pages || r.name.endsWith('.github.io'));
    res.json(ghPages.map(r => ({
      id: r.id,
      full_name: r.full_name,
      owner: r.owner.login,
      name: r.name,
      default_branch: r.default_branch,
      has_pages: r.has_pages,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/detect', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
  try {
    const token = getToken();
    const ssgType = await detectSsg(owner, repo, null, token);
    const sections = await proposeSections(owner, repo, null, ssgType, token);
    res.json({ ssgType, sections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/enhance-policies', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
  try {
    const { listFiles } = require('../../services/github');
    const token = getToken();
    const files = await listFiles(owner, repo, '_enhance_policy', null, token);
    const policies = files
      .filter(f => f.name.endsWith('.prompt'))
      .map(f => ({ name: f.name.replace('.prompt', ''), path: f.path, sha: f.sha }));
    res.json(policies);
  } catch {
    res.json([]);
  }
});

// GET /api/repos/check — check if a repo is GitHub Pages-ready
router.get('/check', async (req, res) => {
  const { owner, repo, branch } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

  try {
    const token = req.headers['x-setup-token'] || getToken();
    const br = branch || 'main';

    async function exists(path) {
      try { await getFile(owner, repo, path, br, token); return true; } catch { return false; }
    }
    async function dirExists(dir) {
      try {
        const { listFiles } = require('../../services/github');
        const files = await listFiles(owner, repo, dir, br, token);
        return files.length > 0;
      } catch { return false; }
    }

    const [indexHtml, indexMd, configYml, configToml, hugoToml, nojekyll,
           hasPosts, hasDrafts, hasArchive, hasPages] = await Promise.all([
      exists('index.html'), exists('index.md'), exists('_config.yml'),
      exists('config.toml'), exists('hugo.toml'), exists('.nojekyll'),
      dirExists('_posts'), dirExists('_drafts'), dirExists('_archive'), dirExists('_pages'),
    ]);

    const ssg = configYml ? 'jekyll' : (configToml || hugoToml) ? 'hugo' : nojekyll ? 'plain' : 'unknown';
    const hasIndex = indexHtml || indexMd;
    const hasBlogFolders = hasPosts && hasDrafts;
    const hasWikiFolders = hasPages;

    res.json({
      ssg,
      hasIndex,
      indexFile: indexHtml ? 'index.html' : indexMd ? 'index.md' : null,
      hasBlogFolders,
      hasWikiFolders,
      checks: { indexHtml, indexMd, configYml, configToml, hugoToml, nojekyll, hasPosts, hasDrafts, hasArchive, hasPages },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repos/init
router.post('/init', async (req, res) => {
  const { owner, repo, branch, siteType, createSnapshot, createIndex } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

  try {
    const token = getToken();
    const br = branch || 'main';
    const type = siteType || 'blog';

    let snapshotTag = null;
    if (createSnapshot) {
      const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const tagName = `cms-snapshot-${now}`;
      try {
        await createTag(owner, repo, tagName, 'Snapshot before CMS folder initialization', br, token);
        snapshotTag = tagName;
      } catch (e) {
        console.warn('Could not create snapshot tag:', e.message);
      }
    }

    // Folders to create based on site type
    const blogDirs = ['_posts', '_drafts', '_archive'];
    const wikiDirs = ['_pages'];
    const dirsToCreate = type === 'wiki' ? wikiDirs
      : type === 'mixed' ? [...blogDirs, ...wikiDirs]
      : blogDirs;

    const created = [];
    const { listFiles } = require('../../services/github');
    for (const dir of dirsToCreate) {
      try {
        try {
          const files = await listFiles(owner, repo, dir, br, token);
          if (files.length > 0) { created.push({ dir, status: 'exists' }); continue; }
        } catch { /* dir doesn't exist */ }
        await upsertFile(owner, repo, `${dir}/.gitkeep`, '', `init: create ${dir} directory`, null, br, token);
        created.push({ dir, status: 'created' });
      } catch (e) {
        created.push({ dir, status: 'error', error: e.message });
      }
    }

    // Optionally create an index page
    let indexCreated = null;
    if (createIndex) {
      // Detect SSG to pick template
      let ssg = 'unknown';
      try { await getFile(owner, repo, '_config.yml', br, token); ssg = 'jekyll'; } catch {}
      try { await getFile(owner, repo, 'config.toml', br, token); ssg = 'hugo'; } catch {}

      const template = buildIndexTemplate(type, ssg, owner, repo, br);
      const indexPath = template.file;
      try {
        // Don't overwrite existing index
        try {
          await getFile(owner, repo, indexPath, br, token);
          indexCreated = { file: indexPath, status: 'exists' };
        } catch {
          await upsertFile(owner, repo, indexPath, template.content, `init: create ${indexPath}`, null, br, token);
          indexCreated = { file: indexPath, status: 'created' };
        }
      } catch (e) {
        indexCreated = { file: indexPath, status: 'error', error: e.message };
      }
    }

    res.json({ ok: true, dirs: created, snapshotTag, index: indexCreated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildIndexTemplate(siteType, ssg, owner, repo, branch) {
  const hasBlog = siteType === 'blog' || siteType === 'mixed';
  const hasWiki = siteType === 'wiki' || siteType === 'mixed';

  // ── Jekyll ──────────────────────────────────────────────────────────────
  if (ssg === 'jekyll') {
    const parts = [];

    if (hasWiki) {
      parts.push(`## Pages

{% assign wiki_pages = site.pages | where_exp:"p","p.dir contains '_pages'" | sort: 'title' %}
{% if wiki_pages.size > 0 %}
{% for p in wiki_pages %}
- [{{ p.title | default: p.name }}]({{ p.url | relative_url }})
{% endfor %}
{% else %}
*No pages yet. Add markdown files to \`_pages/\`.*
{% endif %}`);
    }

    if (hasBlog) {
      parts.push(`## Recent Posts

{% if site.posts.size > 0 %}
{% for post in site.posts limit:10 %}
- [{{ post.title }}]({{ post.url | relative_url }}) — {{ post.date | date: "%b %-d, %Y" }}
{% endfor %}
{% else %}
*No posts yet. Publish a post to see it here.*
{% endif %}`);
    }

    if (siteType === 'blog') {
      return {
        file: 'index.md',
        content: `---\ntitle: Home\nlayout: home\n---\n`,
      };
    }

    return {
      file: 'index.md',
      content: `---\ntitle: Home\nlayout: page\n---\n\n${parts.join('\n\n')}\n`,
    };
  }

  // ── Hugo ─────────────────────────────────────────────────────────────────
  if (ssg === 'hugo') {
    const parts = [];
    if (hasWiki) parts.push(`{{- range where .Site.Pages "Section" "pages" }}\n- [{{ .Title }}]({{ .Permalink }})\n{{- end }}`);
    if (hasBlog) parts.push(`## Recent Posts\n\n{{- range first 10 (where .Site.RegularPages "Section" "posts") }}\n- [{{ .Title }}]({{ .Permalink }}) — {{ .Date.Format "Jan 2, 2006" }}\n{{- end }}`);
    return {
      file: 'index.md',
      content: `---\ntitle: Home\n---\n\n${parts.join('\n\n')}\n`,
    };
  }

  // ── Plain HTML (no SSG detected) ─────────────────────────────────────────
  const siteName = (repo || 'My Site')
    .replace(/\.github\.io$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

  const OWNER  = owner  || '';
  const REPO   = repo   || '';
  const BRANCH = branch || 'main';

  const navLinks = [
    ...(hasBlog ? ['<a href="#posts">Posts</a>'] : []),
    ...(hasWiki ? ['<a href="#pages">Pages</a>'] : []),
  ].join('\n      ');

  const blogSection = hasBlog ? `  <section id="posts">
    <h2>Posts</h2>
    <ul class="post-list" id="post-list"><li class="empty">Loading…</li></ul>
  </section>` : '';

  const wikiSection = hasWiki ? `  <section id="pages">
    <h2>Pages</h2>
    <ul class="post-list" id="page-list"><li class="empty">Loading…</li></ul>
  </section>` : '';

  const sections = [blogSection, wikiSection].filter(Boolean).join('\n\n');

  const script = `
  (function () {
    var OWNER = '${OWNER}', REPO = '${REPO}', BRANCH = '${BRANCH}';

    function titleCase(s) {
      return s.replace(/-/g, ' ').replace(/\\b\\w/g, function (c) { return c.toUpperCase(); });
    }

    function load(dir, listId, makeItem) {
      var el = document.getElementById(listId);
      if (!el) return;
      fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + dir + '?ref=' + BRANCH)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (files) {
          var items = files
            .filter(function (f) { return f.name.endsWith('.md') && f.name !== '.gitkeep'; })
            .sort(function (a, b) { return b.name.localeCompare(a.name); })
            .map(makeItem);
          el.innerHTML = items.length
            ? items.join('')
            : '<li class="empty">No content yet.</li>';
        })
        .catch(function () {
          el.innerHTML = '<li class="empty">No content yet.</li>';
        });
    }

    var GH = 'https://github.com/' + OWNER + '/' + REPO + '/blob/' + BRANCH;

    load('_posts', 'post-list', function (f) {
      var m = f.name.match(/^(\\d{4}-\\d{2}-\\d{2})-(.+)\\.md$/);
      var date = m ? new Date(m[1] + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
      var title = m ? titleCase(m[2]) : f.name.replace('.md', '');
      return '<li><a href="' + GH + '/_posts/' + f.name + '" target="_blank" rel="noopener">' + title + '</a>' + (date ? '<div class="post-date">' + date + '</div>' : '') + '</li>';
    });

    load('_pages', 'page-list', function (f) {
      var slug = f.name.replace('.md', '');
      return '<li><a href="' + GH + '/_pages/' + f.name + '" target="_blank" rel="noopener">' + titleCase(slug) + '</a></li>';
    });
  })();`;

  return {
    file: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 60px auto; padding: 0 24px 80px; line-height: 1.6; color: #1e293b; background: #f8fafc; }
    header { margin-bottom: 48px; }
    h1 { font-size: 2rem; font-weight: 800; color: #0f172a; }
    nav { display: flex; gap: 16px; margin-top: 16px; }
    nav a { color: #6366f1; font-weight: 500; text-decoration: none; border-bottom: 2px solid transparent; padding-bottom: 2px; transition: border-color 0.15s; }
    nav a:hover { border-color: #6366f1; }
    section { margin-bottom: 40px; }
    h2 { font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    .post-list { list-style: none; display: flex; flex-direction: column; gap: 12px; }
    .post-list li { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; }
    .post-list a { font-weight: 600; color: #0f172a; text-decoration: none; }
    .post-list a:hover { color: #6366f1; }
    .post-date { font-size: 0.8125rem; color: #94a3b8; margin-top: 2px; }
    .empty { color: #94a3b8; font-size: 0.875rem; padding: 4px 0; list-style: none; }
  </style>
</head>
<body>
  <header>
    <h1>${siteName}</h1>
    <nav>
      ${navLinks}
    </nav>
  </header>

${sections}
  <script>${script}
  </script>
</body>
</html>
`,
  };
}

// POST /api/repos/create — create a new GitHub Pages repo
router.post('/create', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const token = getToken();
    const repoInfo = await createRepo(name, description, token);
    try { await enablePages(repoInfo.owner, repoInfo.name, repoInfo.default_branch, token); } catch (e) {
      console.warn('Could not enable Pages:', e.message);
    }
    res.status(201).json(repoInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
