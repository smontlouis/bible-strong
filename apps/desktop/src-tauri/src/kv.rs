//! The app's synchronous key-value store (MMKV on mobile), kept durable in SQLite.
//!
//! JavaScript reads from a snapshot served before the bundle runs (see `bootstrap`) and sends
//! its writes here in order. Unlike `localStorage`, nothing caps the size of the persisted
//! account data.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use std::{collections::BTreeMap, path::Path, sync::Mutex};

pub struct KvStore {
    connection: Mutex<Connection>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum KvOp {
    Set { key: String, value: String },
    Remove { key: String },
    Clear,
}

impl KvStore {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let connection = Connection::open(path).map_err(|error| error.to_string())?;
        connection
            .execute_batch(
                "PRAGMA journal_mode = WAL;
                 PRAGMA synchronous = NORMAL;
                 CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
            )
            .map_err(|error| error.to_string())?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn snapshot(&self) -> Result<BTreeMap<String, String>, String> {
        let connection = self.connection.lock().map_err(|error| error.to_string())?;
        let mut statement = connection
            .prepare("SELECT key, value FROM kv")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<_, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn get(&self, key: &str) -> Result<Option<String>, String> {
        let connection = self.connection.lock().map_err(|error| error.to_string())?;
        connection
            .query_row("SELECT value FROM kv WHERE key = ?1", params![key], |row| {
                row.get(0)
            })
            .optional()
            .map_err(|error| error.to_string())
    }

    /// Applies one batch atomically, in the order JavaScript made the writes.
    pub fn apply(&self, ops: &[KvOp]) -> Result<(), String> {
        let mut connection = self.connection.lock().map_err(|error| error.to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        for op in ops {
            match op {
                KvOp::Set { key, value } => transaction.execute(
                    "INSERT INTO kv (key, value) VALUES (?1, ?2)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    params![key, value],
                ),
                KvOp::Remove { key } => {
                    transaction.execute("DELETE FROM kv WHERE key = ?1", params![key])
                }
                KvOp::Clear => transaction.execute("DELETE FROM kv", []),
            }
            .map_err(|error| error.to_string())?;
        }
        transaction.commit().map_err(|error| error.to_string())
    }
}

#[tauri::command]
pub async fn kv_apply(store: tauri::State<'_, KvStore>, ops: Vec<KvOp>) -> Result<(), String> {
    store.apply(&ops)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn applies_batches_in_order_and_survives_reopening() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("kv.sqlite");
        let store = KvStore::open(&path).unwrap();
        store
            .apply(&[
                KvOp::Set {
                    key: "root".into(),
                    value: "{\"a\":1}".into(),
                },
                KvOp::Set {
                    key: "root".into(),
                    value: "{\"a\":2}".into(),
                },
                KvOp::Set {
                    key: "flag".into(),
                    value: "true".into(),
                },
                KvOp::Remove { key: "flag".into() },
            ])
            .unwrap();
        drop(store);

        let reopened = KvStore::open(&path).unwrap();
        let snapshot = reopened.snapshot().unwrap();
        assert_eq!(snapshot.get("root").map(String::as_str), Some("{\"a\":2}"));
        assert!(!snapshot.contains_key("flag"));
        assert_eq!(reopened.get("root").unwrap().as_deref(), Some("{\"a\":2}"));
        assert_eq!(reopened.get("flag").unwrap(), None);

        reopened.apply(&[KvOp::Clear]).unwrap();
        assert!(reopened.snapshot().unwrap().is_empty());
    }

    #[test]
    fn deserializes_the_javascript_operations() {
        let ops: Vec<KvOp> = serde_json::from_str(
            r#"[{"op":"set","key":"k","value":"v"},{"op":"remove","key":"k"},{"op":"clear"}]"#,
        )
        .unwrap();
        assert_eq!(ops.len(), 3);
    }
}
