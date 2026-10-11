// Tauri v2 desktop shell for the Re-Shell dashboard.
//
// On startup this app:
//   1. locates Node.js (>= 18) and the bundled hub-server.js,
//   2. spawns the hub as a child process on a free 127.0.0.1 port with a freshly
//      generated random session token,
//   3. waits for an authenticated GET /health,
//   4. opens the dashboard window with `window.__RE_SHELL_HUB__ = { url, token }`
//      injected before any page script runs (the same runtime contract the CLI's
//      static server uses, so the dashboard needs no desktop-specific code),
//   5. stops the hub when the app exits.
//
// If the hub cannot be started the window shows why (an explicit in-window
// error), and the process exits with status 1 when that window is closed. There
// is no code path that opens a dashboard pretending a hub exists.
//
// See docs/desktop.md.

pub mod hub;
pub mod webview;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::utils::config::Csp;
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

use hub::{Hub, HubError, HubOptions, NodeSearch};

const MAIN_WINDOW: &str = "main";
const HUB_READY_TIMEOUT: Duration = Duration::from_secs(20);
const HUB_BIND_ATTEMPTS: u32 = 5;
const HUB_STOP_GRACE: Duration = Duration::from_secs(5);
const WATCHDOG_INTERVAL: Duration = Duration::from_secs(1);

/// What the window is told at startup.
enum Startup {
    Ready { url: String, token: String },
    Failed { message: String },
}

/// Shared app state: the hub we own and lifecycle flags.
struct AppState {
    hub: Mutex<Option<Hub>>,
    startup_failed: AtomicBool,
    options: Mutex<Option<HubOptions>>,
    port: u16,
    window_label: Mutex<String>,
    window_generation: AtomicU64,
    restarting: AtomicBool,
    updating: AtomicBool,
    update_installing: AtomicBool,
    exiting: AtomicBool,
}

/// Find everything the hub needs and start it.
fn hub_options(context: &tauri::Context<tauri::Wry>) -> Result<HubOptions, HubError> {
    let resource_dir =
        tauri::utils::platform::resource_dir(context.package_info(), &tauri::utils::Env::default())
            .ok();
    let sidecar_name = if cfg!(windows) {
        "re-shell-node.exe"
    } else {
        "re-shell-node"
    };
    let packaged_node = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|dir| dir.join(sidecar_name)));
    let dev_node = if cfg!(debug_assertions) {
        Some(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("binaries")
                .join(format!(
                    "re-shell-node-{}{}",
                    env!("TAURI_ENV_TARGET_TRIPLE"),
                    if cfg!(windows) { ".exe" } else { "" }
                )),
        )
    } else {
        None
    };
    let node_path = packaged_node.filter(|path| path.exists()).or(dev_node);
    let node = hub::resolve_desktop_node(&NodeSearch::from_env(), node_path.as_deref())?;
    let version = hub::check_node_version(&node)?;
    println!("[desktop] using Node.js {version} at {}", node.display());
    // Debug builds (`tauri dev`) can also use the dashboard build output directly.
    let dev_fallback = if cfg!(debug_assertions) {
        Some(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("dist")
                .join("hub-server.js"),
        )
    } else {
        None
    };
    let bundle = hub::resolve_bundle(
        std::env::var_os("RE_SHELL_HUB_BUNDLE").as_deref(),
        resource_dir.as_deref(),
        dev_fallback.as_deref(),
    )?;

    let remembered = hub::load_workspace(hub::user_home().as_deref());
    let workspace_override =
        std::env::var_os("RE_SHELL_WORKSPACE").or_else(|| remembered.map(PathBuf::into_os_string));
    let workspace = hub::resolve_workspace(
        std::env::args_os(),
        workspace_override.as_deref(),
        std::env::current_dir().ok().as_deref(),
        hub::user_home().as_deref(),
    );
    println!("[desktop] workspace: {}", workspace.display());

    Ok(HubOptions {
        node,
        bundle,
        workspace,
        allowed_origins: webview::webview_origins(dev_url(context).as_ref()),
        ready_timeout: HUB_READY_TIMEOUT,
        bind_attempts: HUB_BIND_ATTEMPTS,
    })
}

