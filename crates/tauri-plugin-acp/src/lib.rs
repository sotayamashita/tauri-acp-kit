use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod agent_download;
mod agent_registry;
mod commands;
mod error;
mod events;
mod framing;
mod process;
mod protocol;
mod state;

pub use error::Error;
pub use protocol::AgentSpec;

pub type Result<T> = std::result::Result<T, Error>;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("acp")
        .invoke_handler(tauri::generate_handler![
            commands::acp_spawn_agent,
            commands::acp_start_session,
            commands::acp_send_prompt,
            commands::acp_cancel,
            commands::acp_set_model,
            commands::acp_respond_permission,
            commands::acp_terminate_agent,
            commands::acp_check_agent_available,
            commands::acp_check_agent,
            commands::acp_download_agent,
            commands::acp_get_agent_registry,
            commands::acp_get_cli_version,
        ])
        .setup(|app, _api| {
            let plugin_state = state::PluginState::new();

            // Initialize download manager with app data directory
            if let Ok(data_dir) = app.path().app_data_dir() {
                if let Err(e) = plugin_state.init_download_manager(data_dir) {
                    tracing::warn!("Failed to initialize download manager: {}", e);
                }
            }

            // Initialize agent registry with defaults
            plugin_state.init_registry();

            app.manage(plugin_state);
            Ok(())
        })
        .build()
}
