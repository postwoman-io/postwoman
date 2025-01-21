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
  packages = with pkgs; [
    git
    lima
    colima
    docker
    jq
    nodejs_22
    nodePackages_latest.typescript-language-server
    nodePackages_latest."@volar/vue-language-server"
    nodePackages_latest.prisma
    prisma-engines
    cargo-edit
  ] ++ lib.optionals pkgs.stdenv.isDarwin darwinPackages
    ++ lib.optionals pkgs.stdenv.isLinux linuxPackages;

  env = {
    APP_GREET = "Hoppscotch";
    DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/hoppscotch?connect_timeout=300";
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

    docker-clean-all.exec = ''
      echo "Starting complete Docker cleanup..."

      echo "1/6: Stopping all running containers..."
      CONTAINERS=$(docker ps -q)
      if [ -n "$CONTAINERS" ]; then
        docker stop $CONTAINERS
        echo "✓  Containers stopped"
      else
        echo "• No running containers found"
      fi

      echo "2/6: Removing all containers..."
      CONTAINERS=$(docker ps -aq)
      if [ -n "$CONTAINERS" ]; then
        docker rm $CONTAINERS
        echo "✓  Containers removed"
      else
        echo "• No containers to remove"
      fi

      echo "3/6: Removing all images..."
      IMAGES=$(docker images -q)
      if [ -n "$IMAGES" ]; then
        docker rmi --force $IMAGES
        echo "✓  Images removed"
      else
        echo "• No images to remove"
      fi

      echo "4/6: Removing all volumes..."
      VOLUMES=$(docker volume ls -q)
      if [ -n "$VOLUMES" ]; then
        docker volume rm $VOLUMES
        echo "✓  Volumes removed"
      else
        echo "• No volumes to remove"
      fi

      echo "5/6: Removing custom networks..."
      NETWORKS=$(docker network ls --filter type=custom -q)
      if [ -n "$NETWORKS" ]; then
        docker network rm $NETWORKS
        echo "✓  Networks removed"
      else
        echo "• No custom networks to remove"
      fi

      echo "6/6: Running system prune..."
      docker system prune --all --force --volumes
      echo "✓  System pruned"

      echo "Done!"
    '';
  };

  enterShell = ''
    git --version
    echo "Hoppscotch development environment ready!"
    ${lib.optionalString pkgs.stdenv.isDarwin ''
      # Place to put macOS-specific shell initialization
    ''}
    ${lib.optionalString pkgs.stdenv.isLinux ''
      # Place to put Linux-specific shell initialization
    ''}
  '';

  enterTest = ''
    echo "Running tests"
  '';

  dotenv.enable = true;

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
}
