import { AtpAgent } from '@atproto/api';
import { env } from 'cloudflare:workers';

export const atpAgent = (_locals?: App.Locals) => new AtpAgent({
  service: env.ATP_SERVICE,
});