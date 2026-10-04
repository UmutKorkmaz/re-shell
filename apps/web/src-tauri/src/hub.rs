//! Ownership of the local hub-server child process.
//!
//! The desktop shell spawns the bundled `hub-server.js` (the same single-file
//! bundle `re-shell ui` runs) under Node, on a free loopback port, with a
//! freshly generated random session token. It waits until the hub answers an
//! authenticated `GET /health`, hands `{ url, token }` to the webview, and
//! tears the hub down when the app exits.
//!
//! Security model (unchanged from the browser flow):
//! * the hub binds `127.0.0.1` only (hard-pinned inside the hub);
//! * every hub route requires the per-launch token, which exists only in this
//!   process and the webview's memory (it is never written to disk or argv);
//! * the hub is tied to this process through its stdin pipe, so it cannot
//!   outlive the app even if the app is killed without cleanup.

use std::collections::VecDeque;
use std::ffi::{OsStr, OsString};
use std::fmt;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, ExitStatus, Stdio};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// The hub only ever listens on loopback.
pub const HUB_HOST: &str = "127.0.0.1";
/// The hub bundle is built with `target: node18`.
pub const MIN_NODE_MAJOR: u32 = 18;
/// Where the hub bundle lives under the app's resource directory.
pub const BUNDLE_RESOURCE_PATH: &str = "hub/hub-server.js";

const TOKEN_BYTES: usize = 32;
const LOG_TAIL_LINES: usize = 40;

/// Everything needed to start a hub.
#[derive(Debug, Clone)]
pub struct HubOptions {
    /// Absolute path of the Node.js executable.
    pub node: PathBuf,
    /// Absolute path of the bundled `hub-server.js`.
    pub bundle: PathBuf,
    /// Workspace directory the hub (and the CLI jobs it spawns) are rooted in.
    pub workspace: PathBuf,
    /// Extra exact origins the hub must accept (the webview origins).
    pub allowed_origins: Vec<String>,
    /// How long to wait for the hub to answer `/health`.
    pub ready_timeout: Duration,
    /// How many different ports to try when the chosen one is taken.
    pub bind_attempts: u32,
}

/// Why the hub could not be started. `Display` is the user-facing message.
#[derive(Debug)]
pub enum HubError {
    NodeNotFound { searched: Vec<PathBuf> },
    NodeUnusable { path: PathBuf, reason: String },
    NodeTooOld { path: PathBuf, found: String },
    BundleMissing { searched: Vec<PathBuf> },
    WorkspaceMissing(PathBuf),
    Io(String),
    ExitedEarly { status: String, log_tail: String },
    NotReady { waited: Duration, log_tail: String },
}

impl fmt::Display for HubError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            HubError::NodeNotFound { searched } => write!(
                f,
                "Node.js {MIN_NODE_MAJOR} or newer was not found, and the Re-Shell hub needs it.\n\
                 Install Node.js (https://nodejs.org) or set RE_SHELL_NODE to the node executable.\n\
                 Searched: {}",
                join_paths_for_display(searched)
            ),
            HubError::NodeUnusable { path, reason } => write!(
                f,
                "The Node.js executable at {} could not be run: {reason}",
                path.display()
            ),
            HubError::NodeTooOld { path, found } => write!(
                f,
                "Node.js {found} at {} is too old; the Re-Shell hub needs Node.js {MIN_NODE_MAJOR} or newer.\n\
                 Install a newer Node.js or set RE_SHELL_NODE to another node executable.",
                path.display()
            ),
            HubError::BundleMissing { searched } => write!(
                f,
                "The bundled hub-server.js was not found. This installation is incomplete.\n\
                 Searched: {}",
                join_paths_for_display(searched)
            ),
            HubError::WorkspaceMissing(path) => write!(
                f,
                "The workspace directory {} does not exist or is not a directory.",
                path.display()
            ),
            HubError::Io(message) => write!(f, "{message}"),
            HubError::ExitedEarly { status, log_tail } => {
                write!(f, "The Re-Shell hub exited during startup ({status}).")?;
                append_log(f, log_tail)
            }
            HubError::NotReady { waited, log_tail } => {
                write!(
                    f,
                    "The Re-Shell hub did not become ready within {} seconds.",
                    waited.as_secs()
                )?;
                append_log(f, log_tail)
            }
        }
    }
}

impl std::error::Error for HubError {}

fn append_log(f: &mut fmt::Formatter<'_>, log_tail: &str) -> fmt::Result {
    if log_tail.trim().is_empty() {
        Ok(())
    } else {
        write!(f, "\n\nHub output:\n{log_tail}")
    }
}

fn join_paths_for_display(paths: &[PathBuf]) -> String {
    if paths.is_empty() {
        return "(nothing)".to_string();
    }
    paths
        .iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join(", ")
}

