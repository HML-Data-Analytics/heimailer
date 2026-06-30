import { useState } from "react";
import { useCampaign } from "../state/campaign";
import { useAuth } from "../auth/useAuth";
import { isValidEmail } from "../lib/validation";
import { CheckIcon, GearIcon, XIcon } from "./icons";

function MsLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, notify } = useCampaign();
  const { user, isReal, configured, connectMicrosoft, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      await connectMicrosoft();
      notify("success", "Microsoft connected", "Real sending is now enabled for your mailbox.");
    } catch (e) {
      notify("error", "Couldn't connect", e instanceof Error ? e.message : "Sign-in was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label="Settings">
        <div className="drawer__head">
          <span className="card__icon">
            <GearIcon />
          </span>
          <h2>Settings</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </div>
        <div className="drawer__body">

          {/* Microsoft connection */}
          <div className="setrow">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MsLogo /> Microsoft connection
            </h3>

            {isReal ? (
              <>
                <div className="conn-status">
                  <span className="pill pill--ok">
                    <CheckIcon size={12} /> Connected
                  </span>
                  <span className="muted">Sending as {user?.email}</span>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  Emails are sent for real from your mailbox via Microsoft Graph.
                </p>
                <button
                  className="btn btn--danger btn--sm"
                  style={{ marginTop: 6 }}
                  onClick={() => signOut()}
                >
                  Disconnect &amp; sign out
                </button>
              </>
            ) : configured ? (
              <>
                <p>Connect your Microsoft account to send real emails from your own mailbox.</p>
                <button className="btn btn--primary btn--sm" onClick={connect} disabled={busy}>
                  {busy ? <span className="spinner" /> : <MsLogo />} Connect Microsoft account
                </button>
              </>
            ) : (
              <>
                <p>Microsoft sending isn't configured for this deployment.</p>
                <p className="muted">
                  Set <code>VITE_AZURE_CLIENT_ID</code> and <code>VITE_AZURE_TENANT_ID</code> in
                  your hosting environment (e.g. Vercel → Settings → Environment Variables) and
                  redeploy. The Azure app must be a Single-page application (SPA) with redirect
                  URI <code>{window.location.origin}</code> and delegated permissions Mail.Send +
                  User.Read. No client secret is required.
                </p>
              </>
            )}
          </div>

          {/* Send-from (shared mailbox) */}
          {configured && (
            <div className="setrow">
              <h3>Send from (shared mailbox)</h3>
              <p>
                Leave blank to send from your own mailbox. To send from a shared mailbox, enter its
                address - you must have <b>Send As</b> rights on it.
              </p>
              <input
                className="input"
                type="email"
                placeholder="events@yourcompany.com"
                value={settings.sendFromMailbox ?? ""}
                onChange={(e) => updateSettings({ sendFromMailbox: e.target.value })}
                spellCheck={false}
                autoComplete="off"
              />
              {settings.sendFromMailbox?.trim() && !isValidEmail(settings.sendFromMailbox.trim()) && (
                <p className="muted" style={{ color: "var(--danger, #dc2626)", marginTop: 6 }}>
                  That doesn't look like a valid email address.
                </p>
              )}
              {settings.sendFromMailbox?.trim() && isValidEmail(settings.sendFromMailbox.trim()) && (
                <p className="muted" style={{ marginTop: 6 }}>
                  Emails will be sent as <b>{settings.sendFromMailbox.trim()}</b>.
                </p>
              )}
            </div>
          )}

          {/* Sending behaviour */}
          <div className="setrow">
            <h3>Delay between sends</h3>
            <p>A small pause between each email keeps sending gentle and reliable.</p>
            <div className="range-row">
              <input
                type="range"
                min={0}
                max={2000}
                step={100}
                value={settings.sendDelayMs}
                onChange={(e) => updateSettings({ sendDelayMs: Number(e.target.value) })}
              />
              <span className="range-val">{settings.sendDelayMs} ms</span>
            </div>
          </div>

          <div className="setrow">
            <h3>High-volume warning</h3>
            <p>Show an extra confirmation when sending to more than this many recipients.</p>
            <div className="range-row">
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={settings.highVolumeThreshold}
                onChange={(e) => updateSettings({ highVolumeThreshold: Number(e.target.value) })}
              />
              <span className="range-val">{settings.highVolumeThreshold}</span>
            </div>
          </div>

          <p className="muted" style={{ marginTop: 18 }}>
            Settings, templates, groups, and send history are stored locally on this device.
          </p>
        </div>
      </aside>
    </div>
  );
}
