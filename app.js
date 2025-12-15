// Repository list to monitor
const REPOS = [
    'smallyunet/echoevm',
    'smallyunet/safe-kit',
    'smallyunet/finder-sight',
    'smallyunet/privy-wallet-kit',
    'smallyunet/userop-validator',
    'smallyunet/etherflow',
    'smallyunet/go-cggmp-tss'
];

// Language colors (from GitHub)
const LANGUAGE_COLORS = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#3178c6',
    'Python': '#3572A5',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'Java': '#b07219',
    'C++': '#f34b7d',
    'C': '#555555',
    'Ruby': '#701516',
    'PHP': '#4F5D95',
    'Swift': '#F05138',
    'Kotlin': '#A97BFF',
    'Scala': '#c22d40',
    'Shell': '#89e051',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Solidity': '#AA6746',
    'Vue': '#41b883',
    'Dart': '#00B4AB'
};

// State
let state = {
    repos: [],
    activity: [],
    sortBy: 'updated',
    loading: false
};

// Cache Config
const CACHE_KEY = 'dashboard_data';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// DOM Elements
const elements = {
    lastUpdated: document.getElementById('last-updated'),
    refreshBtn: document.getElementById('refresh-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeModalBtn: document.querySelector('.close-modal'),
    saveTokenBtn: document.getElementById('save-token-btn'),
    githubTokenInput: document.getElementById('github-token'),
    totalStars: document.getElementById('total-stars'),
    totalForks: document.getElementById('total-forks'),
    totalRepos: document.getElementById('total-repos'),
    totalIssues: document.getElementById('total-issues'),
    reposContainer: document.getElementById('repos-container'),
    activityTimeline: document.getElementById('activity-timeline'),
    sortSelect: document.getElementById('sort-select'),
    navItems: document.querySelectorAll('.nav-item')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load token if exists
    const token = localStorage.getItem('github_token');
    if (token) {
        elements.githubTokenInput.value = token;
    }

    initDashboard();
    setupEventListeners();

    // Auto refresh every 10 minutes
    setInterval(() => {
        if (!state.loading) {
            console.log('Auto-refreshing data...');
            initDashboard();
        }
    }, 600000);
});

function setupEventListeners() {
    // Refresh
    elements.refreshBtn.addEventListener('click', () => {
        initDashboard(true); // Force refresh
    });

    // Settings Modal
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsModal.classList.add('active');
    });

    elements.closeModalBtn.addEventListener('click', () => {
        elements.settingsModal.classList.remove('active');
    });

    elements.saveTokenBtn.addEventListener('click', () => {
        const token = elements.githubTokenInput.value.trim();
        if (token) {
            localStorage.setItem('github_token', token);
        } else {
            localStorage.removeItem('github_token');
        }
        elements.settingsModal.classList.remove('active');
        initDashboard(true); // Refresh with new token
    });

    // Close modal on outside click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            elements.settingsModal.classList.remove('active');
        }
    });

    // Sort
    elements.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderRepositories();
    });
}

async function initDashboard(forceRefresh = false) {
    setLoading(true);
    try {
        if (!forceRefresh) {
            const cachedData = loadFromCache();
            if (cachedData) {
                console.log('Loading from cache...');
                state.repos = cachedData.repos;
                state.activity = cachedData.activity;
                updateStats();
                renderRepositories();
                renderActivity();
                updateLastUpdated(new Date(cachedData.timestamp));
                setLoading(false);
                return;
            }
        }

        await fetchAllData();
        
        // Save to cache
        saveToCache({
            repos: state.repos,
            activity: state.activity
        });

        updateStats();
        renderRepositories();
        renderActivity();
        updateLastUpdated();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        if (error.message.includes('rate limit')) {
            alert(error.message);
            elements.settingsModal.classList.add('active');
        } else {
            alert('Failed to load dashboard data. Check console for details.');
        }
    } finally {
        setLoading(false);
    }
}

function loadFromCache() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    try {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) return null;
        return { ...data, timestamp };
    } catch (e) {
        return null;
    }
}

function saveToCache(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data
    }));
}

function getAuthHeaders() {
    const token = localStorage.getItem('github_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function fetchWithAuth(url) {
    const headers = getAuthHeaders();
    const response = await fetch(url, { headers });
    
    if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        if (rateLimitRemaining === '0') {
            throw new Error('API rate limit exceeded. Please add a GitHub token in settings.');
        }
    }
    
    return response;
}

