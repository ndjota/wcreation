# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/notify-core packages/notify-core
COPY apps/mqtt-bridge apps/mqtt-bridge
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wcreation/shared run build \
  && pnpm --filter @wcreation/notify-core run build \
  && pnpm --filter @wcreation/mqtt-bridge run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
COPY --from=build /repo/apps/mqtt-bridge/dist ./dist
COPY --from=build /repo/apps/mqtt-bridge/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./node_modules/@wcreation/shared/dist
COPY --from=build /repo/packages/shared/package.json ./node_modules/@wcreation/shared/package.json
COPY --from=build /repo/packages/notify-core/dist ./node_modules/@wcreation/notify-core/dist
COPY --from=build /repo/packages/notify-core/package.json ./node_modules/@wcreation/notify-core/package.json
USER nodejs
ENV HEALTH_LISTEN_PORT=9090
EXPOSE 9090
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
