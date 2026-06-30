import { useRef } from "react";
import { useCampaign } from "../state/campaign";
import type { Recipient, RowValidation, SendStatus } from "../types";
import { importFile, ImportError } from "../lib/importer";
import { downloadTemplateXlsx, exportRecipientsXlsx } from "../lib/exporter";
import {
  CheckIcon,
  DownloadIcon,
  ExportIcon,
  ImportIcon,
  InboxIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  UsersIcon,
} from "./icons";
import GroupMenu from "./GroupMenu";

export default function RecipientsPanel() {
  const { recipients, counts, validation } = useCampaign();

  return (
    <section className="card recipients-card">
      <div className="card__head">
        <span className="card__icon">
          <UsersIcon />
        </span>
        <div className="card__titles">
          <h2>Recipients</h2>
          <p>Add people or import a file - edit any cell inline, then send.</p>
        </div>
        <div className="card__head-actions">
          <GroupMenu />
        </div>
      </div>
      <div className="divider" />

      <div className="card__body">
        {recipients.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <Toolbar />
            <div className="counts">
              <span className="count"><b>{counts.total}</b> total</span>
              <span className="count count--ok"><b>{counts.sendable}</b> ready</span>
              {counts.invalidEmail > 0 && (
                <span className="count count--warn"><b>{counts.invalidEmail}</b> invalid email</span>
              )}
              {counts.missingName > 0 && (
                <span className="count count--amber"><b>{counts.missingName}</b> missing name</span>
              )}
              {counts.duplicate > 0 && (
                <span className="count count--amber"><b>{counts.duplicate}</b> duplicate</span>
              )}
            </div>
            <EditableTable recipients={recipients} validation={validation} />
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------- Toolbar ---------------- */
function Toolbar() {
  const {
    counts,
    recipients,
    addBlankRow,
    addImported,
    removeInvalid,
    removeDuplicates,
    includeAllValid,
    clearRecipients,
    notify,
  } = useCampaign();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(files: FileList | null) {
    if (!files?.[0]) return;
    try {
      const result = await importFile(files[0]);
      const n = addImported(result.rows);
      const cols = [result.matched.name && "Name", "Email", result.matched.company && "Company"]
        .filter(Boolean)
        .join(", ");
      notify("success", "List imported", `Added ${n} recipients (mapped ${cols}).`);
    } catch (e) {
      notify("error", "Import failed", e instanceof ImportError ? e.message : "Could not import that file.");
    }
  }

  const hasRecipients = recipients.length > 0;

  return (
    <div className="toolbar">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden-file"
        onChange={(e) => {
          onFile(e.target.files);
          e.target.value = "";
        }}
      />

      <button className="btn btn--primary btn--sm" onClick={addBlankRow}>
        <PlusIcon size={15} /> Add row
      </button>
      <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} title="Import .xlsx or .csv">
        <ImportIcon size={15} /> Import
      </button>
      <button className="btn btn--ghost btn--sm" onClick={() => downloadTemplateXlsx()} title="Download a blank Excel template">
        <DownloadIcon size={15} /> Get template
      </button>
      {hasRecipients && (
        <button className="btn btn--ghost btn--sm" onClick={() => exportRecipientsXlsx(recipients)} title="Export the list as Excel">
          <ExportIcon size={15} /> Export
        </button>
      )}

      <div className="toolbar__spacer" />

      {counts.invalidEmail + counts.missingName > 0 && (
        <button
          className="btn btn--danger btn--sm"
          onClick={() => notify("info", "Removed invalid rows", `${removeInvalid()} row(s) removed.`)}
        >
          <TrashIcon size={14} /> Remove invalid
        </button>
      )}
      {counts.duplicate > 0 && (
        <button
          className="btn btn--danger btn--sm"
          onClick={() => notify("info", "Removed duplicates", `${removeDuplicates()} removed.`)}
        >
          <TrashIcon size={14} /> Remove duplicates
        </button>
      )}
      {hasRecipients && (
        <>
          <button className="btn btn--ghost btn--sm" onClick={includeAllValid} title="Include all valid rows">
            <CheckIcon size={14} /> Select all valid
          </button>
          <button
            className="btn btn--subtle btn--sm"
            onClick={() => confirm("Remove all recipients?") && clearRecipients()}
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------- Editable grid ---------------- */
function EditableTable({
  recipients,
  validation,
}: {
  recipients: Recipient[];
  validation: Map<string, RowValidation>;
}) {
  const { selectedId, setSelectedId, excludedIds, toggleExclude, updateRecipient, removeRecipient, sending } =
    useCampaign();

  return (
    <div className="tablewrap" style={{ marginTop: 12 }}>
      <div className="rtable__scroll">
        <table className="rtable">
          <thead>
            <tr>
              <th style={{ width: 34 }}></th>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Validation</th>
              <th>Send</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => {
              const v = validation.get(r.id)!;
              const checked = v.sendable && !excludedIds.has(r.id);
              const emailBad = r.email.trim().length > 0 && !v.validEmail;
              return (
                <tr key={r.id} className={r.id === selectedId ? "is-selected" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      className="rcheck"
                      checked={checked}
                      disabled={!v.sendable || sending}
                      onChange={() => toggleExclude(r.id)}
                      title={v.sendable ? "Include in Send All" : "Not sendable"}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input cell-name"
                      value={r.name}
                      placeholder="Name"
                      disabled={sending}
                      onFocus={() => setSelectedId(r.id)}
                      onChange={(e) => updateRecipient(r.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={`cell-input ${emailBad ? "is-bad" : ""}`}
                      value={r.email}
                      placeholder="name@company.com"
                      disabled={sending}
                      onFocus={() => setSelectedId(r.id)}
                      onChange={(e) => updateRecipient(r.id, { email: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      value={r.company ?? ""}
                      placeholder="-"
                      disabled={sending}
                      onFocus={() => setSelectedId(r.id)}
                      onChange={(e) => updateRecipient(r.id, { company: e.target.value || undefined })}
                    />
                  </td>
                  <td>{validationPill(v)}</td>
                  <td>{sendPill(r.sendStatus, r.error)}</td>
                  <td>
                    <button
                      className="iconaction"
                      title="Remove recipient"
                      onClick={() => removeRecipient(r.id)}
                      disabled={sending}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function validationPill(v: RowValidation) {
  if (!v.validEmail) return <span className="pill pill--bad"><span className="dot" /> Invalid email</span>;
  if (v.missingName) return <span className="pill pill--warn"><span className="dot" /> Missing name</span>;
  if (v.duplicate) return <span className="pill pill--warn"><span className="dot" /> Duplicate</span>;
  return <span className="pill pill--ok"><CheckIcon size={12} /> Ready</span>;
}

function sendPill(status: SendStatus, error?: string) {
  switch (status) {
    case "sent":
      return <span className="pill pill--ok"><CheckIcon size={12} /> Sent</span>;
    case "failed":
      return <span className="pill pill--bad" title={error}><span className="dot" /> Failed</span>;
    case "sending":
      return <span className="pill pill--live"><span className="spinner" /> Sending</span>;
    case "queued":
      return <span className="pill pill--neutral"><RefreshIcon size={12} /> Queued</span>;
    default:
      return <span className="pill pill--neutral">-</span>;
  }
}

/* ---------------- Empty ---------------- */
function EmptyState() {
  const { addBlankRow, addImported, notify } = useCampaign();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(files: FileList | null) {
    if (!files?.[0]) return;
    try {
      const result = await importFile(files[0]);
      notify("success", "List imported", `Added ${addImported(result.rows)} recipients.`);
    } catch (e) {
      notify("error", "Import failed", e instanceof ImportError ? e.message : "Could not import that file.");
    }
  }

  return (
    <div className="empty">
      <div className="empty__art">
        <InboxIcon size={26} />
      </div>
      <h3>No recipients yet</h3>
      <p>Add a row, paste a list, or import an Excel / CSV file to begin.</p>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden-file"
        onChange={(e) => {
          onFile(e.target.files);
          e.target.value = "";
        }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn btn--primary btn--sm" onClick={addBlankRow}>
          <PlusIcon size={15} /> Add row
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
          <ImportIcon size={15} /> Import file
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => downloadTemplateXlsx()}>
          <DownloadIcon size={15} /> Get template
        </button>
      </div>
    </div>
  );
}
