# Skiddle ID — Coming Soon

A minimal static "Coming Soon" site while the full project is under construction.

## Structure

- `index.html` — Landing page
- `404.html` — Not found page
- `assets/styles.css` — Styles
- `assets/logo.svg` — Simple placeholder logo
- `robots.txt` — Disallow indexing while in development
- `Changelog.md` — Keep a Changelog (Unreleased section updated for all changes)

## Local preview

Open `index.html` directly in your browser, or serve the folder with any static server.

Example (Node):

```bash
npx serve .
```

## Deployment

This is a pure static site; deploy the root directory to any static host (e.g., GitHub Pages, Netlify, Vercel static, Cloudflare Pages).

- Ensure `index.html` is the entrypoint.
- Keep `robots.txt` while private; remove or relax it before launch.

## Customization

- Replace `assets/logo.svg` with your logo.
- Adjust brand colors in `assets/styles.css` (`--accent`, background, etc.).
- Update meta tags in `index.html` for title/description and social preview.
