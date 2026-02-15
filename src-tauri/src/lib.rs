use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fix PATH for GUI apps: macOS/Linux GUI apps don't inherit shell PATH
    // from dotfiles (.zshrc, .bash_profile, etc.), so executables like
    // claude-code-acp or codex-acp installed via npm/Homebrew won't be found.
    let _ = fix_path_env::fix();

    // Initialize tracing with debug level for acp plugin
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tauri_plugin_acp=debug,tauri_acp_kit=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_acp::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
