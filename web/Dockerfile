# syntax=docker/dockerfile:1
# NEXT_PUBLIC_* values are baked in at build time, so the demo (mock) and the real app
# (api) are two images built from this file with different build arguments.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_DATA_SOURCE=mock
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_CSRF_COOKIE_NAME=slotera_csrf
# Real app: "false" during the invite-only pilot. Demo: the app origin it links to.
ARG NEXT_PUBLIC_SIGNUP_OPEN=true
ARG NEXT_PUBLIC_APP_URL=
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
# Sentry: empty DSN = off (the demo). The auth token arrives as a build secret, so it
# never lands in an image layer; without it, source maps are simply not uploaded.
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ARG SENTRY_RELEASE=
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_CSRF_COOKIE_NAME=$NEXT_PUBLIC_CSRF_COOKIE_NAME \
    NEXT_PUBLIC_SIGNUP_OPEN=$NEXT_PUBLIC_SIGNUP_OPEN \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_RELEASE=$SENTRY_RELEASE \
    NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
