# syntax=docker/dockerfile:1

# ---- Dependencies (cached on the lockfile) ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build: Next.js standalone output ----
FROM node:24-alpine AS build
WORKDIR /app
# The /api rewrite target is read at build time and baked into the standalone server.
ARG BACKEND_URL=http://backend:8080
ENV BACKEND_URL=${BACKEND_URL} NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Runtime: only the traced standalone files, non-root ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
