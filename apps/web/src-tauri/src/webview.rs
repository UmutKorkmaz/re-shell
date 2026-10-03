//! Webview-facing helpers: the runtime hub config handed to the dashboard, the
//! per-launch CSP, the navigation allowlist, and the error page and banner.
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
        _ => false,
    }
}

/// Navigation guard for the failure window: only a `data:text/html` page (the
/// error page, plus the engine-internal about:blank; the URL is re-serialized so it cannot be compared
/// byte for byte). That window holds no credentials.
pub fn is_error_page(url: &Url) -> bool {
    // wry loads a data URL by decoding it and handing the HTML to the engine,
    // which reports an internal `about:blank` navigation for it.
    (url.scheme() == "data" && url.path().starts_with("text/html")) || url.as_str() == "about:blank"
}

/// Banner over the running dashboard, rendered with `textContent` only (the
/// message can carry hub output, so it is never interpreted as HTML). Used when
/// the hub dies under a live window.
pub fn banner_script(title: &str, message: &str) -> String {
    let payload = js_json(&serde_json::json!({ "title": title, "message": message }));
    format!(
        r#"(function(){{
var data={payload};
function render(){{
  var host=document.createElement('div');
  host.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:12px 16px;background:#3a1114;color:#ffd9d9;border-bottom:1px solid #ff6b6b;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;';
  var strong=document.createElement('strong');
  strong.style.cssText='display:block;margin-bottom:4px;';
  strong.textContent=data.title;
  var body=document.createElement('div');
  body.textContent=data.message;
  host.appendChild(strong);
  host.appendChild(body);
  document.body.appendChild(host);
}}
if(document.readyState==='loading'){{document.addEventListener('DOMContentLoaded',render);}}else{{render();}}
}})();"#
    )
}

/// Escape text for an HTML text node.
pub fn html_escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}

/// Percent-encode everything but RFC 3986 unreserved characters.
fn percent_encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len() * 3);
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// The self-contained error page shown when the hub cannot be started, as a
/// `data:` URL: static HTML, no scripts, no hub token, opaque origin. It is the
/// only thing the window shows in that case.
pub fn error_page_url(title: &str, message: &str) -> Url {
    let html = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{t}</title>\
         <meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'\">\
         <style>html,body{{margin:0;background:rgb(12,14,18);color:rgb(240,241,244);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}}\
         main{{max-width:760px;margin:0 auto;padding:48px 24px}}h1{{margin:0 0 16px;font-size:22px;color:rgb(196,240,66)}}\
         pre{{margin:0;padding:16px;border:1px solid rgb(42,47,58);border-radius:8px;background:rgb(20,23,29);\
         font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}}</style></head>\
         <body><main><h1>{t}</h1><pre>{m}</pre></main></body></html>",
        t = html_escape(title),
        m = html_escape(message),
    );
    Url::parse(&format!("data:text/html;charset=utf-8,{}", percent_encode(&html)))
        .expect("a percent-encoded data URL is always valid")
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
        assert!(!is_allowed_navigation(&url("about:blank"), None));

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
    fn banner_script_renders_text_not_html() {
        let banner = banner_script("Hub stopped", "<img src=x onerror=alert(1)>");
        assert!(banner.contains("textContent"));
        assert!(!banner.contains("innerHTML"));
        assert!(banner.contains(r#""title":"Hub stopped""#));
        // The hostile message is data inside a JSON string, never markup.
        assert!(banner.contains(r#""message":"<img src=x onerror=alert(1)>""#));
    }

    #[test]
    fn error_page_is_a_scriptless_data_url_with_escaped_text() {
        let url = error_page_url("Could not start <hub>", "node: \"missing\" & <script>alert(1)</script>");
        assert_eq!(url.scheme(), "data");
        let encoded = url.path().strip_prefix("text/html;charset=utf-8,").unwrap().to_string();
        let raw = encoded.as_bytes();
        let mut bytes = Vec::new();
        let mut i = 0;
        while i < raw.len() {
            if raw[i] == b'%' {
                bytes.push(u8::from_str_radix(&encoded[i + 1..i + 3], 16).unwrap());
                i += 3;
            } else {
                bytes.push(raw[i]);
                i += 1;
            }
        }
        let html = String::from_utf8(bytes).unwrap();
        assert!(html.contains("&lt;hub&gt;"));
        assert!(html.contains("&amp; &lt;script&gt;alert(1)&lt;/script&gt;"));
        assert!(!html.contains("<script"));
        assert!(html.contains("default-src 'none'"));
        // The engine decodes the data URL before loading it, so a literal `#`
        // would start a URL fragment and truncate the page.
        assert!(!html.contains('#'), "page must not contain '#': {html}");
    }

    #[test]
    fn failure_window_only_allows_the_html_data_page() {
        assert!(is_error_page(&error_page_url("t", "m")));
        assert!(is_error_page(&url("data:text/html,<p>re-serialized</p>")));
        assert!(!is_error_page(&url("data:application/javascript,alert(1)")));
        assert!(!is_error_page(&url("https://example.com/")));
        assert!(!is_error_page(&url("tauri://localhost/")));
    }

    #[test]
    fn html_escape_handles_all_special_characters() {
        assert_eq!(
            html_escape("<a href=\"x\">'&'</a>"),
            "&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;"
        );
    }
}
