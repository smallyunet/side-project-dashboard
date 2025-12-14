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

// Cache for API responses
let repoCache = {};

// Format relative time
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Get status icon class
function getStatusIcon(status, conclusion) {
    if (status === 'completed') {
        switch (conclusion) {
            case 'success': return { class: 'success', icon: '✓' };
            case 'failure': return { class: 'failure', icon: '✗' };
            case 'cancelled': return { class: 'cancelled', icon: '○' };
            default: return { class: 'pending', icon: '?' };
        }
    }
    return { class: 'pending', icon: '●' };
}

// Fetch repository data
async function fetchRepoData(repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    
    try {
        // Fetch all data in parallel
        const [repoResponse, releasesResponse, commitsResponse, actionsResponse] = await Promise.all([
            fetch(`https://api.github.com/repos/${owner}/${repo}`),
            fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=1`),
            fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
            fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=3`)
        ]);

        const repoData = await repoResponse.json();
        const releases = await releasesResponse.json();
        const commits = await commitsResponse.json();
        const actions = actionsResponse.ok ? await actionsResponse.json() : { workflow_runs: [] };

        return {
            repo: repoData,
            latestRelease: releases[0] || null,
            latestCommit: commits[0] || null,
            actions: actions.workflow_runs || []
        };
    } catch (error) {
        console.error(`Error fetching ${repoFullName}:`, error);
        return null;
    }
}

// Create repository card HTML
function createRepoCard(data) {
    if (!data || !data.repo) {
        return `<div class="repo-card error-message">Failed to load repository data</div>`;
    }

    const { repo, latestRelease, latestCommit, actions } = data;

    // Topics
    const topicsHtml = repo.topics && repo.topics.length > 0
        ? `<div class="repo-topics">
            ${repo.topics.slice(0, 5).map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
           </div>`
        : '';

    // Language
    const languageHtml = repo.language
        ? `<div class="repo-language">
            <span class="language-dot" style="background-color: ${LANGUAGE_COLORS[repo.language] || '#8b949e'}"></span>
            <span class="language-name">${repo.language}</span>
           </div>`
        : '';

    // Release section
    const releaseHtml = latestRelease
        ? `<span class="release-tag">${latestRelease.tag_name}</span>
           <span class="release-date">${timeAgo(latestRelease.published_at)}</span>`
        : `<span class="release-tag no-release">No releases</span>`;

    // Commit section
    const commitHtml = latestCommit
        ? `<div class="commit-message" title="${latestCommit.commit.message}">${latestCommit.commit.message.split('\n')[0]}</div>
           <div class="commit-meta">
               <span class="commit-author">
                   ${latestCommit.author ? `<img src="${latestCommit.author.avatar_url}" alt="${latestCommit.commit.author.name}">` : ''}
                   ${latestCommit.commit.author.name}
               </span>
               <span>•</span>
               <span>${timeAgo(latestCommit.commit.author.date)}</span>
           </div>`
        : '<span class="text-secondary">No commits</span>';

    // Actions section
    const actionsHtml = actions.length > 0
        ? actions.slice(0, 2).map(run => {
            const status = getStatusIcon(run.status, run.conclusion);
            return `
                <div class="action-run">
                    <div class="action-status">
                        <span class="status-icon ${status.class}">${status.icon}</span>
                        <span class="action-name">${run.name}</span>
                    </div>
                    <span class="action-time">${timeAgo(run.updated_at)}</span>
                </div>
            `;
        }).join('')
        : '<div class="action-run"><span class="action-name" style="color: var(--text-secondary);">No workflow runs</span></div>';

    return `
        <div class="repo-card">
            <div class="repo-header">
                <div class="repo-name">
                    <i class="fas fa-book" style="color: var(--text-secondary);"></i>
                    <a href="${repo.html_url}" target="_blank">${repo.name}</a>
                </div>
                <span class="repo-visibility">${repo.private ? 'Private' : 'Public'}</span>
            </div>
            
            <p class="repo-description">${repo.description || 'No description provided'}</p>
            
            ${topicsHtml}
            ${languageHtml}
            
            <div class="repo-stats">
                <span class="repo-stat stars">
                    <i class="fas fa-star"></i> ${repo.stargazers_count}
                </span>
                <span class="repo-stat forks">
                    <i class="fas fa-code-fork"></i> ${repo.forks_count}
                </span>
                <span class="repo-stat watchers">
                    <i class="fas fa-eye"></i> ${repo.watchers_count}
                </span>
                <span class="repo-stat issues">
                    <i class="fas fa-circle-dot"></i> ${repo.open_issues_count}
                </span>
            </div>

            <div class="repo-section">
                <div class="section-title"><i class="fas fa-tag"></i> Latest Release</div>
                <div class="release-info">
                    ${releaseHtml}
                </div>
            </div>

            <div class="repo-section">
                <div class="section-title"><i class="fas fa-code-commit"></i> Latest Commit</div>
                <div class="commit-info">
                    ${commitHtml}
                </div>
            </div>

            <div class="repo-section">
                <div class="section-title"><i class="fas fa-play"></i> GitHub Actions</div>
                <div class="actions-info">
                    ${actionsHtml}
                </div>
            </div>

            <div style="margin-top: 12px; font-size: 0.75rem; color: var(--text-secondary);">
                <i class="fas fa-clock"></i> Created: ${formatDate(repo.created_at)} | Updated: ${timeAgo(repo.updated_at)}
            </div>
        </div>
    `;
}

// Create loading skeleton
function createLoadingSkeleton() {
    return `
        <div class="repo-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text" style="width: 80%;"></div>
            <div class="skeleton skeleton-text" style="width: 60%;"></div>
            <div style="height: 100px; margin-top: 20px;">
                <div class="skeleton skeleton-text" style="width: 40%;"></div>
                <div class="skeleton skeleton-text" style="width: 70%;"></div>
            </div>
        </div>
    `;
}

// Update statistics overview
function updateStats(allData) {
    let totalStars = 0;
    let totalForks = 0;
    let totalWatchers = 0;

    allData.forEach(data => {
        if (data && data.repo) {
            totalStars += data.repo.stargazers_count || 0;
            totalForks += data.repo.forks_count || 0;
            totalWatchers += data.repo.watchers_count || 0;
        }
    });

    document.getElementById('total-repos').textContent = REPOS.length;
    document.getElementById('total-stars').textContent = totalStars;
    document.getElementById('total-forks').textContent = totalForks;
    document.getElementById('total-watchers').textContent = totalWatchers;
}

// Main function to load all repositories
async function loadRepositories() {
    const container = document.getElementById('repos-container');
    const refreshBtn = document.getElementById('refresh-btn');

    // Show loading state
    container.innerHTML = REPOS.map(() => createLoadingSkeleton()).join('');
    refreshBtn.classList.add('loading');

    try {
        // Fetch all repositories in parallel
        const allData = await Promise.all(REPOS.map(repo => fetchRepoData(repo)));
        
        // Cache the results
        repoCache = allData;

        // Render all cards
        container.innerHTML = allData.map(data => createRepoCard(data)).join('');

        // Update statistics
        updateStats(allData);

        // Update last updated time
        document.getElementById('last-updated').textContent = 
            `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error('Error loading repositories:', error);
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                Failed to load repositories. Please try again later.
            </div>
        `;
    } finally {
        refreshBtn.classList.remove('loading');
    }
}

// Refresh all data
function refreshAll() {
    loadRepositories();
}

// Auto-refresh every 5 minutes
function startAutoRefresh() {
    setInterval(() => {
        loadRepositories();
    }, 5 * 60 * 1000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRepositories();
    startAutoRefresh();
});
