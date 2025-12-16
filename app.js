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

class Dashboard {
    constructor() {
        this.state = {
            repos: [],
            sortBy: 'updated',
            theme: localStorage.getItem('theme') || 'light'
        };

        this.elements = {
            lastUpdated: document.getElementById('last-updated'),
            totalStars: document.getElementById('total-stars'),
            totalForks: document.getElementById('total-forks'),
            totalRepos: document.getElementById('total-repos'),
            totalIssues: document.getElementById('total-issues'),
            reposContainer: document.getElementById('repos-container'),
            sortSelect: document.getElementById('sort-select'),
            themeToggle: document.getElementById('theme-toggle'),
        };

        this.bindEvents();
        this.init();
    }

    bindEvents() {
        this.elements.sortSelect.addEventListener('change', (e) => {
            this.state.sortBy = e.target.value;
            this.renderRepositories();
        });

        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    async init() {
        this.initTheme();
        this.showSkeleton();
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('Failed to load data');

            const data = await response.json();
            this.state.repos = data.repos;

            this.updateStats();
            this.renderRepositories();
            this.updateLastUpdated(new Date(data.timestamp));
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.elements.reposContainer.innerHTML = '<div class="empty-state">Failed to load data. Please try again later.</div>';
        }
    }

    initTheme() {
        // Check system preference if no stored theme
        if (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.state.theme = 'dark';
        }
        this.applyTheme();
    }

