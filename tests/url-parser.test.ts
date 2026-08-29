import { parseGitHubUrl } from '../lib/github';
import { parseGitLabUrl } from '../lib/gitlab';

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
    } catch (err: any) {
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
    } catch (err: any) {
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
