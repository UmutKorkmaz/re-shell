//! Webview-facing helpers: the runtime hub config handed to the dashboard, the
//! per-launch CSP, the navigation allowlist, and the in-window error notices.
//!
//! Everything here is a pure function so it can be unit tested without a window.

use tauri::Url;

/// The global the dashboard reads for its hub URL and session token. It is the
/// same contract the CLI's static server uses (`window.__RE_SHELL_HUB__`), so
/// the dashboard needs no desktop-specific code.
pub const HUB_GLOBAL: &str = "__RE_SHELL_HUB__";

/// Origins the webview itself is served from: `tauri://localhost` on macOS and
/// Linux, `http(s)://tauri.localhost` on Windows. The hub is told to accept
/// exactly these (plus the dev server origin in debug builds) in addition to
/// its own dashboard origin.
pub fn webview_origins(dev_url: Option<&Url>) -> Vec<String> {
    let mut origins = vec![
        "tauri://localhost".to_string(),
        "http://tauri.localhost".to_string(),
        "https://tauri.localhost".to_string(),
    ];
    if let Some(dev) = dev_url {
        let origin = dev.origin().ascii_serialization();
        if origin != "null" && !origins.contains(&origin) {
            origins.push(origin);
        }
    }
    origins
}

/// JSON for embedding in a JS source: valid JSON is valid JS except for the
/// U+2028/U+2029 line separators in older engines.
fn js_json(value: &serde_json::Value) -> String {
    value
        .to_string()
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
}

/// Initialization script that defines `window.__RE_SHELL_HUB__ = { url, token }`
/// before any page script runs. The property is frozen and non-writable so page
/// code cannot swap the hub endpoint for another one.
pub fn hub_init_script(url: &str, token: &str) -> String {
    let payload = js_json(&serde_json::json!({ "url": url, "token": token }));
    format!(
        "(function(){{try{{Object.defineProperty(window,'{HUB_GLOBAL}',\
         {{value:Object.freeze({payload}),enumerable:true,configurable:false,writable:false}});\
         }}catch(e){{}}}})();"
    )
}

/// Pin the CSP's loopback wildcard ports to the hub's actual port, so the
/// webview may only talk to ITS hub rather than to any local service.
/// `connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*` becomes
/// `connect-src 'self' http://127.0.0.1:43211 ws://127.0.0.1:43211`.
pub fn pin_csp(csp: &str, port: u16) -> String {
    csp.replace("http://127.0.0.1:*", &format!("http://127.0.0.1:{port}"))
        .replace("ws://127.0.0.1:*", &format!("ws://127.0.0.1:{port}"))
}

/// Navigation allowlist for the main window. The webview carries the hub token
/// (via the init script), so it must never be navigated to a foreign origin.
pub fn is_allowed_navigation(url: &Url, dev_url: Option<&Url>) -> bool {
    match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" => {
            if url.host_str() == Some("tauri.localhost") {
                return true;
            }
            match dev_url {
                Some(dev) => {
                    url.scheme() == dev.scheme()
                        && url.host_str() == dev.host_str()
                        && url.port_or_known_default() == dev.port_or_known_default()
                }
                None => false,
            }
        }
        "about" => url.as_str() == "about:blank",
        _ => false,
    }
}

/// Where a notice is rendered.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoticeKind {
    /// Replaces the whole (blank) page: the app could not start its hub.
    Page,
    /// A banner over the running dashboard: the hub stopped under it.
    Banner,
}

