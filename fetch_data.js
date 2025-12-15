const fs = require('fs');

const REPOS = [
    'smallyunet/echoevm',
    'smallyunet/safe-kit',
    'smallyunet/finder-sight',
    'smallyunet/privy-wallet-kit',
    'smallyunet/userop-validator',
    'smallyunet/etherflow',
    'smallyunet/go-cggmp-tss',
    'smallyunet/ethbft'
];

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchWithAuth(url) {
    const headers = GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {};
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response;
}

async function fetchRepoData(repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    try {
        const [repoRes, lastCommitRes, releasesRes, workflowRunsRes, tagsRes] = await Promise.all([
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=3`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=1`)
        ]);

        const repoData = await repoRes.json();
        const lastCommitData = await lastCommitRes.json();
        const releasesData = await releasesRes.json();
        const workflowRunsData = await workflowRunsRes.json();
        const tagsData = await tagsRes.json();

        if (Array.isArray(lastCommitData) && lastCommitData.length > 0) {
            repoData.last_commit_date = lastCommitData[0].commit.author.date;
        }

        return {
            repo: repoData,
            lastCommit: Array.isArray(lastCommitData) && lastCommitData.length > 0 ? lastCommitData[0] : null,
            releases: Array.isArray(releasesData) ? releasesData : [],
            workflowRuns: Array.isArray(workflowRunsData.workflow_runs) ? workflowRunsData.workflow_runs : [],
            latestTag: Array.isArray(tagsData) && tagsData.length > 0 ? tagsData[0] : null
        };
    } catch (error) {
        console.error(`Error fetching data for ${repoFullName}:`, error);
        return {
            repo: {
                name: repo,
                full_name: repoFullName,
                error: true,
                error_message: error.message
            },
            lastCommit: null,
            releases: [],
            workflowRuns: [],
            latestTag: null
        };
    }
}

async function main() {
    const repoPromises = REPOS.map(repo => fetchRepoData(repo));
    const results = await Promise.all(repoPromises);

    const repos = results.map(r => {
        const repo = r.repo;
        if (r.latestTag) {
            repo.latest_tag = r.latestTag;
        }
        if (r.workflowRuns && Array.isArray(r.workflowRuns) && r.workflowRuns.length > 0 && r.lastCommit) {
            // Get all workflow runs for the latest commit
            const latestCommitSha = r.lastCommit.sha;
            const latestCommitRuns = r.workflowRuns.filter(run => run.head_sha === latestCommitSha);
            
            if (latestCommitRuns.length > 0) {
                repo.latest_workflow_runs = latestCommitRuns;
                repo.latest_workflow_run = latestCommitRuns[0]; // Keep for backward compatibility
            } else {
                // Fallback to the most recent run if no runs match the latest commit
                repo.latest_workflow_run = r.workflowRuns[0];
                repo.latest_workflow_runs = [r.workflowRuns[0]];
            }
        } else if (r.workflowRuns && Array.isArray(r.workflowRuns) && r.workflowRuns.length > 0) {
            repo.latest_workflow_run = r.workflowRuns[0];
            repo.latest_workflow_runs = [r.workflowRuns[0]];
        }
        return repo;
    });

    let allActivity = [];
    results.forEach(r => {
        if (r.workflowRuns && Array.isArray(r.workflowRuns)) {
            allActivity.push(...r.workflowRuns.map(run => ({
                type: 'workflow',
                repo: r.repo.name,
                date: run.created_at, // Keep as string for JSON
                data: run
            })));
        }
        if (r.releases && Array.isArray(r.releases)) {
            allActivity.push(...r.releases.map(rel => ({
                type: 'release',
                repo: r.repo.name,
                date: rel.published_at, // Keep as string for JSON
                data: rel
            })));
        }
    });

    allActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
    allActivity = allActivity.slice(0, 20);

    const data = {
        timestamp: Date.now(),
        repos,
        activity: allActivity
    };

    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    console.log('Data saved to data.json');
}

main();