function setLoading(isLoading) {
    state.loading = isLoading;
    const icon = elements.refreshBtn.querySelector('i');
    
    if (isLoading) {
        icon.classList.add('fa-spin');
        elements.refreshBtn.disabled = true;
        
        // Show loading spinner in containers if they are empty
        const spinner = '<div class="loading-spinner"><i class="fas fa-circle-notch"></i></div>';
        if (!state.repos.length) {
            elements.reposContainer.innerHTML = spinner;
            elements.activityTimeline.innerHTML = spinner;
        }
    } else {
        icon.classList.remove('fa-spin');
        elements.refreshBtn.disabled = false;
    }
}

async function fetchAllData() {
    const repoPromises = REPOS.map(repo => fetchRepoData(repo));
    const results = await Promise.all(repoPromises);
    
    state.repos = results.map(r => r.repo);
    
    // Collect activity from all repos
    let allActivity = [];
    results.forEach(r => {
        // Add workflow runs to activity
        if (r.workflowRuns && Array.isArray(r.workflowRuns)) {
            allActivity.push(...r.workflowRuns.map(run => ({
                type: 'workflow',
                repo: r.repo.name,
                date: new Date(run.created_at),
                data: run
            })));
        }
        if (r.releases && Array.isArray(r.releases)) {
            allActivity.push(...r.releases.map(rel => ({
                type: 'release',
                repo: r.repo.name,
                date: new Date(rel.published_at),
                data: rel
            })));
        }
    });

    // Sort activity by date desc
    state.activity = allActivity.sort((a, b) => b.date - a.date).slice(0, 20);
}

async function fetchRepoData(repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    try {
        const [repoRes, lastCommitRes, releasesRes, workflowRunsRes] = await Promise.all([
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=3`),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`)
        ]);

        if (!repoRes.ok) {
            throw new Error(`GitHub API returned ${repoRes.status}`);
        }

        const repoData = await repoRes.json();
        
        // Handle optional data gracefully
        const lastCommitData = lastCommitRes.ok ? await lastCommitRes.json() : [];
        const releasesData = releasesRes.ok ? await releasesRes.json() : [];
        const workflowRunsData = workflowRunsRes.ok ? await workflowRunsRes.json() : { workflow_runs: [] };

        // Add last commit time to repo data
        if (Array.isArray(lastCommitData) && lastCommitData.length > 0) {
            repoData.last_commit_date = lastCommitData[0].commit.author.date;
        }

        return {
            repo: repoData,
            lastCommit: Array.isArray(lastCommitData) && lastCommitData.length > 0 ? lastCommitData[0] : null,
            releases: Array.isArray(releasesData) ? releasesData : [],
            workflowRuns: Array.isArray(workflowRunsData.workflow_runs) ? workflowRunsData.workflow_runs : []
        };
    } catch (error) {
        console.error(`Error fetching data for ${repoFullName}:`, error);
        // Propagate rate limit errors
        if (error.message.includes('rate limit')) {
            throw error;
        }
        return { 
            repo: { 
                name: repo, 
                full_name: repoFullName, 
                error: true,
                error_message: error.message
            }, 
            lastCommit: null, 
            releases: [],
            workflowRuns: []
        };
    }
}

function updateStats() {
    const stats = state.repos.reduce((acc, repo) => {
        if (repo.error) return acc;
        acc.stars += repo.stargazers_count || 0;
        acc.forks += repo.forks_count || 0;
        acc.issues += repo.open_issues_count || 0;
        return acc;
    }, { stars: 0, forks: 0, issues: 0 });

    elements.totalStars.textContent = stats.stars;
    elements.totalForks.textContent = stats.forks;
    elements.totalIssues.textContent = stats.issues;
    elements.totalRepos.textContent = state.repos.length;
}

function renderOverview() {
    // Top 3 repos by stars
    const topRepos = [...state.repos]
        .filter(r => !r.error)
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 3);

    if (topRepos.length === 0) {
        elements.topReposContainer.innerHTML = '<div class="empty-state">No repositories found.</div>';
        return;
    }

    elements.topReposContainer.innerHTML = topRepos.map(createRepoCard).join('');
}

function renderRepositories() {
    console.log('Sorting by:', state.sortBy);
    let sortedRepos = [...state.repos];
    
    switch (state.sortBy) {
        case 'stars':
            sortedRepos.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
            break;
        case 'forks':
            sortedRepos.sort((a, b) => (b.forks_count || 0) - (a.forks_count || 0));
            break;
        case 'created':
            sortedRepos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'updated':
        default:
            sortedRepos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            break;
    }

    if (sortedRepos.length === 0) {
        elements.reposContainer.innerHTML = '<div class="empty-state">No repositories found.</div>';
        return;
    }

    elements.reposContainer.innerHTML = sortedRepos.map(createRepoCard).join('');
}

