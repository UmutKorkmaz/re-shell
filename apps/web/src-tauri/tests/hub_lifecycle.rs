//! Integration tests for the desktop shell's hub ownership, against the REAL
//! bundled hub (`apps/web/dist/hub-server.js`, built by
//! `pnpm --filter @re-shell/dashboard run build`) under a real Node.js.
//!
//! These tests do not skip: if Node.js or the hub bundle is missing they FAIL
//! with instructions, because "the desktop app drives the local hub" cannot be
//! claimed without them.

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use re_shell_desktop_lib::hub::{
    generate_token, probe_health, resolve_node, Hub, HubError, HubOptions,
    NodeSearch,
};

const WEBVIEW_ORIGINS: [&str; 3] = [
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
];

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn real_bundle() -> PathBuf {
    let path = std::env::var_os("RE_SHELL_HUB_BUNDLE")
        .map(PathBuf::from)
        .unwrap_or_else(|| manifest_dir().join("..").join("dist").join("hub-server.js"));
    assert!(
        path.is_file(),
        "hub bundle not found at {}. Build it first: pnpm --filter @re-shell/dashboard run build",
        path.display()
    );
    path
}

fn node() -> PathBuf {
    resolve_node(&NodeSearch::from_env()).unwrap_or_else(|e| panic!("these tests need Node.js: {e}"))
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("re-shell-desktop-it-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn options(bundle: PathBuf, workspace: PathBuf) -> HubOptions {
    HubOptions {
        node: node(),
        bundle,
        workspace,
        allowed_origins: WEBVIEW_ORIGINS.iter().map(|s| s.to_string()).collect(),
        ready_timeout: Duration::from_secs(20),
        bind_attempts: 5,
    }
}

/// Raw HTTP/1.1 request returning (status, lowercase-header-lines, body).
fn http(port: u16, method: &str, path: &str, headers: &[(&str, &str)]) -> (u16, String) {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).expect("connect");
    stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
    let mut request = format!("{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n");
    for (k, v) in headers {
        request.push_str(&format!("{k}: {v}\r\n"));
    }
    request.push_str("\r\n");
    stream.write_all(request.as_bytes()).unwrap();
    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    let status = response
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    (status, response.to_ascii_lowercase())
}

fn wait_until(timeout: Duration, mut condition: impl FnMut() -> bool) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if condition() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(40));
    }
    condition()
}

/// True while the process exists and is not a zombie (Linux; elsewhere we rely
/// on the port being closed).
fn process_running(pid: u32) -> bool {
    match fs::read_to_string(format!("/proc/{pid}/stat")) {
        Ok(stat) => stat
            .rsplit(')')
            .next()
            .and_then(|rest| rest.split_whitespace().next())
            .map_or(false, |state| state != "Z"),
        Err(_) => false,
    }
}

#[test]
fn starts_the_real_hub_on_loopback_with_a_required_random_token() {
    let workspace = temp_dir("workspace");
    let mut hub = Hub::start(&options(real_bundle(), workspace.clone())).expect("hub should start");

    assert!(hub.url().starts_with("http://127.0.0.1:"), "url was {}", hub.url());
    assert_eq!(hub.url(), format!("http://127.0.0.1:{}", hub.port()));
    assert_eq!(hub.token().len(), 64);

    // Authenticated: 200. Missing or wrong token: 401 (the token is enforced by
    // the live hub, not just assumed).
    assert_eq!(probe_health(hub.port(), Some(hub.token())), Some(200));
    assert_eq!(probe_health(hub.port(), None), Some(401));
    assert_eq!(probe_health(hub.port(), Some(&generate_token().unwrap())), Some(401));

    #[cfg(target_os = "linux")]
    {
        // The listening socket is bound to 127.0.0.1 only.
        let table = fs::read_to_string("/proc/net/tcp").unwrap();
        let wanted = format!("{:04X}", hub.port());
        let listeners: Vec<&str> = table
            .lines()
            .skip(1)
            .filter(|line| {
                let cols: Vec<&str> = line.split_whitespace().collect();
                cols.get(3) == Some(&"0A") && cols.get(1).map_or(false, |a| a.ends_with(&format!(":{wanted}")))
            })
            .collect();
        assert!(!listeners.is_empty(), "hub port {} is not listening", hub.port());
        for line in listeners {
            let local = line.split_whitespace().nth(1).unwrap();
            assert_eq!(local, format!("0100007F:{wanted}"), "hub must bind loopback only");
        }
    }

    let pid = hub.pid();
    hub.stop(Duration::from_secs(5));
    assert!(hub.exit_status().is_some(), "hub process should have exited");
    assert_eq!(probe_health(hub.port(), Some(hub.token())), None, "port must be released");
    #[cfg(target_os = "linux")]
    assert!(!process_running(pid), "hub pid {pid} still running after stop");
    let _ = pid;
    let _ = fs::remove_dir_all(workspace);
}

