# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install before `prisma generate` so it detects the same OpenSSL version as the runtime stage.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Production dependencies stage ---
FROM node:20-alpine AS prod-deps
WORKDIR /app

# Install before `prisma generate` so it detects the same OpenSSL version as the runtime stage.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine requires OpenSSL, which isn't present in the base alpine image.
RUN apk add --no-cache openssl

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=prod-deps --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./
COPY --chown=appuser:appgroup docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

USER appuser

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
