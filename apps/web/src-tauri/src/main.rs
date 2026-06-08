// Prevents an extra console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ENV-LIMITED SCAFFOLD: structurally valid Tauri v2 entrypoint, NOT compiled in
// this environment (the Tauri CLI is absent). See docs/desktop.md for the build
// + sign workflow that requires the Rust + Tauri toolchain.

fn main() {
    re_shell_desktop_lib::run();
}
