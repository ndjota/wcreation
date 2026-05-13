# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/pwa apps/pwa
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wcreation/shared run build \
  && pnpm --filter @wcreation/pwa run build

FROM fholzer/nginx-brotli:latest AS runner
COPY apps/pwa/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /repo/apps/pwa/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
