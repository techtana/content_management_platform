const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../config/db');
const ensureApiAuth = require('../../middleware/ensureApiAuth');
const { getToken, listFiles, getFile, upsertFile, deleteFile } = require('../../services/github');
const { parseFile, serializeFile, isDatedFile, isTemplateFile, buildFilename } = require('../../services/frontmatterParser');

router.use(ensureApiAuth);

function getSite(siteId) {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  if (!site) throw Object.assign(new Error('Site not found'), { status: 404 });
  return { ...site, sections: JSON.parse(site.sections_json) };
}

function getSection(site, sectionSlug) {
  const section = site.sections.find(s => s.slug === sectionSlug);
  if (!section) throw Object.assign(new Error('Section not found'), { status: 404 });
  return section;
}

// GET /api/sites/:siteId/content/:sectionSlug
router.get('/:siteId/content/:sectionSlug', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const section = getSection(site, req.params.sectionSlug);
    const token = getToken();
    const status = req.query.status || 'published';
    const token_ = token;

    const dirs = [];
    if (status === 'published' || status === 'all') dirs.push({ dir: section.publishedDir, status: 'published' });
    if (status === 'draft' || status === 'all') dirs.push({ dir: section.draftDir, status: 'draft' });

    const results = [];
    for (const { dir, status: s } of dirs) {
      let files;
      try {
        files = await listFiles(site.repo_owner, site.repo_name, dir, site.default_branch, token_);
      } catch {
        files = [];
      }
      for (const f of files) {
        if (!isDatedFile(f.name) || isTemplateFile(f.name)) continue;
        results.push({
          name: f.name,
          path: f.path,
          sha: f.sha,
          status: s,
          size: f.size,
          lastModified: null,
        });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/sites/:siteId/content/:sectionSlug/:encodedPath
router.get('/:siteId/content/:sectionSlug/:encodedPath', async (req, res) => {
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

// POST /api/sites/:siteId/content/:sectionSlug  — create new file
router.post('/:siteId/content/:sectionSlug', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const section = getSection(site, req.params.sectionSlug);
    const token = getToken();
    const { frontmatter, body, filename, saveAsDraft } = req.body;
    const dir = saveAsDraft ? section.draftDir : section.publishedDir;
    const name = filename || buildFilename(frontmatter.date || new Date().toISOString().slice(0, 10), slugify(frontmatter.title || 'untitled'), section.fileType || 'md');
    const filePath = `${dir}/${name}`;
    const content = serializeFile(frontmatter, body);
    const message = `content(${section.slug}): ${saveAsDraft ? 'save draft' : 'publish'} ${name}`;
    const sha = await upsertFile(site.repo_owner, site.repo_name, filePath, content, message, null, site.default_branch, token);
    logAudit(site.id, saveAsDraft ? 'save_draft' : 'publish', filePath, sha);
    res.status(201).json({ ok: true, path: filePath, sha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PUT /api/sites/:siteId/content/:sectionSlug/:encodedPath
router.put('/:siteId/content/:sectionSlug/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const section = getSection(site, req.params.sectionSlug);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { frontmatter, body, sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required for update' });
    const content = serializeFile(frontmatter, body);
    const filename = filePath.split('/').pop();
    const message = `content(${section.slug}): update ${filename}`;
    try {
      const newSha = await upsertFile(site.repo_owner, site.repo_name, filePath, content, message, sha, site.default_branch, token);
      logAudit(site.id, 'save_draft', filePath, newSha);
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

// POST /api/sites/:siteId/content/:sectionSlug/:encodedPath/publish
router.post('/:siteId/content/:sectionSlug/:encodedPath/publish', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const section = getSection(site, req.params.sectionSlug);
    const draftPath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { frontmatter, body, sha } = req.body;
    const filename = draftPath.split('/').pop();
    const publishPath = `${section.publishedDir}/${filename}`;
    const content = serializeFile(frontmatter, body);

    // Write to published dir
    const newSha = await upsertFile(site.repo_owner, site.repo_name, publishPath, content,
      `content(${section.slug}): publish ${filename}`, null, site.default_branch, token);

    // Delete from draft dir if it was a draft
    if (draftPath !== publishPath && sha) {
      try {
        await deleteFile(site.repo_owner, site.repo_name, draftPath, `content(${section.slug}): remove draft ${filename}`, sha, site.default_branch, token);
      } catch { /* ignore if draft already gone */ }
    }

    logAudit(site.id, 'publish', publishPath, newSha);
    res.json({ ok: true, path: publishPath, sha: newSha });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /api/sites/:siteId/content/:sectionSlug/:encodedPath
router.delete('/:siteId/content/:sectionSlug/:encodedPath', async (req, res) => {
  try {
    const site = getSite(req.params.siteId);
    const section = getSection(site, req.params.sectionSlug);
    const filePath = Buffer.from(req.params.encodedPath, 'base64url').toString('utf8');
    const token = getToken();
    const { sha } = req.body;
    if (!sha) return res.status(400).json({ error: 'sha required for delete' });
    const filename = filePath.split('/').pop();
    await deleteFile(site.repo_owner, site.repo_name, filePath, `content(${section.slug}): delete ${filename}`, sha, site.default_branch, token);
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
