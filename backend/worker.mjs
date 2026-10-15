import { handleApi } from './api.mjs';

export default {
  fetch(request, env) {
    return handleApi(request, {
      DB: env.DB,
      BUCKET: env.BUCKET,
      TENCENT_API_KEY: env.TENCENT_API_KEY,
      TENCENT_AI_ENDPOINT: env.TENCENT_AI_ENDPOINT,
      TENCENT_AI_MODEL: env.TENCENT_AI_MODEL,
      TENCENT_IMAGE_ENABLED: env.TENCENT_IMAGE_ENABLED,
      allowedOrigins: (env.ALLOWED_ORIGINS || 'https://fda75186-glitch.github.io').split(',').map(value => value.trim()).filter(Boolean),
      allowLoopback: false,
      publicOrigin: env.PUBLIC_ORIGIN || new URL(request.url).origin,
    });
  },
};
