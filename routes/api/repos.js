const express = require('express');
const router = express.Router();
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { listUserRepos, getToken, getFile, upsertFile, createRepo, enablePages, createTag } = require('../../services/github');
const { detectSsg, proposeSections } = require('../../services/ssgDetector');

router.use(ensureApiAuth);

router.get('/', async (req, res) => {
  try {
    const token = getToken();
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
    const token = getToken();
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

      const template = buildIndexTemplate(type, ssg);
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

function buildIndexTemplate(siteType, ssg) {
  if (ssg === 'jekyll') {
    if (siteType === 'wiki' || siteType === 'mixed') {
      return {
        file: 'index.md',
        content: `---
title: Home
layout: page
---

## Pages

{% assign wiki_pages = site.pages | where_exp:"p","p.dir contains '_pages'" | sort: 'title' %}
{% for p in wiki_pages %}
- [{{ p.title | default: p.name }}]({{ p.url | relative_url }})
{% endfor %}
${siteType === 'mixed' ? `
## Recent Posts

{% for post in site.posts limit:10 %}
- [{{ post.title }}]({{ post.url | relative_url }}) — {{ post.date | date: "%b %-d, %Y" }}
{% endfor %}` : ''}
`,
      };
    }
    // blog / default
    return {
      file: 'index.md',
      content: `---
title: Home
layout: home
---
`,
    };
  }

  // Plain HTML fallback (works without any SSG)
  const blogSection = `
  <section>
    <h2>Posts</h2>
    <p>Posts live in <code>_posts/</code>. Configure Jekyll, Hugo, or another static site generator to render them automatically.</p>
  </section>`;

  const wikiSection = `
  <section>
    <h2>Pages</h2>
    <p>Pages live in <code>_pages/</code>. Configure your static site generator to render them.</p>
  </section>`;

  const body = siteType === 'wiki' ? wikiSection
    : siteType === 'mixed' ? blogSection + wikiSection
    : blogSection;

  return {
    file: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Site</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 60px auto; padding: 0 24px; line-height: 1.6; color: #1e293b; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 4px; }
    h2 { font-size: 1.25rem; font-weight: 600; margin-top: 40px; margin-bottom: 8px; }
    p { color: #475569; }
    a { color: #6366f1; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.875em; }
  </style>
</head>
<body>
  <h1>My Site</h1>
  <p>Managed with Pages CMS.</p>
${body}
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
