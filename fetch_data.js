const fs = require('fs');

// Load Repos from config
// Load Repos from config
let REPOS_CONFIG = {};
try {
    REPOS_CONFIG = require('./repos.json');
} catch (e) {
    console.error('Failed to load repos.json. Please ensure it exists.');
    process.exit(1);
}


const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchWithAuth(url) {
    const headers = {
        'User-Agent': 'Side-Project-Dashboard',
        ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {})
    };
    const response = await fetch(url, { headers });

    // Check for rate limit
    if (response.status === 403 || response.status === 429) {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const limit = response.headers.get('x-ratelimit-limit');
        const remaining = response.headers.get('x-ratelimit-remaining');

        console.error('GitHub API Rate Limit Hit!');
        console.error(`Limit: ${limit}, Remaining: ${remaining}`);

        if (resetTime) {
            const resetDate = new Date(resetTime * 1000);
            console.error(`Rate limit resets at: ${resetDate.toISOString()}`);
        }

        // Fail the action
        process.exit(1);
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response;
}

async function fetchPyPiData(packageName) {
    try {
        const res = await fetch(`https://pypi.org/pypi/${packageName}/json`);
        if (res.status === 404) return null;
        // if (!res.ok) return null; 
        if (!res.ok) throw new Error(`PyPI status: ${res.status}`);

        const data = await res.json();
        return {
            type: 'pypi',
            name: packageName,
            version: data.info.version,
            url: data.info.package_url
        };
    } catch (e) {
        return null;
    }
}

async function fetchNpmData(packageName) {
    try {
        const res = await fetch(`https://registry.npmjs.org/${packageName}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`NPM status: ${res.status}`);

        const data = await res.json();
        const latest = data['dist-tags']?.latest;
        if (!latest) return null;

        return {
            type: 'npm',
            name: packageName,
            version: latest,
            url: `https://www.npmjs.com/package/${packageName}`
        };
    } catch (e) {
        return null;
    }
}

async function fetchCratesData(packageName) {
    try {
        const res = await fetch(`https://crates.io/api/v1/crates/${packageName}`, {
            headers: {
                'User-Agent': 'Side-Project-Dashboard'
            }
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Crates.io status: ${res.status}`);

        const data = await res.json();
        const version = data.crate.max_version;

        return {
            type: 'crates',
            name: packageName,
            version: version,
            url: `https://crates.io/crates/${packageName}`
        };
    } catch (e) {
        return null;
    }
}

async function fetchVscodeMarketplaceData(publisherName, extensionName) {
    try {
        const res = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json;api-version=3.0-preview.1'
            },
            body: JSON.stringify({
                filters: [{
                    criteria: [
                        { filterType: 7, value: `${publisherName}.${extensionName}` }
                    ]
                }],
                flags: 914
            })
        });

        if (!res.ok) return null;

        const data = await res.json();
        const extension = data.results?.[0]?.extensions?.[0];

        if (!extension) return null;

        const installStat = extension.statistics?.find(s => s.statisticName === 'install');

        return {
            type: 'vscode',
            name: extension.displayName || extensionName,
            version: extension.versions?.[0]?.version,
            url: `https://marketplace.visualstudio.com/items?itemName=${publisherName}.${extensionName}`,
            installs: installStat?.value || 0
        };
    } catch (e) {
        return null;
    }
}

async function fetchOpenVsxData(publisherName, extensionName) {
    try {
        const res = await fetch(`https://open-vsx.org/api/${publisherName}/${extensionName}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!res.ok) return null;

        const data = await res.json();

        // Check if extension exists (error field indicates not found)
        if (data.error) return null;

        return {
            type: 'openvsx',
            name: data.displayName || extensionName,
            version: data.version,
            url: `https://open-vsx.org/extension/${publisherName}/${extensionName}`,
            downloads: data.downloadCount || 0
        };
    } catch (e) {
        return null;
    }
}

