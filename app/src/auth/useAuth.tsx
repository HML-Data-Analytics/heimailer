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
 * They are never entered or stored in the app UI.
 */
const ENV_CONFIG: GraphConfig = {
  clientId: (import.meta.env.VITE_AZURE_CLIENT_ID ?? "").trim(),
  tenantId: (import.meta.env.VITE_AZURE_TENANT_ID ?? "common").trim() || "common",
};

interface AuthValue {
  user: User | null;
  mode: AuthMode | null;
  /** True when sending will go through real Microsoft Graph. */
  isReal: boolean;
  /** Microsoft sign-in is configured via environment variables. */
  configured: boolean;

  signInDemo: () => Promise<void>;
  connectMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;

  /** Access token for Graph when connected; null in demo mode. */
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AuthMode | null>(null);

  const configured = ENV_CONFIG.clientId.length > 0;

  // Restore a previous session on load.
  useEffect(() => {
    let cancelled = false;
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
          /* fall through to demo */
        }
      }
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw && !cancelled) {
        try {
          setUser(JSON.parse(raw) as User);
          setMode("demo");
        } catch {
          localStorage.removeItem(DEMO_KEY);
        }
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
