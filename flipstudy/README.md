# FlipStudy

Flashcard app. Static frontend (GitHub Pages) plus a small Express API (Render).

```
flipstudy/
  frontend/    HTML, CSS, JS (config.js holds the API address)
  backend/     Express API, JSON file storage
  render.yaml  Render blueprint (optional)
  .github/workflows/pages.yml   GitHub Pages deploy (optional)
```

## Backend environment variables

Only two:

| Variable | Value |
|---|---|
| `SESSION_SECRET` | Long random string. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CLIENT_ORIGIN` | Your frontend origin, no path and no trailing slash. Example: `https://yourname.github.io` |

(`PORT` is supplied by Render automatically.)

## Run locally

```bash
cd backend
cp .env.example .env        # CLIENT_ORIGIN=http://localhost:3000
npm install
npm start                   # http://localhost:4000

# second terminal
npx serve frontend -l 3000  # http://localhost:3000
```

`frontend/config.js` already points at `http://localhost:4000/api`.

## Deploy

### 1. Backend on Render

1. Push this folder to a GitHub repo.
2. Render: New > Web Service > pick the repo.
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Or use New > Blueprint, which reads `render.yaml`.
3. Add the two environment variables above. Set `CLIENT_ORIGIN` to your GitHub Pages origin, for example `https://yourname.github.io`.
4. Deploy, then open `https://YOUR-SERVICE.onrender.com/api/health`. You should see `{"ok":true}`.

### 2. Frontend on GitHub Pages

1. Edit `frontend/config.js`:
   ```js
   window.FLIPSTUDY_API_BASE = 'https://YOUR-SERVICE.onrender.com/api';
   ```
   It must end with `/api` (the app also adds it if you forget).
2. Commit and push to `main`.
3. Repo Settings > Pages > Source: **GitHub Actions**. The included workflow publishes the `frontend` folder.
4. Your site is at `https://yourname.github.io/REPO/`. Its origin (`https://yourname.github.io`) is what goes in `CLIENT_ORIGIN`.

## How it works

- **Register:** username, email, password. Then redirects to the login page.
- **Login:** username and password. Then redirects to `dashboard.html`.
- Passwords are hashed with bcrypt. Login tokens are signed with `SESSION_SECRET` and last 30 days. Changing your password signs out your other devices.
- Decks and cards are stored per user on the server. Theme, sound and study stats stay in the browser.
- No email is sent anywhere, and there is no password reset.

## Things to know

- **Render free tier:** the service sleeps after idle time, so the first request can take 30 to 60 seconds. The app shows a "try again" message if that happens.
- **Render free tier storage is not permanent.** The filesystem resets on each deploy or restart, which erases accounts and decks. To keep data, add a Render persistent disk (paid plan) mounted at `/opt/render/project/src/backend/data`, or swap `utils/db.js` for a hosted database.
- Changing `SESSION_SECRET` signs everyone out.