async function fetchRepoData(repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    try {
        const [repoRes, lastCommitRes, releasesRes, workflowRunsRes, tagsRes] = await Promise.all([
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=1`), // Reduced to 1
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=5`), // Reduced to 5
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=1`)
        ]);

        const repoData = await repoRes.json();
        const lastCommitData = await lastCommitRes.json();
        // const releasesData = await releasesRes.json(); // Not using releases list anymore in app.js
        const workflowRunsData = await workflowRunsRes.json();
        const tagsData = await tagsRes.json();

        // Extract last commit date
        let lastCommitDate = null;
        if (Array.isArray(lastCommitData) && lastCommitData.length > 0) {
            lastCommitDate = lastCommitData[0].commit.author.date;
        }

        // Extract commit count
        let commitCount = 0;
        const linkHeader = lastCommitRes.headers.get('Link');
        if (linkHeader) {
            const matches = linkHeader.match(/&page=(\d+)>; rel="last"/);
            if (matches && matches[1]) {
                commitCount = parseInt(matches[1], 10);
            }
        } else if (Array.isArray(lastCommitData)) {
            // Fallback for small repos (only 1 page)
            // If the array is full (length == 1), and no link header, it means there is exactly 1 commit... 
            // actually if per_page=1, no link header means ONLY 1 commit total.
            // If per_page was default (30), no link header means <= 30 commits.
            // Since we use per_page=1, if there is data but no link header, it's 1 commit.
            // But wait, if there are 0 commits, the array is empty.
            // If there's 1 commit: array length 1. Is there a link header for page 1? usually no if only 1 page.
            if (lastCommitData.length > 0) {
                commitCount = 1; // At least one, and no pagination means exactly one page of 1.
            }
        }

        // Process Workflow Runs (Minified)
        let relevantRuns = [];
        let latestRun = null;
        if (workflowRunsData.workflow_runs && Array.isArray(workflowRunsData.workflow_runs) && workflowRunsData.workflow_runs.length > 0) {
            // Filter relevant fields
            const runs = workflowRunsData.workflow_runs.map(run => ({
                name: run.name,
                status: run.status,
                conclusion: run.conclusion,
                html_url: run.html_url,
                head_sha: run.head_sha,
                created_at: run.created_at
            }));

            // Match with latest commit if possible
            if (lastCommitData.length > 0) {
                const latestSha = lastCommitData[0].sha;
                const commitRuns = runs.filter(r => r.head_sha === latestSha);
                if (commitRuns.length > 0) {
                    relevantRuns = commitRuns;
                } else {
                    relevantRuns = [runs[0]];
                }
            } else {
                relevantRuns = [runs[0]];
            }
        }

        // Process Latest Tag (Minified)
        let latestTag = null;
        if (Array.isArray(tagsData) && tagsData.length > 0) {
            latestTag = {
                name: tagsData[0].name
            };
        }

        // Fetch Package Info (PyPI, NPM, Crates, VS Code extensions)
        let packageInfo = null;
        const lang = repoData.language;
        try {
            // Check for VS Code extensions first (repo name starts with 'vscode-')
            if (repoData.name.startsWith('vscode-')) {
                // Use 'smallyu' as publisher if owner is 'smallyunet', otherwise use owner
                const publisher = owner === 'smallyunet' ? 'smallyu' : owner;

                // Try both VS Code Marketplace and Open VSX in parallel
                const [vscode, openvsx] = await Promise.all([
                    fetchVscodeMarketplaceData(publisher, repoData.name),
                    fetchOpenVsxData(publisher, repoData.name)
                ]);

                // Store both if available, otherwise whichever is found
                const extensions = [vscode, openvsx].filter(Boolean);
                if (extensions.length > 0) {
                    packageInfo = extensions.length === 1 ? extensions[0] : extensions;
                }
            } else if (lang === 'Python') {
                const pypi = await fetchPyPiData(repoData.name);
                if (pypi) packageInfo = pypi;
            } else if (lang === 'JavaScript' || lang === 'TypeScript') {
                // Try repo name directly
                let npm = await fetchNpmData(repoData.name);
                // logic to try variants? For now, just repo name.
                if (npm) packageInfo = npm;
            } else if (lang === 'Rust') {
                const crates = await fetchCratesData(repoData.name);
                if (crates) packageInfo = crates;
            }
        } catch (pkgErr) {
            console.warn(`Error checking package info for ${repoData.name}:`, pkgErr.message);
        }

        // Construct Minified Repo Object
        return {
            name: repoData.name,
            full_name: repoData.full_name,
            html_url: repoData.html_url,
            description: repoData.description,
            language: repoData.language,
            stargazers_count: repoData.stargazers_count,
            forks_count: repoData.forks_count,
            open_issues_count: repoData.open_issues_count,
            visibility: repoData.visibility,
            updated_at: repoData.updated_at,
            created_at: repoData.created_at,
            last_commit_date: lastCommitDate,
            latest_tag: latestTag,
            latest_workflow_runs: relevantRuns,
            package_info: packageInfo,
            homepage: repoData.homepage,
            has_pages: repoData.has_pages,
            commit_count: commitCount,
            topics: repoData.topics || [],
            license: repoData.license
        };

    } catch (error) {
        console.error(`Error fetching data for ${repoFullName}:`, error);
        return {
            name: repo,
            full_name: repoFullName,
            error: true,
            error_message: error.message
        };
    }
}

async function main() {
    console.log('Fetching data...');
    const results = [];

    // Iterate through categories
    for (const [category, repos] of Object.entries(REPOS_CONFIG)) {
        console.log(`Processing category: ${category} (${repos.length} repos)`);
        for (const repo of repos) {
            const data = await fetchRepoData(repo);
            // Attach category to the repo data
            data.category = category;
            results.push(data);
        }
    }

    // Filter out nulls if any (though fetchRepoData returns error objects)
    const validRepos = results;

    const data = {
        timestamp: Date.now(),
        repos: validRepos
    };

    const outputPath = 'data.json';
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    // Get stats
    const stats = fs.statSync(outputPath);
    const sizeKeys = stats.size / 1024;

    console.log(`Data saved to ${outputPath}`);
    console.log(`Total size: ${sizeKeys.toFixed(2)} KB`);
}

main();