/// Script that renders a titled notice using only `textContent` (the message can
/// carry hub output, so it is never interpreted as HTML).
pub fn notice_script(kind: NoticeKind, title: &str, message: &str) -> String {
    let payload = js_json(&serde_json::json!({ "title": title, "message": message }));
    let banner = kind == NoticeKind::Banner;
    format!(
        r#"(function(){{
var data={payload};
var banner={banner};
function el(tag,css,text){{var n=document.createElement(tag);n.style.cssText=css;if(text!==undefined)n.textContent=text;return n;}}
function render(){{
  var host;
  if(banner){{
    host=el('div','position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:12px 16px;background:#3a1114;color:#ffd9d9;border-bottom:1px solid #ff6b6b;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;');
    document.body.appendChild(host);
  }} else {{
    document.title=data.title;
    document.documentElement.style.background='#0c0e12';
    document.body.style.cssText='margin:0;background:#0c0e12;color:#f0f1f4;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    document.body.textContent='';
    host=el('main','max-width:760px;margin:0 auto;padding:48px 24px;');
    document.body.appendChild(host);
  }}
  host.appendChild(el(banner?'strong':'h1',banner?'display:block;margin-bottom:4px;':'margin:0 0 16px;font-size:22px;color:#c4f042;',data.title));
  host.appendChild(el('div',banner?'':'padding:16px;border:1px solid #2a2f3a;border-radius:8px;background:#14171d;font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;',data.message));
}}
if(document.readyState==='loading'){{document.addEventListener('DOMContentLoaded',render);}}else{{render();}}
}})();"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn init_script_defines_a_frozen_hub_global_with_url_and_token() {
        let script = hub_init_script("http://127.0.0.1:43211", "abc123");
        assert!(script.contains("Object.defineProperty(window,'__RE_SHELL_HUB__'"));
        assert!(script.contains("Object.freeze({"));
        assert!(script.contains(r#""url":"http://127.0.0.1:43211""#));
        assert!(script.contains(r#""token":"abc123""#));
        assert!(script.contains("writable:false"));
        assert!(script.contains("configurable:false"));
    }

    #[test]
    fn init_script_escapes_hostile_values() {
        let script = hub_init_script("http://127.0.0.1:1", "\"});alert(1);({\"\u{2028}");
        // The quote that would break out of the string literal is escaped.
        assert!(!script.contains(r#"{"url":"http://127.0.0.1:1","token":""});alert"#));
        assert!(script.contains(r#"\"});alert(1);({\""#));
        assert!(!script.contains('\u{2028}'));
        assert!(script.contains("\\u2028"));
    }

    #[test]
    fn webview_origins_cover_all_platforms_and_the_dev_server() {
        let origins = webview_origins(None);
        assert_eq!(
            origins,
            vec!["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"]
        );
        let with_dev = webview_origins(Some(&url("http://localhost:3333/")));
        assert_eq!(with_dev.last().unwrap(), "http://localhost:3333");
        assert_eq!(with_dev.len(), 4);
    }

    #[test]
    fn csp_is_pinned_to_the_hub_port_only() {
        let csp = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; \
                   connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*";
        let pinned = pin_csp(csp, 43211);
        assert!(pinned.contains("connect-src 'self' http://127.0.0.1:43211 ws://127.0.0.1:43211"));
        assert!(!pinned.contains(":*"));
        // Everything else is untouched.
        assert!(pinned.starts_with("default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';"));
        // A CSP without the wildcards is left alone.
        assert_eq!(pin_csp("default-src 'self'", 1), "default-src 'self'");
    }

    #[test]
    fn navigation_allows_only_the_app_origins() {
        assert!(is_allowed_navigation(&url("tauri://localhost/"), None));
        assert!(is_allowed_navigation(&url("tauri://localhost/index.html"), None));
        assert!(is_allowed_navigation(&url("http://tauri.localhost/"), None));
        assert!(is_allowed_navigation(&url("https://tauri.localhost/x"), None));
        assert!(is_allowed_navigation(&url("about:blank"), None));

        assert!(!is_allowed_navigation(&url("https://example.com/"), None));
        assert!(!is_allowed_navigation(&url("http://127.0.0.1:43211/health"), None));
        assert!(!is_allowed_navigation(&url("tauri://evil/"), None));
        assert!(!is_allowed_navigation(&url("http://tauri.localhost.evil.com/"), None));
        assert!(!is_allowed_navigation(&url("file:///etc/passwd"), None));
        assert!(!is_allowed_navigation(&url("about:srcdoc"), None));
        assert!(!is_allowed_navigation(&url("data:text/html,hi"), None));
        assert!(!is_allowed_navigation(&url("javascript:alert(1)"), None));
    }

    #[test]
    fn navigation_dev_url_is_exact() {
        let dev = url("http://localhost:3333/");
        assert!(is_allowed_navigation(&url("http://localhost:3333/some/path"), Some(&dev)));
        assert!(!is_allowed_navigation(&url("http://localhost:3334/"), Some(&dev)));
        assert!(!is_allowed_navigation(&url("https://localhost:3333/"), Some(&dev)));
        assert!(!is_allowed_navigation(&url("http://localhost:3333/"), None));
    }

    #[test]
    fn notice_scripts_render_text_not_html() {
        let page = notice_script(NoticeKind::Page, "Hub failed", "<img src=x onerror=alert(1)>");
        assert!(page.contains("textContent"));
        assert!(!page.contains("innerHTML"));
        assert!(page.contains("var banner=false;"));
        assert!(page.contains(r#""title":"Hub failed""#));
        // The hostile message is data inside a JSON string, never markup.
        assert!(page.contains(r#""message":"<img src=x onerror=alert(1)>""#));

        let banner = notice_script(NoticeKind::Banner, "Hub stopped", "exit code 1");
        assert!(banner.contains("var banner=true;"));
    }
}