/// The Vite dev server URL, only meaningful in debug builds (`tauri dev`).
fn dev_url(context: &tauri::Context<tauri::Wry>) -> Option<Url> {
    if cfg!(debug_assertions) {
        context.config().build.dev_url.clone()
    } else {
        None
    }
}

fn pin_csp_option(csp: &mut Option<Csp>, port: u16) {
    if let Some(Csp::Policy(policy)) = csp {
        *policy = webview::pin_csp(policy, port);
    }
}

fn create_main_window(
    app: &tauri::App,
    startup: &Startup,
    dev_url: Option<Url>,
) -> tauri::Result<()> {
    let window_config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .expect("tauri.conf.json must declare the main window (with create: false)");

    match startup {
        Startup::Ready { url, token } => {
            WebviewWindowBuilder::from_config(app.handle(), &window_config)?
                .initialization_script(webview::hub_init_script(url, token))
                // The webview holds the hub token: keep it on the app's own origin.
                .on_navigation(move |target| {
                    webview::is_allowed_navigation(target, dev_url.as_ref())
                })
                .build()?;
        }
        Startup::Failed { message } => {
            // A static, scriptless page that holds no credentials; the window
            // may not navigate away from it.
            let page = webview::error_page_url("Re-Shell could not start its local hub", message);
            WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::External(page))
                .title(window_config.title.clone())
                .inner_size(900.0, 600.0)
                // The engine re-serializes the data URL, so match its kind, not
                // its exact text.
                .on_navigation(webview::is_error_page)
                .build()?;
        }
    }
    Ok(())
}

/// Report (never hide) a hub that dies while the app is running.
fn spawn_hub_watchdog(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(WATCHDOG_INTERVAL);
        let state = app.state::<AppState>();
        if state.exiting.load(Ordering::SeqCst) {
            return;
        }
        if state.restarting.load(Ordering::SeqCst) {
            continue;
        }
        let status = match state.hub.try_lock() {
            Ok(mut guard) => {
                let status = guard.as_mut().and_then(Hub::exit_status);
                if status.is_some() {
                    guard.take();
                }
                status
            }
            Err(_) => None,
        };
        if let Some(status) = status {
            if state.exiting.load(Ordering::SeqCst) {
                return;
            }
            if state.restarting.load(Ordering::SeqCst) {
                continue;
            }
            let detail = match status.code() {
                Some(code) => format!("exit code {code}"),
                None => "terminated by a signal".to_string(),
            };
            eprintln!("[desktop] the hub stopped unexpectedly ({detail})");
            let label = current_window_label(&state);
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.eval(webview::banner_script(
                    "The local Re-Shell hub stopped",
                    &format!("The hub process exited unexpectedly ({detail}). Use Re-Shell → Restart Local Hub to recover. Running jobs may have stopped."),
                ));
            }
        }
    });
}

fn current_window_label(state: &AppState) -> String {
    state
        .window_label
        .lock()
        .unwrap_or_else(|error| {
            eprintln!("[desktop] recovering retained window label after a poisoned lock");
            error.into_inner()
        })
        .clone()
}

fn set_window_label(state: &AppState, label: String) {
    *state.window_label.lock().unwrap_or_else(|error| {
        eprintln!("[desktop] recovering retained window label after a poisoned lock");
        error.into_inner()
    }) = label;
}

fn dialog(
    app: &AppHandle,
    title: &str,
    body: impl Into<String>,
) -> tauri_plugin_dialog::MessageDialogBuilder<tauri::Wry> {
    let builder = app.dialog().message(body).title(title);
    let label = app
        .state::<AppState>()
        .window_label
        .lock()
        .ok()
        .map(|label| label.clone());
    match label.and_then(|label| app.get_webview_window(&label)) {
        Some(window) => builder.parent(&window),
        None => builder,
    }
}

fn message(app: &AppHandle, title: &str, body: impl Into<String>) {
    println!("[desktop] dialog: {title}");
    dialog(app, title, body).show(|_| {});
}

