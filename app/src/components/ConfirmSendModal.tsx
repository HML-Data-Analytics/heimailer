import { useCampaign } from "../state/campaign";
import { usedPlaceholders } from "../lib/validation";
import { AlertIcon, SendIcon, XIcon } from "./icons";

interface Warning {
  level: "warn" | "block";
  text: string;
}

export default function ConfirmSendModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { draft, recipients, sendIds, attachments, settings } = useCampaign();

  const sendCount = sendIds.length;
  const sendable = new Set(sendIds);
  const placeholders = usedPlaceholders(`${draft.subject} ${draft.body}`);

  const warnings: Warning[] = [];

  if (sendCount === 0) {
    warnings.push({ level: "block", text: "No valid recipients are selected to send." });
  }
  if (draft.subject.trim().length === 0) {
    warnings.push({ level: "warn", text: "The subject line is empty." });
  }
  if (draft.body.trim().length === 0) {
    warnings.push({ level: "warn", text: "The message body is empty." });
  }
  if (placeholders.includes("company")) {
    const missing = recipients.filter(
      (r) => sendable.has(r.id) && !r.company?.trim(),
    ).length;
    if (missing > 0) {
      warnings.push({
        level: "warn",
        text: `${missing} recipient(s) have no Company, but your message uses {{Company}}.`,
      });
    }
  }
  if (sendCount > settings.highVolumeThreshold) {
    warnings.push({
      level: "warn",
      text: `This is a high-volume send (${sendCount} recipients). Please double-check before continuing.`,
    });
  }

  const blocked = warnings.some((w) => w.level === "block");

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="console" role="dialog" aria-modal="true" aria-label="Confirm send">
        <div className="console__head">
          <div className="console__icon console__icon--run">
            <SendIcon size={24} />
          </div>
          <h2>Send to {sendCount} recipient{sendCount === 1 ? "" : "s"}?</h2>
          <p>Each person receives their own personalized email - one by one, from your mailbox.</p>
        </div>
        <div className="console__body">
          <div className="confirm-recap">
            <div className="stat">
              <div className="stat__n">{sendCount}</div>
              <div className="stat__l">Recipients</div>
            </div>
            <div className="stat">
              <div className="stat__n">{attachments.length}</div>
              <div className="stat__l">Attachments</div>
            </div>
            <div className="stat">
              <div className="stat__n">{settings.sendDelayMs}ms</div>
              <div className="stat__l">Gap</div>
            </div>
          </div>

          {warnings.length > 0 && (
            <ul className="warnlist">
              {warnings.map((w, i) => (
                <li key={i} className={w.level}>
                  <AlertIcon size={15} />
                  {w.text}
                </li>
              ))}
            </ul>
          )}

          <div className="console__actions">
            <button className="btn btn--ghost" onClick={onClose}>
              <XIcon size={15} /> Go back
            </button>
            <button className="btn btn--primary" onClick={onConfirm} disabled={blocked}>
              <SendIcon size={16} /> Send all now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
