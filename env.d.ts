/// <reference types="astro/client" />

declare var __GIT_HASH__: string;
declare var __GIT_TAG__: string;
declare var __GIT_DESCRIBE__: string;

// use a default runtime configuration (advanced mode).
type Runtime = import("@astrojs/cloudflare").Runtime<Env>;
declare namespace App {
  interface Locals extends Runtime {}
}
