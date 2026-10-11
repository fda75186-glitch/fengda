import { handleApi } from './api.mjs';

export default {
  fetch(request, env) {
    return handleApi(request, {
      DB: env.DB,
      BUCKET: env.BUCKET,
      allowedOrigins: (env.ALLOWED_ORIGINS || 'https://fda75186-glitch.github.io').split(',').map(value => value.trim()).filter(Boolean),
      allowLoopback: false,
      publicOrigin: env.PUBLIC_ORIGIN || new URL(request.url).origin,
    });
  },
};
