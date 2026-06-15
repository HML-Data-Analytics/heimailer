import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Attachment,
  Draft,
  Group,
  Recipient,
  RowValidation,
  SendProgress,
  SendSession,
  Settings,
  Template,
  Toast,
  ToastKind,
} from "../types";
import { useAuth } from "../auth/useAuth";
import { validateList } from "../lib/validation";
import { toRecipients } from "../lib/importer";
import { sendMail, delay } from "../lib/mailer";
import { store } from "../lib/storage";
import { uid } from "../lib/id";

interface Counts {
  total: number;
  valid: number;
  invalidEmail: number;
  missingName: number;
  duplicate: number;
  sendable: number;
}

interface CampaignValue {
  // compose
  draft: Draft;
  setDraft: (d: Draft) => void;

  // recipients
  recipients: Recipient[];
  validation: Map<string, RowValidation>;
  counts: Counts;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selected: Recipient | null;
  // send-selection (which sendable rows are included in Send All)
  excludedIds: Set<string>;
  toggleExclude: (id: string) => void;
  includeAllValid: () => void;
  sendIds: string[];
  failedIds: string[];
  addManual: (r: Pick<Recipient, "name" | "email" | "company">) => string;
  addBlankRow: () => string;
  addManyManual: (rows: Array<Pick<Recipient, "name" | "email" | "company">>) => number;
  addImported: (rows: Array<Pick<Recipient, "name" | "email" | "company">>) => number;
  updateRecipient: (id: string, patch: Partial<Recipient>) => void;
  removeRecipient: (id: string) => void;
  removeInvalid: () => number;
  removeDuplicates: () => number;
  clearRecipients: () => void;

  // attachments
  attachments: Attachment[];
  addAttachments: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: string) => void;

  // settings
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  // send engine
  progress: SendProgress | null;
  sending: boolean;
  startSend: (ids: string[]) => Promise<void>;
  pauseSend: () => void;
  resumeSend: () => void;
  cancelSend: () => void;
  dismissProgress: () => void;

  // templates
  templates: Template[];
  saveTemplate: (name: string) => void;
  deleteTemplate: (id: string) => void;
  applyTemplate: (t: Template) => void;

  // groups
  groups: Group[];
  saveGroup: (name: string) => void;
  deleteGroup: (id: string) => void;
  loadGroup: (g: Group) => number;

  // history
  history: SendSession[];
  clearHistory: () => void;

  // toasts
  toasts: Toast[];
  notify: (kind: ToastKind, title: string, message?: string) => void;
}

