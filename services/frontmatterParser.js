const matter = require('gray-matter');

const DATED_SLUG_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.(md|markdown|ipynb)$/;

function parseDatedFilename(filename) {
  const m = filename.match(DATED_SLUG_RE);
  if (!m) return null;
  return { date: m[1], slug: m[2], ext: m[3] };
}

function buildFilename(date, slug, ext = 'md') {
  return `${date}-${slug}.${ext}`;
}

function parseFile(rawContent, filename) {
  const parsed = matter(rawContent);
  const meta = parseDatedFilename(filename);
  return {
    frontmatter: parsed.data,
    body: parsed.content,
    date: meta?.date || parsed.data.date || null,
    slug: meta?.slug || null,
    filename,
  };
}

function serializeFile(frontmatter, body) {
  return matter.stringify(body || '', frontmatter);
}

function isTemplateFile(filename) {
  return /(__blank__|__template__|\[TEMPLATE\]|\[template\])/i.test(filename);
}

function isDatedFile(filename) {
  return DATED_SLUG_RE.test(filename);
}

module.exports = { parseDatedFilename, buildFilename, parseFile, serializeFile, isTemplateFile, isDatedFile };
