const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../config/db');
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { getToken, listFiles, getFile, upsertFile, deleteFile } = require('../../services/github');
const { parseFile, serializeFile, isDatedFile, isTemplateFile, buildFilename } = require('../../services/frontmatterParser');

router.use(ensureApiAuth);

const STATUS_DIRS = {
  published: '_posts',
  draft: '_drafts',
  archive: '_archive',
  page: '_pages',
};

function getSite(siteId) {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  if (!site) throw Object.assign(new Error('Site not found'), { status: 404 });
  return site;
}

async function listPostFiles(site, status, token) {
  const dir = STATUS_DIRS[status];
  if (!dir) return [];
  let files;
  try {
    files = await listFiles(site.repo_owner, site.repo_name, dir, site.default_branch, token);
  } catch {
    return [];
  }
  return files.filter(f => !isTemplateFile(f.name) && f.name !== '.gitkeep' && f.type === 'file');
}

async function batchReadMeta(site, files, status, token) {
  const BATCH = 6;
  const results = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const chunk = files.slice(i, i + BATCH);
    const batch = await Promise.all(chunk.map(async f => {
      try {
        const fileData = await getFile(site.repo_owner, site.repo_name, f.path, site.default_branch, token);
        const raw = Buffer.from(fileData.content, 'base64').toString('utf8');
        const parsed = parseFile(raw, f.name);
        const fm = parsed.frontmatter || {};
        const catRaw = fm.categories || fm.category;
        return {
          name: f.name, path: f.path, sha: f.sha, status,
          title: fm.title || null,
          category: Array.isArray(catRaw) ? catRaw[0] || null : catRaw || null,
          tags: Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []),
          date: parsed.date || fm.date || null,
        };
      } catch {
        return { name: f.name, path: f.path, sha: f.sha, status, title: null, category: null, tags: [], date: null };
      }
    }));
    results.push(...batch);
  }
  return results;
}

