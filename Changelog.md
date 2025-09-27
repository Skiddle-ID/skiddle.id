# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Light/Dark theme support via CSS variable theme switching (`src/style.css`).
- Theme toggle button with persistence in header (`src/components/header.astro`).
- Early inline script to apply preferred theme before paint and prevent FOUC (`src/layouts/shell.astro`).
- Primary color switcher in header with dropdown and persistence (`src/components/header.astro`).
- GitHub and Bluesky icons added to header (`src/components/header.astro`).
- 404 not found page (`src/pages/404.astro`).
- Search box in header submitting to posts with `q` query param (`src/components/header.astro`).
- Home page avatar now loads from Bluesky profile (`skiddle.blue`) with GitHub avatar fallback (`src/pages/index.astro`).
- Works page redesigned as a CV/resume format with experience, education, skills, and projects (`src/pages/works.astro`).
- Uses page to showcase hardware, software, and development tools (`src/pages/uses.astro`).
- Last.fm "now playing" widget component (`src/components/LastFm.astro`).
 - Services page to highlight public offerings (`src/pages/services.astro`).
 - Navigation link to Services in header (`src/components/header.astro`).
 - Services link added to home page "On this site" section (`src/pages/index.astro`).
 - Testimonials section on Services page (`src/pages/services.astro`).
 - JSON-LD structured data for Services and Reviews for improved SEO (`src/pages/services.astro`).
- New service: Monitoring Setup (Grafana & Prometheus) with matching JSON-LD entry (`src/pages/services.astro`).

### Added
- SEO: Centralized Open Graph and Twitter Card meta tags with per-page title/description/image and proper canonical URL computation in Base Head (`src/components/base-head.astro`, `src/layouts/shell.astro`).
- SEO: JSON-LD structured data for Website, Organization, and current WebPage injected globally (`src/layouts/shell.astro`).
- SEO: Dynamic sitemap endpoint with key site routes (`src/pages/sitemap.xml.ts`).
- SEO: `robots.txt` referencing the sitemap (`public/robots.txt`).
  - Sitemap now auto-discovers static pages under `src/pages` (excludes dynamic routes and endpoints) for better coverage (`src/pages/sitemap.xml.ts`).
 - Social: Dynamic OG image generator endpoint for posts returning SVG (`src/pages/og/posts/[rkey].svg.ts`).
 - Social: Posts now reference their dynamic OG image for previews (`src/pages/posts/[rkey].astro`).

### Changed
- Switched all pink text styles to blue for consistency:
  - Home page links and subtitle (`src/pages/index.astro`): `text-pink` -> `text-blue`.
  - Posts listing title color (`src/pages/posts/index.astro`): `text-pink` -> `text-blue`.
{{ ... }}
  - Header blinking block background (`src/components/header.astro`): `bg-pink` -> `bg-blue`.
  - Footer commit link hover color (`src/components/footer.astro`): `hover:text-pink` -> `hover:text-blue`.
  - Global link color in prose (`src/style.css`): `a { color: var(--color-pink) }` -> `a { color: var(--color-blue) }`.
  - Mapped CSS variable in theme (`src/style.css`): `--color-pink` now points to `var(--color-blue)` to ensure any remaining references render as blue.
  - Updated base palette token (`src/style.css`): `--color-base0A` changed from `#ee5396` (pink) to `#82cfff` (blue) for consistency.
  - Refined theme toggle UI (`src/components/header.astro`): icon now reflects current theme (sun for light, moon for dark), icon size increased, and a subtle bordered/rounded style added.
  - Replaced theme toggle icons with outlined sun/moon SVGs for improved visual clarity (`src/components/header.astro`).
  - Refactored components to use `--color-primary` for primary text/background:
    - Header brand text and blink bar use `text-[var(--color-primary)]` / `bg-[var(--color-primary)]`.
    - Home and Posts pages use `text-[var(--color-primary)]` for titles/links.
    - Footer commit link hover uses `hover:text-[var(--color-primary)]`.
    - Ring page heading uses `text-[var(--color-primary)]`.
  - Normalized header control sizing and icon sizes for consistency (`src/components/header.astro`).
  - Switched header icons to Font Awesome and included CDN in base head (`src/components/header.astro`, `src/components/base-head.astro`).
  - Posts page supports filtering by `q` (title and content) and reflects counts (`src/pages/posts/index.astro`).
  - RSS: Reverted to use `@astrojs/rss` and removed `atom:link` in custom data to resolve XML namespace error (`src/pages/rss.xml.ts`).
  - Footer version now renders as `tag+hash` when building from a tagged commit (both parts link appropriately); falls back to short commit hash otherwise (`src/components/footer.astro`).
  - Footer version formatting tightened to remove unwanted spaces (e.g., `v1.0.0-0-gef5067f`) (`src/components/footer.astro`).
  - Footer no longer displays the distance from the tag; when a tag is available it renders as `vX.Y.Z-g…` (e.g., `v1.0.0-4-g…` or `v1.0.0-0-g…` both display as `v1.0.0-g…`) (`src/components/footer.astro`).
  - Redesigned Services page testimonials with modern card UI, star ratings, and badges for readability (`src/pages/services.astro`).
  - Converted Services page testimonials into an accessible slider/carousel with dots, prev/next controls, keyboard support, and auto‑advance (`src/pages/services.astro`).
 - Converted Services testimonials to a continuous marquee-style auto-scroll with pause-on-hover and reduced-motion support (`src/pages/services.astro`).
 - Aligned testimonial service names to canonical categories for SEO and schema consistency (`src/pages/services.astro`).
- Disabled Webring page by replacing content with a 410 Gone message (`src/pages/ring.astro`).
- Deleted the unused Webring module directory (`src/ring/`).

 - SEO: Home page now provides explicit `<title>` and meta description via layout props to improve SERP snippets (`src/pages/index.astro`).
 - SEO: Converted social images to absolute URLs for more reliable link previews (`src/components/base-head.astro`).
 - SEO: Added BreadcrumbList JSON‑LD across pages based on URL path segments (`src/layouts/shell.astro`).
 - SEO: Added bullets to document sitemap auto-discovery (`src/pages/sitemap.xml.ts`).
 - UX: Default theme is now dark when no saved preference exists (`src/layouts/shell.astro`).

### Fixed
- Social: Dynamic OG image route now explicitly server-rendered with `export const prerender = false;` to resolve `getStaticPaths()` requirement for dynamic routes (`src/pages/og/posts/[rkey].svg.ts`).
