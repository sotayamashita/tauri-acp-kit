# Tauri IPC Patterns Reference

Advanced patterns for Tauri inter-process communication.

## Table of Contents

- [Command Patterns](#command-patterns)
- [Events](#events)
- [Type Safety](#type-safety)
- [Error Handling](#error-handling)
- [Performance](#performance)

## Command Patterns

### Basic Command

```rust
#[tauri::command]
fn hello(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

```typescript
const result = await invoke<string>("hello", { name: "World" });
```

### Command with Multiple Parameters

```rust
#[tauri::command]
fn calculate(a: i32, b: i32, operation: &str) -> Result<i32, String> {
    match operation {
        "add" => Ok(a + b),
        "subtract" => Ok(a - b),
        "multiply" => Ok(a * b),
        "divide" => {
            if b == 0 {
                Err("Division by zero".to_string())
            } else {
                Ok(a / b)
            }
        }
        _ => Err(format!("Unknown operation: {}", operation)),
    }
}
```

### Command with Optional Parameters

```rust
#[tauri::command]
fn search(query: &str, limit: Option<usize>) -> Vec<String> {
    let limit = limit.unwrap_or(10);
    // Search implementation
    vec![]
}
```

### Async Command with Progress

```rust
use tauri::Window;

#[tauri::command]
async fn long_operation(window: Window) -> Result<(), String> {
    for i in 0..100 {
        // Do work
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Emit progress
        window.emit("progress", i).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<number>("progress", (event) => {
  console.log(`Progress: ${event.payload}%`);
});

await invoke("long_operation");
unlisten();
```

## Events

### Emit from Backend

```rust
use tauri::Emitter;

#[tauri::command]
fn start_monitoring(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            let data = get_system_stats();
            app.emit("system-stats", data).unwrap();
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    });
}
```

### Listen in Frontend

```typescript
import { listen } from "@tauri-apps/api/event";

// Listen to event
const unlisten = await listen<SystemStats>("system-stats", (event) => {
  updateUI(event.payload);
});

// Cleanup
unlisten();
```

### Emit from Frontend

```typescript
import { emit } from "@tauri-apps/api/event";

await emit("user-action", { action: "save", timestamp: Date.now() });
```

### Listen in Backend

```rust
use tauri::Listener;

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.listen("user-action", |event| {
        println!("Received: {:?}", event.payload());
    });
    Ok(())
}
```

## Type Safety

### Define Shared Types

```rust
// src-tauri/src/types.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BpmnDocument {
    pub id: String,
    pub name: String,
    pub xml: String,
    pub modified: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SaveResult {
    Success { path: String },
    Cancelled,
    Error { message: String },
}
```

```typescript
// src/types/tauri.ts
interface BpmnDocument {
  id: string;
  name: string;
  xml: string;
  modified: boolean;
}

type SaveResult =
  | { Success: { path: string } }
  | { Cancelled: null }
  | { Error: { message: string } };
```

### Use Types in Commands

```rust
#[tauri::command]
fn save_document(doc: BpmnDocument) -> SaveResult {
    // Implementation
    SaveResult::Success { path: "/path/to/file".to_string() }
}
```

```typescript
const result = await invoke<SaveResult>("save_document", { doc });

if ("Success" in result) {
  console.log("Saved to:", result.Success.path);
} else if ("Error" in result) {
  console.error("Error:", result.Error.message);
}
```

## Error Handling

### Custom Error Type

```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },

    #[error("Invalid format: {message}")]
    InvalidFormat { message: String },

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::FileNotFound {
                path: "unknown".to_string(),
            },
            std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied {
                path: "unknown".to_string(),
            },
            _ => AppError::Internal(err.to_string()),
        }
    }
}

#[tauri::command]
fn open_document(path: &str) -> Result<BpmnDocument, AppError> {
    let content = std::fs::read_to_string(path)?;
    // Parse and return
    Ok(BpmnDocument { /* ... */ })
}
```

### Frontend Error Handling

```typescript
try {
  const doc = await invoke<BpmnDocument>("open_document", { path });
} catch (error) {
  const appError = error as AppError;

  if ("FileNotFound" in appError) {
    showError(`File not found: ${appError.FileNotFound.path}`);
  } else if ("PermissionDenied" in appError) {
    showError(`Access denied: ${appError.PermissionDenied.path}`);
  } else {
    showError("An unexpected error occurred");
  }
}
```

## Performance

### Batch Operations

```rust
#[tauri::command]
fn batch_process(items: Vec<String>) -> Vec<Result<String, String>> {
    items.into_iter()
        .map(|item| process_item(&item))
        .collect()
}
```

### Streaming Large Data

For large files, stream data instead of loading entirely:

```rust
use tauri::ipc::Channel;

#[tauri::command]
fn read_large_file(path: &str, channel: Channel<Vec<u8>>) -> Result<(), String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut reader = std::io::BufReader::new(file);
    let mut buffer = vec![0u8; 8192];

    loop {
        let bytes_read = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        channel.send(buffer[..bytes_read].to_vec()).map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

### Caching

```rust
use std::collections::HashMap;
use std::sync::RwLock;

struct Cache {
    data: RwLock<HashMap<String, String>>,
}

#[tauri::command]
fn get_cached(key: &str, cache: State<Cache>) -> Option<String> {
    cache.data.read().unwrap().get(key).cloned()
}

#[tauri::command]
fn set_cached(key: String, value: String, cache: State<Cache>) {
    cache.data.write().unwrap().insert(key, value);
}
```
