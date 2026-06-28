# Deploy the Yura site

This is a **fully static site** (HTML/CSS/JS + images). No build step, no backend.
The interactive demo is bundled at `app/`, so everything works wherever you host it.

## Option A — Netlify Drop (easiest, ~30 seconds)
1. Go to <https://app.netlify.com/drop>
2. Drag the entire **`yura-site`** folder onto the page.
3. You get a live URL instantly (e.g. `your-site.netlify.app`). Done.

## Option B — Vercel
**Drag-and-drop:** go to <https://vercel.com/new>, import/drag the `yura-site` folder, deploy (framework preset: "Other").

**CLI:**
```powershell
npm i -g vercel
cd C:\Users\T774363\yura-site
vercel          # follow prompts; accept defaults
vercel --prod   # promote to production
```

## Option C — GitHub Pages
1. Push `yura-site` to a GitHub repo.
2. Settings → Pages → deploy from branch → root (`/`).

## Notes
- **Custom domain:** add it in your host's dashboard (e.g. `yura.health`).
- **Fonts** load from Google Fonts and **brand logos** are bundled locally — both work online.
- The live **demo** loads from `app/index.html` (relative path), so no separate server is needed.
- To preview locally before deploying:
  ```powershell
  cd C:\Users\T774363\yura-site
  python -m http.server 4300
  ```
  then open <http://localhost:4300>.
