// ENV-LIMITED SCAFFOLD: Tauri v2 app builder. The desktop shell simply wraps the
// built apps/web dashboard (frontendDist = ../dist in tauri.conf.json) inside a
// native window. No custom Rust commands are wired yet; the dashboard talks to
// the existing local hub over HTTP/WS exactly as it does in the browser.
//
// NOT compiled here (Tauri CLI absent). See docs/desktop.md.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Re-Shell desktop application");
}
