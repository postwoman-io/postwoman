# This step is used to build a custom build of Caddy to prevent
# vulnerable packages on the dependency chain
FROM alpine:3.21.2 AS caddy_builder
RUN apk add curl go

RUN mkdir -p /tmp/caddy-build

RUN curl -L -o /tmp/caddy-build/src.tar.gz https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_src.tar.gz

# Checksum verification of caddy source
RUN expected="1cfd6127f9ed8dc908d84d7d14579d3ce5114e8671aa8f786745cb3fe60923e0" && \
    actual=$(sha256sum /tmp/caddy-build/src.tar.gz | cut -d' ' -f1) && \
    [ "$actual" = "$expected" ] && \
    echo "✅ Caddy Source Checksum OK" || \
    (echo "❌ Caddy Source Checksum failed!" && exit 1)

WORKDIR /tmp/caddy-build
RUN tar xvf /tmp/caddy-build/src.tar.gz

# Patch to resolve CVE-2024-45339 on glog
RUN go get github.com/golang/glog@v1.2.4
RUN go mod vendor

WORKDIR /tmp/caddy-build/cmd/caddy
RUN go build



FROM alpine:3.19.6 AS base_builder
RUN apk add nodejs curl

# Install NPM from source, as Alpine version is old and has dependency vulnerabilities
# TODO: Find a better method which is resistant to supply chain attacks
RUN sh -c "curl -qL https://www.npmjs.com/install.sh | env npm_install=10.9.2 sh"

WORKDIR /usr/src/app

ENV HOPP_ALLOW_RUNTIME_ENV=true

# Required by @hoppscotch/js-sandbox to build `isolated-vm`
RUN apk add python3 make g++ zlib-dev brotli-dev c-ares-dev nghttp2-dev openssl-dev icu-dev

RUN npm install -g pnpm
COPY pnpm-lock.yaml .
RUN pnpm fetch

COPY . .
RUN pnpm install -f --offline



FROM base_builder AS backend_builder
WORKDIR /usr/src/app/packages/hoppscotch-backend
RUN pnpm exec prisma generate
RUN pnpm run build
RUN pnpm --filter=hoppscotch-backend deploy /dist/backend --prod
WORKDIR /dist/backend
RUN pnpm exec prisma generate

FROM alpine:3.19.6 AS backend
RUN apk add nodejs curl

# Install NPM from source, as Alpine version is old and has dependency vulnerabilities
# TODO: Find a better method which is resistant to supply chain attacks
RUN sh -c "curl -qL https://www.npmjs.com/install.sh | env npm_install=10.9.2 sh"

# Install caddy
COPY --from=caddy_builder /tmp/caddy-build/cmd/caddy/caddy /usr/bin/caddy

RUN npm install -g pnpm

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




FROM alpine:3.19.6 AS app
RUN apk add nodejs curl

# Install NPM from source, as Alpine version is old and has dependency vulnerabilities
# TODO: Find a better method which is resistant to supply chain attacks
RUN sh -c "curl -qL https://www.npmjs.com/install.sh | env npm_install=10.9.2 sh"

# Install caddy
COPY --from=caddy_builder /tmp/caddy-build/cmd/caddy/caddy /usr/bin/caddy

COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/prod_run.mjs /site/prod_run.mjs
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/selfhost-web.Caddyfile /etc/caddy/selfhost-web.Caddyfile
COPY --from=fe_builder /usr/src/app/packages/hoppscotch-selfhost-web/dist/ /site/selfhost-web


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





FROM alpine:3.19.6 AS sh_admin
RUN apk add nodejs curl

# Install NPM from source, as Alpine version is old and has dependency vulnerabilities
# TODO: Find a better method which is resistant to supply chain attacks
RUN sh -c "curl -qL https://www.npmjs.com/install.sh | env npm_install=10.9.2 sh"

# Install caddy
COPY --from=caddy_builder /tmp/caddy-build/cmd/caddy/caddy /usr/bin/caddy

COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/prod_run.mjs /site/prod_run.mjs
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/sh-admin-multiport-setup.Caddyfile /etc/caddy/sh-admin-multiport-setup.Caddyfile
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/sh-admin-subpath-access.Caddyfile /etc/caddy/sh-admin-subpath-access.Caddyfile
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-multiport-setup /site/sh-admin-multiport-setup
COPY --from=sh_admin_builder /usr/src/app/packages/hoppscotch-sh-admin/dist-subpath-access /site/sh-admin-subpath-access


RUN npm install -g @import-meta-env/cli

EXPOSE 80
EXPOSE 3100

WORKDIR /site

CMD ["node","/site/prod_run.mjs"]

FROM alpine:3.19.6 AS aio

RUN apk add nodejs curl

# Install NPM from source, as Alpine version is old and has dependency vulnerabilities
# TODO: Find a better method which is resistant to supply chain attacks
RUN sh -c "curl -qL https://www.npmjs.com/install.sh | env npm_install=10.9.2 sh"

# Caddy install
COPY --from=caddy_builder /tmp/caddy-build/cmd/caddy/caddy /usr/bin/caddy

ENV PRODUCTION="true"
ENV PORT=8080
ENV APP_PORT=${PORT}
ENV DB_URL=${DATABASE_URL}

# Open Containers Initiative (OCI) labels - useful for bots like Renovate
LABEL org.opencontainers.image.source="https://github.com/hoppscotch/hoppscotch" \
  org.opencontainers.image.url="https://docs.hoppscotch.io" \
  org.opencontainers.image.licenses="MIT"

RUN apk add tini

RUN npm install -g pnpm

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
