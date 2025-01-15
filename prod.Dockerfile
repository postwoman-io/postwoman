FROM node:20-alpine3.19 AS base_builder

WORKDIR /usr/src/app

ENV HOPP_ALLOW_RUNTIME_ENV=true

# Required by @hoppscotch/js-sandbox to build `isolated-vm`
RUN apk add python3 make g++

RUN npm install -g pnpm
COPY pnpm-lock.yaml .
RUN pnpm fetch

COPY . .
RUN pnpm install -f --offline

RUN npm uninstall -g cross-spawn && \
    npm cache clean --force && \
    # Remove any remaining old versions
    find /usr/local/lib/node_modules -name "cross-spawn" -type d -exec rm -rf {} + && \
    # Install cross-spawn v7 globally
    npm install -g cross-spawn@^7.0.6 --force

FROM base_builder AS backend_builder
WORKDIR /usr/src/app/packages/hoppscotch-backend
RUN pnpm exec prisma generate
RUN pnpm run build
RUN pnpm --filter=hoppscotch-backend deploy /dist/backend --prod
WORKDIR /dist/backend
RUN pnpm exec prisma generate

FROM node:20-alpine3.19 AS backend
RUN apk add caddy
RUN npm install -g pnpm

RUN npm uninstall -g cross-spawn && \
    npm cache clean --force && \
    # Remove any remaining old versions
    find /usr/local/lib/node_modules -name "cross-spawn" -type d -exec rm -rf {} + && \
    # Install cross-spawn v7 globally
    npm install -g cross-spawn@^7.0.6 --force

COPY --from=base_builder  /usr/src/app/packages/hoppscotch-backend/backend.Caddyfile /etc/caddy/backend.Caddyfile
COPY --from=backend_builder /dist/backend /dist/backend
COPY --from=base_builder /usr/src/app/packages/hoppscotch-backend/prod_run.mjs /dist/backend

# Remove the env file to avoid backend copying it in and using it
ENV PRODUCTION="true"
ENV PORT=8080
ENV APP_PORT=${PORT}
ENV DB_URL=${DATABASE_URL}

WORKDIR /dist/backend

CMD ["node", "prod_run.mjs"]
EXPOSE 80
EXPOSE 3170

FROM base_builder AS fe_builder
WORKDIR /usr/src/app/packages/hoppscotch-selfhost-web
RUN pnpm run generate

FROM caddy:2-alpine AS app
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/prod_run.mjs /site/prod_run.mjs
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/selfhost-web.Caddyfile /etc/caddy/selfhost-web.Caddyfile
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/dist/ /site/selfhost-web

RUN apk add nodejs npm

RUN npm install -g @import-meta-env/cli

EXPOSE 80
EXPOSE 3000

WORKDIR /site

CMD ["/bin/sh", "-c", "node /site/prod_run.mjs && caddy run --config /etc/caddy/selfhost-web.Caddyfile --adapter caddyfile"]

FROM base_builder AS sh_admin_builder
WORKDIR /usr/src/app/packages/hoppscotch-sh-admin
# Generate two builds for `sh-admin`, one based on subpath-access and the regular build
RUN pnpm run build --outDir dist-multiport-setup
RUN pnpm run build --outDir dist-subpath-access --base /admin/

FROM caddy:2-alpine AS sh_admin

COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/prod_run.mjs /site/prod_run.mjs
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/sh-admin-multiport-setup.Caddyfile /etc/caddy/sh-admin-multiport-setup.Caddyfile
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/sh-admin-subpath-access.Caddyfile /etc/caddy/sh-admin-subpath-access.Caddyfile
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-multiport-setup /site/sh-admin-multiport-setup
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-subpath-access /site/sh-admin-subpath-access

RUN apk add nodejs npm

RUN npm install -g @import-meta-env/cli

EXPOSE 80
EXPOSE 3100

WORKDIR /site

CMD ["node","/site/prod_run.mjs"]

FROM node:20-alpine3.19 AS aio

ENV PRODUCTION="true"
ENV PORT=8080
ENV APP_PORT=${PORT}
ENV DB_URL=${DATABASE_URL}

# Open Containers Initiative (OCI) labels - useful for bots like Renovate
LABEL org.opencontainers.image.source="https://github.com/hoppscotch/hoppscotch" \
  org.opencontainers.image.url="https://docs.hoppscotch.io" \
  org.opencontainers.image.licenses="MIT"

# Run this separately to use the cache from backend
RUN apk add caddy

RUN apk add tini curl

RUN npm install -g pnpm
RUN npm uninstall -g cross-spawn && \
    npm cache clean --force && \
    # Remove any remaining old versions
    find /usr/local/lib/node_modules -name "cross-spawn" -type d -exec rm -rf {} + && \
    # Install cross-spawn v7 globally
    npm install -g cross-spawn@^7.0.6 --force

# Copy necessary files
# Backend files
COPY --from=base_builder /usr/src/app/packages/hoppscotch-backend/backend.Caddyfile /etc/caddy/backend.Caddyfile
COPY --from=backend_builder /dist/backend /dist/backend
COPY --from=base_builder /usr/src/app/packages/hoppscotch-backend/prod_run.mjs /dist/backend

# FE Files
COPY --from=base_builder /usr/src/app/aio_run.mjs /usr/src/app/aio_run.mjs
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/dist /site/selfhost-web
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-multiport-setup /site/sh-admin-multiport-setup
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-subpath-access /site/sh-admin-subpath-access
COPY aio-multiport-setup.Caddyfile /etc/caddy/aio-multiport-setup.Caddyfile
COPY aio-subpath-access.Caddyfile /etc/caddy/aio-subpath-access.Caddyfile

RUN npm install -g @import-meta-env/cli

ENTRYPOINT [ "tini", "--" ]
COPY --chmod=755 healthcheck.sh /
HEALTHCHECK --interval=2s CMD /bin/sh /healthcheck.sh

WORKDIR /dist/backend

CMD ["node", "/usr/src/app/aio_run.mjs"]

# NOTE: Although these ports are exposed, the HOPP_ALTERNATE_AIO_PORT variable can be used to assign a user-specified port
EXPOSE 3170
EXPOSE 3000
EXPOSE 3100
EXPOSE 80