    toggleTheme() {
        this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.state.theme);
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.state.theme);
        const icon = this.elements.themeToggle.querySelector('i');
        if (this.state.theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }

    formatNumber(num) {
        return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

        if (diffInSeconds < 60) return rtf.format(-diffInSeconds, 'second');
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return rtf.format(-diffInMinutes, 'minute');
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return rtf.format(-diffInHours, 'hour');
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) return rtf.format(-diffInDays, 'day');
        const diffInMonths = Math.floor(diffInDays / 30);
        if (diffInMonths < 12) return rtf.format(-diffInMonths, 'month');
        return rtf.format(-Math.floor(diffInDays / 365), 'year');
    }

    showSkeleton() {
        this.elements.reposContainer.innerHTML = Array(6).fill(0).map(() => this.createSkeletonCard()).join('');
    }

    createSkeletonCard() {
        return `
            <div class="repo-card skeleton-card">
                <div class="repo-header">
                    <div class="skeleton skeleton-title"></div>
                </div>
                <div class="skeleton skeleton-text long"></div>
                <div class="skeleton skeleton-text short"></div>
                <div class="repo-stats">
                    <div class="skeleton skeleton-text" style="width: 20px;"></div>
                    <div class="skeleton skeleton-text" style="width: 20px;"></div>
                    <div class="skeleton skeleton-text" style="width: 20px;"></div>
                </div>
                <div class="repo-footer">
                    <div class="skeleton skeleton-text" style="width: 40px;"></div>
                    <div class="skeleton skeleton-text" style="width: 80px;"></div>
                </div>
            </div>
        `;
    }

    updateStats() {
        const stats = this.state.repos.reduce((acc, repo) => {
            if (repo.error) return acc;
            acc.stars += repo.stargazers_count || 0;
            acc.forks += repo.forks_count || 0;
            acc.issues += repo.open_issues_count || 0;
            return acc;
        }, { stars: 0, forks: 0, issues: 0 });

        this.elements.totalStars.textContent = this.formatNumber(stats.stars);
        this.elements.totalForks.textContent = this.formatNumber(stats.forks);
        this.elements.totalIssues.textContent = this.formatNumber(stats.issues);
        this.elements.totalRepos.textContent = this.state.repos.length;
    }

    renderRepositories() {
        let sortedRepos = [...this.state.repos];

        switch (this.state.sortBy) {
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
            this.elements.reposContainer.innerHTML = '<div class="empty-state">No repositories found.</div>';
            return;
        }

        this.elements.reposContainer.innerHTML = sortedRepos.map(repo => this.createRepoCard(repo)).join('');
    }

    createRepoCard(repo) {
        if (repo.error) {
            return `
                <div class="repo-card error-card">
                    <div class="repo-header">
                        <span class="repo-name">
                            <i class="fas fa-exclamation-triangle"></i> ${repo.full_name}
                        </span>
                    </div>
                    <p class="repo-description">
                        Failed to load data. ${repo.error_message || 'Check your connection.'}
                    </p>
                </div>
            `;
        }

        const langColor = LANGUAGE_COLORS[repo.language] || '#ccc';
        const lastCommitDate = repo.last_commit_date ? this.formatRelativeTime(new Date(repo.last_commit_date)) : 'N/A';
        const stars = this.formatNumber(repo.stargazers_count || 0);
        const forks = this.formatNumber(repo.forks_count || 0);
        const issues = this.formatNumber(repo.open_issues_count || 0);

        let tagHtml = '';
        if (repo.latest_tag) {
            const tagUrl = `${repo.html_url}/releases/tag/${repo.latest_tag.name}`;
            tagHtml = `
                <div class="version-badge tag-badge">
                    <i class="fas fa-tag"></i>
                    <a href="${tagUrl}" target="_blank">${repo.latest_tag.name}</a>
                </div>
            `;
        }

        let workflowHtml = '';
        if (repo.latest_workflow_runs && repo.latest_workflow_runs.length > 0) {
            const workflowLinks = repo.latest_workflow_runs.map(run => {
                const status = run.conclusion || run.status;
                const statusIcon = this.getWorkflowStatusIcon(status);
                const statusClass = this.getWorkflowStatusClass(status);
                return `<a href="${run.html_url}" target="_blank" class="workflow-link">
                    ${statusIcon} <span class="${statusClass}">${run.name}</span>
                </a>`;
            }).join('');

            workflowHtml = `
                <div class="repo-workflow">
                    <span class="workflow-label">Actions:</span>
                    <div class="workflow-links">${workflowLinks}</div>
                </div>
            `;
        }

        let packageHtml = '';
        if (repo.package_info) {
            const iconClass = repo.package_info.type === 'pypi' ? 'fab fa-python' : 'fab fa-npm';
            const iconColor = repo.package_info.type === 'pypi' ? '#3775a9' : '#CB3837';
            // Add specific class based on package type for easier styling
            const packageTypeClass = repo.package_info.type === 'pypi' ? 'pypi-badge' : 'npm-badge';

            packageHtml = `
                <div class="version-badge package-badge ${packageTypeClass}">
                    <i class="${iconClass}" style="color: ${iconColor};"></i>
                    <a href="${repo.package_info.url}" target="_blank">${repo.package_info.version}</a>
                </div>
             `;
        }

        let websiteHtml = '';
        // Check if homepage is available and looks like a URL
        if (repo.homepage && (repo.homepage.startsWith('http') || repo.homepage.startsWith('https'))) {
            websiteHtml = `
                <a href="${repo.homepage}" target="_blank" class="repo-website-icon" title="Visit Website">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            `;
        }

        return `
            <div class="repo-card">
                <div class="repo-header">
                    <div class="repo-header-left">
                        <a href="${repo.html_url}" target="_blank" class="repo-name">
                            <i class="fas fa-book-bookmark"></i> ${repo.name}
                        </a>
                        ${websiteHtml}
                    </div>
                    <span class="repo-visibility">${repo.visibility || 'public'}</span>
                </div>
                <p class="repo-description">${repo.description || 'No description available'}</p>
                <div class="repo-stats">
                    <div class="repo-stat" title="Stars">
                        <i class="far fa-star"></i> ${stars}
                    </div>
                    <div class="repo-stat" title="Forks">
                        <i class="fas fa-code-branch"></i> ${forks}
                    </div>
                    <div class="repo-stat" title="Open Issues">
                        <i class="far fa-circle-dot"></i> ${issues}
                    </div>
                </div>
                ${workflowHtml}

        <div class="repo-bottom">
            ${(tagHtml || packageHtml) ? `
                    <div class="repo-versions">
                        ${tagHtml}
                        ${packageHtml}
                    </div>` : ''}

            <div class="repo-footer">
                <div class="repo-lang">
                    <span class="language-dot" style="background-color: ${langColor}"></span>
                    ${repo.language || 'Unknown'}
                </div>
                <div class="repo-updated" title="${repo.last_commit_date ? new Date(repo.last_commit_date).toLocaleString() : ''}">
                    ${lastCommitDate === 'N/A' ? 'No commits' : 'Updated ' + lastCommitDate}
                </div>
            </div>
        </div>
            </div >
            `;
    }

    getWorkflowStatusIcon(status) {
        switch (status) {
            case 'success': return '<i class="fas fa-check-circle" style="color: #22c55e"></i>';
            case 'failure': return '<i class="fas fa-times-circle" style="color: #ef4444"></i>';
            case 'cancelled': return '<i class="fas fa-ban" style="color: #f59e0b"></i>';
            case 'in_progress':
            case 'queued':
            case 'waiting':
            case 'pending': return '<i class="fas fa-circle-notch fa-spin" style="color: #3b82f6"></i>';
            default: return '<i class="fas fa-minus-circle" style="color: #9ca3af"></i>';
        }
    }

    getWorkflowStatusClass(status) {
        switch (status) {
            case 'success': return 'status-success';
            case 'failure': return 'status-failure';
            case 'cancelled': return 'status-cancelled';
            case 'in_progress':
            case 'queued':
            case 'pending': return 'status-pending';
            default: return 'status-unknown';
        }
    }

    updateLastUpdated(date) {
        const displayDate = date || new Date();
        const timeString = this.formatRelativeTime(displayDate);
        this.elements.lastUpdated.textContent = `Updated: ${timeString} `;
        this.elements.lastUpdated.title = displayDate.toLocaleString();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