fn pick_workspace(app: AppHandle) {
    let handle = app.clone();
    app.dialog()
        .file()
        .set_title("Open Re-Shell Workspace")
        .pick_folder(move |folder| {
            if let Some(folder) = folder {
                match folder.into_path() {
                    Ok(path) => restart_hub(handle, Some(path)),
                    Err(err) => message(&handle, "Workspace could not be opened", err.to_string()),
                }
            }
        });
}

/// Serializes replacement with shutdown and the watchdog. Reuse the original
/// port so the CSP stays pinned, but recreate the window with a fresh token.
fn restart_hub(app: AppHandle, workspace: Option<PathBuf>) {
    let state = app.state::<AppState>();
    if state.port == 0 {
        message(
            &app,
            "Restart required",
            "The hub did not start on launch. Correct the startup error and reopen Re-Shell.",
        );
        return;
    }
    if state.restarting.swap(true, Ordering::SeqCst) {
        message(
            &app,
            "Hub restart in progress",
            "Try this action again after the current hub restart finishes.",
        );
        return;
    }
    thread::spawn(move || {
        let state = app.state::<AppState>();
        let result = (|| -> Result<(String, String, PathBuf), String> {
            let mut opts = state
                .options
                .lock()
                .map_err(|e| e.to_string())?
                .clone()
                .ok_or("hub options unavailable")?;
            if let Some(workspace) = workspace {
                if !workspace.is_dir() {
                    return Err("The selected folder is no longer available.".into());
                }
                opts.workspace = workspace;
            }
            let mut guard = state.hub.lock().map_err(|e| e.to_string())?;
            if state.exiting.load(Ordering::SeqCst) {
                return Err("Re-Shell is closing.".into());
            }
            if let Some(mut previous) = guard.take() {
                previous.stop(HUB_STOP_GRACE);
            }
            let hub = Hub::restart_on_port(&opts, state.port).map_err(|e| e.to_string())?;
            println!(
                "[desktop] hub ready after restart at {} (pid {}), workspace {}",
                hub.url(),
                hub.pid(),
                opts.workspace.display()
            );
            let payload = (hub.url(), hub.token().to_string(), opts.workspace.clone());
            *guard = Some(hub);
            *state.options.lock().map_err(|e| e.to_string())? = Some(opts);
            Ok(payload)
        })();
        match result {
            Ok((url, token, workspace)) => {
                let handle = app.clone();
                if let Err(err) = app.run_on_main_thread(move || {
                    let state = handle.state::<AppState>();
                    if state.exiting.load(Ordering::SeqCst) { return; }
                    let old_label = current_window_label(&state);
                    let next = format!("main-recovery-{}", state.window_generation.fetch_add(1, Ordering::SeqCst));
                    let mut config = handle.config().app.windows[0].clone();
                    config.label = next.clone();
                    let dev = if cfg!(debug_assertions) { handle.config().build.dev_url.clone() } else { None };
                    let replacement = WebviewWindowBuilder::from_config(&handle, &config)
                        .and_then(|builder| builder
                            .initialization_script(webview::hub_init_script(&url, &token))
                            .on_navigation(move |target| webview::is_allowed_navigation(target, dev.as_ref()))
                            .build());
                    match replacement {
                        Ok(_) => {
                            set_window_label(&state, next);
                            state.startup_failed.store(false, Ordering::SeqCst);
                            if let Some(previous) = handle.get_webview_window(&old_label) { let _ = previous.close(); }
                            // Persist only a workspace that successfully started its authenticated hub.
                            if let Some(dir) = hub::user_home().map(|home| home.join(".re-shell")) {
                                if let Err(err) = hub::save_workspace(&dir, &workspace) {
                                    message(&handle, "Workspace opened", format!("The workspace opened, but could not be remembered: {err}"));
                                }
                            }
                        }
                        Err(err) => {
                            if let Ok(mut guard) = state.hub.lock() { guard.take(); }
                            message(&handle, "Hub restart failed", err.to_string());
                        }
                    }
                    state.restarting.store(false, Ordering::SeqCst);
                }) {
                    state.restarting.store(false, Ordering::SeqCst);
                    message(&app, "Hub restart failed", err.to_string());
                }
            }
            Err(err) => {
                state.restarting.store(false, Ordering::SeqCst);
                message(
                    &app,
                    "Hub restart failed",
                    format!("{err}\nUse Restart Local Hub to try again."),
                );
            }
        }
    });
}

