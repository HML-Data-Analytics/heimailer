import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthMode, GraphConfig, User } from "../types";
import { store } from "../lib/storage";
import * as graph from "../lib/graph";

const DEMO_KEY = "hmm.demo.user";

/**
 * Azure connection details come from build-time environment variables
 * (set in Vercel → Settings → Environment Variables, or a local .env file):
 *   VITE_AZURE_CLIENT_ID, VITE_AZURE_TENANT_ID
 */
const ENV_CONFIG: GraphConfig = {
  clientId: (import.meta.env.VITE_AZURE_CLIENT_ID ?? "").trim(),
  tenantId: (import.meta.env.VITE_AZURE_TENANT_ID ?? "common").trim() || "common",
};

interface AuthValue {
  user: User | null;
  mode: AuthMode | null;
  isReal: boolean;
  configured: boolean;
  /** True while completing a redirect sign-in / restoring a session on load. */
  initializing: boolean;
  /** Set when a sign-in attempt failed (e.g. not on the allowlist). */
  authError: string | null;
  clearAuthError: () => void;

  signInDemo: () => Promise<void>;
  connectMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Verify a signed-in email against the Synapse allowlist (mini_mail.user) via
 * the serverless function. Only enforced in production; dev always passes.
 * Throws with a user-facing message if the account is not authorised.
 */
async function verifyAccess(email: string): Promise<void> {
  if (!import.meta.env.PROD) return;
  const res = await fetch("/api/check-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Couldn't verify your access. Please try again.");
  const { allowed } = (await res.json()) as { allowed: boolean };
  if (!allowed) {
    throw new Error(
      "Your account is not authorised to use this app. Contact your administrator.",
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const configured = ENV_CONFIG.clientId.length > 0;

  // On load: complete a redirect sign-in if we just came back from Microsoft,
  // otherwise restore an existing connected session. Demo mode is deliberately
  // NOT restored, so the sign-in page is always the landing screen unless a
  // real account is connected. (Any stale demo session is cleared here.)
  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem(DEMO_KEY);

    (async () => {
      if (!configured) {
        if (!cancelled) setInitializing(false);
        return;
      }

      // 1. Did we just return from a Microsoft redirect sign-in?
      try {
        const u = await graph.completeLogin(ENV_CONFIG);
        if (u) {
          try {
            await verifyAccess(u.email);
            if (!cancelled) {
              store.saveMode("graph");
              setUser(u);
              setMode("graph");
            }
          } catch (err) {
            await graph.disconnect().catch(() => {});
            store.saveMode(null);
            if (!cancelled) {
              setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
            }
          }
          if (!cancelled) setInitializing(false);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
        }
      }

      // 2. Otherwise, restore a previously connected account silently.
      if (store.getMode() === "graph") {
        try {
          const u = await graph.restore(ENV_CONFIG);
          if (u && !cancelled) {
            setUser(u);
            setMode("graph");
            setInitializing(false);
            return;
          }
        } catch {
          /* not connected — show sign-in */
        }
        if (!cancelled) store.saveMode(null);
      }

      if (!cancelled) setInitializing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [configured]);

  const signInDemo = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 400));
    const demoUser: User = { name: "Su Su Aung", email: "su.aung@heineken.com.mm" };
    localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser));
    store.saveMode("demo");
    setUser(demoUser);
    setMode("demo");
  }, []);

  // Starts a full-page redirect to Microsoft. Does not return — the result is
  // handled by the load effect above when the browser comes back.
  const connectMicrosoft = useCallback(async () => {
    if (!configured) throw new Error("Microsoft sign-in is not configured for this deployment.");
    setAuthError(null);
    await graph.beginLogin(ENV_CONFIG);
  }, [configured]);

  const signOut = useCallback(async () => {
    if (mode === "graph") {
      await graph.disconnect().catch(() => {});
    }
    localStorage.removeItem(DEMO_KEY);
    store.saveMode(null);
    setUser(null);
    setMode(null);
  }, [mode]);

  const getAccessToken = useCallback(async () => {
    if (mode !== "graph") return null;
    return graph.getToken();
  }, [mode]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      mode,
      isReal: mode === "graph",
      configured,
      initializing,
      authError,
      clearAuthError,
      signInDemo,
      connectMicrosoft,
      signOut,
      getAccessToken,
    }),
    [
      user, mode, configured, initializing, authError, clearAuthError,
      signInDemo, connectMicrosoft, signOut, getAccessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
