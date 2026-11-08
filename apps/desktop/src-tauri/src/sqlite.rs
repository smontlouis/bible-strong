//! The subset of `expo-sqlite` the app uses: one connection per open, as with
//! `useNewConnection: true`, and statements run off the main thread.
//!
//! The bundled SQLite includes FTS5 (`fts5vocab`, `rank`), which Bible search needs. Error
//! messages carry the SQLite code name (`SQLITE_CORRUPT`, `SQLITE_FULL`…) so that
//! `sqliteErrors.ts` and `resourceDeviceCondition.ts` recognise them.

use rusqlite::{
    ffi,
    types::{Value as SqlValue, ValueRef},
    Connection, OpenFlags,
};
use serde::Serialize;
use serde_json::{Map, Number, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use crate::paths::to_path;

#[derive(Default)]
pub struct Databases {
    next_id: AtomicU32,
    connections: Mutex<HashMap<u32, Arc<Mutex<Connection>>>>,
}

impl Databases {
    /// Drops every connection; one still running a statement closes when it is done.
    pub fn close_all(&self) {
        self.connections.lock().unwrap().clear();
    }
}

fn code_name(code: ffi::ErrorCode) -> &'static str {
    use ffi::ErrorCode::*;
    match code {
        DatabaseCorrupt => "SQLITE_CORRUPT",
        NotADatabase => "SQLITE_NOTADB",
        DiskFull => "SQLITE_FULL",
        DatabaseBusy => "SQLITE_BUSY",
        DatabaseLocked => "SQLITE_LOCKED",
        CannotOpen => "SQLITE_CANTOPEN",
        ReadOnly => "SQLITE_READONLY",
        SystemIoFailure => "SQLITE_IOERR",
        ConstraintViolation => "SQLITE_CONSTRAINT",
        _ => "SQLITE_ERROR",
    }
}

fn describe(error: rusqlite::Error) -> String {
    match &error {
        rusqlite::Error::SqliteFailure(failure, message) => format!(
            "{}: {}",
            code_name(failure.code),
            message.clone().unwrap_or_else(|| failure.to_string())
        ),
        _ => error.to_string(),
    }
}

fn connection(databases: &Databases, id: u32) -> Result<Arc<Mutex<Connection>>, String> {
    databases
        .connections
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or_else(|| format!("The database connection {id} was already released"))
}

async fn with_connection<T: Send + 'static>(
    databases: &Databases,
    id: u32,
    task: impl FnOnce(&Connection) -> Result<T, rusqlite::Error> + Send + 'static,
) -> Result<T, String> {
    let connection = connection(databases, id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = connection.lock().map_err(|error| error.to_string())?;
        task(&connection).map_err(describe)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn to_sql(value: &Value) -> SqlValue {
    match value {
        Value::Null => SqlValue::Null,
        Value::Bool(value) => SqlValue::Integer(i64::from(*value)),
        Value::Number(number) => number
            .as_i64()
            .map(SqlValue::Integer)
            .unwrap_or_else(|| SqlValue::Real(number.as_f64().unwrap_or(0.0))),
        Value::String(text) => SqlValue::Text(text.clone()),
        // A byte array, as Uint8Array arrives once serialized.
        Value::Array(items) => SqlValue::Blob(
            items
                .iter()
                .filter_map(|item| item.as_u64().map(|byte| byte as u8))
                .collect(),
        ),
        Value::Object(_) => SqlValue::Text(value.to_string()),
    }
}

fn to_json(value: ValueRef<'_>) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(integer) => Value::Number(integer.into()),
        ValueRef::Real(real) => Number::from_f64(real)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Text(text) => Value::String(String::from_utf8_lossy(text).into_owned()),
        ValueRef::Blob(blob) => Value::Array(
            blob.iter()
                .map(|byte| Value::Number((*byte).into()))
                .collect(),
        ),
    }
}

fn query(
    connection: &Connection,
    sql: &str,
    params: &[Value],
    limit: Option<usize>,
) -> Result<Vec<Map<String, Value>>, rusqlite::Error> {
    let mut statement = connection.prepare_cached(sql)?;
    let columns: Vec<String> = statement
        .column_names()
        .into_iter()
        .map(String::from)
        .collect();
    let params: Vec<SqlValue> = params.iter().map(to_sql).collect();
    let mut rows = statement.query(rusqlite::params_from_iter(params))?;
    let mut results = Vec::new();
    while let Some(row) = rows.next()? {
        let mut object = Map::with_capacity(columns.len());
        for (index, column) in columns.iter().enumerate() {
            object.insert(column.clone(), to_json(row.get_ref(index)?));
        }
        results.push(object);
        if limit.is_some_and(|limit| results.len() >= limit) {
            break;
        }
    }
    Ok(results)
}

#[tauri::command]
pub async fn sqlite_open(
    databases: tauri::State<'_, Databases>,
    uri: String,
) -> Result<u32, String> {
    let path = to_path(&uri)?;
    let opened = tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let connection = Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(describe)?;
        connection
            .busy_timeout(Duration::from_secs(10))
            .map_err(describe)?;
        connection.set_prepared_statement_cache_capacity(64);
        Ok::<_, String>(connection)
    })
    .await
    .map_err(|error| error.to_string())??;
    let id = databases.next_id.fetch_add(1, Ordering::SeqCst) + 1;
    databases
        .connections
        .lock()
        .unwrap()
        .insert(id, Arc::new(Mutex::new(opened)));
    Ok(id)
}

