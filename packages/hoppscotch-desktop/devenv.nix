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
    git
    postgresql_16
    # FE and Node stuff
    nodejs_22
    nodePackages_latest.typescript-language-server
    nodePackages_latest.vls
    nodePackages_latest.prisma
    prisma-engines
    # Cargo
    cargo-edit
  ] ++ lib.optionals pkgs.stdenv.isDarwin darwinPackages
    ++ lib.optionals pkgs.stdenv.isLinux linuxPackages;

  # https://devenv.sh/basics/
  env = {
    APP_GREET = "Hoppscotch";
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
  };

  enterShell = ''
    git --version
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

  # https://devenv.sh/pre-commit-hooks/
  # pre-commit.hooks.shellcheck.enable = true;

  # https://devenv.sh/processes/
  # processes.ping.exec = "ping example.com";

  # See full reference at https://devenv.sh/reference/options/
}
