{ pkgs, lib, config, inputs, ... }:

let
  rosettaPkgs =
    if pkgs.stdenv.isDarwin && pkgs.stdenv.isAarch64
    then pkgs.pkgsx86_64Darwin
    else pkgs;

  darwinPackages = with pkgs; [
    darwin.apple_sdk.frameworks.Security
    darwin.apple_sdk.frameworks.CoreServices
    darwin.apple_sdk.frameworks.CoreFoundation
    darwin.apple_sdk.frameworks.Foundation
    darwin.apple_sdk.frameworks.AppKit
    darwin.apple_sdk.frameworks.WebKit
  ];

  linuxPackages = with pkgs; [
    libsoup_3
    webkitgtk_4_1
    librsvg
    libappindicator
    libayatana-appindicator
  ];

in {
  # https://devenv.sh/packages/
  packages = with pkgs; [
    # General
    git
    lima
    colima
    docker
    jq
    # FE and Node
    nodejs_22
    nodePackages_latest.typescript-language-server
    nodePackages_latest.vue-language-server
    nodePackages_latest.prisma
    prisma-engines
    # Cargo and Rust
    cargo-edit
  ] ++ lib.optionals pkgs.stdenv.isDarwin darwinPackages
    ++ lib.optionals pkgs.stdenv.isLinux linuxPackages;

  # https://devenv.sh/basics/
  env = {
    APP_GREET = "Hoppscotch";
    DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/hoppscotch?connect_timeout=300";
    # Enable BuildKit for better build performance
    DOCKER_BUILDKIT = "1";
    COMPOSE_DOCKER_CLI_BUILD = "1";
  } // lib.optionalAttrs pkgs.stdenv.isLinux {
    # NOTE: Setting these `PRISMA_*` environment variable fixes
    # Error: Failed to fetch sha256 checksum at https://binaries.prisma.sh/all_commits/<hash>/linux-nixos/libquery_engine.so.node.gz.sha256 - 404 Not Found
    # See: https://github.com/prisma/prisma/discussions/3120
    PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
    PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
    PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";

    LD_LIBRARY_PATH = lib.makeLibraryPath [
      pkgs.libappindicator
      pkgs.libayatana-appindicator
    ];
  } // lib.optionalAttrs pkgs.stdenv.isDarwin {
    # Place to put macOS-specific environment variables
  };

  # https://devenv.sh/scripts/
  scripts = {
    hello.exec = "echo hello from $APP_GREET";
    e.exec = "emacs";
    lima-docker-setup.exec = "limactl start template://docker";
    lima-docker-clean.exec = "limactl rm -f $(limactl ls -q)";
    colima-docker-start.exec = "colima start --memory 8";

    docker-prune.exec = ''
      echo "Cleaning up unused Docker resources..."
      docker system prune -f
    '';

    docker-build-aio.exec = ''
      echo "Building Hoppscotch AIO container..."
      docker build \
        --build-arg DATABASE_URL="postgresql://postgres:testpass@host.docker.internal:5432/hoppscotch?connect_timeout=300" \
        --build-arg PORT=8080 \
        --build-arg PRODUCTION=true \
        --build-arg HOPP_ALLOW_RUNTIME_ENV=true \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --tag hoppscotch-aio \
        --target aio \
        --file prod.Dockerfile \
        --pull \
        .
    '';

    docker-run-aio.exec = ''
      echo "Starting Hoppscotch AIO container..."
      if docker ps -a | grep -q hoppscotch-aio; then
        echo "Removing existing hoppscotch-aio container..."
        docker rm -f hoppscotch-aio
      fi

      docker run -d \
        --name hoppscotch-aio \
        --env-file .env \
        -e DATABASE_URL="postgresql://postgres:testpass@host.docker.internal:5432/hoppscotch?connect_timeout=300" \
        -e PORT=8080 \
        -e APP_PORT=8080 \
        -e PRODUCTION=true \
        -e HOPP_ALLOW_RUNTIME_ENV=true \
        -p 80:80 \
        -p 3170:3170 \
        -p 3000:3000 \
        -p 3100:3100 \
        -p 3200:3200 \
        --add-host=host.docker.internal:host-gateway \
        --restart unless-stopped \
        --health-cmd "/bin/sh /healthcheck.sh" \
        --health-interval=2s \
        hoppscotch-aio

      echo "Container started. Services available at:"
      echo "  - Main app: http://localhost:3000"
      echo "  - Admin dashboard: http://localhost:3100"
      echo "  - Backend: http://localhost:3170"
      echo "  - Static Server: http://localhost:3200"
      echo "  - HTTP port: http://localhost:80"
      echo ""
      echo "To view logs: docker logs -f hoppscotch-aio"
      echo "To stop: devenv shell docker-stop-aio"
    '';

    docker-stop-aio.exec = ''
      echo "Stopping Hoppscotch AIO container..."
      docker stop hoppscotch-aio 2>/dev/null || true
      docker rm hoppscotch-aio 2>/dev/null || true
      echo "Stopped and removed container."
    '';

    docker-logs.exec = "docker logs -f hoppscotch-aio";

    docker-status.exec = ''
      echo "Container Status:"
      docker ps -a --filter "name=hoppscotch-aio" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    '';

    db-reset.exec = ''
      echo "Resetting database..."
      psql -U postgres -d hoppscotch -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
      echo "Database reset complete."
    '';
  };

  enterShell = ''
    git --version
    echo "Hoppscotch development environment ready!"
    echo "Available commands:"
    echo "  - docker-build-aio : Build the Hoppscotch AIO container"
    echo "  - docker-run-aio   : Run the Hoppscotch AIO container"
    echo "  - docker-stop-aio  : Stop and remove the container"
    echo "  - docker-logs      : View container logs"
    echo "  - docker-status    : Check container status"
    echo "  - docker-prune     : Clean up unused Docker resources"
    echo "  - db-reset         : Reset the database schema"
    ${lib.optionalString pkgs.stdenv.isDarwin ''
      # Place to put macOS-specific shell initialization
    ''}
    ${lib.optionalString pkgs.stdenv.isLinux ''
      # Place to put Linux-specific shell initialization
    ''}
  '';

  # https://devenv.sh/tests/
  enterTest = ''
    echo "Running tests"
  '';

  # https://devenv.sh/integrations/dotenv/
  dotenv.enable = true;

  # https://devenv.sh/languages/
  languages = {
    typescript.enable = true;
    javascript = {
      enable = true;
      pnpm.enable = true;
      npm.enable = true;
    };
    rust = {
      enable = true;
      channel = "nightly";
      components = [
        "rustc"
        "cargo"
        "clippy"
        "rustfmt"
        "rust-analyzer"
        "llvm-tools-preview"
        "rust-src"
        "rustc-codegen-cranelift-preview"
      ];
    };
  };

  services.postgres = {
    enable = true;
    package = pkgs.postgresql_16;
    initialDatabases = [{ name = "hoppscotch"; }];
    initialScript = ''
      CREATE USER postgres WITH PASSWORD 'testpass' SUPERUSER;
    '';
    settings = {
      max_connections = 100;
      shared_buffers = "128MB";
      effective_cache_size = "512MB";
      maintenance_work_mem = "128MB";
      checkpoint_completion_target = 0.9;
      wal_buffers = "16MB";
      default_statistics_target = 100;
      random_page_cost = 1.1;
      effective_io_concurrency = 200;
      work_mem = "16MB";
      min_wal_size = "1GB";
      max_wal_size = "4GB";
    };
  };

  # https://devenv.sh/pre-commit-hooks/
  # pre-commit.hooks.shellcheck.enable = true;

  # https://devenv.sh/processes/
  # processes.ping.exec = "ping example.com";

  # See full reference at https://devenv.sh/reference/options/
}
