import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import childProcess from "child_process";
import fs from "node:fs";
import path from "node:path";

// Ensure dist/_worker.js/index.js exists before @cloudflare/vite-plugin validates Wrangler config.
// Astro deletes dist during build; the vite-plugin runs in config phase before dist is recreated.
// Creating a placeholder prevents "doesn't point to an existing file" on fresh builds.
try {
  fs.mkdirSync(path.resolve("dist/_worker.js"), { recursive: true });
  const placeholder = path.resolve("dist/_worker.js/index.js");
  if (!fs.existsSync(placeholder)) fs.writeFileSync(placeholder, "export default {};\n");
} catch {}

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

  adapter: cloudflare({
    imageService: 'cloudflare',
    platformProxy: {
      enabled: true,
    },
    entrypointResolution: "auto",
  }),
  vite: {
    plugins: [tailwindcss()],
    define: {
      __GIT_HASH__: JSON.stringify(hash),
      __GIT_TAG__: JSON.stringify(tag),
      __GIT_DESCRIBE__: JSON.stringify(describe),
    },
    build: {
      rollupOptions: {
        external: ['shiki/onig.wasm'],
      },
    },
  }
});
