use parking_lot::Mutex;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, OnceLock},
};
use tauri::{AppHandle, Manager};

const CURRENT_VERSION: u32 = 1;

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
    filename: &'static str,
}

impl<T: Persistent> PersistentStore<T> {
    pub const fn new(filename: &'static str) -> Self {
        Self {
            inner: OnceLock::new(),
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
        {
            let arc = self.get_arc();
            let mut guard = arc.lock();
            f(&mut *guard);
        }
        let snapshot = self.get_arc().lock().clone();
        self.flush_to_disk(app, &snapshot);
    }

    fn load_from_disk(&self, app: &AppHandle) -> T {
        let Some(path) = self.file_path(app) else {
            return T::default();
        };
        let contents = match fs::read_to_string(&path) {
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
                // Version mismatch – attempt migration (just log and use defaults for now)
                tracing::warn!(
                    "Settings file {} has version {} (current {}). Using defaults.",
                    path.display(),
                    versioned.version,
                    CURRENT_VERSION
                );
                // Optional: implement migration logic here if needed
                T::default()
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to parse {}: {}. Creating backup and using defaults.",
                    path.display(),
                    e
                );
                let _ = fs::copy(&path, path.with_extension("json.bak"));
                T::default()
            }
        }
    }

    fn flush_to_disk(&self, app: &AppHandle, data: &T) {
        let Some(path) = self.file_path(app) else {
            return;
        };
        if let Some(parent) = path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                tracing::error!("Failed to create dir {}: {e}", parent.display());
                return;
            }
        }
        let versioned = VersionedData {
            version: CURRENT_VERSION,
            data,
        };
        let serialized = match serde_json::to_string_pretty(&versioned) {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("Serialization error: {e}");
                return;
            }
        };
        let tmp = path.with_extension("json.tmp");
        if let Err(e) = fs::write(&tmp, &serialized) {
            tracing::error!("Failed to write temp file {}: {e}", tmp.display());
            return;
        }
        if let Err(e) = fs::rename(&tmp, &path) {
            tracing::error!(
                "Failed to rename {} -> {}: {e}",
                tmp.display(),
                path.display()
            );
            let _ = fs::remove_file(&tmp);
        }
    }
}
