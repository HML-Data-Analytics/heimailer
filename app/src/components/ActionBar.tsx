import { useState } from "react";
import { useCampaign } from "../state/campaign";
import { useAuth } from "../auth/useAuth";
import { sendMail } from "../lib/mailer";
import { hasBodyContent } from "../lib/validation";
import { EyeIcon, SendIcon, UserIcon } from "./icons";

export default function ActionBar({
  onPreview,
  onSendAll,
}: {
  onPreview: () => void;
  onSendAll: () => void;
}) {
  const { draft, recipients, sendIds, attachments, sending, notify } = useCampaign();
  const { user, getAccessToken } = useAuth();
  const [selfBusy, setSelfBusy] = useState(false);

  const hasSubject = draft.subject.trim().length > 0;
  const hasMessage = hasBodyContent(draft.body);
  const hasContent = hasSubject && hasMessage;
  const canPreview = recipients.length > 0;
  const canSendAll = hasContent && sendIds.length > 0 && !sending;

  async function sendToMyself() {
    if (!user) return;
    setSelfBusy(true);
    try {
      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch {
        notify("error", "Test failed", "Reconnect your Microsoft account in Settings.");
        return;
      }
      const res = await sendMail(
        {
          from: user,
          to: { name: user.name, email: user.email },
          subject: draft.subject,
          body: draft.body,
          attachments,
          cc: draft.cc,
          bcc: draft.bcc,
        },
        token,
      );
      if (res.ok) notify("success", "Test sent to you", `Check ${user.email}.`);
      else notify("error", "Test failed", res.error);
    } finally {
      setSelfBusy(false);
    }
  }

  return (
    <div className="actionbar">
      <div className="actionbar__inner">
        <div className="actionbar__meta">
          {sendIds.length === 0 ? (
            <span className="muted">Add a recipient to begin</span>
          ) : !hasContent ? (
            <span className="muted">
              {!hasSubject ? "Add a subject" : "Add a message"} to send
            </span>
          ) : (
            <>
              <b>{sendIds.length}</b> ready to send
              {recipients.length !== sendIds.length && (
                <span className="muted"> · {recipients.length - sendIds.length} excluded/invalid</span>
              )}
            </>
          )}
        </div>

        <div className="actionbar__spacer" />

        <button className="btn btn--subtle btn--sm" onClick={sendToMyself} disabled={!hasContent || selfBusy}>
          {selfBusy ? <span className="spinner" style={{ borderTopColor: "#00843d", borderColor: "rgba(0,132,61,.25)" }} /> : <UserIcon size={15} />}
          Send test to myself
        </button>

        <button className="btn btn--ghost btn--lg" onClick={onPreview} disabled={!canPreview}>
          <EyeIcon /> Preview
        </button>

        <button
          className="btn btn--primary btn--lg"
          onClick={onSendAll}
          disabled={!canSendAll}
          title={
            sendIds.length === 0
              ? "Add at least one valid recipient"
              : !hasContent
                ? "Add a subject and message first"
                : undefined
          }
        >
          <SendIcon /> Send all{sendIds.length > 0 ? ` (${sendIds.length})` : ""}
        </button>
      </div>
    </div>
  );
}
