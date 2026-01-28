import "./App.css";
import { AcpChat } from "./features/acp-chat";
import type { AgentSpec } from "tauri-acp";

// Configure your ACP agent here
const agentSpec: AgentSpec = {
  id: "codex",
  executable: "/opt/homebrew/bin/codex",
  args: ["app-server"],
};

function App() {
  return (
    <main className="container">
      <AcpChat agentSpec={agentSpec} />
    </main>
  );
}

export default App;
