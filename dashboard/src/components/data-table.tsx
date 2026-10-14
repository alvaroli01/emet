"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X, Trash2, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar, ViewOnlyBadge } from "@/components/ui";
import { eur, shortDate, dateTime, num } from "@/lib/format";
import type { Member } from "@/lib/boards";

/**
 * One reusable "records" component for every group tool (sales, prospects, campaigns…).
 * Columns are described as data (no functions), so server pages can configure it.
 * The database still decides who may write — this only hides buttons people can't use.
 */

export type Option = { value: string; label: string };
export type Field =
  | { key: string; label: string; type: "text" | "textarea" | "number" | "money" | "date" | "datetime" | "bool"; required?: boolean; list?: boolean; form?: boolean; placeholder?: string }
  | { key: string; label: string; type: "select"; options: Option[]; required?: boolean; list?: boolean; form?: boolean }
  | { key: string; label: string; type: "person"; required?: boolean; list?: boolean; form?: boolean }
  // Display-only columns
  | { key: string; label: string; type: "timer"; start: string; end: string; hours: number; list?: boolean; form?: false }
  | { key: string; label: string; type: "logged24"; date: string; created: string; list?: boolean; form?: false }
  | { key: string; label: string; type: "margin"; price: string; cost: string; list?: boolean; form?: false };

export type Row = Record<string, unknown> & { id: string };

