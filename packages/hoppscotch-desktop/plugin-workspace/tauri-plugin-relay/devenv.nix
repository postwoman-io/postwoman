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
    nodejs_22
    nodePackages_latest.typescript-language-server
    nodePackages_latest.vue-language-server
    cargo-edit
  ] ++ lib.optionals pkgs.stdenv.isDarwin darwinPackages
    ++ lib.optionals pkgs.stdenv.isLinux linuxPackages;

  env = {
    APP_GREET = "Hi!";
  } // lib.optionalAttrs pkgs.stdenv.isLinux {
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
