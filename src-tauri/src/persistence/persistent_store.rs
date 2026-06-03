use serde::{de::DeserializeOwned, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
};

use tauri::{AppHandle, Manager};

pub struct PersistentStore<T>
where
    T: Serialize + DeserializeOwned + Default + Clone,
{
    store: OnceLock<Arc<Mutex<T>>>,
    filename: &'static str,
}

impl<T> PersistentStore<T>
where
    T: Serialize + DeserializeOwned + Default + Clone,
{
    pub const fn new(filename: &'static str) -> Self {
        Self {
            store: OnceLock::new(),
            filename,
        }
    }

    fn get_store(&self) -> Arc<Mutex<T>> {
        self.store
            .get_or_init(|| Arc::new(Mutex::new(T::default())))
            .clone()
    }

    fn path(&self, app: &AppHandle) -> Option<PathBuf> {
        app.path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join(self.filename))
    }

    pub fn load(&self, app: &AppHandle) {
        let data = self
            .path(app)
            .and_then(|path| fs::read_to_string(path).ok())
            .and_then(|contents| serde_json::from_str::<T>(&contents).ok())
            .unwrap_or_default();

        let store = self.get_store();
        let mut guard = store.lock().unwrap();
        *guard = data;
    }

    pub fn flush(&self, app: &AppHandle) {
        let snapshot = {
            let store = self.get_store();
            let guard = store.lock().unwrap();
            guard.clone()
        };

        let Some(path) = self.path(app) else {
            return;
        };

        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        if let Ok(serialized) = serde_json::to_string_pretty(&snapshot) {
            let _ = fs::write(path, serialized);
        }
    }

    pub fn update<F>(&self, app: &AppHandle, f: F)
    where
        F: FnOnce(&mut T),
    {
        {
            let store = self.get_store();
            let mut guard = store.lock().unwrap();
            f(&mut guard);
        }

        self.flush(app);
    }

    pub fn read<R, F>(&self, f: F) -> R
    where
        F: FnOnce(&T) -> R,
    {
        let store = self.get_store();
        let guard = store.lock().unwrap();
        f(&guard)
    }
}
