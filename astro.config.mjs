import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import childProcess from "child_process";
import tailwindcss from '@tailwindcss/vite';

// obtain Git commit hash
const hash = childProcess
  .execSync("git rev-parse --short HEAD")
  .toString()
  .trim();

// obtain Git tag if current commit is exactly at a tag; otherwise leave empty
let tag = "";
try {
  tag = childProcess
    .execSync("git describe --tags --exact-match")
    .toString()
    .trim();
} catch (e) {
  // Not on a tagged commit; leave tag as empty string
}

// obtain nearest tag description (e.g., v1.0.0-4-gabc123).
// With --long, exact tags become v1.0.0-0-g<hash>. With --always, fallback is just the hash.
let describe = hash;
try {
  describe = childProcess
    .execSync("git describe --tags --always --long")
    .toString()
    .trim();
} catch (e) {
  // Fallback remains the short hash
}

export default defineConfig({
  site: 'https://skiddle.id',
  // Keep Astro 6's HTML-aware whitespace handling. Astro 7 defaults to 'jsx',
  // which drops the space between adjacent inline elements in templates.
  compressHTML: true,

  adapter: cloudflare({
    imageService: 'cloudflare',
  }),
  // Markdown and MDX are rendered by Sätteri (Astro 7's default processor),
  // which has GitHub-Flavored Markdown and smart punctuation built in.
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: 'dark',
      wrap: true,
    },
  },
  integrations: [
    mdx(),
  ],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __GIT_HASH__: JSON.stringify(hash),
      __GIT_TAG__: JSON.stringify(tag),
      __GIT_DESCRIBE__: JSON.stringify(describe),
    },
  }
});
