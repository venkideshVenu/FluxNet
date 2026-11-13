use parking_lot::Mutex;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, OnceLock},
};
use tauri::{AppHandle, Manager};

pub const CURRENT_VERSION: u32 = 1;

#[derive(Serialize, Deserialize)]
struct VersionedData<T> {
    version: u32,
    #[serde(flatten)]
    data: T,
}

pub trait Persistent: Serialize + DeserializeOwned + Default + Clone + Send + 'static {}
impl<T: Serialize + DeserializeOwned + Default + Clone + Send + 'static> Persistent for T {}

pub struct PersistentStore<T: Persistent> {
    inner: OnceLock<Arc<Mutex<T>>>,
    /// Serialises snapshot + write + rename so concurrent updates can't
    /// interleave on the shared temp file or land an older snapshot last.
    write_lock: Mutex<()>,
    filename: &'static str,
}

impl<T: Persistent> PersistentStore<T> {
    pub const fn new(filename: &'static str) -> Self {
        Self {
            inner: OnceLock::new(),
            write_lock: Mutex::new(()),
            filename,
        }
    }

    fn get_arc(&self) -> Arc<Mutex<T>> {
        self.inner
            .get_or_init(|| Arc::new(Mutex::new(T::default())))
            .clone()
    }

    fn file_path(&self, app: &AppHandle) -> Option<PathBuf> {
        app.path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join(self.filename))
    }

    pub fn load(&self, app: &AppHandle) {
        let data = self.load_from_disk(app);
        *self.get_arc().lock() = data;
    }

    pub fn read<R, F: FnOnce(&T) -> R>(&self, f: F) -> R {
        let arc = self.get_arc();
        let guard = arc.lock();
        f(&guard)
    }

    pub fn update<F: FnOnce(&mut T)>(&self, app: &AppHandle, f: F) {
        // Writers are ordered by `write_lock`; readers only wait for the
        // in-memory mutation, never for disk I/O.
        let _writer = self.write_lock.lock();
        let snapshot = {
            let arc = self.get_arc();
            let mut guard = arc.lock();
            f(&mut *guard);
            guard.clone()
        };
        self.flush_to_disk(app, &snapshot);
    }

    fn load_from_disk(&self, app: &AppHandle) -> T {
        match self.file_path(app) {
            Some(path) => load_from_path(&path),
            None => T::default(),
        }
    }

    fn flush_to_disk(&self, app: &AppHandle, data: &T) {
        if let Some(path) = self.file_path(app) {
            if let Err(e) = save_to_path(&path, data) {
                tracing::error!("Failed to save {}: {e}", path.display());
            }
        }
    }
}

/// Reads a versioned JSON file. Missing → defaults; unreadable, corrupt or
/// from another version → backed up to `.json.bak`, then defaults.
pub fn load_from_path<T: Persistent>(path: &Path) -> T {
    let contents = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return T::default(),
        Err(e) => {
            tracing::warn!("Failed to read {}: {e}. Using defaults.", path.display());
            return T::default();
        }
    };
    match serde_json::from_str::<VersionedData<T>>(&contents) {
        Ok(versioned) if versioned.version == CURRENT_VERSION => versioned.data,
        Ok(versioned) => {
            tracing::error!(
                "{} has version {} (current {}); backing up and using defaults",
                path.display(),
                versioned.version,
                CURRENT_VERSION
            );
            let _ = fs::copy(path, path.with_extension("json.bak"));
            T::default()
        }
        Err(e) => {
            tracing::warn!(
                "Failed to parse {}: {e}; backing up and using defaults",
                path.display()
            );
            let _ = fs::copy(path, path.with_extension("json.bak"));
            T::default()
        }
    }
}

/// Atomically replaces `path`: write a temp file, fsync it, then rename, so
/// a crash or power loss leaves either the old or the new file, never a
/// truncated one.
pub fn save_to_path<T: Persistent>(path: &Path, data: &T) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let serialized = serde_json::to_vec(&VersionedData {
        version: CURRENT_VERSION,
        data,
    })
    .map_err(std::io::Error::other)?;

    let tmp = path.with_extension("json.tmp");
    let result = (|| {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(&serialized)?;
        file.sync_all()?;
        fs::rename(&tmp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
    struct Sample {
        #[serde(default)]
        values: HashMap<String, i32>,
    }

    fn temp_path(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("fluxnet-store-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir.join("state.json")
    }

    #[test]
    fn round_trips_through_disk() {
        let path = temp_path("roundtrip");
        let mut data = Sample::default();
        data.values.insert("pill".into(), 3);
        save_to_path(&path, &data).unwrap();
        assert_eq!(load_from_path::<Sample>(&path), data);
        assert!(!path.with_extension("json.tmp").exists());
    }

    #[test]
    fn missing_file_gives_defaults() {
        let path = temp_path("missing");
        assert_eq!(load_from_path::<Sample>(&path), Sample::default());
    }

    #[test]
    fn corrupt_file_is_backed_up_and_defaults_used() {
        let path = temp_path("corrupt");
        fs::write(&path, b"{\"version\":1,\"values\":{\"pi").unwrap();
        assert_eq!(load_from_path::<Sample>(&path), Sample::default());
        assert!(path.with_extension("json.bak").exists());
    }

    #[test]
    fn other_version_is_backed_up_and_defaults_used() {
        let path = temp_path("version");
        fs::write(&path, br#"{"version":99,"values":{"a":1}}"#).unwrap();
        assert_eq!(load_from_path::<Sample>(&path), Sample::default());
        assert!(path.with_extension("json.bak").exists());
    }

    #[test]
    fn concurrent_saves_always_leave_a_valid_file() {
        let path = temp_path("concurrent");
        let lock = Arc::new(Mutex::new(()));
        let handles: Vec<_> = (0..8)
            .map(|i| {
                let path = path.clone();
                let lock = lock.clone();
                std::thread::spawn(move || {
                    for j in 0..25 {
                        let mut data = Sample::default();
                        data.values.insert("n".into(), i * 100 + j);
                        let _guard = lock.lock();
                        save_to_path(&path, &data).unwrap();
                    }
                })
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }
        let loaded: Sample = load_from_path(&path);
        assert!(loaded.values.contains_key("n"));
        assert!(!path.with_extension("json.bak").exists());
    }
}
