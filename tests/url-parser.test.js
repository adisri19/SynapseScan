// Self-contained regression test for URL parser logic
const url = require('url');

function parseGitHubUrl(repoUrl) {
  try {
    let cleanUrl = repoUrl.trim();
    
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      const parts = cleanUrl.split('/');
      if (parts.length >= 2) {
        cleanUrl = 'https://github.com/' + cleanUrl;
      } else {
        throw new Error('Please enter a complete GitHub URL or "owner/repo" pattern.');
      }
    } else if (cleanUrl.startsWith('http://')) {
      cleanUrl = 'https://' + cleanUrl.slice(7);
    }

    let parsed;
    try {
      parsed = new URL(cleanUrl);
    } catch {
      throw new Error('Please enter a valid absolute URL format.');
    }

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
  } catch (error) {
    throw new Error(`Invalid GitHub URL: ${error.message}`);
  }
}

function parseGitLabUrl(repoUrl) {
  try {
    let cleanUrl = repoUrl.trim();
    
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

    let parsed;
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
  } catch (error) {
    throw new Error(`Invalid GitLab URL: ${error.message}`);
  }
}

function runTests() {
  console.log('Running URL parser regression tests...\n');

  const testCasesGitHub = [
    {
      input: 'https://github.com/adisri19/SynapseScan',
      expected: { owner: 'adisri19', repo: 'SynapseScan', branch: 'main' }
    },
    {
      input: ' https://github.com/adisri19/SynapseScan.git ',
      expected: { owner: 'adisri19', repo: 'SynapseScan', branch: 'main' }
    },
    {
      input: 'https://www.github.com/adisri19/SynapseScan',
      expected: { owner: 'adisri19', repo: 'SynapseScan', branch: 'main' }
    },
    {
      input: 'http://github.com/adisri19/SynapseScan.git',
      expected: { owner: 'adisri19', repo: 'SynapseScan', branch: 'main' }
    },
    {
      input: 'https://github.com/owner/repo/tree/feature/auth',
      expected: { owner: 'owner', repo: 'repo', branch: 'feature/auth' }
    },
    {
      input: 'adisri19/SynapseScan',
      expected: { owner: 'adisri19', repo: 'SynapseScan', branch: 'main' }
    },
    {
      input: 'adisri19/SynapseScan.git',
      expected: { owner: 'adisri19', repo: 'SynapseScan', branch: 'main' }
    }
  ];

  const testCasesGitLab = [
    {
      input: 'https://gitlab.com/owner/repo',
      expected: { owner: 'owner', repo: 'repo', branch: 'main' }
    },
    {
      input: ' https://gitlab.com/owner/repo.git ',
      expected: { owner: 'owner', repo: 'repo', branch: 'main' }
    },
    {
      input: 'https://www.gitlab.com/owner/repo',
      expected: { owner: 'owner', repo: 'repo', branch: 'main' }
    },
    {
      input: 'http://gitlab.com/owner/repo.git',
      expected: { owner: 'owner', repo: 'repo', branch: 'main' }
    },
    {
      input: 'owner/repo',
      expected: { owner: 'owner', repo: 'repo', branch: 'main' }
    }
  ];

  let failures = 0;

  console.log('--- Testing GitHub URL Parser ---');
  testCasesGitHub.forEach((tc, idx) => {
    try {
      const res = parseGitHubUrl(tc.input);
      const isMatch = res.owner === tc.expected.owner &&
                      res.repo === tc.expected.repo &&
                      res.branch === tc.expected.branch;
      if (isMatch) {
        console.log(`✅ Test Case ${idx + 1} Passed`);
      } else {
        console.error(`❌ Test Case ${idx + 1} Failed: expected`, tc.expected, 'got', res);
        failures++;
      }
    } catch (err) {
      console.error(`❌ Test Case ${idx + 1} Threw Error:`, err.message);
      failures++;
    }
  });

  console.log('\n--- Testing GitLab URL Parser ---');
  testCasesGitLab.forEach((tc, idx) => {
    try {
      const res = parseGitLabUrl(tc.input);
      const isMatch = res.owner === tc.expected.owner &&
                      res.repo === tc.expected.repo &&
                      res.branch === tc.expected.branch;
      if (isMatch) {
        console.log(`✅ Test Case ${idx + 1} Passed`);
      } else {
        console.error(`❌ Test Case ${idx + 1} Failed: expected`, tc.expected, 'got', res);
        failures++;
      }
    } catch (err) {
      console.error(`❌ Test Case ${idx + 1} Threw Error:`, err.message);
      failures++;
    }
  });

  console.log('\n---------------------------------');
  if (failures === 0) {
    console.log('🎉 All URL parser regression tests passed successfully!');
    process.exit(0);
  } else {
    console.error(`⚠️ ${failures} test case failures occurred.`);
    process.exit(1);
  }
}

runTests();
