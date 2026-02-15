use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

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
            commands::acp_terminate_agent,
        ])
        .setup(|app, _api| {
            app.manage(state::PluginState::new());
            Ok(())
        })
        .build()
}
