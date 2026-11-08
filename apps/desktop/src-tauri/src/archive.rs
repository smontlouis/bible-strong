//! Offline-copy archives: plain ZIP extraction, and the desktop counterpart of the
//! `bible-strong-archive` module for AES archives (ADR-0065).
//!
//! The password is derived here and never reaches JavaScript. Keep `derive_password` in step
//! with `ArchivePassword.swift`, its Kotlin twin and `encryptedOfflineArchive.ts`: the shared
//! test vector below pins all of them.

use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::{
    fs, io,
    path::{Path, PathBuf},
};
use zip::ZipArchive;

use crate::paths::to_path;

pub(crate) struct ArchiveKeyMaterial {
    pub version: u32,
    pub masked: &'static [u8],
    pub mask: &'static [u8],
}

include!(concat!(env!("OUT_DIR"), "/archive_keys.rs"));

const PASSWORD_SALT: &[u8] = b"bible-strong-offline-archive";

fn key(version: u32) -> Option<Vec<u8>> {
    ARCHIVE_KEYS
        .iter()
        .find(|entry| entry.version == version)
        .filter(|entry| entry.masked.len() == entry.mask.len() && !entry.masked.is_empty())
        .map(|entry| {
            entry
                .masked
                .iter()
                .zip(entry.mask)
                .map(|(masked, mask)| masked ^ mask)
                .collect()
        })
}

pub fn available_key_versions() -> Vec<u32> {
    ARCHIVE_KEYS.iter().map(|entry| entry.version).collect()
}

fn is_lowercase_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

pub fn derive_password(
    master_key: &[u8],
    resource_id: &str,
    archive_sha256: &str,
) -> Option<String> {
    if resource_id.is_empty() || !is_lowercase_sha256(archive_sha256) {
        return None;
    }
    let mut output = [0u8; 32];
    Hkdf::<Sha256>::new(Some(PASSWORD_SALT), master_key)
        .expand(
            format!("{resource_id}\n{archive_sha256}").as_bytes(),
            &mut output,
        )
        .ok()?;
    Some(hex::encode(output))
}

fn create_entry_path(destination: &Path, name: &Path) -> io::Result<PathBuf> {
    let path = destination.join(name);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(path)
}

