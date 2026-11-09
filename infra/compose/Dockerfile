FROM node@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/media-web/package.json ./apps/media-web/package.json
COPY apps/transfer-web/package.json ./apps/transfer-web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY services/transfer-api/package.json ./services/transfer-api/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm typecheck && pnpm test && pnpm build
RUN find /app -type d ! -perm -005 -exec chmod a+rx {} +

FROM build AS runtime
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 HOSTNAME=0.0.0.0
USER node

FROM runtime AS api
CMD ["node","--import","tsx","services/transfer-api/src/index.ts"]

FROM runtime AS media
ENV PORT=3100 NODE_OPTIONS=--max-old-space-size=256
CMD ["node","apps/media-web/.next/standalone/apps/media-web/server.js"]

FROM runtime AS transfer
ENV PORT=3101 NODE_OPTIONS=--max-old-space-size=256
CMD ["node","apps/transfer-web/.next/standalone/apps/transfer-web/server.js"]
