# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Light/Dark theme support via CSS variable theme switching (`src/style.css`).
- Theme toggle button with persistence in header (`src/components/header.astro`).
- Early inline script to apply preferred theme before paint and prevent FOUC (`src/layouts/shell.astro`).

### Changed
- Switched all pink text styles to blue for consistency:
  - Home page links and subtitle (`src/pages/index.astro`): `text-pink` -> `text-blue`.
  - Posts listing title color (`src/pages/posts/index.astro`): `text-pink` -> `text-blue`.
  - Header brand color (`src/components/header.astro`): `text-base0A` -> `text-blue`.
  - Header blinking block background (`src/components/header.astro`): `bg-pink` -> `bg-blue`.
  - Footer commit link hover color (`src/components/footer.astro`): `hover:text-pink` -> `hover:text-blue`.
  - Global link color in prose (`src/style.css`): `a { color: var(--color-pink) }` -> `a { color: var(--color-blue) }`.
  - Mapped CSS variable in theme (`src/style.css`): `--color-pink` now points to `var(--color-blue)` to ensure any remaining references render as blue.
  - Updated base palette token (`src/style.css`): `--color-base0A` changed from `#ee5396` (pink) to `#82cfff` (blue) for consistency.
  - Refined theme toggle UI (`src/components/header.astro`): icon now reflects current theme (sun for light, moon for dark), icon size increased, and a subtle bordered/rounded style added.
  - Replaced theme toggle icons with outlined sun/moon SVGs for improved visual clarity (`src/components/header.astro`).

### Removed
- Removed Webring from the site navigation (`src/pages/index.astro`).
- Disabled Webring page by replacing content with a 410 Gone message (`src/pages/ring.astro`).
- Deleted the unused Webring module directory (`src/ring/`).