#[test]
fn the_hub_accepts_the_webview_origin_through_the_allowlist_env() {
    let workspace = temp_dir("origins");
    let hub = Hub::start(&options(real_bundle(), workspace.clone())).expect("hub should start");

    for origin in WEBVIEW_ORIGINS {
        let (status, response) = http(
            hub.port(),
            "OPTIONS",
            "/health",
            &[
                ("Origin", origin),
                ("Access-Control-Request-Method", "GET"),
                ("Access-Control-Request-Headers", "x-re-shell-ui-hub-token"),
            ],
        );
        assert_eq!(status, 204);
        assert!(
            response.contains(&format!("access-control-allow-origin: {origin}\r\n")),
            "preflight for {origin} was not allowed: {response}"
        );
    }

    // A foreign origin is not echoed back.
    let (_, response) = http(hub.port(), "OPTIONS", "/health", &[("Origin", "https://evil.example.com")]);
    assert!(!response.contains("access-control-allow-origin: https://evil.example.com"));

    drop(hub);
    let _ = fs::remove_dir_all(workspace);
}

#[test]
fn every_launch_gets_its_own_port_and_token() {
    let workspace = temp_dir("distinct");
    let a = Hub::start(&options(real_bundle(), workspace.clone())).expect("hub a");
    let b = Hub::start(&options(real_bundle(), workspace.clone())).expect("hub b");
    assert_ne!(a.port(), b.port());
    assert_ne!(a.token(), b.token());
    // One hub's token does not open the other.
    assert_eq!(probe_health(a.port(), Some(b.token())), Some(401));
    assert_eq!(probe_health(b.port(), Some(a.token())), Some(401));
    let _ = fs::remove_dir_all(workspace);
}

#[test]
fn dropping_the_hub_stops_the_process() {
    let workspace = temp_dir("drop");
    let hub = Hub::start(&options(real_bundle(), workspace.clone())).expect("hub should start");
    let port = hub.port();
    let pid = hub.pid();
    assert_eq!(probe_health(port, Some(hub.token())), Some(200));
    drop(hub);
    assert!(wait_until(Duration::from_secs(5), || probe_health(port, None).is_none()));
    #[cfg(target_os = "linux")]
    assert!(wait_until(Duration::from_secs(5), || !process_running(pid)));
    let _ = pid;
    let _ = fs::remove_dir_all(workspace);
}

/// Helper mode for the next test: acts as the "desktop app" that owns a hub and
/// then idles until it is killed. A no-op in a normal test run.
#[test]
fn owner_helper_process() {
    if std::env::var("RE_SHELL_TEST_OWNER").as_deref() != Ok("1") {
        return;
    }
    let workspace = temp_dir("owner");
    let hub = Hub::start(&options(real_bundle(), workspace)).expect("owner: hub should start");
    println!("OWNER_READY pid={} port={}", hub.pid(), hub.port());
    std::io::stdout().flush().unwrap();
    // Hold the hub (and its stdin pipe) until killed.
    std::thread::sleep(Duration::from_secs(600));
    drop(hub);
}

#[cfg(target_os = "linux")]
#[test]
fn a_killed_app_does_not_leave_an_orphaned_hub() {
    let exe = std::env::current_exe().unwrap();
    let mut owner = Command::new(exe)
        .args(["--exact", "owner_helper_process", "--nocapture", "--test-threads=1"])
        .env("RE_SHELL_TEST_OWNER", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn owner");

    let mut reader = BufReader::new(owner.stdout.take().unwrap());
    let (hub_pid, port) = loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line).expect("read owner output");
        assert!(n > 0, "owner exited before reporting a hub");
        if let Some(rest) = line.trim().strip_prefix("OWNER_READY ") {
            let mut pid = 0u32;
            let mut port = 0u16;
            for part in rest.split_whitespace() {
                if let Some(v) = part.strip_prefix("pid=") {
                    pid = v.parse().unwrap();
                }
                if let Some(v) = part.strip_prefix("port=") {
                    port = v.parse().unwrap();
                }
            }
            break (pid, port);
        }
    };
    assert!(process_running(hub_pid));
    assert!(probe_health(port, None).is_some(), "hub should be listening");

    // SIGKILL: the owner gets no chance to run any cleanup.
    owner.kill().expect("kill owner");
    let _ = owner.wait();

    assert!(
        wait_until(Duration::from_secs(10), || !process_running(hub_pid)),
        "hub pid {hub_pid} outlived its killed owner"
    );
    assert_eq!(probe_health(port, None), None, "orphaned hub still holds port {port}");
}

