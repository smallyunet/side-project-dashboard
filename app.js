const LANGUAGE_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5', Go: '#00add8',
    Rust: '#dea584', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Ruby: '#701516',
    PHP: '#4f5d95', Swift: '#f05138', Kotlin: '#a97bff', Scala: '#c22d40', Shell: '#89e051',
    HTML: '#e34c26', CSS: '#563d7c', Solidity: '#aa6746', Vue: '#41b883', Dart: '#00b4ab'
};

const CATEGORY_CONFIG = {
    infrastructure: {
        label: 'Core Systems & Infrastructure',
        shortLabel: 'Infrastructure',
        description: 'Protocols, runtimes, indexing systems, and services that power other software.',
        icon: 'fa-server'
    },
    libraries_sdk: {
        label: 'Libraries & SDKs',
        shortLabel: 'Libraries & SDKs',
        description: 'Reusable packages, frameworks, protocol implementations, and integration kits.',
        icon: 'fa-boxes-stacked'
    },
    developer_tools: {
        label: 'Developer Tools & Research',
        shortLabel: 'Tools & Research',
        description: 'Debuggers, deployers, experiments, and technical research built for developers.',
        icon: 'fa-screwdriver-wrench'
    },
    user_applications: {
        label: 'Applications & Products',
        shortLabel: 'Applications',
        description: 'Web apps, desktop software, bots, extensions, and finished user-facing products.',
        icon: 'fa-window-maximize'
    }
};

const CATEGORY_ORDER = Object.keys(CATEGORY_CONFIG);

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
        return '';
    }
}

class Dashboard {
    constructor() {
        this.state = {
            repos: [],
            sortBy: 'updated',
            category: 'all',
            query: '',
            theme: document.documentElement.dataset.theme || 'light'
        };

        this.elements = {
            lastUpdated: document.getElementById('last-updated'),
            totalStars: document.getElementById('total-stars'),
            totalForks: document.getElementById('total-forks'),
            totalRepos: document.getElementById('total-repos'),
            totalIssues: document.getElementById('total-issues'),
            reposContainer: document.getElementById('repos-container'),
            sortSelect: document.getElementById('sort-select'),
            searchInput: document.getElementById('search-input'),
            categoryFilters: document.getElementById('category-filters'),
            resultsSummary: document.getElementById('results-summary'),
            themeToggle: document.getElementById('theme-toggle'),
            themeColor: document.querySelector('meta[name="theme-color"]')
        };

        this.bindEvents();
        this.init();
    }

    bindEvents() {
        this.elements.sortSelect.addEventListener('change', (event) => {
            this.state.sortBy = event.target.value;
            this.renderRepositories();
        });

        this.elements.searchInput.addEventListener('input', (event) => {
            this.state.query = event.target.value.trim().toLowerCase();
            this.renderRepositories();
        });

        this.elements.categoryFilters.addEventListener('click', (event) => {
            const button = event.target.closest('[data-category]');
            if (!button) return;
            this.state.category = button.dataset.category;
            this.renderCategoryFilters();
            this.renderRepositories();
        });

        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        document.addEventListener('keydown', (event) => {
            const tagName = document.activeElement?.tagName;
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
            if (event.key === '/' && !isTyping) {
                event.preventDefault();
                this.elements.searchInput.focus();
            }
        });
    }

