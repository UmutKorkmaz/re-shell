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
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::utils::config::Csp;
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};

use hub::{Hub, HubError, HubOptions, NodeSearch};
use webview::NoticeKind;

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
    startup_failed: bool,
    exiting: AtomicBool,
}

/// Find everything the hub needs and start it.
fn start_hub(context: &tauri::Context<tauri::Wry>) -> Result<Hub, HubError> {
    let node = hub::resolve_node(&NodeSearch::from_env())?;
    let version = hub::check_node_version(&node)?;
    println!("[desktop] using Node.js {version} at {}", node.display());

    let resource_dir =
        tauri::utils::platform::resource_dir(context.package_info(), &tauri::utils::Env::default())
            .ok();
    // Debug builds (`tauri dev`) can also use the dashboard build output directly.
    let dev_fallback = if cfg!(debug_assertions) {
        Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("dist").join("hub-server.js"))
    } else {
        None
    };
    let bundle = hub::resolve_bundle(
        std::env::var_os("RE_SHELL_HUB_BUNDLE").as_deref(),
        resource_dir.as_deref(),
        dev_fallback.as_deref(),
    )?;

    let workspace = hub::resolve_workspace(
        std::env::args_os(),
        std::env::var_os("RE_SHELL_WORKSPACE").as_deref(),
        std::env::current_dir().ok().as_deref(),
        hub::user_home().as_deref(),
    );
    println!("[desktop] workspace: {}", workspace.display());

    let options = HubOptions {
        node,
        bundle,
        workspace,
        allowed_origins: webview::webview_origins(dev_url(context).as_ref()),
        ready_timeout: HUB_READY_TIMEOUT,
        bind_attempts: HUB_BIND_ATTEMPTS,
    };
    Hub::start(&options)
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
                .on_navigation(move |target| webview::is_allowed_navigation(target, dev_url.as_ref()))
                .build()?;
        }
        Startup::Failed { message } => {
            let blank: Url = "about:blank".parse().expect("about:blank is a valid URL");
            WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::External(blank))
                .title(window_config.title.clone())
                .inner_size(900.0, 600.0)
                .initialization_script(webview::notice_script(
                    NoticeKind::Page,
                    "Re-Shell could not start its local hub",
                    message,
                ))
                .on_navigation(|target| webview::is_allowed_navigation(target, None))
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
        let status = match state.hub.lock() {
            Ok(mut guard) => match guard.as_mut() {
                Some(hub) => hub.exit_status(),
                None => return,
            },
            Err(_) => return,
        };
        if let Some(status) = status {
            if state.exiting.load(Ordering::SeqCst) {
                return;
            }
            let detail = match status.code() {
                Some(code) => format!("exit code {code}"),
                None => "terminated by a signal".to_string(),
            };
            eprintln!("[desktop] the hub stopped unexpectedly ({detail})");
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.eval(webview::notice_script(
                    NoticeKind::Banner,
                    "The local Re-Shell hub stopped",
                    &format!("The hub process exited unexpectedly ({detail}). Close and reopen Re-Shell to start a new one."),
                ));
            }
            return;
        }
    });
}

fn on_exit(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.exiting.store(true, Ordering::SeqCst);
    let hub = state.hub.lock().ok().and_then(|mut guard| guard.take());
    if let Some(mut hub) = hub {
        hub.stop(HUB_STOP_GRACE);
        println!("[desktop] hub stopped");
    }
    if state.startup_failed {
        // The window only existed to explain the failure: do not exit 0.
        std::process::exit(1);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();

    let (startup, hub) = match start_hub(&context) {
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
            (Startup::Failed { message: err.to_string() }, None)
        }
    };

    let state = AppState {
        hub: Mutex::new(hub),
        startup_failed: matches!(startup, Startup::Failed { .. }),
        exiting: AtomicBool::new(false),
    };
    let window_dev_url = dev_url(&context);

    let app = tauri::Builder::default()
        .manage(state)
        .setup(move |app| {
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