function createRepoCard(repo) {
    if (repo.error) {
        return `
            <div class="repo-card error-card">
                <div class="repo-header">
                    <span class="repo-name">
                        <i class="fas fa-exclamation-triangle"></i> ${repo.full_name}
                    </span>
                </div>
                <p class="repo-description">
                    Failed to load data. ${repo.error_message || 'Check your connection or API rate limits.'}
                </p>
            </div>
        `;
    }

    const langColor = LANGUAGE_COLORS[repo.language] || '#ccc';
    const updatedDate = new Date(repo.updated_at).toLocaleDateString();
    const lastCommitDate = repo.last_commit_date ? new Date(repo.last_commit_date).toLocaleDateString() : 'N/A';

    return `
        <div class="repo-card">
            <div class="repo-header">
                <a href="${repo.html_url}" target="_blank" class="repo-name">
                    <i class="fas fa-book-bookmark"></i> ${repo.name}
                </a>
                <span class="repo-visibility">${repo.visibility || 'public'}</span>
            </div>
            <p class="repo-description">${repo.description || 'No description available'}</p>
            <div class="repo-stats">
                <div class="repo-stat" title="Stars">
                    <i class="far fa-star"></i> ${repo.stargazers_count}
                </div>
                <div class="repo-stat" title="Forks">
                    <i class="fas fa-code-branch"></i> ${repo.forks_count}
                </div>
                <div class="repo-stat" title="Open Issues">
                    <i class="far fa-circle-dot"></i> ${repo.open_issues_count}
                </div>
            </div>
            <div class="repo-footer">
                <div class="repo-lang">
                    <span class="language-dot" style="background-color: ${langColor}"></span>
                    ${repo.language || 'Unknown'}
                </div>
                <div class="repo-updated">
                    Last commit: ${lastCommitDate}
                </div>
            </div>
        </div>
    `;
}

function renderActivity() {
    if (state.activity.length === 0) {
        elements.activityTimeline.innerHTML = '<div class="empty-state">No recent activity found.</div>';
        return;
    }

    elements.activityTimeline.innerHTML = state.activity.map(item => {
        const date = item.date.toLocaleDateString() + ' ' + item.date.toLocaleTimeString();
        let content = '';
        let icon = '';
        let statusClass = '';

        if (item.type === 'workflow') {
            const status = item.data.conclusion || item.data.status;
            const statusIcon = getWorkflowStatusIcon(status);
            statusClass = getWorkflowStatusClass(status);
            content = `Workflow run: <a href="${item.data.html_url}" target="_blank" style="color: var(--accent-primary)">${item.data.name}</a> - <span class="${statusClass}">${status}</span>`;
            icon = statusIcon;
        } else if (item.type === 'release') {
            content = `Published release: <a href="${item.data.html_url}" target="_blank" style="color: var(--accent-secondary)">${item.data.name || item.data.tag_name}</a>`;
            icon = '<i class="fas fa-tag"></i>';
        }

        return `
            <div class="timeline-item">
                <div class="timeline-header">
                    <span class="timeline-repo">${item.repo}</span>
                    <span class="timeline-date">${date}</span>
                </div>
                <div class="timeline-content">
                    ${icon} ${content}
                </div>
            </div>
        `;
    }).join('');
}

function getWorkflowStatusIcon(status) {
    switch (status) {
        case 'success':
            return '<i class="fas fa-check-circle" style="color: #22c55e"></i>';
        case 'failure':
            return '<i class="fas fa-times-circle" style="color: #ef4444"></i>';
        case 'cancelled':
            return '<i class="fas fa-ban" style="color: #f59e0b"></i>';
        case 'in_progress':
        case 'queued':
        case 'waiting':
            return '<i class="fas fa-circle-notch fa-spin" style="color: #3b82f6"></i>';
        default:
            return '<i class="fas fa-circle" style="color: #6b7280"></i>';
    }
}

function getWorkflowStatusClass(status) {
    switch (status) {
        case 'success':
            return 'status-success';
        case 'failure':
            return 'status-failure';
        case 'cancelled':
            return 'status-cancelled';
        case 'in_progress':
        case 'queued':
        case 'waiting':
            return 'status-pending';
        default:
            return 'status-unknown';
    }
}

function updateLastUpdated() {
    const now = new Date();
    elements.lastUpdated.textContent = `Updated: ${now.toLocaleTimeString()}`;
}
