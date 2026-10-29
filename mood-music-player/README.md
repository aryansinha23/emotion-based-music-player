# 🎧 Mood Music Player

A camera-free, mood-based music player for Spotify. Pick (or type) how you feel and it plays a matching playlist, right in your browser.

## Features
- 10 mood buttons plus a "describe how you feel" box that detects your mood from your words (runs locally)
- Energy and language filters (Hindi, English, Punjabi)
- In-browser player (Spotify Web Playback SDK) with play/pause, skip, volume and album art
- Embedded-player fallback if you don't have Premium
- Mood history and stats saved in your browser
- Pure HTML/CSS/JS. No build step, no backend, no client secret (uses PKCE login)

## Setup
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app.
2. Add Redirect URIs (exact match, including the trailing slash):
   - Local: `http://127.0.0.1:8888/`
   - GitHub Pages: `https://YOUR-USERNAME.github.io/YOUR-REPO/`
3. Copy your **Client ID**.

## Run locally
```bash
python -m http.server 8888
```
Open `http://127.0.0.1:8888/`, paste your Client ID, and click **Connect Spotify**.

## Deploy on GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Deploy from branch → main / (root)**.
3. Open `https://YOUR-USERNAME.github.io/YOUR-REPO/` and connect.

## Customize
Edit the `MOODS` object at the top of `js/app.js` to change emojis, search keywords, and the words used for mood detection.

## Notes
- Playback control and the in-browser player need **Spotify Premium**.
- Your Client ID and tokens are stored only in your own browser (localStorage).
- Spotify may limit new apps to a few allowlisted users in Development Mode. Add your account under **User Management** in the dashboard.

## License
MIT
