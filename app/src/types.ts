export interface User {
  name: string;
  email: string;
}

/** Azure AD app-registration details for real Microsoft Graph sending. */
export interface GraphConfig {
  clientId: string;
  /** Tenant id, or "common" / "organizations". */
  tenantId: string;
}

export type AuthMode = "demo" | "graph";

export interface Draft {
  subject: string;
  body: string;
  /** Optional Cc / Bcc addresses (comma or semicolon separated) added to every send. */
  cc: string;
  bcc: string;
}

/** A row in the recipient list (manual or imported). */
export interface Recipient {
  id: string;
  name: string;
  email: string;
  company?: string;
  /** "manual" | "import" — where the row came from. */
  source: "manual" | "import";
  sendStatus: SendStatus;
  /** Error detail when sendStatus === "failed". */
  error?: string;
}

export type SendStatus = "idle" | "queued" | "sending" | "sent" | "failed";

/** Validation problems for a single recipient row. */
export interface RowValidation {
  validEmail: boolean;
  missingName: boolean;
  duplicate: boolean;
  /** True when the row can be sent (valid email + has name). */
  sendable: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  /** base64 data URL, kept in-memory for preview/send. */
  dataUrl: string;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: number;
}

export interface Group {
  id: string;
  name: string;
  recipients: Array<Pick<Recipient, "name" | "email" | "company">>;
  updatedAt: number;
}

export interface Settings {
  /** Delay between individual sends, ms (PRD §12.8 configurable delay). */
  sendDelayMs: number;
  /** Warn before sending to more than this many recipients. */
  highVolumeThreshold: number;
}

/** Live progress while a Send All / retry run is in flight. */
export interface SendProgress {
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  currentName: string | null;
  status: "running" | "paused" | "done" | "cancelled";
}

/** A completed send session, stored in history (Phase 5). */
export interface SendSession {
  id: string;
  startedAt: number;
  finishedAt: number;
  subject: string;
  from: string;
  total: number;
  sent: number;
  failed: number;
  cancelled: boolean;
  rows: Array<{
    name: string;
    email: string;
    company?: string;
    status: "sent" | "failed";
    error?: string;
  }>;
}

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}
