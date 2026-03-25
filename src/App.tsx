import { useState } from "react";
import "./App.css";
import { AcpChat } from "./features/acp-chat";
import { PROVIDERS } from "./features/acp-chat/providers";
import { safeGetItem, safeSetItem } from "./features/acp-chat/utils/storage";

function App() {
  const [providerId, setProviderId] = useState(() => {
    return safeGetItem("acp-provider") || PROVIDERS[0].id;
  });
  const provider = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];

  const handleProviderChange = (id: string) => {
    setProviderId(id);
    safeSetItem("acp-provider", id);
  };

  return (
    <main className="app-container">
      <AcpChat
        agentSpec={provider.agentSpec}
        providers={PROVIDERS}
        selectedProviderId={providerId}
        onProviderChange={handleProviderChange}
      />
    </main>
  );
}

export default App;
