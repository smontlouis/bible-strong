//! Google and Apple sign-in through the reader's own browser (RFC 8252, loopback redirect).
//!
//! Google refuses OAuth inside an embedded webview. The app opens the browser on
//! `web.bible-strong.app/desktop-sign-in` with the port of a one-time listener and a random
//! state; the page signs the reader in, obtains a Firebase custom token for that account and
//! redirects the browser to `http://127.0.0.1:<port>/callback`. Only a callback carrying the
//! same state is accepted, and the listener stops after it.

use serde::Serialize;
use std::{sync::Mutex, time::Duration};
use tauri::Manager;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::oneshot,
};
use url::Url;

const WAIT: Duration = Duration::from_secs(10 * 60);

#[derive(Default)]
pub struct SignIn {
    pending: Mutex<Option<oneshot::Receiver<SignInOutcome>>>,
    cancel: Mutex<Option<oneshot::Sender<()>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInOutcome {
    token: Option<String>,
    is_new_user: bool,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct SignInStart {
    port: u16,
    state: String,
}

fn random_state() -> String {
    let mut bytes = [0u8; 24];
    getrandom::fill(&mut bytes).expect("random state");
    hex::encode(bytes)
}

const PAGE: &str = r#"<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bible Strong</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#0f2132}
main{text-align:center;max-width:28rem;padding:2rem}h1{font-size:1.4rem}p{color:#5b6b7a}</style></head>
<body><main><h1>Vous pouvez revenir dans Bible Strong</h1><p>You can go back to Bible Strong. Cette page peut être fermée.</p></main></body></html>"#;

async fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;
}

/// Reads one request line; the callback is a plain GET.
async fn request_target(stream: &mut TcpStream) -> Option<String> {
    let mut buffer = vec![0u8; 16 * 1024];
    let mut read = 0;
    loop {
        let count = tokio::time::timeout(Duration::from_secs(10), stream.read(&mut buffer[read..]))
            .await
            .ok()?
            .ok()?;
        if count == 0 {
            return None;
        }
        read += count;
        if buffer[..read]
            .windows(4)
            .any(|window| window == b"\r\n\r\n")
            || read == buffer.len()
        {
            break;
        }
    }
    let head = String::from_utf8_lossy(&buffer[..read]);
    let mut parts = head.lines().next()?.split_whitespace();
    (parts.next()? == "GET")
        .then(|| parts.next().map(str::to_string))
        .flatten()
}

fn parse_callback(target: &str, expected_state: &str) -> Option<SignInOutcome> {
    let url = Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != "/callback" {
        return None;
    }
    let query = |name: &str| {
        url.query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.into_owned())
    };
    if query("state").as_deref() != Some(expected_state) {
        return None;
    }
    Some(SignInOutcome {
        token: query("token").filter(|token| !token.is_empty()),
        is_new_user: query("isNewUser").as_deref() == Some("1"),
        error: query("error"),
    })
}

fn ended(error: &str) -> SignInOutcome {
    SignInOutcome {
        token: None,
        is_new_user: false,
        error: Some(error.into()),
    }
}

async fn serve(
    listener: TcpListener,
    state: String,
    sender: oneshot::Sender<SignInOutcome>,
    cancelled: oneshot::Receiver<()>,
) {
    let accept = async {
        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                continue;
            };
            let Some(target) = request_target(&mut stream).await else {
                continue;
            };
            match parse_callback(&target, &state) {
                Some(outcome) => {
                    respond(&mut stream, "200 OK", PAGE).await;
                    return outcome;
                }
                None => respond(&mut stream, "404 Not Found", "").await,
            }
        }
    };
    let outcome = tokio::select! {
        outcome = tokio::time::timeout(WAIT, accept) => outcome.unwrap_or_else(|_| ended("timeout")),
        _ = cancelled => ended("cancelled"),
    };
    let _ = sender.send(outcome);
}

#[tauri::command]
pub async fn sign_in_start(sign_in: tauri::State<'_, SignIn>) -> Result<SignInStart, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    let state = random_state();
    let (sender, receiver) = oneshot::channel();
    let (cancel, cancelled) = oneshot::channel();
    *sign_in.pending.lock().unwrap() = Some(receiver);
    // A new attempt ends the previous one, whose listener would otherwise wait for nothing.
    if let Some(previous) = sign_in.cancel.lock().unwrap().replace(cancel) {
        let _ = previous.send(());
    }
    tauri::async_runtime::spawn(serve(listener, state.clone(), sender, cancelled));
    Ok(SignInStart { port, state })
}

#[tauri::command]
pub async fn sign_in_result(
    app: tauri::AppHandle,
    sign_in: tauri::State<'_, SignIn>,
) -> Result<SignInOutcome, String> {
    let receiver = sign_in
        .pending
        .lock()
        .unwrap()
        .take()
        .ok_or("No sign-in is in progress")?;
    let outcome = receiver.await.map_err(|_| "cancelled".to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(outcome)
}

pub fn cancel(sign_in: &SignIn) {
    if let Some(cancel) = sign_in.cancel.lock().unwrap().take() {
        let _ = cancel.send(());
    }
}

#[tauri::command]
pub fn sign_in_cancel(sign_in: tauri::State<'_, SignIn>) {
    cancel(&sign_in);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_the_callback_with_its_state() {
        let outcome = parse_callback("/callback?state=abc&token=tok&isNewUser=1", "abc").unwrap();
        assert_eq!(outcome.token.as_deref(), Some("tok"));
        assert!(outcome.is_new_user);
        assert!(parse_callback("/callback?state=other&token=tok", "abc").is_none());
        assert!(parse_callback("/favicon.ico", "abc").is_none());
        let cancelled = parse_callback("/callback?state=abc&error=cancelled", "abc").unwrap();
        assert_eq!(cancelled.error.as_deref(), Some("cancelled"));
        assert!(cancelled.token.is_none());
    }
}