#[test]
fn a_hub_that_crashes_on_startup_is_reported_with_its_output() {
    let dir = temp_dir("crash");
    let bundle = dir.join("crash.js");
    fs::write(&bundle, "console.error('[hub-server] Failed to start: boom'); process.exit(3);").unwrap();

    match Hub::start(&options(bundle, dir.clone())) {
        Err(HubError::ExitedEarly { status, log_tail }) => {
            assert!(status.contains('3'), "status was {status}");
            assert!(log_tail.contains("boom"), "log tail was {log_tail:?}");
        }
        other => panic!("expected ExitedEarly, got {other:?}"),
    }
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn a_hub_that_never_answers_times_out_and_is_not_left_running() {
    let dir = temp_dir("hang");
    let bundle = dir.join("hang.js");
    // Writes its pid where the test can find it, then idles without listening.
    fs::write(
        &bundle,
        "require('fs').writeFileSync(process.env.RE_SHELL_WORKSPACE + '/pid', String(process.pid)); setInterval(() => {}, 1000);",
    )
    .unwrap();

    let mut opts = options(bundle, dir.clone());
    opts.ready_timeout = Duration::from_millis(1500);
    match Hub::start(&opts) {
        Err(HubError::NotReady { waited, .. }) => assert_eq!(waited, Duration::from_millis(1500)),
        other => panic!("expected NotReady, got {other:?}"),
    }
    #[cfg(target_os = "linux")]
    {
        let pid: u32 = fs::read_to_string(dir.join("pid")).unwrap().trim().parse().unwrap();
        assert!(wait_until(Duration::from_secs(5), || !process_running(pid)), "hung hub {pid} was left running");
    }
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn a_port_taken_between_pick_and_bind_is_retried_on_another_port() {
    let dir = temp_dir("retry");
    let bundle = dir.join("flaky-hub.js");
    // First launch fails the way the real hub does when its port is taken; the
    // second one serves /health for the token it was given.
    fs::write(
        &bundle,
        r#"
const fs = require('fs');
const http = require('http');
const marker = process.env.RE_SHELL_WORKSPACE + '/first-launch-done';
if (!fs.existsSync(marker)) {
  fs.writeFileSync(marker, '1');
  console.error('[hub-server] Failed to start: Port ' + process.env.RE_SHELL_UI_HUB_PORT + ' is already in use');
  process.exit(1);
}
const token = process.env.RE_SHELL_UI_HUB_TOKEN;
http.createServer((req, res) => {
  const ok = req.headers['x-re-shell-ui-hub-token'] === token;
  res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
  res.end('{}');
}).listen(Number(process.env.RE_SHELL_UI_HUB_PORT), '127.0.0.1');
process.stdin.resume();
process.stdin.on('end', () => process.exit(0));
"#,
    )
    .unwrap();

    let hub = Hub::start(&options(bundle, dir.clone())).expect("second attempt should succeed");
    assert_eq!(probe_health(hub.port(), Some(hub.token())), Some(200));
    assert!(dir.join("first-launch-done").exists());
    drop(hub);
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn missing_inputs_fail_explicitly_before_anything_is_spawned() {
    let dir = temp_dir("missing");
    let good_bundle = real_bundle();

    match Hub::start(&options(dir.join("nope.js"), dir.clone())) {
        Err(HubError::BundleMissing { .. }) => {}
        other => panic!("expected BundleMissing, got {other:?}"),
    }
    match Hub::start(&options(good_bundle, dir.join("no-such-workspace"))) {
        Err(HubError::WorkspaceMissing(_)) => {}
        other => panic!("expected WorkspaceMissing, got {other:?}"),
    }

    let mut bad_node = options(real_bundle(), dir.clone());
    bad_node.node = dir.join("no-such-node");
    match Hub::start(&bad_node) {
        Err(HubError::NodeUnusable { .. }) => {}
        other => panic!("expected NodeUnusable, got {other:?}"),
    }
    let _ = fs::remove_dir_all(dir);
}
