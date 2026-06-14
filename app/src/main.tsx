import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./auth/useAuth";
import { CampaignProvider } from "./state/campaign";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CampaignProvider>
        <App />
      </CampaignProvider>
    </AuthProvider>
  </StrictMode>,
);
