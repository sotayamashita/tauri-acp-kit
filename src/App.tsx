import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
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
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [showChat, setShowChat] = useState(false);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>

      <hr style={{ margin: "2rem 0", width: "100%" }} />

      <button type="button" onClick={() => setShowChat(!showChat)}>
        {showChat ? "Hide ACP Chat" : "Show ACP Chat"}
      </button>

      {showChat && (
        <div style={{ marginTop: "1rem", width: "100%", maxWidth: "600px" }}>
          <AcpChat agentSpec={agentSpec} />
        </div>
      )}
    </main>
  );
}

export default App;
