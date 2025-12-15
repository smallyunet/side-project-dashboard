# Side Project Dashboard

🚀 A minimalist dashboard to monitor your GitHub side projects — stars, forks, releases, CI status, and more.

**Live Demo:** [spd.smallyu.net](https://spd.smallyu.net)

![Dashboard Preview](https://img.shields.io/badge/status-active-success) ![GitHub Pages](https://img.shields.io/badge/deployed-GitHub%20Pages-blue)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 Overview | All your repositories at a glance |
| ⭐ Statistics | Total stars, forks, and open issues |
| 🏷️ Releases | Latest release tags with dates |
| 🚀 CI Status | GitHub Actions workflow status |
| 🔄 Auto-refresh | Data updates via GitHub Actions |
| 📱 Responsive | Mobile-friendly design |

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Data:** GitHub REST API
- **Deployment:** GitHub Actions + GitHub Pages
- **Icons:** Font Awesome

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/smallyunet/side-project-dashboard.git
cd side-project-dashboard

# Start a local server
python -m http.server 8000
# or
npx serve
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## 📦 Deployment

1. Fork this repository
2. Edit `fetch_data.js` to add your repositories
3. Enable GitHub Pages (Settings → Pages → GitHub Actions)
4. Your dashboard will be live at `https://<username>.github.io/side-project-dashboard/`

## 📄 License

MIT
