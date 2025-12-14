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

// DOM Elements
const elements = {
    lastUpdated: document.getElementById('last-updated'),
    refreshBtn: document.getElementById('refresh-btn'),
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
        initDashboard();
    });

    // Sort
    elements.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderRepositories();
    });
}

async function initDashboard() {
    setLoading(true);
    try {
        await fetchAllData();
        updateStats();
        renderRepositories();
        renderActivity();
        updateLastUpdated();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('Failed to load dashboard data. Check console for details.');
    } finally {
        setLoading(false);
    }
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
        if (r.commits && Array.isArray(r.commits)) {
            allActivity.push(...r.commits.map(c => ({
                type: 'commit',
                repo: r.repo.name,
                date: new Date(c.commit.author.date),
                data: c
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
        const [repoRes, commitsRes, releasesRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${owner}/${repo}`),
            fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`),
            fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=3`)
        ]);

        if (!repoRes.ok) {
            throw new Error(`GitHub API returned ${repoRes.status}`);
        }

        const repoData = await repoRes.json();
        
        // Handle optional data gracefully
        const commitsData = commitsRes.ok ? await commitsRes.json() : [];
        const releasesData = releasesRes.ok ? await releasesRes.json() : [];

        return {
            repo: repoData,
            commits: Array.isArray(commitsData) ? commitsData : [],
            releases: Array.isArray(releasesData) ? releasesData : []
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
            commits: [], 
            releases: [] 
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
                    Updated ${updatedDate}
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

        if (item.type === 'commit') {
            content = `Pushed commit: <a href="${item.data.html_url}" target="_blank" style="color: var(--accent-primary)">${item.data.commit.message}</a>`;
            icon = '<i class="fas fa-code-commit"></i>';
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

function updateLastUpdated() {
    const now = new Date();
    elements.lastUpdated.textContent = `Updated: ${now.toLocaleTimeString()}`;
}