type LogTail = Arc<Mutex<VecDeque<String>>>;

fn log_tail_text(log: &LogTail) -> String {
    match log.lock() {
        Ok(lines) => lines.iter().cloned().collect::<Vec<_>>().join("\n"),
        Err(_) => String::new(),
    }
}

/// A running hub child process. Dropping it stops the process.
pub struct Hub {
    child: Child,
    stdin: Option<ChildStdin>,
    port: u16,
    token: String,
    log: LogTail,
    readers: Vec<JoinHandle<()>>,
}

impl fmt::Debug for Hub {
    // The token is a credential: never print it.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Hub")
            .field("pid", &self.child.id())
            .field("port", &self.port)
            .field("token", &"<redacted>")
            .finish()
    }
}

impl Hub {
    /// Generate a token, pick a free loopback port, spawn the hub and wait for
    /// it to answer an authenticated `GET /health`. Retries on a different port
    /// when the chosen one was taken between picking it and the hub binding it.
    pub fn start(opts: &HubOptions) -> Result<Hub, HubError> {
        if !opts.bundle.is_file() {
            return Err(HubError::BundleMissing {
                searched: vec![opts.bundle.clone()],
            });
        }
        if !opts.workspace.is_dir() {
            return Err(HubError::WorkspaceMissing(opts.workspace.clone()));
        }

        let token = generate_token()?;
        let attempts = opts.bind_attempts.max(1);
        let mut last_err = None;
        for _ in 0..attempts {
            let port = pick_free_port()?;
            match Hub::start_on_port(opts, &token, port) {
                Ok(hub) => return Ok(hub),
                Err(err @ HubError::ExitedEarly { .. }) if is_port_conflict(&err) => {
                    last_err = Some(err);
                }
                Err(err) => return Err(err),
            }
        }
        Err(last_err.unwrap_or_else(|| HubError::Io("could not allocate a hub port".into())))
    }

    fn start_on_port(opts: &HubOptions, token: &str, port: u16) -> Result<Hub, HubError> {
        let log: LogTail = Arc::new(Mutex::new(VecDeque::new()));
        let mut command = build_command(opts, token, port);
        let mut child = command.spawn().map_err(|e| HubError::NodeUnusable {
            path: opts.node.clone(),
            reason: e.to_string(),
        })?;

        let stdin = child.stdin.take();
        let mut readers = Vec::new();
        if let Some(stdout) = child.stdout.take() {
            readers.push(forward_lines(stdout, log.clone(), false));
        }
        if let Some(stderr) = child.stderr.take() {
            readers.push(forward_lines(stderr, log.clone(), true));
        }

        let mut hub = Hub {
            child,
            stdin,
            port,
            token: token.to_string(),
            log,
            readers,
        };
        hub.wait_ready(opts.ready_timeout)?;
        Ok(hub)
    }

