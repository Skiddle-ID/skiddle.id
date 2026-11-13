import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import childProcess from "child_process";
import tailwindcss from '@tailwindcss/vite';

// Run a git command and return its trimmed output, or '' if it fails (no git, no repo, no tag…)
const git = (args) => {
  try {
    return childProcess
      .execSync(`git ${args}`, {
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        timeout: 60_000,
      })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

// Cloudflare Workers Builds (WORKERS_CI=1) may check out a shallow clone without tags.
// Fetch history and tags so the footer can still show the release, e.g. "v3.1+abc1234".
if (process.env.WORKERS_CI) {
  if (git('rev-parse --is-shallow-repository') === 'true') git('fetch --quiet --unshallow --tags');
  else if (!git('tag --list')) git('fetch --quiet --tags');
}

// Git commit hash; falls back to the CI commit, then "dev" outside a git checkout
const hash = git('rev-parse --short HEAD') || (process.env.WORKERS_CI_COMMIT_SHA ?? '').slice(0, 7) || 'dev';

// Git tag if the current commit is exactly at a tag; otherwise empty
const tag = git('describe --tags --exact-match');

// Nearest tag description (e.g., v1.0.0-4-gabc123).
// With --long, exact tags become v1.0.0-0-g<hash>. With --always, fallback is just the hash.
const describe = git('describe --tags --always --long') || hash;

export default defineConfig({
  site: 'https://skiddle.id',
  // Keep Astro 6's HTML-aware whitespace handling. Astro 7 defaults to 'jsx',
  // which drops the space between adjacent inline elements in templates.
  compressHTML: true,

  // The site doesn't use Astro sessions. Without this, the Cloudflare adapter adds a
  // SESSION KV binding with no namespace id: production deploys inherit the old one,
  // but Worker Previews reject it ("binding SESSION ... must have a namespace_id").
  session: false,

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
