//! `FileSystem.createDownloadResumable` for Offline copies.
//!
//! As on mobile, a response outside 2xx resolves with its status and body instead of failing,
//! and a cancelled download resolves to nothing. Network failures are worded so that
//! `resourceDeviceCondition.ts` recognises an offline device or a timeout.

use futures_util::StreamExt;
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::ipc::Channel;
use tokio::io::AsyncWriteExt;

use crate::paths::{to_path, to_uri};

pub struct Downloads {
    client: reqwest::Client,
    cancelled: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Downloads {
    pub fn new(user_agent: String) -> Self {
        let client = reqwest::Client::builder()
            .user_agent(user_agent)
            .connect_timeout(Duration::from_secs(30))
            .read_timeout(Duration::from_secs(60))
            .build()
            .expect("HTTP client");
        Self {
            client,
            cancelled: Mutex::new(HashMap::new()),
        }
    }

    pub fn cancel_all(&self) {
        for flag in self.cancelled.lock().unwrap().values() {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    total_bytes_written: u64,
    total_bytes_expected_to_write: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    uri: String,
    status: u16,
    headers: HashMap<String, String>,
    mime_type: Option<String>,
}

fn describe_request_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        format!("The request timed out ({error})")
    } else if error.is_connect() {
        format!("Could not connect to the server ({error})")
    } else {
        format!("The network connection was lost ({error})")
    }
}

#[tauri::command]
pub async fn download_start(
    downloads: tauri::State<'_, Downloads>,
    id: String,
    url: String,
    uri: String,
    headers: HashMap<String, String>,
    on_progress: Channel<DownloadProgress>,
) -> Result<Option<DownloadResult>, String> {
    let cancelled = Arc::new(AtomicBool::new(false));
    downloads
        .cancelled
        .lock()
        .unwrap()
        .insert(id.clone(), cancelled.clone());
    let result = run(
        &downloads.client,
        &url,
        &uri,
        &headers,
        &on_progress,
        &cancelled,
    )
    .await;
    downloads.cancelled.lock().unwrap().remove(&id);
    result
}

async fn run(
    client: &reqwest::Client,
    url: &str,
    uri: &str,
    headers: &HashMap<String, String>,
    on_progress: &Channel<DownloadProgress>,
    cancelled: &AtomicBool,
) -> Result<Option<DownloadResult>, String> {
    let path = to_path(uri)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| error.to_string())?;
    }
    let mut request = client.get(url);
    for (name, value) in headers {
        request = request.header(name, value);
    }
    let response = request
        .send()
        .await
        .map_err(|error| describe_request_error(&error))?;
    let status = response.status().as_u16();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            Some((
                name.as_str().to_lowercase(),
                value.to_str().ok()?.to_string(),
            ))
        })
        .collect();
    let mime_type = response_headers
        .get("content-type")
        .map(|value| value.split(';').next().unwrap_or(value).trim().to_string());
    let expected = response
        .content_length()
        .map(|length| length as i64)
        .unwrap_or(-1);

    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|error| format!("File '{uri}' could not be created: {error}"))?;
    let mut written: u64 = 0;
    let mut last_report = Instant::now();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if cancelled.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let chunk = chunk.map_err(|error| describe_request_error(&error))?;
        file.write_all(&chunk)
            .await
            .map_err(|error| error.to_string())?;
        written += chunk.len() as u64;
        if last_report.elapsed() >= Duration::from_millis(150) {
            last_report = Instant::now();
            let _ = on_progress.send(DownloadProgress {
                total_bytes_written: written,
                total_bytes_expected_to_write: expected,
            });
        }
    }
    file.flush().await.map_err(|error| error.to_string())?;
    file.sync_all().await.map_err(|error| error.to_string())?;
    if cancelled.load(Ordering::SeqCst) {
        return Ok(None);
    }
    let _ = on_progress.send(DownloadProgress {
        total_bytes_written: written,
        total_bytes_expected_to_write: expected,
    });
    Ok(Some(DownloadResult {
        uri: to_uri(&path, false),
        status,
        headers: response_headers,
        mime_type,
    }))
}

#[tauri::command]
pub fn download_cancel(downloads: tauri::State<'_, Downloads>, id: String) {
    if let Some(flag) = downloads.cancelled.lock().unwrap().get(&id) {
        flag.store(true, Ordering::SeqCst);
    }
}
