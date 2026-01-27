---
name: tauri-best-practices
description: Tauri desktop application patterns for bpmn-editor. Use when implementing IPC commands, file system operations, window management, app lifecycle, or Tauri plugins. Triggers on tasks involving Rust/JavaScript bridge, desktop features, native APIs, or Tauri configuration.
---

# Tauri Best Practices

Patterns and guidelines for Tauri integration in the bpmn-editor project.

## Project Structure

```
src-tauri/
├── src/
│   ├── main.rs           # Entry point
│   └── lib.rs            # Commands and logic
├── tauri.conf.json       # Configuration
├── Cargo.toml            # Rust dependencies
└── capabilities/         # Security capabilities
```

## Quick Start

### Define a Command (Rust)

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Register in main.rs
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![greet])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

### Call from Frontend (TypeScript)

```typescript
import { invoke } from "@tauri-apps/api/core";

const greeting = await invoke<string>("greet", { name: "World" });
```

## IPC Patterns

### Return Complex Types

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct Document {
    id: String,
    name: String,
    content: String,
}

#[tauri::command]
fn get_document(id: &str) -> Result<Document, String> {
    Ok(Document {
        id: id.to_string(),
        name: "Untitled".to_string(),
        content: String::new(),
    })
}
```

### Error Handling

```rust
#[tauri::command]
fn save_file(path: &str, content: &str) -> Result<(), String> {
    std::fs::write(path, content)
        .map_err(|e| format!("Failed to save: {}", e))
}
```

Frontend handling:

```typescript
try {
  await invoke("save_file", { path, content });
} catch (error) {
  console.error("Save failed:", error);
}
```

### Async Commands

```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // Async implementation
    Ok("data".to_string())
}
```

### Access App State

```rust
use std::sync::Mutex;
use tauri::State;

struct AppState {
    counter: Mutex<i32>,
}

#[tauri::command]
fn increment(state: State<AppState>) -> i32 {
    let mut counter = state.counter.lock().unwrap();
    *counter += 1;
    *counter
}

// Setup in main.rs
tauri::Builder::default()
    .manage(AppState { counter: Mutex::new(0) })
    .invoke_handler(tauri::generate_handler![increment])
```

## File System

### Read File

```rust
#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|e| e.to_string())
}
```

### Write File

```rust
#[tauri::command]
fn write_file(path: &str, content: &str) -> Result<(), String> {
    std::fs::write(path, content)
        .map_err(|e| e.to_string())
}
```

### File Dialogs

Frontend:

```typescript
import { open, save } from "@tauri-apps/plugin-dialog";

// Open file
const file = await open({
  filters: [{ name: "BPMN", extensions: ["bpmn", "xml"] }],
});

// Save file
const path = await save({
  filters: [{ name: "BPMN", extensions: ["bpmn"] }],
  defaultPath: "diagram.bpmn",
});
```

## Security

### Capability Configuration

Define minimal permissions in `src-tauri/capabilities/`:

```json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": ["core:default", "dialog:default", "fs:read-files", "fs:write-files"]
}
```

### Input Validation

Always validate in commands:

```rust
#[tauri::command]
fn open_file(path: &str) -> Result<String, String> {
    // Validate path
    if path.contains("..") {
        return Err("Invalid path".to_string());
    }

    std::fs::read_to_string(path)
        .map_err(|e| e.to_string())
}
```

## Development

```bash
pnpm tauri dev     # Development with hot reload
pnpm tauri build   # Production build
```

## Resources

- **IPC Reference**: See `references/ipc-patterns.md`
- **File System API**: See `references/filesystem-api.md`
