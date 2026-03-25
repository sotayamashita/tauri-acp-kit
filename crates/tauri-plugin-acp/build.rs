const COMMANDS: &[&str] = &[
    "acp_spawn_agent",
    "acp_start_session",
    "acp_send_prompt",
    "acp_cancel",
    "acp_set_model",
    "acp_respond_permission",
    "acp_terminate_agent",
    "acp_check_agent_available",
    "acp_check_agent",
    "acp_download_agent",
    "acp_get_agent_registry",
    "acp_get_cli_version",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
