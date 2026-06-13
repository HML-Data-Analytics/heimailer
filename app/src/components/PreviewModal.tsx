import { useEffect, useState } from "react";
import { useCampaign } from "../state/campaign";
import { useAuth } from "../auth/useAuth";
import { hasBodyContent, parseEmails, renderTemplate } from "../lib/validation";
import { sendMail } from "../lib/mailer";
import { ChevronIcon, PaperclipIcon, SendIcon, XIcon } from "./icons";

export default function PreviewModal({ onClose }: { onClose: () => void }) {
  const { draft, recipients, selectedId, setSelectedId, attachments, updateRecipient, notify } =
    useCampaign();
  const { user, getAccessToken } = useAuth();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const index = Math.max(
    0,
    recipients.findIndex((r) => r.id === selectedId),
  );
  const recipient = recipients[index];
  if (!recipient || !user) return null;

  const subject = renderTemplate(draft.subject, recipient);
  const body = renderTemplate(draft.body, recipient);
  const hasBody = hasBodyContent(body);
  const ccList = parseEmails(draft.cc);
  const bccList = parseEmails(draft.bcc);
  const canSend = draft.subject.trim().length > 0 && hasBody;
  const firstName = recipient.name.trim().split(/\s+/)[0] || "them";

  function go(delta: number) {
    const next = index + delta;
    if (next >= 0 && next < recipients.length) setSelectedId(recipients[next].id);
  }

  async function testSend() {
    if (!user) return;
    setSending(true);
    updateRecipient(recipient.id, { sendStatus: "sending" });
    try {
      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch {
        updateRecipient(recipient.id, { sendStatus: "failed", error: "Microsoft sign-in needed." });
        notify("error", "Test send failed", "Reconnect your Microsoft account in Settings.");
        return;
      }
      const res = await sendMail({ from: user, to: recipient, subject, body, attachments }, token);
      if (res.ok) {
        updateRecipient(recipient.id, { sendStatus: "sent", error: undefined });
        notify("success", "Test sent successfully", `Delivered to ${recipient.email}.`);
      } else {
        updateRecipient(recipient.id, { sendStatus: "failed", error: res.error });
        notify("error", "Test send failed", res.error);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Email preview">
        <div className="modal__bar">
          <span className="modal__dot" style={{ background: "#ff5f57" }} />
          <span className="modal__dot" style={{ background: "#febc2e" }} />
          <span className="modal__dot" style={{ background: "#28c840" }} />
          <span className="modal__title">Preview</span>
          {recipients.length > 1 && (
            <div className="preview-nav">
              <button onClick={() => go(-1)} disabled={index <= 0} aria-label="Previous recipient">
                <ChevronIcon size={15} className="rot-90" />
              </button>
              <span>
                {index + 1} / {recipients.length}
              </span>
              <button
                onClick={() => go(1)}
                disabled={index >= recipients.length - 1}
                aria-label="Next recipient"
              >
                <ChevronIcon size={15} className="rot-270" />
              </button>
            </div>
          )}
          <button className="modal__close" onClick={onClose} disabled={sending} aria-label="Close preview">
            <XIcon />
          </button>
        </div>

        <div className="mail">
          <div className="mail__head">
            <div className="mail__row">
              <span className="k">From</span>
              <span className="v">
                {user.name} &lt;{user.email}&gt;
              </span>
            </div>
            <div className="mail__row">
              <span className="k">To</span>
              <span className="v">
                {recipient.name} &lt;{recipient.email}&gt;
              </span>
            </div>
            {ccList.length > 0 && (
              <div className="mail__row">
                <span className="k">Cc</span>
                <span className="v">{ccList.join(", ")}</span>
              </div>
            )}
            {bccList.length > 0 && (
              <div className="mail__row">
                <span className="k">Bcc</span>
                <span className="v">{bccList.join(", ")}</span>
              </div>
            )}
          </div>
          <div className="mail__subject">{subject || "(no subject)"}</div>
          {hasBody ? (
            <div className="mail__body" dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            <div className="mail__body">(empty message)</div>
          )}
          {attachments.length > 0 && (
            <div className="mail__attach">
              {attachments.map((a) => (
                <span className="chip" key={a.id}>
                  <PaperclipIcon size={12} /> {a.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose} disabled={sending}>
            Keep editing
          </button>
          <button
            className="btn btn--primary"
            style={{ flex: 1.4 }}
            onClick={testSend}
            disabled={sending || !canSend}
            title={!canSend ? "Add a subject and message first" : undefined}
          >
            {sending ? (
              <>
                <span className="spinner" /> Sending…
              </>
            ) : (
              <>
                <SendIcon /> Test send to {firstName}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