// GET /api/sites/:siteId/posts?status=draft|published|archive
router.get('/:siteId/posts', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const status = req.query.status || 'draft';
    if (!STATUS_DIRS[status]) return res.status(400).json({ error: 'Invalid status' });
    const token = getToken();
    const files = await listPostFiles(site, status, token);
    res.json(files.map(f => ({ name: f.name, path: f.path, sha: f.sha, status, size: f.size })));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/sites/:siteId/posts/meta?status=draft|published|archive
// Must be defined BEFORE /:encodedPath
router.get('/:siteId/posts/meta', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const status = req.query.status || 'draft';
    if (!STATUS_DIRS[status]) return res.status(400).json({ error: 'Invalid status' });
    const token = getToken();
    const files = await listPostFiles(site, status, token);
    const results = await batchReadMeta(site, files, status, token);
    res.json(results);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/sites/:siteId/posts/taxonomy
// Must be defined BEFORE /:encodedPath
router.get('/:siteId/posts/taxonomy', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const token = getToken();
    const categories = new Set();
    const tags = new Set();

    for (const status of ['published', 'draft']) {
      const files = await listPostFiles(site, status, token);
      const meta = await batchReadMeta(site, files, status, token);
      for (const m of meta) {
        if (m.category) categories.add(m.category);
        for (const t of (m.tags || [])) tags.add(t);
      }
    }
    res.json({ categories: [...categories].sort(), tags: [...tags].sort() });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/sites/:siteId/posts/:encodedPath
router.get('/:siteId/posts/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const fileData = await getFile(site.repo_owner, site.repo_name, filePath, site.default_branch, token);
    const rawContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const filename = filePath.split('/').pop();
    const parsed = parseFile(rawContent, filename);
    res.json({ ...parsed, sha: fileData.sha, path: filePath });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sites/:siteId/posts — create new draft
router.post('/:siteId/posts', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const token = getToken();
    const { frontmatter, body, filename, status: reqStatus } = req.body;
    const dir = STATUS_DIRS[reqStatus] || STATUS_DIRS.draft;
    const name = filename || buildFilename(
      frontmatter.date || new Date().toISOString().slice(0, 10),
      slugify(frontmatter.title || 'untitled'),
      'md'
    );
    const filePath = `${dir}/${name}`;
    const content = serializeFile(frontmatter, body || '');
    const sha = await upsertFile(site.repo_owner, site.repo_name, filePath, content, `draft: save ${name}`, null, site.default_branch, token);
    logAudit(site.id, 'save_draft', filePath, sha);
    res.status(201).json({ ok: true, path: filePath, sha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PUT /api/sites/:siteId/posts/:encodedPath — update
router.put('/:siteId/posts/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { frontmatter, body, sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required for update' });
    const content = serializeFile(frontmatter, body || '');
    const filename = filePath.split('/').pop();
    try {
      const newSha = await upsertFile(site.repo_owner, site.repo_name, filePath, content, `post: update ${filename}`, sha, site.default_branch, token);
      logAudit(site.id, 'update', filePath, newSha);
      res.json({ ok: true, sha: newSha });
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.includes('does not match'))) {
        return res.status(409).json({ error: 'File changed remotely — reload?' });
      }
      throw err;
    }
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sites/:siteId/posts/:encodedPath/publish — move _drafts/ → _posts/
router.post('/:siteId/posts/:encodedPath/publish', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const draftPath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { frontmatter, body, sha } = req.body;
    const filename = draftPath.split('/').pop();
    const publishPath = `${STATUS_DIRS.published}/${filename}`;
    const content = serializeFile(frontmatter, body || '');

    // If re-publishing an already-published post, use the supplied sha.
    // Otherwise check if a file already exists at the destination.
    let destSha = draftPath === publishPath ? (sha || null) : null;
    if (!destSha) {
      try {
        const existing = await getFile(site.repo_owner, site.repo_name, publishPath, site.default_branch, token);
        destSha = existing.sha;
      } catch { /* destination doesn't exist yet */ }
    }

    const newSha = await upsertFile(site.repo_owner, site.repo_name, publishPath, content, `post: publish ${filename}`, destSha, site.default_branch, token);
    if (draftPath !== publishPath && sha) {
      try { await deleteFile(site.repo_owner, site.repo_name, draftPath, `post: remove draft ${filename}`, sha, site.default_branch, token); } catch { /* ignore */ }
    }
    logAudit(site.id, 'publish', publishPath, newSha);
    res.json({ ok: true, path: publishPath, sha: newSha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sites/:siteId/posts/:encodedPath/archive — move to _archive/
router.post('/:siteId/posts/:encodedPath/archive', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const srcPath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required' });
    const filename = srcPath.split('/').pop();
    const archivePath = `${STATUS_DIRS.archive}/${filename}`;
    const fileData = await getFile(site.repo_owner, site.repo_name, srcPath, site.default_branch, token);
    const rawContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    let archiveDestSha = null;
    try { archiveDestSha = (await getFile(site.repo_owner, site.repo_name, archivePath, site.default_branch, token)).sha; } catch { /* doesn't exist */ }
    const newSha = await upsertFile(site.repo_owner, site.repo_name, archivePath, rawContent, `post: archive ${filename}`, archiveDestSha, site.default_branch, token);
    try { await deleteFile(site.repo_owner, site.repo_name, srcPath, `post: remove ${filename}`, sha, site.default_branch, token); } catch { /* ignore */ }
    logAudit(site.id, 'archive', archivePath, newSha);
    res.json({ ok: true, path: archivePath, sha: newSha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sites/:siteId/posts/:encodedPath/unarchive — move _archive/ → _drafts/
router.post('/:siteId/posts/:encodedPath/unarchive', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const srcPath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required' });
    const filename = srcPath.split('/').pop();
    const draftPath = `${STATUS_DIRS.draft}/${filename}`;
    const fileData = await getFile(site.repo_owner, site.repo_name, srcPath, site.default_branch, token);
    const rawContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    let draftDestSha = null;
    try { draftDestSha = (await getFile(site.repo_owner, site.repo_name, draftPath, site.default_branch, token)).sha; } catch { /* doesn't exist */ }
    const newSha = await upsertFile(site.repo_owner, site.repo_name, draftPath, rawContent, `post: unarchive ${filename}`, draftDestSha, site.default_branch, token);
    try { await deleteFile(site.repo_owner, site.repo_name, srcPath, `post: remove archive ${filename}`, sha, site.default_branch, token); } catch { /* ignore */ }
    logAudit(site.id, 'unarchive', draftPath, newSha);
    res.json({ ok: true, path: draftPath, sha: newSha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /api/sites/:siteId/posts/:encodedPath
router.delete('/:siteId/posts/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required for delete' });
    const filename = filePath.split('/').pop();
    await deleteFile(site.repo_owner, site.repo_name, filePath, `post: delete ${filename}`, sha, site.default_branch, token);
    logAudit(site.id, 'delete', filePath, null);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function logAudit(siteId, action, filePath, commitSha) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO audit_log (id, site_id, action, file_path, commit_sha) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), siteId, action, filePath, commitSha);
  } catch { /* non-critical */ }
}

module.exports = router;
