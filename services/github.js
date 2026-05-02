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
  return new Octokit({ auth: token || getToken() });
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
  return data.commit.sha;
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

module.exports = { createOctokit, getToken, getFile, listFiles, listFilesRecursive, upsertFile, deleteFile, listUserRepos, validateToken };
