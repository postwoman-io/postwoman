# Hoppscotch Desktop App

## Notes

- Remember to `pnpm build` in `tauri-plugin-hoppscotch-appload` before running the `pnpm tauri dev` server. Those exports needs to be built in `tauri-plugin-hoppscotch-appload/dist-js` before they can be used.

- Always check `build.rs` file in the plugin directory to make sure newly added commands are defined in the `COMMANDS` static str, these are used to generate permissions. This should regenerate `permissions` directory contents. Default permissions can be set with `default.toml` in the same directory.