fn extract(source: &Path, destination: &Path, password: Option<&[u8]>) -> Result<(), String> {
    let file =
        fs::File::open(source).map_err(|error| format!("Archive could not be opened: {error}"))?;
    let mut archive =
        ZipArchive::new(io::BufReader::new(file)).map_err(|error| error.to_string())?;
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for index in 0..archive.len() {
        let mut entry = match password {
            Some(password) => archive.by_index_decrypt(index, password),
            None => archive.by_index(index),
        }
        .map_err(|error| error.to_string())?;
        // `enclosed_name` refuses entries that would escape the destination ("zip slip").
        let name = entry.enclosed_name().ok_or_else(|| {
            let raw = entry
                .name()
                .map(|name| name.into_owned())
                .unwrap_or_default();
            format!("Unsafe archive entry: {raw}")
        })?;
        if entry.is_dir() {
            fs::create_dir_all(destination.join(name)).map_err(|error| error.to_string())?;
            continue;
        }
        let path = create_entry_path(destination, &name).map_err(|error| error.to_string())?;
        let mut output = fs::File::create(&path).map_err(|error| error.to_string())?;
        io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Every file entry must be encrypted, as the Android module requires.
fn is_fully_encrypted(source: &Path) -> Result<bool, String> {
    let file =
        fs::File::open(source).map_err(|error| format!("Archive could not be opened: {error}"))?;
    let mut archive =
        ZipArchive::new(io::BufReader::new(file)).map_err(|error| error.to_string())?;
    let mut files = 0;
    for index in 0..archive.len() {
        let entry = archive
            .by_index_raw(index)
            .map_err(|error| error.to_string())?;
        if entry.is_dir() {
            continue;
        }
        files += 1;
        if !entry.encrypted() {
            return Ok(false);
        }
    }
    Ok(files > 0)
}

#[tauri::command]
pub async fn archive_unzip(source: String, destination: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        extract(&to_path(&source)?, &to_path(&destination)?, None)?;
        Ok(destination)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractEncryptedArchiveOptions {
    source_path: String,
    destination_path: String,
    resource_id: String,
    archive_sha256: String,
    key_version: u32,
}

/// Failures are values, as the native modules return them, so their codes stay stable.
#[derive(Serialize)]
#[serde(untagged)]
pub enum ExtractionResult {
    Path {
        path: String,
    },
    Failure {
        #[serde(rename = "errorCode")]
        error_code: &'static str,
        message: String,
    },
}

fn failure(error_code: &'static str, message: impl Into<String>) -> ExtractionResult {
    ExtractionResult::Failure {
        error_code,
        message: message.into(),
    }
}

pub fn extract_encrypted(options: &ExtractEncryptedArchiveOptions) -> ExtractionResult {
    let Some(master_key) = key(options.key_version) else {
        return failure(
            "ARCHIVE_KEY_UNAVAILABLE",
            "This build has no Offline-copy key for the requested version",
        );
    };
    extract_encrypted_with_key(&master_key, options)
}

fn extract_encrypted_with_key(
    master_key: &[u8],
    options: &ExtractEncryptedArchiveOptions,
) -> ExtractionResult {
    let Some(password) = derive_password(master_key, &options.resource_id, &options.archive_sha256)
    else {
        return failure(
            "ARCHIVE_INVALID_REQUEST",
            "The resource id or plain archive SHA-256 is invalid",
        );
    };
    let (source, destination) = match (
        to_path(&options.source_path),
        to_path(&options.destination_path),
    ) {
        (Ok(source), Ok(destination)) => (source, destination),
        (Err(error), _) | (_, Err(error)) => return failure("ARCHIVE_INVALID_REQUEST", error),
    };
    match is_fully_encrypted(&source) {
        Ok(true) => {}
        Ok(false) => {
            return failure(
                "ARCHIVE_NOT_ENCRYPTED",
                "The archive is not password protected",
            )
        }
        Err(error) => return failure("ARCHIVE_EXTRACTION_FAILED", error),
    }
    match extract(&source, &destination, Some(password.as_bytes())) {
        Ok(()) => ExtractionResult::Path {
            path: options.destination_path.clone(),
        },
        Err(error) => failure("ARCHIVE_EXTRACTION_FAILED", error),
    }
}

#[tauri::command]
pub async fn archive_extract_encrypted(
    options: ExtractEncryptedArchiveOptions,
) -> Result<ExtractionResult, String> {
    tauri::async_runtime::spawn_blocking(move || extract_encrypted(&options))
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The fixed test key of the native module and publication tests, never the production key.
    fn test_key() -> Vec<u8> {
        (1..=32).collect()
    }

    #[test]
    fn derives_the_password_pinned_by_the_other_implementations() {
        assert_eq!(
            derive_password(
                &test_key(),
                "bible:QA",
                "a8671609da0052a7afd556651e091882ec848675317f5642efab84346a333354"
            )
            .as_deref(),
            Some("a4fa97894dc44cbfd4b1bc6aa5e64427a4edfe333bbcfc04dccaa3e47d669c94")
        );
        assert_eq!(derive_password(&test_key(), "bible:QA", "nope"), None);
        assert_eq!(derive_password(&test_key(), "", &"a".repeat(64)), None);
        assert_eq!(
            derive_password(&test_key(), "bible:QA", &"A".repeat(64)),
            None
        );
    }

    fn fixture(name: &str) -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    fn options(source: &Path, destination: &Path) -> ExtractEncryptedArchiveOptions {
        let plain_sha = fs::read_to_string(fixture("qa-plain.sha256"))
            .unwrap()
            .trim()
            .to_string();
        ExtractEncryptedArchiveOptions {
            source_path: crate::paths::to_uri(source, false),
            destination_path: crate::paths::to_uri(destination, true),
            resource_id: "bible:QA".into(),
            archive_sha256: plain_sha,
            key_version: 1,
        }
    }

    #[test]
    fn extracts_an_archive_encrypted_by_the_publication_workflow() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("out");
        let result = extract_encrypted_with_key(
            &test_key(),
            &options(&fixture("qa.encrypted.zip"), &destination),
        );
        assert!(
            matches!(result, ExtractionResult::Path { .. }),
            "{}",
            serde_json::to_string(&result).unwrap()
        );
        assert_eq!(
            fs::read_to_string(destination.join("bible-qa.json")).unwrap(),
            "{\"QA\":true}"
        );
    }

    #[test]
    fn refuses_a_plain_archive_on_the_encrypted_path() {
        let directory = tempfile::tempdir().unwrap();
        let result = extract_encrypted_with_key(
            &test_key(),
            &options(&fixture("qa.zip"), &directory.path().join("out")),
        );
        assert!(matches!(
            result,
            ExtractionResult::Failure {
                error_code: "ARCHIVE_NOT_ENCRYPTED",
                ..
            }
        ));
    }

    #[test]
    fn fails_with_another_key() {
        let directory = tempfile::tempdir().unwrap();
        let result = extract_encrypted_with_key(
            &[9u8; 32],
            &options(&fixture("qa.encrypted.zip"), &directory.path().join("out")),
        );
        assert!(matches!(
            result,
            ExtractionResult::Failure {
                error_code: "ARCHIVE_EXTRACTION_FAILED",
                ..
            }
        ));
    }

    #[test]
    fn extracts_plain_archives() {
        let directory = tempfile::tempdir().unwrap();
        extract(&fixture("qa.zip"), directory.path(), None).unwrap();
        assert_eq!(
            fs::read_to_string(directory.path().join("bible-qa.json")).unwrap(),
            "{\"QA\":true}"
        );
    }

    #[test]
    fn reports_missing_key_versions() {
        let directory = tempfile::tempdir().unwrap();
        let mut request = options(&fixture("qa.encrypted.zip"), directory.path());
        request.key_version = 999;
        assert!(matches!(
            extract_encrypted(&request),
            ExtractionResult::Failure {
                error_code: "ARCHIVE_KEY_UNAVAILABLE",
                ..
            }
        ));
    }
}
