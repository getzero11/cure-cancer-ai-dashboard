FROM node:24.0.0-bookworm-slim AS base

# Keep the package manager reproducible inside the build image too. This is a
# container-local install, not a host-global dependency.
RUN npm install --global npm@10.1.0 \
  && test "$(node --version)" = "v24.0.0" \
  && test "$(npm --version)" = "10.1.0"

WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.0.0-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
