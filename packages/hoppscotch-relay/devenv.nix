{ pkgs, lib, config, inputs, ... }:

{
  # https://devenv.sh/packages/
  packages = with pkgs; [
    git
    # Cargo
    cargo-edit
  ];

  # https://devenv.sh/basics/
  env = {
    APP_GREET = "Hoppscotch";
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
