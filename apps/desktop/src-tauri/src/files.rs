//! The subset of `expo-file-system/legacy` the Offline-copy pipeline uses.
//!
//! Error messages keep the words `resourceDeviceCondition.ts` recognises: the standard library
//! already says "No space left on device" (Unix) or "There is not enough space on the disk"
//! (Windows).

use base64::Engine;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{self, Read},
    path::Path,
    time::UNIX_EPOCH,
};
use tauri::ipc::Response;

use crate::paths::{to_path, to_uri};

async fn blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| error.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    exists: bool,
    is_directory: bool,
    uri: String,
    size: Option<u64>,
    modification_time: Option<f64>,
}

#[tauri::command]
pub async fn fs_info(uri: String) -> Result<FileInfo, String> {
    blocking(move || {
        let path = to_path(&uri)?;
        Ok(match fs::metadata(&path) {
            Ok(metadata) => FileInfo {
                exists: true,
                is_directory: metadata.is_dir(),
                uri: to_uri(&path, metadata.is_dir()),
                size: Some(metadata.len()),
                modification_time: metadata
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_secs_f64()),
            },
            Err(_) => FileInfo {
                exists: false,
                is_directory: false,
                uri,
                size: None,
                modification_time: None,
            },
        })
    })
    .await
}

fn remove(path: &Path) -> io::Result<()> {
    if fs::symlink_metadata(path)?.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
}

#[tauri::command]
pub async fn fs_delete(uri: String, idempotent: bool) -> Result<(), String> {
    blocking(move || {
        let path = to_path(&uri)?;
        match remove(&path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound && idempotent => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Err(format!(
                "File '{uri}' could not be deleted because it could not be found"
            )),
            Err(error) => Err(format!("File '{uri}' could not be deleted: {error}")),
        }
    })
    .await
}

#[tauri::command]
pub async fn fs_mkdir(uri: String, intermediates: bool) -> Result<(), String> {
    blocking(move || {
        let path = to_path(&uri)?;
        let result = if intermediates {
            fs::create_dir_all(&path)
        } else {
            fs::create_dir(&path)
        };
        result.map_err(|error| format!("Directory '{uri}' could not be created: {error}"))
    })
    .await
}

fn copy_recursively(from: &Path, to: &Path) -> io::Result<()> {
    if fs::metadata(from)?.is_dir() {
        fs::create_dir_all(to)?;
        for entry in fs::read_dir(from)? {
            let entry = entry?;
            copy_recursively(&entry.path(), &to.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(from, to).map(|_| ())
    }
}

/// Renames, or copies then removes when the two paths are on different volumes.
pub fn move_path(from: &Path, to: &Path) -> io::Result<()> {
    match fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Err(error),
        Err(_) => {
            copy_recursively(from, to)?;
            remove(from)
        }
    }
}

#[tauri::command]
pub async fn fs_move(from: String, to: String) -> Result<(), String> {
    blocking(move || {
        move_path(&to_path(&from)?, &to_path(&to)?)
            .map_err(|error| format!("File '{from}' could not be moved to '{to}': {error}"))
    })
    .await
}

#[tauri::command]
pub async fn fs_copy(from: String, to: String) -> Result<(), String> {
    blocking(move || {
        copy_recursively(&to_path(&from)?, &to_path(&to)?)
            .map_err(|error| format!("File '{from}' could not be copied to '{to}': {error}"))
    })
    .await
}

/// Raw bytes, so a Bible of several megabytes crosses the bridge without JSON encoding.
#[tauri::command]
pub async fn fs_read_bytes(uri: String) -> Result<Response, String> {
    blocking(move || {
        fs::read(to_path(&uri)?)
            .map(Response::new)
            .map_err(|error| format!("File '{uri}' could not be read: {error}"))
    })
    .await
}

#[tauri::command]
pub async fn fs_write_string(
    uri: String,
    contents: String,
    encoding: String,
) -> Result<(), String> {
    blocking(move || {
        let path = to_path(&uri)?;
        let bytes = if encoding == "base64" {
            base64::engine::general_purpose::STANDARD
                .decode(contents)
                .map_err(|error| format!("Invalid base64 for '{uri}': {error}"))?
        } else {
            contents.into_bytes()
        };
        fs::write(path, bytes)
            .map_err(|error| format!("File '{uri}' could not be written: {error}"))
    })
    .await
}

#[tauri::command]
pub async fn fs_read_dir(uri: String) -> Result<Vec<String>, String> {
    blocking(move || {
        let entries = fs::read_dir(to_path(&uri)?)
            .map_err(|error| format!("Directory '{uri}' could not be read: {error}"))?;
        entries
            .map(|entry| entry.map(|entry| entry.file_name().to_string_lossy().into_owned()))
            .collect::<io::Result<_>>()
            .map_err(|error| error.to_string())
    })
    .await
}

#[derive(Serialize)]
pub struct DiskSpace {
    free: u64,
    total: u64,
}

#[tauri::command]
pub async fn fs_disk_space(uri: String) -> Result<DiskSpace, String> {
    blocking(move || {
        let path = to_path(&uri)?;
        Ok(DiskSpace {
            free: fs4::available_space(&path).map_err(|error| error.to_string())?,
            total: fs4::total_space(&path).map_err(|error| error.to_string())?,
        })
    })
    .await
}

pub fn sha256_file(path: &Path) -> io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[tauri::command]
pub async fn fs_sha256(uri: String) -> Result<String, String> {
    blocking(move || {
        sha256_file(&to_path(&uri)?)
            .map_err(|error| format!("File '{uri}' could not be hashed: {error}"))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("a.txt");
        fs::write(&path, b"abc").unwrap();
        assert_eq!(
            sha256_file(&path).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn moves_directories() {
        let directory = tempfile::tempdir().unwrap();
        let from = directory.path().join("from");
        fs::create_dir_all(from.join("nested")).unwrap();
        fs::write(from.join("nested").join("a.sqlite"), b"x").unwrap();
        let to = directory.path().join("to");
        move_path(&from, &to).unwrap();
        assert!(!from.exists());
        assert_eq!(fs::read(to.join("nested").join("a.sqlite")).unwrap(), b"x");
    }
}
