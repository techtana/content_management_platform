const { Octokit } = require('@octokit/rest');
const { getDb } = require('../config/db');
const { decrypt } = require('./crypto');

function getToken() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('github_token');
  if (!row) throw new Error('GitHub token not configured');
  return decrypt(row.value);
}

function createOctokit(token) {
  const octokit = new Octokit({ auth: token || getToken() });
  octokit.hook.error('request', (error) => {
    if (error.status === 401) {
      const ghMessage = error.response?.data?.message;
      const e = new Error(
        ghMessage
          ? `GitHub token rejected: ${ghMessage}`
          : 'GitHub token is invalid or expired. Re-run setup to enter a new token.'
      );
      e.status = 401;
      e.response = error.response;
      throw e;
    }
    throw error;
  });
  return octokit;
}

async function getFile(owner, repo, filePath, ref, token) {
  const octokit = createOctokit(token);
  const params = { owner, repo, path: filePath };
  if (ref) params.ref = ref;
  const { data } = await octokit.repos.getContent(params);
  return data;
}

async function listFiles(owner, repo, dirPath, ref, token) {
  const octokit = createOctokit(token);
  const params = { owner, repo, path: dirPath };
  if (ref) params.ref = ref;
  const { data } = await octokit.repos.getContent(params);
  return Array.isArray(data) ? data : [];
}

async function listFilesRecursive(owner, repo, dirPath, ref, token) {
  const octokit = createOctokit(token);
  const treeSha = ref || 'HEAD';
  const { data: refData } = await octokit.git.getRef({
    owner, repo, ref: `heads/${ref || 'main'}`,
  });
  const commitSha = refData.object.sha;
  const { data: commitData } = await octokit.git.getCommit({ owner, repo, commit_sha: commitSha });
  const { data: treeData } = await octokit.git.getTree({
    owner, repo, tree_sha: commitData.tree.sha, recursive: '1',
  });
  return treeData.tree
    .filter(item => item.type === 'blob' && item.path.startsWith(dirPath + '/'))
    .map(item => ({ ...item, name: item.path.split('/').pop() }));
}

async function upsertFile(owner, repo, filePath, content, message, sha, branch, token) {
  const octokit = createOctokit(token);
  const params = {
    owner, repo, path: filePath,
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: branch || 'main',
  };
  if (sha) params.sha = sha;
  const { data } = await octokit.repos.createOrUpdateFileContents(params);
  // Return blob sha (not commit sha) so callers can use it for subsequent updates
  return data.content.sha;
}

async function deleteFile(owner, repo, filePath, message, sha, branch, token) {
  const octokit = createOctokit(token);
  await octokit.repos.deleteFile({
    owner, repo, path: filePath, message, sha, branch: branch || 'main',
  });
}

async function listUserRepos(token) {
  const octokit = createOctokit(token);
  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    sort: 'updated', per_page: 100,
  });
  return repos;
}

async function validateToken(token) {
  const octokit = createOctokit(token);
  const { data } = await octokit.users.getAuthenticated();
  return { username: data.login, avatar: data.avatar_url };
}

async function createRepo(name, description, token) {
  const octokit = createOctokit(token);
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name,
    description: description || '',
    auto_init: true,
    private: false,
  });
  return { owner: data.owner.login, name: data.name, default_branch: data.default_branch };
}

async function enablePages(owner, repo, branch, token) {
  const octokit = createOctokit(token);
  try {
    await octokit.repos.createPagesSite({
      owner, repo,
      source: { branch: branch || 'main', path: '/' },
    });
  } catch (err) {
    // 409 = already enabled — ignore
    if (err.status !== 409) throw err;
  }
}

async function createTag(owner, repo, tagName, message, branch, token) {
  const octokit = createOctokit(token);
  // Get latest commit SHA on branch
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch || 'main'}` });
  const commitSha = refData.object.sha;
  // Create annotated tag object
  const { data: tagObj } = await octokit.git.createTag({
    owner, repo,
    tag: tagName,
    message: message || `Snapshot before CMS initialization`,
    object: commitSha,
    type: 'commit',
  });
  // Create ref pointing to the tag
  await octokit.git.createRef({ owner, repo, ref: `refs/tags/${tagName}`, sha: tagObj.sha });
  return tagObj.sha;
}

module.exports = { createOctokit, getToken, getFile, listFiles, listFilesRecursive, upsertFile, deleteFile, listUserRepos, validateToken, createRepo, enablePages, createTag };
