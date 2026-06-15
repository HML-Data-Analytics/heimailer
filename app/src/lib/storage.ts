import type { GraphConfig, Group, SendSession, Settings, Template } from "../types";

/**
 * Namespaced localStorage persistence (PRD §11 Phase 5: "better storage
 * structure for templates, groups, and logs"). All reads are defensive so a
 * corrupt entry never crashes the app.
 */
const NS = "hmm.v1";
const KEYS = {
  templates: `${NS}.templates`,
  groups: `${NS}.groups`,
  history: `${NS}.history`,
  settings: `${NS}.settings`,
  graph: `${NS}.graph`,
  mode: `${NS}.mode`,
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export const DEFAULT_SETTINGS: Settings = {
  // Microsoft 365 throttles /me/sendMail at ~30 messages/minute. A 2s gap
  // (~30/min) keeps the batch under that ceiling so messages aren't dropped.
  sendDelayMs: 2000,
  highVolumeThreshold: 50,
};

export const store = {
  // Templates -------------------------------------------------------------
  getTemplates: (): Template[] => read<Template[]>(KEYS.templates, []),
  saveTemplates: (t: Template[]) => write(KEYS.templates, t),

  // Groups ----------------------------------------------------------------
  getGroups: (): Group[] => read<Group[]>(KEYS.groups, []),
  saveGroups: (g: Group[]) => write(KEYS.groups, g),

  // History (most recent first, capped) -----------------------------------
  getHistory: (): SendSession[] => read<SendSession[]>(KEYS.history, []),
  saveHistory: (h: SendSession[]) => write(KEYS.history, h.slice(0, 50)),
  addSession: (s: SendSession): SendSession[] => {
    const next = [s, ...store.getHistory()].slice(0, 50);
    write(KEYS.history, next);
    return next;
  },

  // Settings --------------------------------------------------------------
  getSettings: (): Settings => ({
    ...DEFAULT_SETTINGS,
    ...read<Partial<Settings>>(KEYS.settings, {}),
  }),
  saveSettings: (s: Settings) => write(KEYS.settings, s),

  // Microsoft Graph connection -------------------------------------------
  getGraphConfig: (): GraphConfig =>
    read<GraphConfig>(KEYS.graph, { clientId: "", tenantId: "common" }),
  saveGraphConfig: (c: GraphConfig) => write(KEYS.graph, c),

  getMode: (): string | null => {
    try {
      return localStorage.getItem(KEYS.mode);
    } catch {
      return null;
    }
  },
  saveMode: (m: string | null) => {
    try {
      m ? localStorage.setItem(KEYS.mode, m) : localStorage.removeItem(KEYS.mode);
    } catch {
      /* ignore */
    }
  },
};