const Ctx = createContext<CampaignValue | null>(null);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken } = useAuth();

  const [draft, setDraft] = useState<Draft>({ subject: "", body: "", cc: "", bcc: "" });
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [settings, setSettings] = useState<Settings>(() => store.getSettings());
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [templates, setTemplates] = useState<Template[]>(() => store.getTemplates());
  const [groups, setGroups] = useState<Group[]>(() => store.getGroups());
  const [history, setHistory] = useState<SendSession[]>(() => store.getHistory());

  // toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const notify = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = ++toastId.current;
    setToasts((p) => [...p, { id, kind, title, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4200);
  }, []);

  // engine control flags
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const validation = useMemo(() => validateList(recipients), [recipients]);

  const counts = useMemo<Counts>(() => {
    let valid = 0,
      invalidEmail = 0,
      missingName = 0,
      duplicate = 0,
      sendable = 0;
    for (const r of recipients) {
      const v = validation.get(r.id);
      if (!v) continue;
      if (!v.validEmail) invalidEmail++;
      if (v.missingName) missingName++;
      if (v.duplicate) duplicate++;
      if (v.sendable) {
        sendable++;
        valid++;
      }
    }
    return { total: recipients.length, valid, invalidEmail, missingName, duplicate, sendable };
  }, [recipients, validation]);

  const selected = useMemo(
    () => recipients.find((r) => r.id === selectedId) ?? null,
    [recipients, selectedId],
  );

  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const includeAllValid = useCallback(() => setExcludedIds(new Set()), []);

  const sendIds = useMemo(
    () =>
      recipients
        .filter((r) => validation.get(r.id)?.sendable && !excludedIds.has(r.id))
        .map((r) => r.id),
    [recipients, validation, excludedIds],
  );

  const failedIds = useMemo(
    () => recipients.filter((r) => r.sendStatus === "failed").map((r) => r.id),
    [recipients],
  );

  // ---- recipient ops ----
  const addManual = useCallback((r: Pick<Recipient, "name" | "email" | "company">) => {
    const [rec] = toRecipients([r], "manual");
    setRecipients((prev) => [...prev, rec]);
    return rec.id;
  }, []);

  const addBlankRow = useCallback(() => {
    const [rec] = toRecipients([{ name: "", email: "", company: "" }], "manual");
    setRecipients((prev) => [...prev, rec]);
    setSelectedId(rec.id);
    return rec.id;
  }, []);

  const addManyManual = useCallback(
    (rows: Array<Pick<Recipient, "name" | "email" | "company">>) => {
      const recs = toRecipients(rows, "manual");
      setRecipients((prev) => [...prev, ...recs]);
      return recs.length;
    },
    [],
  );

  const addImported = useCallback(
    (rows: Array<Pick<Recipient, "name" | "email" | "company">>) => {
      const recs = toRecipients(rows, "import");
      setRecipients((prev) => [...prev, ...recs]);
      return recs.length;
    },
    [],
  );

  const updateRecipient = useCallback((id: string, patch: Partial<Recipient>) => {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const removeRecipient = useCallback(
    (id: string) => {
      setRecipients((prev) => prev.filter((r) => r.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  const removeInvalid = useCallback(() => {
    let removed = 0;
    setRecipients((prev) => {
      const v = validateList(prev);
      const next = prev.filter((r) => {
        const ok = v.get(r.id)?.validEmail && !v.get(r.id)?.missingName;
        if (!ok) removed++;
        return ok;
      });
      return next;
    });
    return removed;
  }, []);

  const removeDuplicates = useCallback(() => {
    let removed = 0;
    setRecipients((prev) => {
      const v = validateList(prev);
      const next = prev.filter((r) => {
        const dup = v.get(r.id)?.duplicate;
        if (dup) removed++;
        return !dup;
      });
      return next;
    });
    return removed;
  }, []);

  const clearRecipients = useCallback(() => {
    setRecipients([]);
    setSelectedId(null);
  }, []);

  // ---- attachments ----
  const addAttachments = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const read = await Promise.all(
      list.map(
        (f) =>
          new Promise<Attachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: uid("a_"),
                name: f.name,
                size: f.size,
                type: f.type || "application/octet-stream",
                dataUrl: String(reader.result),
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(f);
          }),
      ),
    );
    setAttachments((prev) => [...prev, ...read]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ---- settings ----
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      store.saveSettings(next);
      return next;
    });
  }, []);

  // ---- send engine ----
  const startSend = useCallback(
    async (ids: string[]) => {
      if (runningRef.current || !user) return;
      const targets = recipients.filter((r) => ids.includes(r.id));
      if (targets.length === 0) return;

      runningRef.current = true;
      cancelRef.current = false;
      pausedRef.current = false;
      const startedAt = Date.now();

      // Acquire a Graph token once for the whole run (null in demo mode).
      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch {
        notify(
          "error",
          "Microsoft sign-in needed",
          "Couldn't get permission to send. Reconnect your Microsoft account in Settings.",
        );
        runningRef.current = false;
        return;
      }

      // mark queued + reset prior status/error
      setRecipients((prev) =>
        prev.map((r) =>
          ids.includes(r.id) ? { ...r, sendStatus: "queued", error: undefined } : r,
        ),
      );

      let sent = 0;
      let failed = 0;
      const total = targets.length;
      const results: SendSession["rows"] = [];

      setProgress({
        total,
        sent: 0,
        failed: 0,
        remaining: total,
        currentName: null,
        status: "running",
      });

      for (let i = 0; i < targets.length; i++) {
        // honour pause
        while (pausedRef.current && !cancelRef.current) {
          setProgress((p) => (p ? { ...p, status: "paused" } : p));
          await delay(150);
        }
        if (cancelRef.current) break;
        setProgress((p) => (p ? { ...p, status: "running" } : p));

        const r = targets[i];
        setProgress((p) => (p ? { ...p, currentName: r.name || r.email } : p));
        updateRecipient(r.id, { sendStatus: "sending" });

        // Refresh the access token before each send. MSAL returns the cached
        // token instantly and only hits the network when it is near expiry, so
        // a long batch can't fail midway because the initial token aged out.
        if (token) {
          try {
            const fresh = await getAccessToken();
            if (fresh) token = fresh;
          } catch {
            /* keep the last good token; the send will surface any real error */
          }
        }

        const res = await sendMail(
          {
            from: user,
            to: r,
            subject: draft.subject,
            body: draft.body,
            attachments,
            cc: draft.cc,
            bcc: draft.bcc,
          },
          token,
        );

        if (res.ok) {
          sent++;
          updateRecipient(r.id, { sendStatus: "sent", error: undefined });
          results.push({ name: r.name, email: r.email, company: r.company, status: "sent" });
        } else {
          failed++;
          updateRecipient(r.id, { sendStatus: "failed", error: res.error });
          results.push({
            name: r.name,
            email: r.email,
            company: r.company,
            status: "failed",
            error: res.error,
          });
        }

        setProgress((p) =>
          p ? { ...p, sent, failed, remaining: total - sent - failed } : p,
        );

        if (i < targets.length - 1 && !cancelRef.current && settings.sendDelayMs > 0) {
          await delay(settings.sendDelayMs);
        }
      }

      const cancelled = cancelRef.current;
      setProgress((p) =>
        p ? { ...p, status: cancelled ? "cancelled" : "done", currentName: null } : p,
      );

      // record history session
      const session: SendSession = {
        id: uid("s_"),
        startedAt,
        finishedAt: Date.now(),
        subject: draft.subject,
        from: user.email,
        total,
        sent,
        failed,
        cancelled,
        rows: results,
      };
      setHistory(store.addSession(session));

      runningRef.current = false;
    },
    [user, recipients, draft, attachments, settings.sendDelayMs, updateRecipient, getAccessToken, notify],
  );

  const pauseSend = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const resumeSend = useCallback(() => {
    pausedRef.current = false;
  }, []);
  const cancelSend = useCallback(() => {
    cancelRef.current = true;
    pausedRef.current = false;
  }, []);
  const dismissProgress = useCallback(() => {
    if (runningRef.current) return;
    setProgress(null);
  }, []);

  // ---- templates ----
  const persistTemplates = (next: Template[]) => {
    setTemplates(next);
    store.saveTemplates(next);
  };
  const saveTemplate = useCallback(
    (name: string) => {
      const existing = templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
      const tpl: Template = {
        id: existing?.id ?? uid("t_"),
        name: name.trim(),
        subject: draft.subject,
        body: draft.body,
        updatedAt: Date.now(),
      };
      const next = existing
        ? templates.map((t) => (t.id === existing.id ? tpl : t))
        : [tpl, ...templates];
      persistTemplates(next);
      notify("success", existing ? "Template updated" : "Template saved", `“${tpl.name}”`);
    },
    [draft, templates, notify],
  );
  const deleteTemplate = useCallback(
    (id: string) => persistTemplates(templates.filter((t) => t.id !== id)),
    [templates],
  );
  const applyTemplate = useCallback(
    (t: Template) => {
      setDraft((prev) => ({ ...prev, subject: t.subject, body: t.body }));
      notify("info", "Template loaded", `“${t.name}” is now in your compose area.`);
    },
    [notify],
  );

  // ---- groups ----
  const persistGroups = (next: Group[]) => {
    setGroups(next);
    store.saveGroups(next);
  };
  const saveGroup = useCallback(
    (name: string) => {
      const existing = groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
      const grp: Group = {
        id: existing?.id ?? uid("g_"),
        name: name.trim(),
        recipients: recipients.map((r) => ({
          name: r.name,
          email: r.email,
          company: r.company,
        })),
        updatedAt: Date.now(),
      };
      const next = existing
        ? groups.map((g) => (g.id === existing.id ? grp : g))
        : [grp, ...groups];
      persistGroups(next);
      notify(
        "success",
        existing ? "Group updated" : "Group saved",
        `“${grp.name}” · ${grp.recipients.length} recipients`,
      );
    },
    [groups, recipients, notify],
  );
  const deleteGroup = useCallback(
    (id: string) => persistGroups(groups.filter((g) => g.id !== id)),
    [groups],
  );
  const loadGroup = useCallback(
    (g: Group) => {
      const recs = toRecipients(g.recipients, "import");
      setRecipients((prev) => [...prev, ...recs]);
      notify("success", "Group loaded", `Added ${recs.length} recipients from “${g.name}”.`);
      return recs.length;
    },
    [notify],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    store.saveHistory([]);
  }, []);

  const value: CampaignValue = {
    draft,
    setDraft,
    recipients,
    validation,
    counts,
    selectedId,
    setSelectedId,
    selected,
    excludedIds,
    toggleExclude,
    includeAllValid,
    sendIds,
    failedIds,
    addManual,
    addBlankRow,
    addManyManual,
    addImported,
    updateRecipient,
    removeRecipient,
    removeInvalid,
    removeDuplicates,
    clearRecipients,
    attachments,
    addAttachments,
    removeAttachment,
    settings,
    updateSettings,
    progress,
    sending: progress?.status === "running" || progress?.status === "paused",
    startSend,
    pauseSend,
    resumeSend,
    cancelSend,
    dismissProgress,
    templates,
    saveTemplate,
    deleteTemplate,
    applyTemplate,
    groups,
    saveGroup,
    deleteGroup,
    loadGroup,
    history,
    clearHistory,
    toasts,
    notify,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCampaign(): CampaignValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
}
