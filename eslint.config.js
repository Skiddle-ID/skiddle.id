// ESLint 10 flat config: JavaScript, TypeScript and .astro files (including their <script>s)
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', '.wrangler/', 'node_modules/', '.claude/', 'worker-configuration.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Build-time constants from vite.define in astro.config.mjs
        __GIT_HASH__: 'readonly',
        __GIT_TAG__: 'readonly',
        __GIT_DESCRIBE__: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // `catch {}` is used on purpose around localStorage, clipboard and optional fetches
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Ambient type declarations: global `var`s, loose binding types and interface merging are normal here
    files: ['**/*.d.ts'],
    rules: {
      'no-var': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
