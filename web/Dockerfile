FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG API_PROXY_TARGET=http://server:8080
ENV API_PROXY_TARGET=${API_PROXY_TARGET}
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user. The image previously ran as root, which turned any code
# execution in the Next.js server — the image optimizer CVEs being the live example — into
# root inside the container. `node` (uid 1000) ships with the base image.
#
# Ownership is set on copy rather than with a later `chown -R`, which would double the
# image's layer size.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000
CMD ["node", "server.js"]
