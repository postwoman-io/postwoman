{ pkgs, lib, config, inputs, ... }:

{
  # https://devenv.sh/packages/
  packages = with pkgs; [
    git
    openssl
    postgresql_16
    jq
    xxd
    # BE and Tauri stuff
    libsoup_3
    webkitgtk_4_1
    librsvg
    libappindicator
    libayatana-appindicator
    libappindicator-gtk3
    # FE and Node stuff
    nodejs_22
    nodePackages_latest.typescript-language-server
    nodePackages_latest.vls
    nodePackages_latest.prisma
    prisma-engines
  ];

  # https://devenv.sh/basics/
  #
  # NOTE: Setting these `PRISMA_*` environment variable fixes
  # Error: Failed to fetch sha256 checksum at https://binaries.prisma.sh/all_commits/<hash>/linux-nixos/libquery_engine.so.node.gz.sha256 - 404 Not Found
  # See: https://github.com/prisma/prisma/discussions/3120
  env = {
    APP_GREET = "Hoppscotch";
    PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
    PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
    PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";

    LD_LIBRARY_PATH = lib.makeLibraryPath [
      pkgs.libappindicator
      pkgs.libayatana-appindicator
      pkgs.libappindicator-gtk3
    ];
  };

  # https://devenv.sh/scripts/
  scripts.hello.exec = "echo hello from $APP_GREET";

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
  languages.javascript = {
    enable = true;
    pnpm = {
      enable = true;
    };
    npm = {
      enable = true;
    };
  };

  languages.typescript.enable = true;

  languages.rust = {
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

  # https://devenv.sh/pre-commit-hooks/
  # pre-commit.hooks.shellcheck.enable = true;

  # https://devenv.sh/processes/
  # processes.ping.exec = "ping example.com";

  # See full reference at https://devenv.sh/reference/options/
}