    fn wait_ready(&mut self, timeout: Duration) -> Result<(), HubError> {
        let started = Instant::now();
        loop {
            match self.child.try_wait() {
                Ok(Some(status)) => {
                    // The process is gone, so its pipes reach EOF: wait for the
                    // reader threads so the captured output is complete.
                    for reader in self.readers.drain(..) {
                        let _ = reader.join();
                    }
                    return Err(HubError::ExitedEarly {
                        status: describe_status(&status),
                        log_tail: log_tail_text(&self.log),
                    });
                }
                Ok(None) => {}
                Err(e) => return Err(HubError::Io(format!("could not poll the hub process: {e}"))),
            }
            if probe_health(self.port, Some(&self.token)) == Some(200) {
                return Ok(());
            }
            if started.elapsed() >= timeout {
                let log_tail = log_tail_text(&self.log);
                self.stop(Duration::from_millis(500));
                return Err(HubError::NotReady {
                    waited: timeout,
                    log_tail,
                });
            }
            thread::sleep(Duration::from_millis(40));
        }
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn url(&self) -> String {
        format!("http://{HUB_HOST}:{}", self.port)
    }

    pub fn token(&self) -> &str {
        &self.token
    }

    pub fn pid(&self) -> u32 {
        self.child.id()
    }

    /// `Some(status)` once the hub process has exited, `None` while it runs.
    pub fn exit_status(&mut self) -> Option<ExitStatus> {
        self.child.try_wait().ok().flatten()
    }

    /// Stop the hub: close its stdin (a graceful stop request, identical on
    /// every platform), wait up to `grace` for it to exit, then kill it.
    pub fn stop(&mut self, grace: Duration) {
        drop(self.stdin.take());
        let deadline = Instant::now() + grace;
        loop {
            match self.child.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) => {}
                Err(_) => break,
            }
            if Instant::now() >= deadline {
                break;
            }
            thread::sleep(Duration::from_millis(25));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for Hub {
    fn drop(&mut self) {
        self.stop(Duration::from_secs(2));
    }
}

fn is_port_conflict(err: &HubError) -> bool {
    match err {
        HubError::ExitedEarly { log_tail, .. } => {
            let lower = log_tail.to_ascii_lowercase();
            lower.contains("eaddrinuse") || lower.contains("already in use")
        }
        _ => false,
    }
}

fn describe_status(status: &ExitStatus) -> String {
    match status.code() {
        Some(code) => format!("exit code {code}"),
        None => "terminated by a signal".to_string(),
    }
}

fn build_command(opts: &HubOptions, token: &str, port: u16) -> Command {
    let mut command = Command::new(&opts.node);
    command
        .arg(&opts.bundle)
        .current_dir(&opts.workspace)
        // The token travels through the environment (never argv, which any local
        // user can read from the process table).
        .env("RE_SHELL_UI_HUB_PORT", port.to_string())
        .env("RE_SHELL_UI_HUB_TOKEN", token)
        .env("RE_SHELL_WORKSPACE", &opts.workspace)
        .env("RE_SHELL_UI_HUB_EXIT_ON_STDIN_CLOSE", "1")
        // One path-only line per request (never the query/token): the auditable
        // record that the dashboard connected with the token.
        .env("RE_SHELL_UI_HUB_ACCESS_LOG", "1")
        .env("RE_SHELL_UI_HUB_ALLOWED_ORIGINS", opts.allowed_origins.join(","))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // GUI launchers (macOS Finder, Linux desktop files) give apps a minimal PATH.
    // The hub runs the `re-shell` CLI by name, and `npm i -g` puts that next to
    // `node`, so put node's directory first.
    if let Some(dir) = opts.node.parent() {
        let current = std::env::var_os("PATH").unwrap_or_default();
        command.env("PATH", prepend_path(dir, &current));
    }

    // Inside an AppImage the runtime prepends its bundled libraries to
    // LD_LIBRARY_PATH. The system Node.js must not load those, so drop the
    // entries that live under the mounted image.
    if std::env::var_os("APPIMAGE").is_some() {
        if let (Some(appdir), Some(ld)) = (
            std::env::var_os("APPDIR").filter(|d| !d.is_empty()),
            std::env::var_os("LD_LIBRARY_PATH"),
        ) {
            match strip_path_entries_under(&ld, Path::new(&appdir)) {
                Some(cleaned) => command.env("LD_LIBRARY_PATH", cleaned),
                None => command.env_remove("LD_LIBRARY_PATH"),
            };
        }
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: never flash a console window for the hub.
        command.creation_flags(0x0800_0000);
    }

    command
}

/// `dir` followed by the entries of `path` (platform separator).
pub fn prepend_path(dir: &Path, path: &OsStr) -> OsString {
    let mut entries: Vec<PathBuf> = vec![dir.to_path_buf()];
    entries.extend(std::env::split_paths(path).filter(|p| p != dir));
    std::env::join_paths(entries).unwrap_or_else(|_| path.to_os_string())
}

/// The entries of a PATH-style `value` that are NOT inside `dir`; `None` when
/// nothing is left.
pub fn strip_path_entries_under(value: &OsStr, dir: &Path) -> Option<OsString> {
    let kept: Vec<PathBuf> = std::env::split_paths(value)
        .filter(|entry| !entry.starts_with(dir))
        .collect();
    if kept.is_empty() {
        None
    } else {
        std::env::join_paths(kept).ok()
    }
}

/// Forward a child pipe line by line to our own stdout/stderr (prefixed) and
/// keep the last lines for error reporting.
fn forward_lines<R: Read + Send + 'static>(
    reader: R,
    log: LogTail,
    is_stderr: bool,
) -> JoinHandle<()> {
    thread::spawn(move || {
        for line in BufReader::new(reader).lines() {
            let Ok(line) = line else { break };
            if is_stderr {
                eprintln!("[hub] {line}");
            } else {
                println!("[hub] {line}");
            }
            if let Ok(mut lines) = log.lock() {
                if lines.len() == LOG_TAIL_LINES {
                    lines.pop_front();
                }
                lines.push_back(line);
            }
        }
    })
}

/// 32 bytes from the OS CSPRNG, hex-encoded (64 chars). Same strength as the
/// token `re-shell ui` mints.
pub fn generate_token() -> Result<String, HubError> {
    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::fill(&mut bytes)
        .map_err(|e| HubError::Io(format!("could not read OS randomness for the hub token: {e}")))?;
    Ok(hex_encode(&bytes))
}

pub fn hex_encode(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[(b >> 4) as usize] as char);
        out.push(DIGITS[(b & 0x0f) as usize] as char);
    }
    out
}