    async init() {
        this.applyTheme();
        this.showSkeleton();

        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error(`Data request failed with ${response.status}`);

            const data = await response.json();
            if (!Array.isArray(data.repos)) throw new Error('Repository data is malformed');

            this.state.repos = data.repos;
            this.updateStats();
            this.renderCategoryFilters();
            this.renderRepositories();
            this.updateLastUpdated(new Date(data.timestamp));
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.elements.reposContainer.innerHTML = `
                <div class="empty-state error-state" role="alert">
                    <span class="empty-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
                    <h3>Repository data is unavailable</h3>
                    <p>Please refresh the page or try again later.</p>
                </div>`;
            this.elements.resultsSummary.textContent = 'Unable to load projects';
        } finally {
            this.elements.reposContainer.setAttribute('aria-busy', 'false');
        }
    }

    toggleTheme() {
        this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.state.theme);
        this.applyTheme();
    }

    applyTheme() {
        const isDark = this.state.theme === 'dark';
        document.documentElement.dataset.theme = this.state.theme;
        this.elements.themeToggle.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        this.elements.themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
        this.elements.themeToggle.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
        if (this.elements.themeColor) this.elements.themeColor.content = isDark ? '#07111f' : '#f4f6f8';
    }

    formatNumber(number) {
        return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(number);
    }

    formatRelativeTime(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'unknown';

        const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

        if (Math.abs(diffInSeconds) < 60) return rtf.format(-diffInSeconds, 'second');
        const minutes = Math.floor(diffInSeconds / 60);
        if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
        const hours = Math.floor(minutes / 60);
        if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
        const days = Math.floor(hours / 24);
        if (Math.abs(days) < 30) return rtf.format(-days, 'day');
        const months = Math.floor(days / 30);
        if (Math.abs(months) < 12) return rtf.format(-months, 'month');
        return rtf.format(-Math.floor(days / 365), 'year');
    }

    showSkeleton() {
        this.elements.reposContainer.innerHTML = `
            <div class="skeleton-heading">
                <div class="skeleton skeleton-line skeleton-line-short"></div>
                <div class="skeleton skeleton-line skeleton-line-medium"></div>
            </div>
            <div class="repos-grid">
                ${Array.from({ length: 6 }, () => this.createSkeletonCard()).join('')}
            </div>`;
    }

    createSkeletonCard() {
        return `
            <div class="repo-card skeleton-card" aria-hidden="true">
                <div class="skeleton skeleton-line skeleton-line-medium"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line skeleton-line-long"></div>
                <div class="skeleton skeleton-block"></div>
            </div>`;
    }

    updateStats() {
        const stats = this.state.repos.reduce((result, repo) => {
            if (repo.error) return result;
            result.stars += repo.stargazers_count || 0;
            result.forks += repo.forks_count || 0;
            result.issues += repo.open_issues_count || 0;
            result.repos += 1;
            return result;
        }, { stars: 0, forks: 0, issues: 0, repos: 0 });

        this.elements.totalStars.textContent = this.formatNumber(stats.stars);
        this.elements.totalForks.textContent = this.formatNumber(stats.forks);
        this.elements.totalIssues.textContent = this.formatNumber(stats.issues);
        this.elements.totalRepos.textContent = this.formatNumber(stats.repos);
    }

    renderCategoryFilters() {
        const counts = this.state.repos.reduce((result, repo) => {
            const category = repo.category || 'other';
            result[category] = (result[category] || 0) + 1;
            return result;
        }, {});

        const filters = [
            { key: 'all', label: 'All projects', count: this.state.repos.length, icon: 'fa-border-all' },
            ...CATEGORY_ORDER.map((key) => ({
                key,
                label: CATEGORY_CONFIG[key].shortLabel,
                count: counts[key] || 0,
                icon: CATEGORY_CONFIG[key].icon
            }))
        ];

        this.elements.categoryFilters.innerHTML = filters.map((filter) => {
            const isActive = this.state.category === filter.key;
            return `
                <button class="filter-chip${isActive ? ' is-active' : ''}" type="button"
                    data-category="${filter.key}" aria-pressed="${isActive}">
                    <i class="fas ${filter.icon}" aria-hidden="true"></i>
                    <span>${escapeHtml(filter.label)}</span>
                    <span class="filter-count">${filter.count}</span>
                </button>`;
        }).join('');
    }

    getVisibleRepos() {
        return this.state.repos.filter((repo) => {
            const matchesCategory = this.state.category === 'all' || repo.category === this.state.category;
            if (!matchesCategory) return false;
            if (!this.state.query) return true;

            const searchText = [
                repo.name, repo.full_name, repo.description, repo.language,
                ...(Array.isArray(repo.topics) ? repo.topics : [])
            ].filter(Boolean).join(' ').toLowerCase();

            const searchTokens = this.state.query.split(/\s+/).filter(Boolean);
            return searchTokens.every((token) => searchText.includes(token));
        });
    }

    renderRepositories() {
        const visibleRepos = this.getVisibleRepos();
        const projectLabel = visibleRepos.length === 1 ? 'project' : 'projects';
        this.elements.resultsSummary.textContent = `${visibleRepos.length} ${projectLabel} shown`;

        if (visibleRepos.length === 0) {
            this.elements.reposContainer.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon"><i class="fas fa-magnifying-glass" aria-hidden="true"></i></span>
                    <h3>No matching projects</h3>
                    <p>Try another keyword or select a different category.</p>
                    <button id="clear-filters" class="text-button" type="button">Clear filters</button>
                </div>`;
            document.getElementById('clear-filters').addEventListener('click', () => {
                this.state.category = 'all';
                this.state.query = '';
                this.elements.searchInput.value = '';
                this.renderCategoryFilters();
                this.renderRepositories();
            });
            return;
        }

        const groupedRepos = visibleRepos.reduce((result, repo) => {
            const category = repo.category || 'other';
            if (!result[category]) result[category] = [];
            result[category].push(repo);
            return result;
        }, {});

        const sections = CATEGORY_ORDER.filter((key) => groupedRepos[key]?.length).map((categoryKey) => {
            const category = CATEGORY_CONFIG[categoryKey];
            const repos = this.sortRepos([...groupedRepos[categoryKey]]);
            return `
                <section class="category-section" aria-labelledby="category-${categoryKey}">
                    <div class="category-heading">
                        <div class="category-icon" aria-hidden="true"><i class="fas ${category.icon}"></i></div>
                        <div class="category-copy">
                            <div class="category-title-row">
                                <h3 id="category-${categoryKey}">${escapeHtml(category.label)}</h3>
                                <span>${repos.length}</span>
                            </div>
                            <p>${escapeHtml(category.description)}</p>
                        </div>
                    </div>
                    <div class="repos-grid">
                        ${repos.map((repo) => this.createRepoCard(repo)).join('')}
                    </div>
                </section>`;
        });

        const otherRepos = groupedRepos.other || [];
        if (otherRepos.length) {
            sections.push(`
                <section class="category-section" aria-labelledby="category-other">
                    <div class="category-heading">
                        <div class="category-icon" aria-hidden="true"><i class="fas fa-folder"></i></div>
                        <div class="category-copy">
                            <div class="category-title-row"><h3 id="category-other">Other</h3><span>${otherRepos.length}</span></div>
                            <p>Projects waiting to be categorized.</p>
                        </div>
                    </div>
                    <div class="repos-grid">${this.sortRepos([...otherRepos]).map((repo) => this.createRepoCard(repo)).join('')}</div>
                </section>`);
        }

        this.elements.reposContainer.innerHTML = sections.join('');
    }

    sortRepos(repos) {
        const dateFor = (repo, field) => new Date(repo[field] || 0).getTime();
        switch (this.state.sortBy) {
            case 'stars': return repos.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
            case 'forks': return repos.sort((a, b) => (b.forks_count || 0) - (a.forks_count || 0));
            case 'created': return repos.sort((a, b) => dateFor(b, 'created_at') - dateFor(a, 'created_at'));
            case 'updated': return repos.sort((a, b) =>
                dateFor(b, b.last_commit_date ? 'last_commit_date' : 'updated_at') -
                dateFor(a, a.last_commit_date ? 'last_commit_date' : 'updated_at'));
            default: return repos;
        }
    }

    createRepoCard(repo) {
        if (repo.error) {
            return `
                <article class="repo-card error-card">
                    <div class="repo-title-group">
                        <span class="repo-mark"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
                        <h4>${escapeHtml(repo.full_name)}</h4>
                    </div>
                    <p class="repo-description">Failed to load this repository. ${escapeHtml(repo.error_message || '')}</p>
                </article>`;
        }

        const repoUrl = safeUrl(repo.html_url);
        const homepageUrl = safeUrl(repo.homepage);
        const langColor = LANGUAGE_COLORS[repo.language] || '#94a3b8';
        const updatedDate = repo.last_commit_date ? new Date(repo.last_commit_date) : new Date(repo.updated_at);
        const createdDate = repo.created_at ? new Date(repo.created_at) : null;
        const updatedRelative = this.formatRelativeTime(updatedDate);
        const createdRelative = createdDate ? this.formatRelativeTime(createdDate) : 'unknown';
        const stars = this.formatNumber(repo.stargazers_count || 0);
        const forks = this.formatNumber(repo.forks_count || 0);
        const issues = this.formatNumber(repo.open_issues_count || 0);
        const commits = this.formatNumber(repo.commit_count || 0);

        const tagHtml = this.createTagBadge(repo, repoUrl);
        const packageHtml = this.createPackageBadges(repo.package_info);
        const versionsHtml = tagHtml || packageHtml ? `<div class="repo-versions">${tagHtml}${packageHtml}</div>` : '';
        const workflowHtml = this.createWorkflowStatus(repo.latest_workflow_runs);
        const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];
        const topicsHtml = topics.length
            ? `<div class="repo-topics">${topics.map((topic) => `<span>${escapeHtml(topic)}</span>`).join('')}</div>`
            : '';
        const license = repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION'
            ? `<span><i class="fas fa-scale-balanced" aria-hidden="true"></i>${escapeHtml(repo.license.spdx_id)}</span>`
            : '';

        return `
            <article class="repo-card" data-category="${escapeHtml(repo.category || 'other')}">
                <div class="repo-card-top">
                    <div class="repo-header">
                        <div class="repo-title-group">
                            <span class="repo-mark" aria-hidden="true"><i class="fas fa-cube"></i></span>
                            <div>
                                <a href="${repoUrl}" target="_blank" rel="noopener noreferrer" class="repo-name"
                                    title="${escapeHtml(repo.full_name || repo.name)}">
                                    ${escapeHtml(repo.name)}
                                </a>
                                <span class="repo-visibility">${escapeHtml(repo.visibility || 'public')}</span>
                            </div>
                        </div>
                        ${homepageUrl ? `
                            <a href="${homepageUrl}" target="_blank" rel="noopener noreferrer" class="repo-website"
                                aria-label="Open ${escapeHtml(repo.name)} website" title="Open project website">
                                <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
                            </a>` : ''}
                    </div>

                    <p class="repo-description">${escapeHtml(repo.description || 'A focused open-source project by smallyu.')}</p>
                    ${topicsHtml}

                    <div class="repo-metrics" aria-label="Repository metrics">
                        <span title="Stars"><i class="fas fa-star" aria-hidden="true"></i>${stars}</span>
                        <span title="Forks"><i class="fas fa-code-branch" aria-hidden="true"></i>${forks}</span>
                        <span title="Open issues"><i class="fas fa-circle-dot" aria-hidden="true"></i>${issues}</span>
                        <span title="Commits"><i class="fas fa-code-commit" aria-hidden="true"></i>${commits}</span>
                    </div>

                    ${workflowHtml}
                    ${versionsHtml}
                </div>

                <div class="repo-footer">
                    <div class="repo-meta">
                        <span class="repo-language"><span class="language-dot" style="background-color:${langColor}"></span>${escapeHtml(repo.language || 'Unknown')}</span>
                        ${license}
                    </div>
                    <div class="repo-dates">
                        <span title="Created ${escapeHtml(createdDate?.toLocaleString() || 'unknown')}">Created ${escapeHtml(createdRelative)}</span>
                        <span title="Updated ${escapeHtml(updatedDate.toLocaleString())}"><i class="far fa-clock" aria-hidden="true"></i>${escapeHtml(updatedRelative)}</span>
                    </div>
                </div>
            </article>`;
    }

    createTagBadge(repo, repoUrl) {
        if (!repo.latest_tag || !repoUrl) return '';
        const tagName = String(repo.latest_tag.name || '');
        const tagUrl = `${repoUrl.replace(/\/$/, '')}/releases/tag/${encodeURIComponent(tagName)}`;
        return `
            <a href="${tagUrl}" target="_blank" rel="noopener noreferrer" class="version-badge tag-badge">
                <i class="fas fa-tag" aria-hidden="true"></i>${escapeHtml(tagName)}
            </a>`;
    }

    createPackageBadges(packageInfo) {
        if (!packageInfo) return '';
        const packages = Array.isArray(packageInfo) ? packageInfo : [packageInfo];
        const packageStyles = {
            pypi: ['fab fa-python', 'pypi-badge'],
            crates: ['fab fa-rust', 'crates-badge'],
            vscode: ['fas fa-puzzle-piece', 'vscode-badge'],
            openvsx: ['fas fa-cube', 'openvsx-badge'],
            npm: ['fab fa-npm', 'npm-badge']
        };

        return packages.map((pkg) => {
            const [iconClass, badgeClass] = packageStyles[pkg.type] || packageStyles.npm;
            const url = safeUrl(pkg.url);
            if (!url) return '';
            return `
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="version-badge ${badgeClass}">
                    <i class="${iconClass}" aria-hidden="true"></i>${escapeHtml(pkg.version || pkg.name || 'package')}
                </a>`;
        }).join('');
    }

    createWorkflowStatus(workflowRuns) {
        if (!Array.isArray(workflowRuns) || workflowRuns.length === 0) return '';
        const links = workflowRuns.slice(0, 3).map((run) => {
            const status = run.conclusion || run.status || 'unknown';
            const url = safeUrl(run.html_url);
            if (!url) return '';
            return `
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="workflow-link ${this.getWorkflowStatusClass(status)}"
                    title="${escapeHtml(run.name)}: ${escapeHtml(status)}">
                    ${this.getWorkflowStatusIcon(status)}<span>${escapeHtml(run.name)}</span>
                </a>`;
        }).join('');

        return links ? `<div class="repo-workflow"><span class="workflow-label">Actions</span><div>${links}</div></div>` : '';
    }

    getWorkflowStatusIcon(status) {
        switch (status) {
            case 'success': return '<i class="fas fa-circle-check" aria-hidden="true"></i>';
            case 'failure': return '<i class="fas fa-circle-xmark" aria-hidden="true"></i>';
            case 'cancelled': return '<i class="fas fa-ban" aria-hidden="true"></i>';
            case 'in_progress':
            case 'queued':
            case 'waiting':
            case 'pending': return '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>';
            default: return '<i class="fas fa-circle-minus" aria-hidden="true"></i>';
        }
    }

    getWorkflowStatusClass(status) {
        switch (status) {
            case 'success': return 'status-success';
            case 'failure': return 'status-failure';
            case 'cancelled': return 'status-cancelled';
            case 'in_progress':
            case 'queued':
            case 'waiting':
            case 'pending': return 'status-pending';
            default: return 'status-unknown';
        }
    }

    updateLastUpdated(date) {
        const displayDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
        this.elements.lastUpdated.textContent = `Data updated ${this.formatRelativeTime(displayDate)}`;
        this.elements.lastUpdated.title = displayDate.toLocaleString();
    }
}

document.addEventListener('DOMContentLoaded', () => new Dashboard());