/// Public key and feed are compiled into signed distributions. A development
/// or unsigned build never falls back to an unverified update source.
fn check_updates(app: AppHandle) {
    let state = app.state::<AppState>();
    let key = option_env!("RE_SHELL_UPDATER_PUBLIC_KEY").unwrap_or("");
    let endpoint = option_env!("RE_SHELL_UPDATER_ENDPOINT").unwrap_or("");
    let Some(endpoint) = Url::parse(endpoint)
        .ok()
        .filter(|url| url.scheme() == "https")
    else {
        message(
            &app,
            "Updates unavailable",
            "This build has no signed HTTPS update feed. Install a newer desktop release manually.",
        );
        return;
    };
    if key.is_empty() {
        message(
            &app,
            "Updates unavailable",
            "This build has no updater verification key. Install a newer desktop release manually.",
        );
        return;
    }
    if state.updating.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        let result = async {
            let cleanup = app.clone();
            let updater = app.updater_builder().pubkey(key).endpoints(vec![endpoint])?
                .timeout(Duration::from_secs(30))
                .on_before_exit(move || pause_hub_for_update(&cleanup))
                .build()?;
            match updater.check().await? {
                Some(update) => {
                    let handle = app.clone();
                    let version = update.version.clone();
                    let (sender, receiver) = std::sync::mpsc::channel();
                    dialog(&app, "Desktop update available", format!("Re-Shell Desktop {version} is available. Install it and restart? Save your work first."))
                        .buttons(MessageDialogButtons::OkCancel)
                        .show(move |accepted| { let _ = sender.send(accepted); });
                    let accepted = tauri::async_runtime::spawn_blocking(move || receiver.recv()).await.ok().and_then(Result::ok);
                    if accepted == Some(true) {
                        begin_update_install(&app.state::<AppState>())?;
                        update.download_and_install(|_, _| {}, || {}).await?;
                        stop_hub(&handle);
                        handle.restart();
                    }
                }
                None => message(&app, "Re-Shell is up to date", "No newer desktop release is available."),
            }
            Ok::<(), tauri_plugin_updater::Error>(())
        }.await;
        if let Err(err) = result {
            let state = app.state::<AppState>();
            // Windows can fail to launch its installer after the before-exit
            // hook ran. Keep the watchdog alive and release only the updater's
            // lifecycle guard, so the native recovery action remains usable.
            let owned_guard = finish_failed_update_install(&state);
            let hub_stopped = owned_guard && state.hub.lock().ok().is_some_and(|hub| hub.is_none());
            let detail = if hub_stopped {
                format!("{err}\nUse Re-Shell → Restart Local Hub to reconnect.")
            } else {
                err.to_string()
            };
            message(&app, "Update failed", detail);
        }
        app.state::<AppState>()
            .updating
            .store(false, Ordering::SeqCst);
    });
}

fn begin_update_install(state: &AppState) -> Result<(), std::io::Error> {
    state
        .restarting
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| {
            std::io::Error::new(
                std::io::ErrorKind::WouldBlock,
                "Wait for the current hub restart to finish, then retry the update.",
            )
        })?;
    state.update_installing.store(true, Ordering::SeqCst);
    Ok(())
}

fn finish_failed_update_install(state: &AppState) -> bool {
    if state.update_installing.swap(false, Ordering::SeqCst) {
        state.restarting.store(false, Ordering::SeqCst);
        true
    } else {
        false
    }
}

fn pause_hub_for_update(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.restarting.store(true, Ordering::SeqCst);
    if let Some(mut hub) = state.hub.lock().ok().and_then(|mut guard| guard.take()) {
        hub.stop(HUB_STOP_GRACE);
    }
}

fn stop_hub(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.exiting.store(true, Ordering::SeqCst);
    if let Some(mut hub) = state.hub.lock().ok().and_then(|mut guard| guard.take()) {
        hub.stop(HUB_STOP_GRACE);
    }
}

