const { listFiles } = require('./github');

const MARKERS = [
  { ssg: 'jekyll',   required: '_config.yml',            confirming: ['Gemfile', 'Gemfile.lock'] },
  { ssg: 'hugo',     required: 'hugo.toml',              confirming: ['content'] },
  { ssg: 'hugo',     required: 'hugo.yaml',              confirming: ['content'] },
  { ssg: 'hugo',     required: 'config.toml',            confirming: ['content'] },
  { ssg: 'eleventy', required: '.eleventy.js',           confirming: [] },
  { ssg: 'eleventy', required: 'eleventy.config.js',     confirming: [] },
];

const CONTENT_DIRS = {
  jekyll: '_posts',
  hugo: 'content',
  eleventy: 'src',
};

async function detectSsg(owner, repo, branch, token) {
  const rootFiles = await listFiles(owner, repo, '', branch, token);
  const names = new Set(rootFiles.map(f => f.name));

  for (const marker of MARKERS) {
    if (names.has(marker.required)) {
      return marker.ssg;
    }
  }
  return 'unknown';
}

async function proposeSections(owner, repo, branch, ssgType, token) {
  const contentDir = CONTENT_DIRS[ssgType] || '';
  const sections = [];

  if (!contentDir) return sections;

  try {
    const entries = await listFiles(owner, repo, contentDir, branch, token);
    const dirs = entries.filter(e => e.type === 'dir');

    for (const dir of dirs) {
      const slug = dir.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      sections.push({
        name: dir.name.charAt(0).toUpperCase() + dir.name.slice(1),
        slug,
        publishedDir: `${contentDir}/${dir.name}`,
        draftDir: ssgType === 'jekyll' ? '_posts_drafts' : `${contentDir}/_drafts`,
        fileType: 'md',
        aiEnabled: false,
        frontmatterFields: defaultFields(slug),
      });
    }

    // Jupyter section if notebook draft dir exists
    const root = await listFiles(owner, repo, '', branch, token);
    if (root.some(e => e.name === '_notebook_draft' && e.type === 'dir')) {
      sections.push({
        name: 'Jupyter',
        slug: 'jupyter',
        publishedDir: `${contentDir}/jupyter`,
        draftDir: '_notebook_draft',
        fileType: 'ipynb',
        aiEnabled: false,
        frontmatterFields: defaultFields('jupyter'),
      });
    }
  } catch {
    // dir may not exist
  }

  return sections;
}

function defaultFields(slug) {
  return [
    { key: 'layout',     label: 'Layout',   type: 'text',  default: 'post' },
    { key: 'title',      label: 'Title',    type: 'text',  required: true },
    { key: 'subtitle',   label: 'Subtitle', type: 'text' },
    { key: 'categories', label: 'Category', type: 'text',  default: slug },
    { key: 'tags',       label: 'Tags',     type: 'array' },
  ];
}

module.exports = { detectSsg, proposeSections };
