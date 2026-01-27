import "./App.css";
import { AcpChat } from "./features/acp-chat";
import type { AgentSpec } from "tauri-acp";

// Configure your ACP agent here
// Example for Codex: { id: "codex", executable: "codex", args: ["--full-auto"] }
const agentSpec: AgentSpec = {
  id: "codex",
  executable: "codex",
  args: ["--full-auto"],
};

function App() {
  return (
    <main className="container">
      <AcpChat agentSpec={agentSpec} />
    </main>
  );
}

export default App;