fn on_exit(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.exiting.store(true, Ordering::SeqCst);
    let hub = state.hub.lock().ok().and_then(|mut guard| guard.take());
    if let Some(mut hub) = hub {
        hub.stop(HUB_STOP_GRACE);
        println!("[desktop] hub stopped");
    }
    if state.startup_failed.load(Ordering::SeqCst) {
        // The window only existed to explain the failure: do not exit 0.
        std::process::exit(1);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();

    let options = hub_options(&context);
    let result = options
        .as_ref()
        .map_err(|e| e.to_string())
        .and_then(|opts| Hub::start(opts).map_err(|e| e.to_string()));
    let (startup, hub) = match result {
        Ok(hub) => {
            println!("[desktop] hub ready at {} (pid {})", hub.url(), hub.pid());
            let security = &mut context.config_mut().app.security;
            pin_csp_option(&mut security.csp, hub.port());
            pin_csp_option(&mut security.dev_csp, hub.port());
            let startup = Startup::Ready {
                url: hub.url(),
                token: hub.token().to_string(),
            };
            (startup, Some(hub))
        }
        Err(err) => {
            eprintln!("[desktop] failed to start the hub: {err}");
            (
                Startup::Failed {
                    message: err.to_string(),
                },
                None,
            )
        }
    };

    let state = AppState {
        startup_failed: AtomicBool::new(matches!(startup, Startup::Failed { .. })),
        port: hub.as_ref().map(Hub::port).unwrap_or(0),
        options: Mutex::new(options.ok()),
        window_label: Mutex::new(MAIN_WINDOW.to_string()),
        window_generation: AtomicU64::new(0),
        restarting: AtomicBool::new(false),
        updating: AtomicBool::new(false),
        update_installing: AtomicBool::new(false),
        exiting: AtomicBool::new(false),
        hub: Mutex::new(hub),
    };
    let window_dev_url = dev_url(&context);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_menu_event(|app, event| {
            println!("[desktop] action: {}", event.id().as_ref());
            match event.id().as_ref() {
                "workspace" => pick_workspace(app.clone()),
                "restart-hub" => restart_hub(app.clone(), None),
                "update" => check_updates(app.clone()),
                _ => {}
            }
        })
        .manage(state)
        .setup(move |app| {
            let actions = SubmenuBuilder::new(app, "Re-Shell")
                .item(
                    &MenuItemBuilder::with_id("workspace", "Open Workspace…")
                        .accelerator("CmdOrCtrl+O")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id("restart-hub", "Restart Local Hub")
                        .accelerator("CmdOrCtrl+Shift+R")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::with_id("update", "Check for Updates…")
                        .accelerator("CmdOrCtrl+Shift+U")
                        .build(app)?,
                )
                .separator()
                .quit()
                .build()?;
            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            app.set_menu(MenuBuilder::new(app).items(&[&actions, &edit]).build()?)?;
            create_main_window(app, &startup, window_dev_url)?;
            spawn_hub_watchdog(app.handle().clone());
            Ok(())
        })
        .build(context)
        .expect("error while building the Re-Shell desktop application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            on_exit(app_handle);
        }
    });
}

#[cfg(test)]
mod lifecycle_tests {
    use super::*;

    fn state() -> AppState {
        AppState {
            hub: Mutex::new(None),
            options: Mutex::new(None),
            port: 12345,
            startup_failed: AtomicBool::new(false),
            exiting: AtomicBool::new(false),
            window_label: Mutex::new(MAIN_WINDOW.into()),
            window_generation: AtomicU64::new(0),
            restarting: AtomicBool::new(false),
            updating: AtomicBool::new(false),
            update_installing: AtomicBool::new(false),
        }
    }

    #[test]
    fn failed_installer_leaves_recovery_and_watchdog_enabled() {
        let state = state();
        begin_update_install(&state).unwrap();
        assert!(finish_failed_update_install(&state));
        assert!(!state.exiting.load(Ordering::SeqCst));
        assert!(!state.restarting.load(Ordering::SeqCst));
        assert!(begin_update_install(&state).is_ok());
    }

    #[test]
    fn failed_update_check_does_not_release_a_workspace_restart() {
        let state = state();
        state.restarting.store(true, Ordering::SeqCst);
        assert!(begin_update_install(&state).is_err());
        assert!(!finish_failed_update_install(&state));
        assert!(state.restarting.load(Ordering::SeqCst));
    }
}
