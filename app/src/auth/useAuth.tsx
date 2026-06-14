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

  signInDemo: () => Promise<void>;
  connectMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AuthMode | null>(null);

  const configured = ENV_CONFIG.clientId.length > 0;

  // Restore a previous session on load.
  // Only a real (Microsoft Graph) connection persists across visits — that's
  // good UX for authorised users. Demo mode is deliberately NOT restored, so
  // the sign-in page is always the landing screen unless a real account is
  // connected. (Any stale demo session from earlier is cleared here.)
  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem(DEMO_KEY);
    (async () => {
      if (configured && store.getMode() === "graph") {
        try {
          const u = await graph.restore(ENV_CONFIG);
          if (!cancelled && u) {
            setUser(u);
            setMode("graph");
            return;
          }
        } catch {
          /* not connected — show sign-in */
        }
        // mode was "graph" but no live account: reset so we land on sign-in.
        if (!cancelled) store.saveMode(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const signInDemo = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 500));
    const demoUser: User = { name: "Su Su Aung", email: "su.aung@heineken.com.mm" };
    localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser));
    store.saveMode("demo");
    setUser(demoUser);
    setMode("demo");
  }, []);

  const connectMicrosoft = useCallback(async () => {
    if (!configured) throw new Error("Microsoft sign-in is not configured for this deployment.");
    const u = await graph.connect(ENV_CONFIG);

    // In production, verify the signed-in email against the Synapse allowlist.
    if (import.meta.env.PROD) {
      try {
        const res = await fetch("/api/check-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: u.email }),
        });
        if (!res.ok) throw new Error("Access check request failed.");
        const { allowed } = (await res.json()) as { allowed: boolean };
        if (!allowed) {
          await graph.disconnect().catch(() => {});
          throw new Error(
            "Your account is not authorised to use this app. Contact your administrator.",
          );
        }
      } catch (err) {
        await graph.disconnect().catch(() => {});
        throw err;
      }
    }

    store.saveMode("graph");
    setUser(u);
    setMode("graph");
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

  const value = useMemo<AuthValue>(
    () => ({
      user,
      mode,
      isReal: mode === "graph",
      configured,
      signInDemo,
      connectMicrosoft,
      signOut,
      getAccessToken,
    }),
    [user, mode, configured, signInDemo, connectMicrosoft, signOut, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
