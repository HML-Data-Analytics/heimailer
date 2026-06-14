import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
} from "@azure/msal-browser";
import type { Attachment, GraphConfig, User } from "../types";

/**
 * Microsoft Graph integration for real sending (delegated, as the signed-in
 * user). Uses MSAL.js in a browser SPA flow — there is no API key; the user
 * signs in and the app sends with their own Mail.Send permission.
 *
 * Azure app registration requirements:
 *  - Platform: Single-page application (SPA)
 *  - Redirect URI: this app's origin (e.g. http://localhost:5173)
 *  - Delegated Graph permissions: User.Read, Mail.Send
 */
const SCOPES = ["User.Read", "Mail.Send"];

let pca: PublicClientApplication | null = null;
let configKey = "";

async function ensureApp(config: GraphConfig): Promise<PublicClientApplication> {
  const key = `${config.clientId}|${config.tenantId}`;
  if (pca && key === configKey) return pca;
  // Use "common" so both personal and organisational Microsoft accounts can
  // sign in. The Synapse mini_mail.user allowlist is the real access gate.
  const authority = "https://login.microsoftonline.com/common";
  pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: "localStorage" },
  });
  await pca.initialize();
  configKey = key;
  return pca;
}

function accountToUser(account: AccountInfo): User {
  return {
    name: account.name || account.username,
    email: account.username,
  };
}

/** Interactive sign-in. Returns the connected user. */
export async function connect(config: GraphConfig): Promise<User> {
  if (!config.clientId) throw new Error("Missing Client ID.");
  // Force a fresh PCA so stale authority config from a prior attempt doesn't persist.
  pca = null;
  configKey = "";
  // Clear any MSAL interaction lock left behind by a previous failed popup.
  for (const key of Object.keys(sessionStorage)) {
    if (key.includes("interaction.status") || key.includes("interaction_in_progress")) {
      sessionStorage.removeItem(key);
    }
  }
  const app = await ensureApp(config);
  const result = await app.loginPopup({ scopes: SCOPES, prompt: "select_account" });
  app.setActiveAccount(result.account);
  return accountToUser(result.account);
}

/** Restore a previously connected account silently (no popup), if present. */
export async function restore(config: GraphConfig): Promise<User | null> {
  if (!config.clientId) return null;
  const app = await ensureApp(config);
  const active = app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
  if (!active) return null;
  app.setActiveAccount(active);
  return accountToUser(active);
}

/** Acquire an access token, falling back to an interactive popup if needed. */
export async function getToken(): Promise<string> {
  if (!pca) throw new Error("Microsoft connection not initialized.");
  const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
  if (!account) throw new Error("No signed-in Microsoft account.");
  try {
    const r = await pca.acquireTokenSilent({ scopes: SCOPES, account });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      const r = await pca.acquireTokenPopup({ scopes: SCOPES, account });
      return r.accessToken;
    }
    throw e;
  }
}

export async function disconnect(): Promise<void> {
  if (!pca) return;
  const account = pca.getActiveAccount() ?? undefined;
  try {
    await pca.clearCache({ account });
  } catch {
    /* ignore */
  }
  pca.setActiveAccount(null);
}

/** Send one personalised email via Graph. Subject/body are already rendered. */
export async function sendViaGraph(
  token: string,
  to: { name: string; email: string },
  subject: string,
  body: string,
  attachments: Attachment[] = [],
  cc: string[] = [],
  bcc: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  const isHtml = /<[a-z][\s\S]*>/i.test(body);

  // Inline images (pasted/dropped) arrive as data URLs in <img src="data:...">.
  // Convert each to a Graph inline fileAttachment referenced by Content-ID so
  // it renders in Outlook (data URIs are often blocked by mail clients).
  const inline: Array<Record<string, unknown>> = [];
  let content = body;
  if (isHtml) {
    let i = 0;
    content = body.replace(
      /src=["'](data:(image\/[a-zA-Z0-9.+-]+);base64,([^"']+))["']/g,
      (_m, _full, mime: string, b64: string) => {
        const cid = `inline${i++}@hmm`;
        const ext = mime.split("/")[1] || "png";
        inline.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: `image-${i}.${ext}`,
          contentType: mime,
          contentBytes: b64,
          contentId: cid,
          isInline: true,
        });
        return `src="cid:${cid}"`;
      },
    );
  }

  const message: Record<string, unknown> = {
    subject,
    body: { contentType: isHtml ? "HTML" : "Text", content },
    toRecipients: [{ emailAddress: { address: to.email, name: to.name || undefined } }],
  };
  if (cc.length > 0) message.ccRecipients = cc.map((a) => ({ emailAddress: { address: a } }));
  if (bcc.length > 0) message.bccRecipients = bcc.map((a) => ({ emailAddress: { address: a } }));

  const fileAttachments = attachments.map((a) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: a.name,
    contentType: a.type,
    contentBytes: a.dataUrl.includes(",") ? a.dataUrl.split(",")[1] : a.dataUrl,
  }));
  const allAttachments = [...fileAttachments, ...inline];
  if (allAttachments.length > 0) {
    message.attachments = allAttachments;
  }

  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (res.ok || res.status === 202) return { ok: true };

    let detail = `Graph error ${res.status}`;
    try {
      const data = await res.json();
      detail = data?.error?.message || detail;
    } catch {
      /* ignore parse */
    }
    return { ok: false, error: detail };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error." };
  }
}
