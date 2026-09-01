// 後台存檔後，把內容與產生的頁面 commit 回 GitHub。
//
// 需要的環境變數（沒設就整個功能停用，網站照常運作）：
//   GITHUB_TOKEN         有該 repo「Contents: read and write」權限的 token
//   GITHUB_REPO          owner/repo，例如 by5947373-alt/my-first-site
//   GITHUB_BRANCH        預設 main
//   GITHUB_PATH_PREFIX   網站在 repo 裡的子目錄，例如 shuishang/（預設空字串）
//   SYNC_DELAY_MS        最後一次修改後隔多久才推，預設 600000（10 分鐘）
//
// 用延遲合併是因為每次 push 都會觸發 Zeabur 重新部署 —— 連續編輯時
// 只會在你停手之後推一次，而不是每按一次儲存就重啟一次網站。
const API = 'https://api.github.com';

/** 'shuishang' / '/shuishang/' → 'shuishang/'；空值 → ''。 */
function normPrefix(v) {
  const t = (v || '').replace(/^\/+|\/+$/g, '');
  return t ? t + '/' : '';
}

export const cfg = {
  token: process.env.GITHUB_TOKEN || '',
  repo: process.env.GITHUB_REPO || '',
  branch: process.env.GITHUB_BRANCH || 'main',
  prefix: normPrefix(process.env.GITHUB_PATH_PREFIX),
  delayMs: Number(process.env.SYNC_DELAY_MS || 600_000),
  authorName: process.env.SYNC_AUTHOR_NAME || '水上網站後台',
  authorEmail: process.env.SYNC_AUTHOR_EMAIL || 'noreply@users.noreply.github.com',
};
export const configured = () => !!(cfg.token && cfg.repo);

async function gh(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${cfg.token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'shuishang-site',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* 非 JSON 回應 */ }
  if (!res.ok) {
    const msg = body?.message || text.slice(0, 200) || res.statusText;
    const err = new Error(`GitHub ${res.status}：${msg}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/** 只讀不寫，用來確認設定是否正確。 */
export async function check() {
  if (!configured()) return { ok: false, reason: '未設定 GITHUB_TOKEN / GITHUB_REPO' };
  const repo = await gh(`/repos/${cfg.repo}`);
  const ref = await gh(`/repos/${cfg.repo}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
  return {
    ok: true,
    repo: repo.full_name,
    branch: cfg.branch,
    head: ref.object.sha.slice(0, 7),
    canWrite: repo.permissions?.push !== false,
    prefix: cfg.prefix || '(repo 根目錄)',
  };
}

/** files: { 'src/content.json': '…', 'index.html': '…' } —— 一次 commit，全有或全無。 */
export async function commitFiles(files, message) {
  const paths = Object.keys(files);
  if (!paths.length) return { skipped: '沒有檔案' };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ref = await gh(`/repos/${cfg.repo}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
      const baseSha = ref.object.sha;
      const baseCommit = await gh(`/repos/${cfg.repo}/git/commits/${baseSha}`);

      const tree = await gh(`/repos/${cfg.repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseCommit.tree.sha,
          tree: paths.map((p) => ({
            path: cfg.prefix + p, mode: '100644', type: 'blob', content: files[p],
          })),
        }),
      });

      // 內容和 base 完全一樣時 GitHub 會回同一個 tree sha —— 沒必要空 commit。
      if (tree.sha === baseCommit.tree.sha) return { skipped: '內容沒有變動' };

      const commit = await gh(`/repos/${cfg.repo}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({
          message, tree: tree.sha, parents: [baseSha],
          author: { name: cfg.authorName, email: cfg.authorEmail, date: new Date().toISOString() },
        }),
      });
      await gh(`/repos/${cfg.repo}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      return { sha: commit.sha.slice(0, 7), files: paths.length };
    } catch (e) {
      // 別人在這期間也推了東西 → 重抓一次 head 再試
      if (attempt === 1 && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}
