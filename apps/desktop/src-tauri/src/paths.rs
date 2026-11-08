//! The JavaScript side speaks `file://` URIs, as `expo-file-system` does on mobile.

use std::path::{Path, PathBuf};
use url::Url;

/// A `file://` URI or a plain absolute path to a filesystem path.
pub fn to_path(value: &str) -> Result<PathBuf, String> {
    if value.is_empty() {
        return Err("An empty path was given".into());
    }
    if value.starts_with("file:") {
        return Url::parse(value)
            .ok()
            .and_then(|url| url.to_file_path().ok())
            .ok_or_else(|| format!("Invalid file URI: {value}"));
    }
    let path = PathBuf::from(value);
    if path.is_absolute() {
        Ok(path)
    } else {
        Err(format!("Expected an absolute path or a file URI: {value}"))
    }
}

/// A filesystem path to a `file://` URI; directories end with `/`, like Expo's constants.
pub fn to_uri(path: &Path, directory: bool) -> String {
    let mut uri = Url::from_file_path(path)
        .map(String::from)
        .unwrap_or_else(|_| format!("file://{}", path.display()));
    if directory && !uri.ends_with('/') {
        uri.push('/');
    }
    uri
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_paths_with_spaces() {
        let path = std::env::temp_dir()
            .join("Application Support")
            .join("bibles.sqlite");
        let uri = to_uri(&path, false);
        assert!(uri.starts_with("file://"));
        assert!(uri.contains("Application%20Support"));
        assert_eq!(to_path(&uri).unwrap(), path);
    }

    #[test]
    fn directories_end_with_a_slash() {
        assert!(to_uri(&std::env::temp_dir(), true).ends_with('/'));
    }

    #[test]
    fn refuses_relative_paths() {
        assert!(to_path("SQLite/bibles.sqlite").is_err());
        assert!(to_path("").is_err());
    }
}