/// Ask the OS for a free loopback port. The port is released before the hub
/// binds it, so [`Hub::start`] retries if another process wins the race.
pub fn pick_free_port() -> Result<u16, HubError> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .map_err(|e| HubError::Io(format!("could not reserve a loopback port: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| HubError::Io(format!("could not read the reserved port: {e}")))?
        .port();
    Ok(port)
}

/// Minimal HTTP/1.1 `GET /health` against the hub. Returns the status code, or
/// `None` when the hub is not (yet) accepting or answering. The request carries
/// `Accept: application/json` because the hub rejects requests that do not look
/// like a real fetch.
pub fn probe_health(port: u16, token: Option<&str>) -> Option<u16> {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(300)).ok()?;
    stream.set_read_timeout(Some(Duration::from_millis(1500))).ok()?;
    stream.set_write_timeout(Some(Duration::from_millis(1500))).ok()?;

    let mut request = format!(
        "GET /health HTTP/1.1\r\nHost: {HUB_HOST}:{port}\r\nAccept: application/json\r\nConnection: close\r\n"
    );
    if let Some(token) = token {
        request.push_str(&format!("x-re-shell-ui-hub-token: {token}\r\n"));
    }
    request.push_str("\r\n");
    stream.write_all(request.as_bytes()).ok()?;

    let mut response = Vec::new();
    // `Connection: close` ends the response with EOF; a read timeout after a
    // full status line is still enough to parse.
    let _ = stream.take(8192).read_to_end(&mut response);
    parse_status_code(&response)
}

/// Status code of an HTTP/1.x response head.
pub fn parse_status_code(response: &[u8]) -> Option<u16> {
    let end = response
        .iter()
        .position(|b| *b == b'\n')
        .unwrap_or(response.len())
        .min(128);
    let line = std::str::from_utf8(&response[..end]).ok()?;
    let mut parts = line.split_whitespace();
    let version = parts.next()?;
    if !version.starts_with("HTTP/1.") {
        return None;
    }
    parts.next()?.parse().ok()
}

// ---------------------------------------------------------------------------
// Node.js discovery
// ---------------------------------------------------------------------------

/// Inputs for locating Node.js, injectable for tests.
#[derive(Debug, Default, Clone)]
pub struct NodeSearch {
    /// `RE_SHELL_NODE`: an explicit node executable (used exclusively if set).
    pub override_path: Option<OsString>,
    /// The `PATH` value to search first.
    pub path_var: Option<OsString>,
    /// Well-known install directories to search after `PATH`.
    pub extra_dirs: Vec<PathBuf>,
}

impl NodeSearch {
    /// The real environment: `RE_SHELL_NODE`, `PATH`, then common install dirs.
    pub fn from_env() -> NodeSearch {
        NodeSearch {
            override_path: std::env::var_os("RE_SHELL_NODE").filter(|v| !v.is_empty()),
            path_var: std::env::var_os("PATH"),
            extra_dirs: default_node_dirs(home_dir().as_deref()),
        }
    }
}

fn node_file_name() -> &'static str {
    if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    }
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(meta) = fs::metadata(path) else {
        return false;
    };
    if !meta.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        meta.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// Locate a Node.js executable. `RE_SHELL_NODE` wins and is never second-guessed:
/// if it is set but unusable that is an error, not a silent fallback.
pub fn resolve_node(search: &NodeSearch) -> Result<PathBuf, HubError> {
    if let Some(explicit) = &search.override_path {
        let path = PathBuf::from(explicit);
        return if is_executable_file(&path) {
            Ok(path)
        } else {
            Err(HubError::NodeUnusable {
                path,
                reason: "RE_SHELL_NODE does not point at an executable file".to_string(),
            })
        };
    }

    let mut searched = Vec::new();
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(path_var) = &search.path_var {
        dirs.extend(std::env::split_paths(path_var));
    }
    dirs.extend(search.extra_dirs.iter().cloned());

    for dir in dirs {
        if dir.as_os_str().is_empty() {
            continue;
        }
        let candidate = dir.join(node_file_name());
        if is_executable_file(&candidate) {
            return Ok(candidate);
        }
        searched.push(dir);
    }
    Err(HubError::NodeNotFound { searched })
}

/// Common Node.js install locations that GUI launchers do not put on `PATH`.
pub fn default_node_dirs(home: Option<&Path>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if cfg!(windows) {
        for var in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(base) = std::env::var_os(var) {
                dirs.push(PathBuf::from(base).join("nodejs"));
            }
        }
        if let Some(base) = std::env::var_os("LOCALAPPDATA") {
            dirs.push(PathBuf::from(base).join("Programs").join("nodejs"));
        }
    } else {
        dirs.extend(
            ["/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin", "/usr/bin"]
                .iter()
                .map(PathBuf::from),
        );
        if let Some(home) = home {
            dirs.push(home.join(".volta").join("bin"));
            if let Some(nvm) = newest_nvm_bin(home) {
                dirs.push(nvm);
            }
        }
    }
    dirs
}

