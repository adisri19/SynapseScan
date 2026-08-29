export function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } {
  // Accepted formats: https://github.com/owner/repo, https://github.com/owner/repo/tree/branch, etc.
  try {
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('http://')) {
      cleanUrl = 'https://' + cleanUrl.slice(7);
    }
    const parsed = new URL(cleanUrl);
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
      throw new Error('Not a GitHub URL');
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new Error('Incomplete GitHub URL');
    }

    const owner = parts[0];
    let repo = parts[1];
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }
    let branch = 'main';

    if (parts[2] === 'tree' && parts[3]) {
      branch = parts.slice(3).join('/');
    }

    return { owner, repo, branch };
  } catch (error: any) {
    throw new Error(`Invalid GitHub URL: ${error?.message || error}`);
  }
}

export async function fetchRepositoryTree(owner: string, repo: string, branch: string): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Tech-Debt-Dashboard'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let activeBranch = branch;
  let url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${activeBranch}?recursive=1`;
  let response = await fetch(url, { headers, cache: 'no-store' });

  // If initial branch fetch fails with 404, query the repo metadata for its actual default_branch
  if (!response.ok && response.status === 404) {
    try {
      const repoMetaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers, cache: 'no-store' });
      if (repoMetaRes.ok) {
        const repoMeta = await repoMetaRes.json();
        if (repoMeta.default_branch && repoMeta.default_branch !== activeBranch) {
          activeBranch = repoMeta.default_branch;
          url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${activeBranch}?recursive=1`;
          response = await fetch(url, { headers, cache: 'no-store' });
        }
      }
    } catch {
      // Fall through to standard error handling
    }
  }

  if (!response.ok) {
    let errMsg = `GitHub API error: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data?.message) {
        errMsg = data.message;
      }
    } catch {
      // Ignored
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  if (data.truncated) {
    console.warn(`Warning: GitHub tree was truncated for repository ${owner}/${repo} on branch ${branch}.`);
  }

  const tree = data.tree || [];
  const excludedDirs = [
    'node_modules/', '.next/', 'dist/', 'build/', '.git/', 'bin/', 'obj/', 'vendor/',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'gradlew', '.gradle/'
  ];
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.pdf', '.zip', '.gz', '.tar',
    '.exe', '.dll', '.dmg', '.mp4', '.mp3', '.mov', '.woff', '.woff2', '.ttf', '.eot',
    '.map', '.wasm', '.jar', '.class', '.pyc', '.pyo', '.db', '.sqlite', '.ds_store'
  ];

  const files: string[] = [];

  for (const entry of tree) {
    if (entry.type !== 'blob') continue;
    const path: string = entry.path.toLowerCase();
    
    const isExcluded = excludedDirs.some(dir => path.startsWith(dir) || path.includes(`/${dir}`) || path === dir);
    const isBinary = binaryExtensions.some(ext => path.endsWith(ext));

    if (!isExcluded && !isBinary) {
      // Push original (case-sensitive) path
      files.push(entry.path);
    }
  }

  return files;
}

export async function downloadFileContents(owner: string, repo: string, filepath: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Tech-Debt-Dashboard'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.size > 1024 * 1024) { // 1 MB limit
      console.warn(`Warning: File ${filepath} in ${owner}/${repo} exceeds 1MB. Skipping download.`);
      return null;
    }

    if (data.content && data.encoding === 'base64') {
      const cleanedContent = data.content.replace(/\s/g, '');
      const decoded = Buffer.from(cleanedContent, 'base64').toString('utf-8');
      return decoded;
    }

    return null;
  } catch (error) {
    console.error(`Failed to download file ${filepath}:`, error);
    return null;
  }
}
