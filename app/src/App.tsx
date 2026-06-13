import { useState } from "react";
import Header from "./components/Header";
import SignIn from "./components/SignIn";
import ComposeCard from "./components/ComposeCard";
import AttachmentsCard from "./components/AttachmentsCard";
import RecipientsPanel from "./components/RecipientsPanel";
import ActionBar from "./components/ActionBar";
import PreviewModal from "./components/PreviewModal";
import ConfirmSendModal from "./components/ConfirmSendModal";
import SendConsole from "./components/SendConsole";
import HistoryDrawer from "./components/HistoryDrawer";
import SettingsDrawer from "./components/SettingsDrawer";
import Toasts from "./components/Toasts";
import { AlertIcon } from "./components/icons";
import { useAuth } from "./auth/useAuth";
import { useCampaign } from "./state/campaign";

export default function App() {
  const { user } = useAuth();
  if (!user) return <SignIn />;
  return <Workspace />;
}

function Workspace() {
  const { isReal } = useAuth();
  const { toasts, recipients, sendIds, startSend, progress, notify } = useCampaign();

  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [history, setHistory] = useState(false);
  const [settings, setSettings] = useState(false);

  function openPreview() {
    if (recipients.length === 0) {
      notify("info", "Add a recipient first", "Add or import someone to preview.");
      return;
    }
    setPreview(true);
  }

  function doSendAll() {
    setConfirm(false);
    startSend(sendIds);
  }

  return (
    <div className="app">
      <Header onOpenHistory={() => setHistory(true)} onOpenSettings={() => setSettings(true)} />

      <main className="shell">
        <div className="intro">
          <h1>Prepare your invitation campaign</h1>
          <p>Compose once, add or import recipients, preview, test, then send personalized emails one by one.</p>
        </div>

        {!isReal && (
          <div className="demo-banner">
            <AlertIcon size={16} />
            Demo mode — sends are simulated. Connect your Microsoft account in Settings to send for real. Tip:
            include “fail” in an email to preview the failure &amp; retry flow.
          </div>
        )}

        <div className="grid">
          <div style={{ display: "grid", gap: 24 }}>
            <ComposeCard />
            <AttachmentsCard />
          </div>
          <RecipientsPanel />
        </div>

        <ActionBar onPreview={openPreview} onSendAll={() => setConfirm(true)} />
      </main>

      {preview && <PreviewModal onClose={() => setPreview(false)} />}
      {confirm && <ConfirmSendModal onClose={() => setConfirm(false)} onConfirm={doSendAll} />}
      {progress && <SendConsole />}
      {history && <HistoryDrawer onClose={() => setHistory(false)} />}
      {settings && <SettingsDrawer onClose={() => setSettings(false)} />}

      <Toasts toasts={toasts} />
    </div>
  );
}
