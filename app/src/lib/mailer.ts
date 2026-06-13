import type { Attachment, Recipient, User } from "../types";
import { parseEmails, renderTemplate } from "./validation";
import { sendViaGraph } from "./graph";

export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface SendPayload {
  from: User;
  to: Pick<Recipient, "name" | "email" | "company">;
  subject: string;
  body: string;
  attachments?: Attachment[];
  cc?: string;
  bcc?: string;
}

/**
 * Sends a single personalised email.
 *
 * - With a `token`, sends for real via Microsoft Graph (`POST /me/sendMail`)
 *   as the signed-in user. Cc/Bcc are added to every message (To = recipient).
 * - Without a token (demo mode), simulates a realistic round-trip. Demo
 *   addresses containing "fail"/"bounce" simulate a delivery failure.
 *
 * Placeholders ({{Name}}, {{Company}}) are rendered per recipient here so all
 * transports send identical content. The body may be HTML (with inline images).
 */
export async function sendMail(
  payload: SendPayload,
  token?: string | null,
): Promise<SendResult> {
  const subject = renderTemplate(payload.subject, payload.to);
  const body = renderTemplate(payload.body, payload.to);
  const cc = parseEmails(payload.cc ?? "");
  const bcc = parseEmails(payload.bcc ?? "");

  if (token) {
    return sendViaGraph(
      token,
      { name: payload.to.name, email: payload.to.email },
      subject,
      body,
      payload.attachments ?? [],
      cc,
      bcc,
    );
  }

  // --- DEMO simulation -----------------------------------------------------
  await delay(450 + Math.random() * 500);
  if (/fail|bounce/i.test(payload.to.email)) {
    return { ok: false, error: "Recipient mailbox rejected the message (simulated)." };
  }
  // eslint-disable-next-line no-console
  console.info("[demo sendMail]", {
    from: payload.from.email,
    to: payload.to.email,
    cc,
    bcc,
    subject,
    bodyChars: body.length,
    attachments: payload.attachments?.map((a) => a.name) ?? [],
  });
  return { ok: true };
}

export function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
