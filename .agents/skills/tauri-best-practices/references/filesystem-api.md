# Tauri File System API Reference

File system operations for Tauri applications.

## Table of Contents

- [File Operations](#file-operations)
- [Directory Operations](#directory-operations)
- [Dialog Integration](#dialog-integration)
- [Path Utilities](#path-utilities)
- [Security Considerations](#security-considerations)

## File Operations

### Read File (Rust)

```rust
use std::fs;

#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_binary(path: &str) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}
```

### Write File (Rust)

```rust
use std::fs;

#[tauri::command]
fn write_file(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary(path: &str, data: Vec<u8>) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}
```

### File Metadata

```rust
use std::fs;
use serde::Serialize;

#[derive(Serialize)]
struct FileInfo {
    size: u64,
    is_file: bool,
    is_dir: bool,
    modified: Option<u64>,
}

#[tauri::command]
fn get_file_info(path: &str) -> Result<FileInfo, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;

    Ok(FileInfo {
        size: metadata.len(),
        is_file: metadata.is_file(),
        is_dir: metadata.is_dir(),
        modified: metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs()),
    })
}
```

### Delete File

```rust
#[tauri::command]
fn delete_file(path: &str) -> Result<(), String> {
    fs::remove_file(path).map_err(|e| e.to_string())
}
```

### Rename/Move File

```rust
#[tauri::command]
fn rename_file(from: &str, to: &str) -> Result<(), String> {
    fs::rename(from, to).map_err(|e| e.to_string())
}
```

### Copy File

```rust
#[tauri::command]
fn copy_file(from: &str, to: &str) -> Result<u64, String> {
    fs::copy(from, to).map_err(|e| e.to_string())
}
```

## Directory Operations

### Create Directory

```rust
#[tauri::command]
fn create_dir(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}
```

### List Directory

```rust
use serde::Serialize;

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn list_dir(path: &str) -> Result<Vec<DirEntry>, String> {
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;

        result.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
        });
    }

    Ok(result)
}
```

### Remove Directory

```rust
#[tauri::command]
fn remove_dir(path: &str, recursive: bool) -> Result<(), String> {
    if recursive {
        fs::remove_dir_all(path)
    } else {
        fs::remove_dir(path)
    }
    .map_err(|e| e.to_string())
}
```

## Dialog Integration

### Open File Dialog

```typescript
import { open } from "@tauri-apps/plugin-dialog";

// Single file
const file = await open({
  multiple: false,
  filters: [
    { name: "BPMN Files", extensions: ["bpmn", "xml"] },
    { name: "All Files", extensions: ["*"] },
  ],
});

if (file) {
  const content = await invoke<string>("read_file", { path: file });
}

// Multiple files
const files = await open({
  multiple: true,
  filters: [{ name: "Images", extensions: ["png", "jpg", "gif"] }],
});
```

### Save File Dialog

```typescript
import { save } from "@tauri-apps/plugin-dialog";

const path = await save({
  filters: [{ name: "BPMN", extensions: ["bpmn"] }],
  defaultPath: "diagram.bpmn",
});

if (path) {
  await invoke("write_file", { path, content: xml });
}
```

### Directory Dialog

```typescript
import { open } from "@tauri-apps/plugin-dialog";

const dir = await open({
  directory: true,
  multiple: false,
});

if (dir) {
  const files = await invoke<DirEntry[]>("list_dir", { path: dir });
}
```

## Path Utilities

### Get App Directories

```typescript
import {
  appDataDir,
  appConfigDir,
  appCacheDir,
  documentDir,
  downloadDir,
  homeDir,
} from "@tauri-apps/api/path";

const dataDir = await appDataDir(); // App data directory
const configDir = await appConfigDir(); // App config directory
const cacheDir = await appCacheDir(); // App cache directory
const docs = await documentDir(); // User documents
const downloads = await downloadDir(); // User downloads
const home = await homeDir(); // User home
```

### Path Manipulation

```typescript
import { join, basename, dirname, extname } from "@tauri-apps/api/path";

const fullPath = await join(dataDir, "diagrams", "flow.bpmn");
const name = await basename(fullPath); // 'flow.bpmn'
const dir = await dirname(fullPath); // '.../diagrams'
const ext = await extname(fullPath); // '.bpmn'
```

### Rust Path Utilities

```rust
use std::path::{Path, PathBuf};

#[tauri::command]
fn resolve_path(base: &str, relative: &str) -> Result<String, String> {
    let path = Path::new(base).join(relative);
    path.canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}
```

## Security Considerations

### Path Validation

Always validate paths to prevent directory traversal:

```rust
use std::path::Path;

fn is_safe_path(path: &str, allowed_base: &str) -> bool {
    let path = match Path::new(path).canonicalize() {
        Ok(p) => p,
        Err(_) => return false,
    };

    let base = match Path::new(allowed_base).canonicalize() {
        Ok(p) => p,
        Err(_) => return false,
    };

    path.starts_with(&base)
}

#[tauri::command]
fn safe_read(path: &str, app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    let app_dir_str = app_dir.to_string_lossy();

    if !is_safe_path(path, &app_dir_str) {
        return Err("Access denied: path outside app directory".to_string());
    }

    std::fs::read_to_string(path).map_err(|e| e.to_string())
}
```

### Capability Scoping

Configure file system access in capabilities:

```json
{
  "identifier": "main-capability",
  "permissions": [
    {
      "identifier": "fs:read-files",
      "allow": [{ "path": "$APPDATA/**" }, { "path": "$DOCUMENT/**" }]
    },
    {
      "identifier": "fs:write-files",
      "allow": [{ "path": "$APPDATA/**" }]
    }
  ]
}
```

### Temporary Files

```rust
use std::env;
use std::fs;

#[tauri::command]
fn create_temp_file(content: &str) -> Result<String, String> {
    let temp_dir = env::temp_dir();
    let temp_file = temp_dir.join(format!("bpmn-{}.tmp", uuid::Uuid::new_v4()));

    fs::write(&temp_file, content).map_err(|e| e.to_string())?;

    Ok(temp_file.to_string_lossy().to_string())
}
```
