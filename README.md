# GitHub Repositories Dashboard

A real-time monitoring dashboard for GitHub repositories, deployed on GitHub Pages.

## Features

- 📊 **Repository Overview** - View all repositories at a glance
- ⭐ **Statistics** - Total stars, forks, and watchers
- 🏷️ **Latest Release** - See the most recent release tag and date
- 📝 **Last Commit Time** - View when each repository was last updated
- 🚀 **GitHub Actions** - Monitor workflow run status with success/failure indicators
- 🔄 **Auto-refresh** - Data refreshes every 10 minutes
- 📱 **Responsive** - Works on desktop and mobile devices

## Monitored Repositories

- [echoevm](https://github.com/smallyunet/echoevm)
- [safe-kit](https://github.com/smallyunet/safe-kit)
- [finder-sight](https://github.com/smallyunet/finder-sight)
- [privy-wallet-kit](https://github.com/smallyunet/privy-wallet-kit)
- [userop-validator](https://github.com/smallyunet/userop-validator)
- [etherflow](https://github.com/smallyunet/etherflow)
- [go-cggmp-tss](https://github.com/smallyunet/go-cggmp-tss)

## Deployment

This dashboard is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### Setup Instructions

1. Push this repository to GitHub
2. Go to repository **Settings** → **Pages**
3. Under "Build and deployment", select **GitHub Actions** as the source
4. The dashboard will be available at `https://<username>.github.io/<repo-name>/`

## API Rate Limiting

This dashboard uses the GitHub REST API without authentication. The rate limit is:
- **60 requests per hour** for unauthenticated requests

With 7 repositories and 4 API calls per repository (repo info, last commit, releases, workflow runs), each refresh uses ~28 requests. This allows for approximately 2 full refreshes per hour.

### Increasing Rate Limits (Optional)

To increase the rate limit to 5,000 requests per hour, you can add a personal access token. However, this requires additional setup and is not recommended for public GitHub Pages deployments for security reasons.

## Local Development

Simply open `index.html` in a web browser, or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## Technologies Used

- HTML5 / CSS3
- Vanilla JavaScript
- GitHub REST API
- Font Awesome Icons
- GitHub Actions for CI/CD

## License

MIT License
# side-project-dashboard
