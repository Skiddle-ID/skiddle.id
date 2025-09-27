/// <reference types="astro/client" />

declare var __GIT_HASH__: string;
declare var __GIT_TAG__: string;
declare var __GIT_DESCRIBE__: string;

// Cloudflare Worker environment bindings and variables
// Loosely typed for portability across environments.
interface Env {
  // Static assets binding (Cloudflare Pages/Workers)
  ASSETS: any;
  // KV namespace for caching or storage
  CACHE: any;

  // Existing app config
  ATP_IDENTIFIER: string;
  ATP_SERVICE: string;

  // Last.fm integration
  LASTFM_USERNAME: string;
  LASTFM_API_KEY: string;
}

// use a default runtime configuration (advanced mode).
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;
declare namespace App {
  interface Locals extends Runtime {}
}
