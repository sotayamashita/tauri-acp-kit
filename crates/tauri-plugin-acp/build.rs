const COMMANDS: &[&str] = &[
    "acp_spawn_agent",
    "acp_start_session",
    "acp_send_prompt",
    "acp_cancel",
    "acp_terminate_agent",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