/// `~/.nvm/versions/node/<newest vX.Y.Z>/bin`, if nvm is installed.
fn newest_nvm_bin(home: &Path) -> Option<PathBuf> {
    let root = home.join(".nvm").join("versions").join("node");
    let mut best: Option<((u32, u32, u32), PathBuf)> = None;
    for entry in fs::read_dir(root).ok()?.flatten() {
        let name = entry.file_name();
        let Some(version) = parse_node_version(&name.to_string_lossy()) else {
            continue;
        };
        if best.as_ref().map_or(true, |(v, _)| version > *v) {
            best = Some((version, entry.path().join("bin")));
        }
    }
    best.map(|(_, dir)| dir)
}

/// `v22.22.0` / `22.22.0` -> `(22, 22, 0)`.
pub fn parse_node_version(text: &str) -> Option<(u32, u32, u32)> {
    let trimmed = text.trim().trim_start_matches('v');
    let mut parts = trimmed.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch_raw = parts.next()?;
    let patch_digits: String = patch_raw.chars().take_while(|c| c.is_ascii_digit()).collect();
    let patch = patch_digits.parse().ok()?;
    Some((major, minor, patch))
}

fn home_dir() -> Option<PathBuf> {
    let var = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    std::env::var_os(var).filter(|v| !v.is_empty()).map(PathBuf::from)
}

/// Run `node --version` and require Node.js >= [`MIN_NODE_MAJOR`]. Returns the
/// version string (e.g. `v22.22.0`).
pub fn check_node_version(node: &Path) -> Result<String, HubError> {
    let output = Command::new(node)
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| HubError::NodeUnusable {
            path: node.to_path_buf(),
            reason: e.to_string(),
        })?;
    if !output.status.success() {
        return Err(HubError::NodeUnusable {
            path: node.to_path_buf(),
            reason: format!("`node --version` failed ({})", describe_status(&output.status)),
        });
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    match parse_node_version(&text) {
        Some((major, _, _)) if major >= MIN_NODE_MAJOR => Ok(text),
        Some(_) => Err(HubError::NodeTooOld {
            path: node.to_path_buf(),
            found: text,
        }),
        None => Err(HubError::NodeUnusable {
            path: node.to_path_buf(),
            reason: format!("unexpected `node --version` output: {text:?}"),
        }),
    }
}

// ---------------------------------------------------------------------------
// Bundle / workspace resolution
// ---------------------------------------------------------------------------

/// Locate `hub-server.js`: an explicit `RE_SHELL_HUB_BUNDLE`, then the app's
/// resource directory, then (debug builds) the dashboard build output.
pub fn resolve_bundle(
    override_path: Option<&OsStr>,
    resource_dir: Option<&Path>,
    dev_fallback: Option<&Path>,
) -> Result<PathBuf, HubError> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(explicit) = override_path.filter(|p| !p.is_empty()) {
        // An explicit override is exclusive: a typo must not silently pick
        // another bundle.
        let path = PathBuf::from(explicit);
        return if path.is_file() {
            Ok(simplify_path(&path))
        } else {
            Err(HubError::BundleMissing { searched: vec![path] })
        };
    }
    if let Some(dir) = resource_dir {
        candidates.push(dir.join(BUNDLE_RESOURCE_PATH));
        // Some bundlers flatten resource paths.
        candidates.push(dir.join("hub-server.js"));
    }
    if let Some(path) = dev_fallback {
        candidates.push(path.to_path_buf());
    }
    for candidate in &candidates {
        if candidate.is_file() {
            return Ok(simplify_path(candidate));
        }
    }
    Err(HubError::BundleMissing { searched: candidates })
}

/// Strip the Windows verbatim prefix (`\\?\C:\...` -> `C:\...`); Node and the
/// scripts it loads handle plain drive paths more reliably. No-op elsewhere.
pub fn simplify_path(path: &Path) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        let bytes = rest.as_bytes();
        let is_drive = bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\';
        if is_drive {
            return PathBuf::from(rest);
        }
    }
    path.to_path_buf()
}

/// Pick the workspace the hub is rooted in: `--workspace <dir>` /
/// `--workspace=<dir>`, then `RE_SHELL_WORKSPACE`, then the launch directory.
/// A launcher-started app often starts in `/` (or has no usable cwd); in that
/// case the home directory is used instead of the filesystem root.
pub fn resolve_workspace<I>(
    args: I,
    env_workspace: Option<&OsStr>,
    cwd: Option<&Path>,
    home: Option<&Path>,
) -> PathBuf
where
    I: IntoIterator<Item = OsString>,
{
    if let Some(from_args) = workspace_from_args(args) {
        return from_args;
    }
    if let Some(from_env) = env_workspace.filter(|v| !v.is_empty()) {
        return PathBuf::from(from_env);
    }
    match cwd {
        Some(dir) if !is_filesystem_root(dir) => dir.to_path_buf(),
        _ => home
            .map(Path::to_path_buf)
            .or_else(|| cwd.map(Path::to_path_buf))
            .unwrap_or_else(|| PathBuf::from(".")),
    }
}

