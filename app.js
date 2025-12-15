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
    sortSelect: document.getElementById('sort-select'),
    navItems: document.querySelectorAll('.nav-item')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setupEventListeners();
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
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('Failed to load data');
        }
        const data = await response.json();
        
        state.repos = data.repos;

        updateStats();
        renderRepositories();
        updateLastUpdated(new Date(data.timestamp));
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        elements.reposContainer.innerHTML = '<div class="empty-state">Failed to load data. Please try again later.</div>';
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
        }
    } else {
        icon.classList.remove('fa-spin');
        elements.refreshBtn.disabled = false;
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

    let workflowHtml = '';
    if (repo.latest_workflow_run) {
        const run = repo.latest_workflow_run;
        const status = run.conclusion || run.status;
        const statusIcon = getWorkflowStatusIcon(status);
        const statusClass = getWorkflowStatusClass(status);
        
        workflowHtml = `
            <div class="repo-workflow">
                <span class="workflow-label">Latest Action:</span>
                <a href="${run.html_url}" target="_blank" class="workflow-link">
                    ${statusIcon} <span class="${statusClass}">${run.name}</span>
                </a>
            </div>
        `;
    }

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
            ${workflowHtml}
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
        case 'pending':
        case 'requested':
            return '<i class="fas fa-circle-notch fa-spin" style="color: #3b82f6"></i>';
        case 'skipped':
        case 'neutral':
            return '<i class="fas fa-minus-circle" style="color: #9ca3af"></i>';
        case 'timed_out':
        case 'action_required':
        case 'stale':
            return '<i class="fas fa-exclamation-circle" style="color: #f59e0b"></i>';
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
        case 'pending':
        case 'requested':
            return 'status-pending';
        case 'skipped':
        case 'neutral':
            return 'status-unknown';
        case 'timed_out':
        case 'action_required':
        case 'stale':
            return 'status-cancelled';
        default:
            return 'status-unknown';
    }
}

function updateLastUpdated(date) {
    const displayDate = date || new Date();
    elements.lastUpdated.textContent = `Updated: ${displayDate.toLocaleString()}`;
}
