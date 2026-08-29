/**
 * Helper to parse a GitLab repository URL.
 * Accepts: https://gitlab.com/owner/repo and https://gitlab.com/owner/repo/-/tree/branch
 * Default branch: "main"
 */
export function parseGitLabUrl(url: string): { owner: string; repo: string; branch: string } {
  try {
    let cleanUrl = url.trim();
    
    // If user entered only "owner/repo" or "owner/repo.git", prefix it to form a valid URL
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      const parts = cleanUrl.split('/');
      if (parts.length >= 2) {
        cleanUrl = 'https://gitlab.com/' + cleanUrl;
      } else {
        throw new Error('Please enter a complete GitLab URL or "owner/repo" pattern.');
      }
    } else if (cleanUrl.startsWith('http://')) {
      cleanUrl = 'https://' + cleanUrl.slice(7);
    }

    let parsed: URL;
    try {
      parsed = new URL(cleanUrl);
    } catch {
      throw new Error('Please enter a valid absolute URL format.');
    }

    if (parsed.hostname !== 'gitlab.com' && parsed.hostname !== 'www.gitlab.com') {
      throw new Error('Not a GitLab URL');
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new Error('Incomplete GitLab URL');
    }

    const owner = parts[0];
    // GitLab supports nested subgroups, so let's join all preceding parts before the actual project repository
    let repo = parts[parts.indexOf('-') !== -1 ? parts.indexOf('-') - 1 : parts.length - 1] || parts[1];
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }
    let branch = 'main';

    const treeIdx = parts.indexOf('tree');
    if (parts.includes('-') && treeIdx !== -1 && parts[treeIdx + 1]) {
      branch = parts.slice(treeIdx + 1).join('/');
    }

    return { owner, repo, branch };
  } catch (error: any) {
    throw new Error(`Invalid GitLab URL: ${error?.message || error}`);
  }
}

/**
 * Recursive paginated call fetching the GitLab repository files list.
 * Filtered to .js .ts .jsx .tsx only, excluding node_modules .next dist build .git
 * GET https://gitlab.com/api/v4/projects/{encoded_path}/repository/tree?recursive=true&ref={branch}&per_page=100
 */
export async function fetchGitLabRepositoryTree(owner: string, repo: string, branch: string): Promise<string[]> {
  const projectPathEncoded = encodeURIComponent(`${owner}/${repo}`);
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
  let page = 1;
  let hasMore = true;

  const headers: Record<string, string> = {
    'User-Agent': 'Tech-Debt-Dashboard-GitLab'
  };

  if (process.env.GITLAB_TOKEN) {
    headers['PRIVATE-TOKEN'] = process.env.GITLAB_TOKEN;
  }

  while (hasMore) {
    const url = `https://gitlab.com/api/v4/projects/${projectPathEncoded}/repository/tree?recursive=true&ref=${branch}&per_page=100&page=${page}`;
    
    const response = await fetch(url, { headers, cache: 'no-store' });

    if (!response.ok) {
      let errMsg = `GitLab API error: ${response.statusText}`;
      try {
        const data = await response.json();
        if (data?.message) errMsg = data.message;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    const tree = await response.json();
    if (!Array.isArray(tree) || tree.length === 0) {
      hasMore = false;
      break;
    }

    for (const entry of tree) {
      if (entry.type !== 'blob') continue;
      const path: string = entry.path.toLowerCase();
      const isExcluded = excludedDirs.some(dir => path.startsWith(dir) || path.includes(`/${dir}`) || path === dir);
      const isBinary = binaryExtensions.some(ext => path.endsWith(ext));

      if (!isExcluded && !isBinary) {
        files.push(entry.path);
      }
    }

    // GitLab exposes pagination state in header 'X-Next-Page' or simply page through if 100 items returned
    const nextPageHeader = response.headers.get('X-Next-Page');
    if (nextPageHeader && nextPageHeader !== '') {
      page = parseInt(nextPageHeader);
    } else {
      if (tree.length === 100) {
        page++;
      } else {
        hasMore = false;
      }
    }
  }

  return files;
}

/**
 * Downloads raw file contents directly from GitLab API.
 * GET https://gitlab.com/api/v4/projects/{encoded_path}/repository/files/{encoded_filepath}/raw?ref={branch}
 * Returns null if file > 1MB or any error.
 */
export async function downloadGitLabFileContents(
  owner: string, 
  repo: string, 
  filepath: string, 
  branch: string
): Promise<string | null> {
  const projectPathEncoded = encodeURIComponent(`${owner}/${repo}`);
  const filePathEncoded = encodeURIComponent(filepath);
  
  const headers: Record<string, string> = {
    'User-Agent': 'Tech-Debt-Dashboard-GitLab'
  };

  if (process.env.GITLAB_TOKEN) {
    headers['PRIVATE-TOKEN'] = process.env.GITLAB_TOKEN;
  }

  try {
    // First query file metadata to assert size limits
    const metadataUrl = `https://gitlab.com/api/v4/projects/${projectPathEncoded}/repository/files/${filePathEncoded}?ref=${branch}`;
    const metaResponse = await fetch(metadataUrl, { headers, cache: 'no-store' });
    
    if (!metaResponse.ok) {
      return null;
    }

    const meta = await metaResponse.json();
    if (meta.size > 1024 * 1024) { // 1 MB limit
      console.warn(`Warning: GitLab file ${filepath} exceeds 1MB. Skipping download.`);
      return null;
    }

    // Now retrieve raw data content
    const rawUrl = `https://gitlab.com/api/v4/projects/${projectPathEncoded}/repository/files/${filePathEncoded}/raw?ref=${branch}`;
    const rawResponse = await fetch(rawUrl, { headers, cache: 'no-store' });
    
    if (!rawResponse.ok) {
      return null;
    }

    return await rawResponse.text();

  } catch (error) {
    console.error(`Failed to download GitLab file ${filepath}:`, error);
    return null;
  }
}
export default parseGitLabUrl;
