import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { HeiMailerLogo, HeinekenMyanmarLogo } from "./Brand";

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
  const { signInDemo, connectMicrosoft, configured, authError } = useAuth();
  const [busy, setBusy] = useState<"ms" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // authError comes from a failed redirect sign-in completed on page load
  // (e.g. account not on the allowlist); local error from a failed click.
  const shownError = error ?? authError;

  async function microsoft() {
    setError(null);
    setBusy("ms");
    try {
      // Navigates the whole page to Microsoft; on success it won't return here.
      await connectMicrosoft();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in was cancelled.");
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
        <div className="signin__logo">
          <HeiMailerLogo size={68} />
        </div>

        <span className="signin__kicker">HEINEKEN MYANMAR</span>
        <h1 className="signin__title">HeiMailer</h1>
        <p className="signin__tagline">Send personalized invitations from your own mailbox.</p>
        <p className="signin__summary">
          Import your guest list, personalize every message, and send individually - each email
          arrives as a genuine one-to-one note, never a mass blast.
        </p>

        {configured ? (
          <>
            <button className="ms-btn" onClick={microsoft} disabled={busy !== null}>
              {busy === "ms" ? (
                <>
                  <span
                    className="spinner"
                    style={{ borderTopColor: "#00843d", borderColor: "rgba(0,132,61,.25)" }}
                  />
                  Connecting…
                </>
              ) : (
                <>
                  <MsLogo />
                  Sign in with Microsoft
                </>
              )}
            </button>
            {shownError && <div className="signin__error">{shownError}</div>}
            {/* <button className="signin__demolink" onClick={demo} disabled={busy !== null}>
              {busy === "demo" ? "Loading…" : "Explore in demo mode"}
            </button> */}
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

        <div className="signin__trust">
          <LockIcon /> Access is restricted to authorized HEINEKEN accounts.
        </div>

        <div className="signin__endorse">
          <HeinekenMyanmarLogo height={22} />
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
