{ pkgs, lib, config, inputs, ... }:

{
  # https://devenv.sh/packages/
  packages = with pkgs; [
    git
    postgresql_16
    # BE and Tauri stuff
    libsoup
    webkitgtk_4_0
    # FE and Node stuff
    nodejs_22
    nodePackages_latest.typescript-language-server
    nodePackages_latest.vls
    nodePackages_latest.prisma
    prisma-engines
    # CI
    act
    # Cargo
    cargo-edit
  ];

  # https://devenv.sh/basics/
  env = {
    APP_GREET = "Hoppscotch";
    # NOTE: Setting these `PRISMA_*` environment variable fixes
    # Error: Failed to fetch sha256 checksum at https://binaries.prisma.sh/all_commits/<hash>/linux-nixos/libquery_engine.so.node.gz.sha256 - 404 Not Found
    # See: https://github.com/prisma/prisma/discussions/3120
    PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
    PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
    PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";
  };


  # https://devenv.sh/scripts/
  scripts = {
    hello.exec = "echo hello from $APP_GREET";
    e.exec = "emacs";
  };

  enterShell = ''
    git --version
  '';

  # https://devenv.sh/tests/
  enterTest = ''
    echo "Running tests"
  '';

  # https://devenv.sh/integrations/dotenv/
  dotenv.enable = true;

  # https://devenv.sh/languages/

  # https://devenv.sh/languages/
  languages = {
    typescript.enable = true;

    javascript = {
      enable = true;
      pnpm = {
        enable = true;
      };
      npm = {
        enable = true;
      };
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

  # https://devenv.sh/pre-commit-hooks/
  # pre-commit.hooks.shellcheck.enable = true;

  # https://devenv.sh/processes/
  # processes.ping.exec = "ping example.com";

  # See full reference at https://devenv.sh/reference/options/
}
