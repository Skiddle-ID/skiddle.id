import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import childProcess from "child_process";

import tailwindcss from '@tailwindcss/vite';

// obtain Git commit hash
const hash = childProcess
  .execSync("git rev-parse --short HEAD")
  .toString()
  .trim();

export default defineConfig({
  site: 'https://skiddle.id',

  adapter: cloudflare({
    imageService: 'cloudflare',
    platformProxy: {
      enabled: true,
    }
  }),
  vite: {
    plugins: [tailwindcss()],
    define: {
      __GIT_HASH__: JSON.stringify(hash),
    },
    build: {
      rollupOptions: {
        external: ['shiki/onig.wasm'],
      },
    },
  }
});
