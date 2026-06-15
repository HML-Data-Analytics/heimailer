import type { Recipient, RowValidation } from "../types";

/**
 * Pragmatic email format check. Blocks obviously invalid addresses before
 * preview / test send / send all (PRD §12.5).
 */
const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length <= 254 && EMAIL_RE.test(v);
}

/** Parse a comma/semicolon-separated address string into valid emails. */
export function parseEmails(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => isValidEmail(s));
}

/** Does this HTML body contain anything sendable (text or an image)? */
export function hasBodyContent(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  return /\S/.test(html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " "));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Render {{Name}} / {{Company}} placeholders for a given recipient.
 * Name must come from the recipient record only — never derived from the
 * email address (PRD core business rule).
 */
export function renderTemplate(
  text: string,
  recipient: Pick<Recipient, "name" | "company">,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const k = key.toLowerCase();
    if (k === "name") return recipient.name || match;
    // Company is optional: when a recipient has no company, render blank
    // instead of leaving the literal {{Company}} token in the message.
    if (k === "company") return recipient.company?.trim() || "";
    return match;
  });
}

/** Which placeholder tokens does the text reference? */
export function usedPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    found.add(m[1].toLowerCase());
  }
  return [...found];
}

/**
 * Validate every row against itself and the rest of the list.
 * Duplicates are keyed on lower-cased, trimmed email; the first occurrence is
 * kept clean and later occurrences are flagged (PRD §12.5).
 */
export function validateList(recipients: Recipient[]): Map<string, RowValidation> {
  const seen = new Map<string, number>();
  const result = new Map<string, RowValidation>();

  for (const r of recipients) {
    const key = r.email.trim().toLowerCase();
    const count = seen.get(key) ?? 0;
    const validEmail = isValidEmail(r.email);
    const missingName = r.name.trim().length === 0;
    const duplicate = validEmail && count > 0;

    result.set(r.id, {
      validEmail,
      missingName,
      duplicate,
      sendable: validEmail && !missingName && !duplicate,
    });

    if (validEmail) seen.set(key, count + 1);
  }

  return result;
}
