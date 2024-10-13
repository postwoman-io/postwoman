fn main() {
    tauri_build::build();
    println!("cargo::rerun-if-env-changed=UPDATER_PUB_KEY");
    println!("cargo::rerun-if-env-changed=UPDATER_URL");
}
