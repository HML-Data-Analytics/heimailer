import { useState } from "react";
import { useCampaign } from "../state/campaign";
import { parseEmails } from "../lib/validation";
import { PenIcon } from "./icons";
import TemplateMenu from "./TemplateMenu";
import RichBody from "./RichBody";

export default function ComposeCard() {
  const { draft, setDraft } = useCampaign();
  const [showCc, setShowCc] = useState(() => draft.cc.trim().length > 0);
  const [showBcc, setShowBcc] = useState(() => draft.bcc.trim().length > 0);

  const ccCount = parseEmails(draft.cc).length;
  const bccCount = parseEmails(draft.bcc).length;

  return (
    <section className="card">
      <div className="card__head">
        <span className="card__icon">
          <PenIcon />
        </span>
        <div className="card__titles">
          <h2>Compose</h2>
          <p>Write one subject and message. It personalizes for each recipient.</p>
        </div>
        <div className="card__head-actions">
          <TemplateMenu />
        </div>
      </div>
      <div className="divider" />
      <div className="card__body">
        <div className="field">
          <div className="label-row">
            <label className="label" htmlFor="subject">
              Subject <span className="req">*</span>
            </label>
            <div className="ccbcc-toggle">
              {!showCc && (
                <button type="button" onClick={() => setShowCc(true)}>
                  Cc
                </button>
              )}
              {!showBcc && (
                <button type="button" onClick={() => setShowBcc(true)}>
                  Bcc
                </button>
              )}
            </div>
          </div>
          <input
            id="subject"
            className="input"
            placeholder="You're invited: HEINEKEN Myanmar Partner Evening"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
        </div>

        {showCc && (
          <div className="field">
            <label className="label" htmlFor="cc">
              Cc <span className="opt">· added to every email</span>
              {ccCount > 0 && <span className="addr-count">{ccCount} valid</span>}
            </label>
            <input
              id="cc"
              className="input"
              placeholder="manager@heineken.com.mm, events@partner.com"
              value={draft.cc}
              onChange={(e) => setDraft({ ...draft, cc: e.target.value })}
            />
          </div>
        )}

        {showBcc && (
          <div className="field">
            <label className="label" htmlFor="bcc">
              Bcc <span className="opt">· hidden recipients</span>
              {bccCount > 0 && <span className="addr-count">{bccCount} valid</span>}
            </label>
            <input
              id="bcc"
              className="input"
              placeholder="archive@heineken.com.mm"
              value={draft.bcc}
              onChange={(e) => setDraft({ ...draft, bcc: e.target.value })}
            />
          </div>
        )}

        <RichBody />
      </div>
    </section>
  );
}
