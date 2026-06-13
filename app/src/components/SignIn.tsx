import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { StarIcon } from "./icons";

function MsLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function SignIn() {
  const { signInDemo, connectMicrosoft, configured } = useAuth();
  const [busy, setBusy] = useState<"ms" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function microsoft() {
    setError(null);
    setBusy("ms");
    try {
      await connectMicrosoft();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in was cancelled.");
    } finally {
      setBusy(null);
    }
  }

  async function demo() {
    setBusy("demo");
    try {
      await signInDemo();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="signin">
      <div className="signin__card">
        <div className="signin__mark">
          <StarIcon size={28} />
        </div>
        <h1>Invitation Sender</h1>
        <p>
          Send personalized invitations from your own HEINEKEN Myanmar mailbox —
          prepared, previewed, and tested with care.
        </p>

        {configured ? (
          <>
            <button className="ms-btn" onClick={microsoft} disabled={busy !== null}>
              {busy === "ms" ? (
                <>
                  <span className="spinner" style={{ borderTopColor: "#00843d", borderColor: "rgba(0,132,61,.25)" }} />
                  Connecting…
                </>
              ) : (
                <>
                  <MsLogo />
                  Sign in with Microsoft
                </>
              )}
            </button>
            {error && <div className="signin__error">{error}</div>}
            <button className="signin__demolink" onClick={demo} disabled={busy !== null}>
              {busy === "demo" ? "Loading…" : "Or explore in demo mode →"}
            </button>
          </>
        ) : (
          <>
            <button className="ms-btn" onClick={demo} disabled={busy !== null}>
              {busy === "demo" ? "Loading…" : "Enter demo mode"}
            </button>
            <p className="signin__note">
              Microsoft sign-in isn’t configured for this deployment. Set
              <code> VITE_AZURE_CLIENT_ID </code> and <code> VITE_AZURE_TENANT_ID </code>
              in your environment to enable real sending.
            </p>
          </>
        )}

        <p className="signin__note">
          You send from your own signed-in mailbox. Emails go out one by one — never as a CC/BCC blast.
        </p>
      </div>
    </div>
  );
}