#[tauri::command]
pub async fn sqlite_close(databases: tauri::State<'_, Databases>, id: u32) -> Result<(), String> {
    let removed = databases.connections.lock().unwrap().remove(&id);
    if let Some(connection) = removed {
        // Closing releases the file, which Windows needs before a swap or a deletion.
        tauri::async_runtime::spawn_blocking(move || {
            if let Ok(connection) = Arc::try_unwrap(connection) {
                if let Ok(connection) = connection.into_inner() {
                    let _ = connection.close();
                }
            }
        })
        .await
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn sqlite_all(
    databases: tauri::State<'_, Databases>,
    id: u32,
    sql: String,
    params: Vec<Value>,
) -> Result<Vec<Map<String, Value>>, String> {
    with_connection(&databases, id, move |connection| {
        query(connection, &sql, &params, None)
    })
    .await
}

#[tauri::command]
pub async fn sqlite_first(
    databases: tauri::State<'_, Databases>,
    id: u32,
    sql: String,
    params: Vec<Value>,
) -> Result<Option<Map<String, Value>>, String> {
    with_connection(&databases, id, move |connection| {
        Ok(query(connection, &sql, &params, Some(1))?
            .into_iter()
            .next())
    })
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    changes: usize,
    last_insert_row_id: i64,
}

#[tauri::command]
pub async fn sqlite_run(
    databases: tauri::State<'_, Databases>,
    id: u32,
    sql: String,
    params: Vec<Value>,
) -> Result<RunResult, String> {
    with_connection(&databases, id, move |connection| {
        let mut statement = connection.prepare_cached(&sql)?;
        let params: Vec<SqlValue> = params.iter().map(to_sql).collect();
        let changes = statement.execute(rusqlite::params_from_iter(params))?;
        Ok(RunResult {
            changes,
            last_insert_row_id: connection.last_insert_rowid(),
        })
    })
    .await
}

#[tauri::command]
pub async fn sqlite_exec(
    databases: tauri::State<'_, Databases>,
    id: u32,
    sql: String,
) -> Result<(), String> {
    with_connection(&databases, id, move |connection| {
        connection.execute_batch(&sql)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runs_full_text_search_with_rank_and_vocab() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE VIRTUAL TABLE verses_fts USING fts5(text, tokenize = 'unicode61 remove_diacritics 2');
                 INSERT INTO verses_fts (text) VALUES ('Car Dieu a tant aimé le monde'), ('Au commencement');
                 CREATE VIRTUAL TABLE verses_vocab USING fts5vocab(verses_fts, 'col');",
            )
            .unwrap();
        let rows = query(
            &connection,
            "SELECT text FROM verses_fts WHERE verses_fts MATCH ? ORDER BY rank",
            &[Value::String("aime".into())],
            None,
        )
        .unwrap();
        assert_eq!(rows.len(), 1);
        let vocab = query(
            &connection,
            "SELECT term FROM verses_vocab WHERE term = ?",
            &[Value::String("monde".into())],
            None,
        )
        .unwrap();
        assert_eq!(vocab.len(), 1);
    }

    #[test]
    fn converts_values_both_ways() {
        let connection = Connection::open_in_memory().unwrap();
        let rows = query(
            &connection,
            "SELECT ? AS i, ? AS r, ? AS t, ? AS n, ? AS b",
            &[
                Value::from(42),
                Value::from(1.5),
                Value::from("Jean"),
                Value::Null,
                Value::from(true),
            ],
            None,
        )
        .unwrap();
        assert_eq!(
            Value::Object(rows[0].clone()),
            serde_json::json!({ "i": 42, "r": 1.5, "t": "Jean", "n": null, "b": 1 })
        );
    }

    #[test]
    fn names_corruption_like_the_app_expects() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("broken.sqlite");
        std::fs::write(&path, vec![7u8; 4096]).unwrap();
        let connection = Connection::open(&path).unwrap();
        let error = connection
            .execute_batch("SELECT * FROM sqlite_master")
            .unwrap_err();
        let message = describe(error);
        assert!(
            message.contains("SQLITE_NOTADB") || message.contains("SQLITE_CORRUPT"),
            "{message}"
        );
    }
}
