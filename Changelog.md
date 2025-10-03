# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [semantic Versioning](https://semver.org/spec/v2.0.0.html).

  ## [Unreleased]

  ### Added
- Light/Dark theme support via CSS variable theme switching (`src/style.css`).
- Theme toggle button with persistence in header (`src/components/header.astro`).
- Early inline script to apply preferred theme before paint and prevent FOUC (`src/layouts/shell.astro`).
- Primary color switcher in header with dropdown and persistence (`src/components/header.astro`).
- GitHub and Bluesky icons added to header (`src/components/header.astro`).
{{ ... }}
- SEO: `robots.txt` referencing the sitemap (`public/robots.txt`).
  - Sitemap now auto-discovers static pages under `src/pages` (excludes dynamic routes and endpoints) for better coverage (`src/pages/sitemap.xml.ts`).
  - Social: Dynamic OG image generator endpoint for posts returning SVG (`src/pages/og/posts/[rkey].svg.ts`).
  - Social: Posts now reference their dynamic OG image for previews (`src/pages/posts/[rkey].astro`).
  - Sidebar navigation component introduced (`src/components/sidebar.astro`) providing vertical menu with search, theme toggle, and primary color picker.
  - Projects page to showcase open-source work (`src/pages/projects.astro`) backed by a simple data source (`src/data/projects.ts`).
  - Data model: Added `databases` to `ProjectTech` and integrated into filters and tech stack display (`src/types/projects.ts`, `src/pages/projects.astro`).
  - Projects now support optional `languages` and `year` metadata in the data model and UI (`src/data/projects.ts`, `src/pages/projects.astro`).
  - Projects languages now render with Devicon icons via CDN fallbacking to `-plain` variant on error (`src/pages/projects.astro`).
  - UI: Project titles on the Projects page now use the primary theme color for emphasis (`src/pages/projects.astro`).
  - UI: Increased language icon size on Projects page to 32px for better readability (`src/pages/projects.astro`).

  ### Changed
  - Posts listing now renders Markdown formatting for summaries on `/posts` using Astro's Markdown processor; it extracts the first paragraph of the rendered HTML and supports Shiki syntax highlighting (`src/pages/posts/index.astro`).
  - Switched all pink text styles to blue for consistency:
  - Home page links and subtitle (`src/pages/index.astro`): `text-pink` -> `text-blue`.
  - Posts listing title color (`src/pages/posts/index.astro`): `text-pink` -> `text-blue`.
{{ ... }}
  - Header blinking block background (`src/components/header.astro`): `bg-pink` -> `bg-blue`.
  - Footer commit link hover color (`src/components/footer.astro`): `hover:text-pink` -> `hover:text-blue`.
{{ ... }}
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
 - Converted Services testimonials to a continuous marquee-style auto-scroll with pause-on-hover and reduced-motion support (`src/pages/services.astro`).
 - Aligned testimonial service names to canonical categories for SEO and schema consistency (`src/pages/services.astro`).
- Deleted the unused Webring module directory (`src/ring/`).
- SEO: Converted social images to absolute URLs for more reliable link previews (`src/components/base-head.astro`).
- SEO: Added BreadcrumbList JSON‑LD across pages based on URL path segments (`src/layouts/shell.astro`).
- SEO: Added bullets to document sitemap auto-discovery (`src/pages/sitemap.xml.ts`).
 - UX: Default theme is now dark when no saved preference exists (`src/layouts/shell.astro`).
 - RSS/Sitemap: Base URL now derived from the incoming request origin to support multiple domains (`src/pages/rss.xml.ts`, `src/pages/sitemap.xml.ts`).
  - Robots: `robots.txt` is now generated dynamically so the `Sitemap:` URL uses the incoming request origin (`src/pages/robots.txt.ts`).
  - Layout switched from top navigation bar to left sidebar. Replaced `Header` with `Sidebar` in layout and adjusted spacing: `pl-56` wrapper and removed `mt-10` offset on `<main>` (`src/layouts/shell.astro`). The old `header.astro` component remains in the codebase but is no longer used by the layout.
  - Navigation updated to include a link to `/projects` in the sidebar (`src/components/sidebar.astro`).
  - Projects page to showcase open-source work (`src/pages/projects.astro`) backed by a simple data source (`src/data/projects.ts`).

### Removed
 - Removed static `public/robots.txt` in favor of dynamic endpoint at `src/pages/robots.txt.ts` to ensure correct domain in `Sitemap:`.

### Fixed
{{ ... }}
- Last.fm SVG endpoint types and error handling improved (`src/pages/lastfm.svg.ts`).
 - Last.fm SVG invalid `xlink:href` causing "prefix not bound" XML error replaced with standard `href` on `<a>` elements (`src/pages/lastfm.svg.ts`).