export function DataTable({
  table, title, rows, fields, members, canEdit, canAdd = canEdit, addFields, defaults = {}, emptyText, addLabel, footer,
}: {
  table: string;
  title: string;
  rows: Row[];
  fields: Field[];
  members: Member[];
  canEdit: boolean;
  /** Some tables let anyone add (e.g. design requests) while only the group edits */
  canAdd?: boolean;
  /** Fields shown when someone without edit rights adds a row */
  addFields?: string[];
  /** Values added to every new row (e.g. logged_by = me) */
  defaults?: Record<string, unknown>;
  emptyText?: string;
  addLabel?: string;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("table");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const memberName = (id: unknown) => members.find((m) => m.id === id);

  const listFields = fields.filter((f) => f.list !== false);

  function display(f: Field, row: Row): React.ReactNode {
    const v = row[f.key];
    switch (f.type) {
      case "money": return v === null || v === undefined || v === "" ? "—" : eur(Number(v), locale, 2);
      case "number": return v === null || v === undefined || v === "" ? "—" : num(Number(v), locale);
      case "date": return v ? shortDate(String(v), locale) : "—";
      case "datetime": return v ? dateTime(String(v), locale) : "—";
      case "bool": return v ? "✓" : "—";
      case "select": return f.options.find((o) => o.value === v)?.label ?? (v ? String(v) : "—");
      case "person": {
        const m = memberName(v);
        return m ? <span className="inline-flex items-center gap-1.5"><Avatar name={m.full_name} src={m.avatar_url} size={20} />{m.full_name}</span> : "—";
      }
      case "textarea": return v ? <span className="line-clamp-2 whitespace-pre-wrap">{String(v)}</span> : "—";
      case "timer": return <Timer start={row[f.start] as string} end={row[f.end] as string | null} hours={f.hours} />;
      case "logged24": return <Logged24 date={row[f.date] as string} created={row[f.created] as string} />;
      case "margin": {
        const price = Number(row[f.price]), cost = Number(row[f.cost]);
        return price > 0 && !Number.isNaN(cost) ? `${Math.round(((price - cost) / price) * 100)}%` : "—";
      }
      default: return v ? String(v) : "—";
    }
  }

  async function saveRow(values: Record<string, unknown>, existing: Row | null) {
    const payload = existing ? values : { ...defaults, ...values };
    const q = existing
      ? supabase.from(table).update(payload).eq("id", existing.id)
      : supabase.from(table).insert(payload);
    const { error } = await q;
    if (error) {
      toast("error", error.code === "42501" || error.message.includes("row-level") ? t("noPermission") : t("saveError"));
      return false;
    }
    toast("ok", t("saved"));
    setEditing(null);
    router.refresh();
    return true;
  }

  async function deleteRow(row: Row) {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("deleted"));
    setEditing(null);
    router.refresh();
  }

  // "Who did this" is taken from the login, never asked: these fields are filled from `defaults` and hidden in forms
  const AUTO_WHO = ["logged_by", "created_by", "requested_by", "author_id"];
  const formFields = (row: Row | null) => fields.filter((f) => f.form !== false && f.type !== "timer" && f.type !== "logged24" && f.type !== "margin")
    .filter((f) => !(f.type === "person" && AUTO_WHO.includes(f.key)))
    .filter((f) => row || canEdit || !addFields || addFields.includes(f.key));

  return (
    <section className="panel">
      <header className="flex flex-wrap items-center gap-2 px-5 pt-4 pb-3">
        <h3 className="flex-1 font-semibold">{title}</h3>
        {!canEdit && !canAdd && <ViewOnlyBadge />}
        {canAdd && (
          <button onClick={() => setEditing("new")}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-sm font-medium text-brand-contrast hover:opacity-90">
            <Plus size={15} /> {addLabel ?? t("add")}
          </button>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-center text-sm text-muted">{emptyText ?? t("empty")}</p>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-xs text-muted">
                  {listFields.map((f) => (
                    <th key={f.key} className={`px-5 py-2 font-medium ${isNumeric(f) ? "text-right" : ""}`}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => canEdit && setEditing(r)}
                      className={canEdit ? "cursor-pointer hover:bg-surface-2/60" : ""}>
                    {listFields.map((f) => (
                      <td key={f.key} className={`px-5 py-2.5 align-top ${isNumeric(f) ? "text-right tabular-nums" : ""}`}>{display(f, r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phone: stacked cards */}
          <ul className="divide-y divide-line border-t border-line sm:hidden">
            {rows.map((r) => (
              <li key={r.id} onClick={() => canEdit && setEditing(r)} className="space-y-1 px-5 py-3 text-sm">
                <p className="font-medium">{display(listFields[0], r)}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {listFields.slice(1).map((f) => (
                    <div key={f.key} className="contents">
                      <dt className="text-muted">{f.label}</dt>
                      <dd className="text-right">{display(f, r)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
      {footer && <div className="border-t border-line px-5 py-3 text-sm">{footer}</div>}

      {editing && (
        <RowForm
          title={editing === "new" ? (addLabel ?? t("add")) : t("edit")}
          fields={formFields(editing === "new" ? null : editing)}
          row={editing === "new" ? null : editing}
          initial={defaults}
          members={members}
          canDelete={editing !== "new" && canEdit}
          onSave={(v) => saveRow(v, editing === "new" ? null : editing)}
          onDelete={() => editing !== "new" && deleteRow(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

const isNumeric = (f: Field) => f.type === "money" || f.type === "number" || f.type === "margin";

function RowForm({ title, fields, row, initial, members, canDelete, onSave, onDelete, onClose }: {
  title: string; fields: Field[]; row: Row | null; initial: Record<string, unknown>; members: Member[]; canDelete: boolean;
  onSave: (v: Record<string, unknown>) => Promise<boolean>; onDelete: () => void; onClose: () => void;
}) {
  const t = useTranslations("table");
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, toInput(f, row ? row[f.key] : initial[f.key])])));
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const out: Record<string, unknown> = {};
    for (const f of fields) out[f.key] = fromInput(f, values[f.key]);
    await onSave(out);
    setBusy(false);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-sm font-medium">{f.label}{"required" in f && f.required ? " *" : ""}</span>
            <FieldInput f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} members={members} />
          </label>
        ))}
        <div className="flex items-center gap-2 pt-2">
          {canDelete && (
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-bad-text hover:bg-surface-2">
              <Trash2 size={14} /> {t("delete")}
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto rounded-xl px-4 py-2 text-sm text-muted hover:text-ink">{t("cancel")}</button>
          <button disabled={busy} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast hover:opacity-90 disabled:opacity-60">
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FieldInput({ f, value, onChange, members }: { f: Field; value: unknown; onChange: (v: unknown) => void; members: Member[] }) {
  const t = useTranslations("table");
  const required = "required" in f && !!f.required;
  const v = (value ?? "") as string;
  switch (f.type) {
    case "textarea":
      return <textarea required={required} value={v} onChange={(e) => onChange(e.target.value)} rows={4} className="input" />;
    case "money":
      return <input required={required} type="number" step="0.01" min="0" inputMode="decimal" value={v} onChange={(e) => onChange(e.target.value)} className="input" />;
    case "number":
      return <input required={required} type="number" step="any" inputMode="decimal" value={v} onChange={(e) => onChange(e.target.value)} className="input" />;
    case "date":
      return <input required={required} type="date" value={v} onChange={(e) => onChange(e.target.value)} className="input" />;
    case "datetime":
      return <input required={required} type="datetime-local" value={v} onChange={(e) => onChange(e.target.value)} className="input" />;
    case "bool":
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="size-5" />;
    case "select":
      return (
        <select required={required} value={v} onChange={(e) => onChange(e.target.value)} className="input">
          {!required && <option value="">—</option>}
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "person":
      return (
        <select required={required} value={v} onChange={(e) => onChange(e.target.value)} className="input">
          <option value="">{t("nobody")}</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      );
    default:
      return <input required={required} value={v} onChange={(e) => onChange(e.target.value)} placeholder={"placeholder" in f ? f.placeholder : undefined} className="input" />;
  }
}

function toInput(f: Field, v: unknown) {
  if (v === null || v === undefined) {
    if (f.type === "select" && f.required) return f.options[0]?.value ?? "";
    return f.type === "bool" ? false : "";
  }
  if (f.type === "datetime") {
    const d = new Date(String(v));
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return v;
}

function fromInput(f: Field, v: unknown) {
  if (f.type === "bool") return !!v;
  if (v === "" || v === undefined) return null;
  if (f.type === "money" || f.type === "number") return Number(v);
  if (f.type === "datetime") return new Date(String(v)).toISOString();
  return v;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className={`relative max-h-[92dvh] w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Countdown for 48h promises (complaints, design requests) */
function Timer({ start, end, hours }: { start: string; end: string | null; hours: number }) {
  const t = useTranslations("table");
  if (!start) return "—";
  const deadline = Date.parse(start) + hours * 3600_000;
  if (end) {
    const ok = Date.parse(end) <= deadline;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? "text-ok-text" : "text-bad-text"}`}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{ok ? t("doneInTime") : t("doneLate")}
      </span>
    );
  }
  const left = Math.round((deadline - Date.now()) / 3600_000);
  const cls = left < 0 ? "text-bad-text" : left < 12 ? "text-warn-text" : "text-muted";
  return (
    <span suppressHydrationWarning className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Clock size={13} />{left < 0
        ? (-left >= 48 ? t("lateByDays", { days: Math.round(-left / 24) }) : t("lateBy", { hours: -left }))
        : t("hoursLeft", { hours: left })}
    </span>
  );
}

/** Was this sale/expense logged within 24h? (by the end of the day after it happened) */
function Logged24({ date, created }: { date: string; created: string }) {
  const t = useTranslations("table");
  if (!date || !created) return "—";
  const ok = Date.parse(created) <= Date.parse(date + "T23:59:59+02:00") + 24 * 3600_000;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? "text-ok-text" : "text-warn-text"}`}>
      {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{ok ? t("yes") : t("late")}
    </span>
  );
}
