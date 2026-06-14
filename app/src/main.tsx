import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./auth/useAuth";
import { CampaignProvider } from "./state/campaign";

/**
 * When MSAL signs in via popup, Azure redirects the popup back to this app's
 * URL with the auth response in the hash (e.g. #code=...). If we boot the full
 * React app inside that popup, it consumes the hash before the parent window's
 * MSAL can read it — the popup then shows the app and never closes
 * (block_nested_popups). So if this window is the auth popup, render nothing
 * and let the opener's MSAL handler read the hash and close us.
 */
const hash = window.location.hash;
const isAuthPopup =
  !!window.opener &&
  window.opener !== window &&
  (hash.includes("code=") || hash.includes("error=") || hash.includes("id_token="));

if (!isAuthPopup) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <CampaignProvider>
          <App />
        </CampaignProvider>
      </AuthProvider>
    </StrictMode>,
  );
}