fn workspace_from_args<I: IntoIterator<Item = OsString>>(args: I) -> Option<PathBuf> {
    let mut iter = args.into_iter();
    while let Some(arg) = iter.next() {
        let text = arg.to_string_lossy();
        if text == "--workspace" {
            return iter.next().filter(|v| !v.is_empty()).map(PathBuf::from);
        }
        if let Some(value) = text.strip_prefix("--workspace=") {
            if !value.is_empty() {
                return Some(PathBuf::from(value));
            }
        }
    }
    None
}

fn is_filesystem_root(path: &Path) -> bool {
    path.parent().is_none()
}

/// The user's home directory.
pub fn user_home() -> Option<PathBuf> {
    home_dir()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_64_hex_chars_and_unique() {
        let a = generate_token().unwrap();
        let b = generate_token().unwrap();
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
        assert_ne!(a, b);
    }

    #[test]
    fn hex_encode_known_vector() {
        assert_eq!(hex_encode(&[0x00, 0x0f, 0xa5, 0xff]), "000fa5ff");
        assert_eq!(hex_encode(&[]), "");
    }

    #[test]
    fn free_port_is_bindable_and_nonzero() {
        // The port is released before it is returned, so a parallel test's socket can
        // take it in between (the race Hub::start retries on). A port the function
        // still held would fail every attempt; a released one binds within a few.
        let mut last_err = None;
        for _ in 0..5 {
            let port = pick_free_port().unwrap();
            assert!(port > 0);
            match TcpListener::bind((Ipv4Addr::LOCALHOST, port)) {
                Ok(_) => return,
                Err(err) => last_err = Some(err),
            }
        }
        panic!("no picked port was free again: {last_err:?}");
    }

    #[test]
    fn parses_http_status_lines() {
        assert_eq!(parse_status_code(b"HTTP/1.1 200 OK\r\nA: b\r\n\r\n"), Some(200));
        assert_eq!(parse_status_code(b"HTTP/1.0 401 Unauthorized\r\n"), Some(401));
        assert_eq!(parse_status_code(b"HTTP/1.1 204\r\n"), Some(204));
        assert_eq!(parse_status_code(b"SSH-2.0-OpenSSH\r\n"), None);
        assert_eq!(parse_status_code(b""), None);
        assert_eq!(parse_status_code(b"HTTP/1.1 abc\r\n"), None);
    }

    #[test]
    fn probe_health_returns_none_when_nothing_listens() {
        let port = pick_free_port().unwrap();
        assert_eq!(probe_health(port, Some("t")), None);
    }

    #[test]
    fn probe_health_sends_loopback_host_accept_and_token() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = thread::spawn(move || {
            let (mut sock, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let n = sock.read(&mut buf).unwrap();
            let request = String::from_utf8_lossy(&buf[..n]).to_string();
            sock.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                .unwrap();
            request
        });
        assert_eq!(probe_health(port, Some("secret-token")), Some(200));
        let request = server.join().unwrap();
        assert!(request.starts_with("GET /health HTTP/1.1\r\n"));
        assert!(request.contains(&format!("Host: 127.0.0.1:{port}\r\n")));
        assert!(request.contains("Accept: application/json\r\n"));
        assert!(request.contains("x-re-shell-ui-hub-token: secret-token\r\n"));
    }

    #[test]
    fn node_version_parsing() {
        assert_eq!(parse_node_version("v22.22.0\n"), Some((22, 22, 0)));
        assert_eq!(parse_node_version("18.0.1"), Some((18, 0, 1)));
        assert_eq!(parse_node_version("v20.1.0-nightly2023"), Some((20, 1, 0)));
        assert_eq!(parse_node_version("nope"), None);
        assert_eq!(parse_node_version("v22"), None);
        assert!(parse_node_version("v22.2.0") > parse_node_version("v22.1.9"));
        assert!(parse_node_version("v20.0.0") > parse_node_version("v18.99.99"));
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("re-shell-desktop-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[cfg(unix)]
    fn make_executable(path: &Path) {
        use std::os::unix::fs::PermissionsExt;
        fs::write(path, "#!/bin/sh\n").unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn resolve_node_prefers_path_then_extra_dirs() {
        let a = temp_dir("node-a");
        let b = temp_dir("node-b");
        make_executable(&b.join("node"));

        // Only in the extra dir.
        let search = NodeSearch {
            override_path: None,
            path_var: Some(std::env::join_paths([&a]).unwrap()),
            extra_dirs: vec![b.clone()],
        };
        assert_eq!(resolve_node(&search).unwrap(), b.join("node"));

        // PATH wins over extra dirs.
        make_executable(&a.join("node"));
        assert_eq!(resolve_node(&search).unwrap(), a.join("node"));

        // A non-executable `node` is skipped.
        fs::set_permissions(a.join("node"), std::os::unix::fs::PermissionsExt::from_mode(0o644)).unwrap();
        assert_eq!(resolve_node(&search).unwrap(), b.join("node"));
    }

    #[test]
    fn resolve_node_reports_what_it_searched() {
        let empty = temp_dir("node-empty");
        let search = NodeSearch {
            override_path: None,
            path_var: Some(std::env::join_paths([&empty]).unwrap()),
            extra_dirs: vec![],
        };
        match resolve_node(&search) {
            Err(HubError::NodeNotFound { searched }) => assert_eq!(searched, vec![empty.clone()]),
            other => panic!("expected NodeNotFound, got {other:?}"),
        }
        let message = resolve_node(&search).unwrap_err().to_string();
        assert!(message.contains("RE_SHELL_NODE"));
        assert!(message.contains(&empty.display().to_string()));
    }

    #[test]
    fn explicit_node_override_is_exclusive_and_never_falls_back() {
        let dir = temp_dir("node-override");
        let search = NodeSearch {
            override_path: Some(dir.join("missing-node").into_os_string()),
            path_var: std::env::var_os("PATH"),
            extra_dirs: default_node_dirs(None),
        };
        assert!(matches!(resolve_node(&search), Err(HubError::NodeUnusable { .. })));
    }

    #[cfg(unix)]
    #[test]
    fn check_node_version_rejects_old_and_garbage_nodes() {
        let dir = temp_dir("node-version");
        let write_script = |name: &str, body: &str| {
            use std::os::unix::fs::PermissionsExt;
            let path = dir.join(name);
            fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
            path
        };
        let ok = write_script("node-ok", "echo v22.1.0");
        let old = write_script("node-old", "echo v16.20.2");
        let junk = write_script("node-junk", "echo hello");
        let failing = write_script("node-fail", "exit 3");

        assert_eq!(check_node_version(&ok).unwrap(), "v22.1.0");
        assert!(matches!(check_node_version(&old), Err(HubError::NodeTooOld { .. })));
        assert!(matches!(check_node_version(&junk), Err(HubError::NodeUnusable { .. })));
        assert!(matches!(check_node_version(&failing), Err(HubError::NodeUnusable { .. })));
        assert!(matches!(
            check_node_version(&dir.join("does-not-exist")),
            Err(HubError::NodeUnusable { .. })
        ));
    }

    #[test]
    fn bundle_resolution_order_and_exclusive_override() {
        let dir = temp_dir("bundle");
        let resources = dir.join("res");
        fs::create_dir_all(resources.join("hub")).unwrap();
        let in_resources = resources.join("hub").join("hub-server.js");
        let dev = dir.join("dev-hub-server.js");

        // Nothing exists: explicit error listing every candidate.
        match resolve_bundle(None, Some(&resources), Some(&dev)) {
            Err(HubError::BundleMissing { searched }) => assert_eq!(searched.len(), 3),
            other => panic!("expected BundleMissing, got {other:?}"),
        }

        fs::write(&dev, "//dev").unwrap();
        assert_eq!(resolve_bundle(None, Some(&resources), Some(&dev)).unwrap(), dev);

        // The resource directory wins over the dev fallback.
        fs::write(&in_resources, "//res").unwrap();
        assert_eq!(resolve_bundle(None, Some(&resources), Some(&dev)).unwrap(), in_resources);

        // An explicit override wins, and a bad override is an error, not a fallback.
        let custom = dir.join("custom.js");
        fs::write(&custom, "//custom").unwrap();
        assert_eq!(
            resolve_bundle(Some(custom.as_os_str()), Some(&resources), Some(&dev)).unwrap(),
            custom
        );
        let missing = dir.join("nope.js");
        assert!(matches!(
            resolve_bundle(Some(missing.as_os_str()), Some(&resources), Some(&dev)),
            Err(HubError::BundleMissing { .. })
        ));
    }

    #[test]
    fn simplify_path_strips_only_windows_verbatim_drive_prefixes() {
        assert_eq!(simplify_path(Path::new(r"\\?\C:\app\hub.js")), PathBuf::from(r"C:\app\hub.js"));
        assert_eq!(simplify_path(Path::new(r"\\?\UNC\srv\share")), PathBuf::from(r"\\?\UNC\srv\share"));
        assert_eq!(simplify_path(Path::new("/usr/lib/hub.js")), PathBuf::from("/usr/lib/hub.js"));
    }

    #[test]
    fn workspace_resolution_precedence() {
        let os = |s: &str| OsString::from(s);
        let cwd = PathBuf::from("/work/proj");
        let home = PathBuf::from("/home/me");

        // --workspace (both forms) beats env and cwd.
        assert_eq!(
            resolve_workspace([os("app"), os("--workspace"), os("/a")], Some(OsStr::new("/e")), Some(&cwd), Some(&home)),
            PathBuf::from("/a")
        );
        assert_eq!(
            resolve_workspace([os("--workspace=/b")], Some(OsStr::new("/e")), Some(&cwd), Some(&home)),
            PathBuf::from("/b")
        );
        // Env beats cwd.
        assert_eq!(
            resolve_workspace([os("app")], Some(OsStr::new("/e")), Some(&cwd), Some(&home)),
            PathBuf::from("/e")
        );
        // cwd when nothing else.
        assert_eq!(resolve_workspace([os("app")], None, Some(&cwd), Some(&home)), cwd);
        // A launcher-style cwd of "/" falls back to home.
        assert_eq!(
            resolve_workspace([os("app")], None, Some(Path::new("/")), Some(&home)),
            home
        );
        // A dangling --workspace with no value is ignored.
        assert_eq!(resolve_workspace([os("--workspace")], None, Some(&cwd), Some(&home)), cwd);
    }

    #[test]
    fn prepend_path_puts_dir_first_without_duplicating() {
        let dir = PathBuf::from("/opt/node/bin");
        let original = std::env::join_paths(["/usr/bin", "/opt/node/bin", "/bin"]).unwrap();
        let result = prepend_path(&dir, &original);
        let entries: Vec<PathBuf> = std::env::split_paths(&result).collect();
        assert_eq!(
            entries,
            vec![PathBuf::from("/opt/node/bin"), PathBuf::from("/usr/bin"), PathBuf::from("/bin")]
        );
    }

    #[test]
    fn appimage_library_entries_are_stripped_from_a_path_list() {
        let appdir = Path::new("/tmp/.mount_ReShelXYZ");
        let value = std::env::join_paths([
            "/tmp/.mount_ReShelXYZ/usr/lib",
            "/usr/lib/x86_64-linux-gnu",
            "/tmp/.mount_ReShelXYZ/lib64",
        ])
        .unwrap();
        let cleaned = strip_path_entries_under(&value, appdir).unwrap();
        let entries: Vec<PathBuf> = std::env::split_paths(&cleaned).collect();
        assert_eq!(entries, vec![PathBuf::from("/usr/lib/x86_64-linux-gnu")]);

        // Nothing but image entries: the variable should be removed entirely.
        let only_image = std::env::join_paths(["/tmp/.mount_ReShelXYZ/usr/lib"]).unwrap();
        assert_eq!(strip_path_entries_under(&only_image, appdir), None);
        // A sibling directory that merely shares the prefix text is kept.
        let sibling = std::env::join_paths(["/tmp/.mount_ReShelXYZ-other/lib"]).unwrap();
        assert!(strip_path_entries_under(&sibling, appdir).is_some());
    }

    #[test]
    fn hub_debug_output_never_contains_the_token() {
        // Hub::fmt::Debug is the only formatter the app logs with; guard it.
        let child = Command::new(if cfg!(windows) { "cmd" } else { "sleep" })
            .args(if cfg!(windows) { vec!["/C", "exit"] } else { vec!["0"] })
            .stdin(Stdio::piped())
            .spawn()
            .unwrap();
        let hub = Hub {
            child,
            stdin: None,
            port: 1234,
            token: "super-secret-token".to_string(),
            log: Arc::new(Mutex::new(VecDeque::new())),
            readers: Vec::new(),
        };
        let printed = format!("{hub:?}");
        assert!(!printed.contains("super-secret-token"));
        assert!(printed.contains("redacted"));
    }

    #[test]
    fn errors_render_actionable_messages() {
        let too_old = HubError::NodeTooOld {
            path: PathBuf::from("/usr/bin/node"),
            found: "v16.0.0".into(),
        };
        let text = too_old.to_string();
        assert!(text.contains("v16.0.0") && text.contains("18") && text.contains("RE_SHELL_NODE"));

        let exited = HubError::ExitedEarly {
            status: "exit code 1".into(),
            log_tail: "[hub-server] Failed to start: boom".into(),
        };
        assert!(exited.to_string().contains("boom"));

        let conflict = HubError::ExitedEarly {
            status: "exit code 1".into(),
            log_tail: "[hub-server] Failed to start: Port 4000 is already in use".into(),
        };
        assert!(is_port_conflict(&conflict));
        assert!(!is_port_conflict(&exited));
    }
}
