"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Phone, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import type { Member } from "@/lib/boards";

export type Customer = { id: string; name: string; phone: string | null; added_by: string | null; created_at: string };

const INPUT = "min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-brand";

/** Customers we already talked to in this project, with their phone numbers. Any project member adds or removes them. */
export function ProjectCustomers({ projectId, customers, people }: { projectId: string; customers: Customer[]; people: Map<string, Member> }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    if (!name) return;
    setBusy(true);
    const { error } = await createClient().from("project_customers").insert({ project_id: projectId, name, phone: phone || null });
    setBusy(false);
    if (error) { toast("error", t("error")); return; }
    form.reset();
    router.refresh();
  }

  async function remove(id: string) {
    const { error } = await createClient().from("project_customers").delete().eq("id", id);
    if (error) { toast("error", t("error")); return; }
    router.refresh();
  }

  return (
    <section className="panel space-y-4 p-5">
      <h2 className="font-semibold">{t("customersTitle")}</h2>
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <input name="name" required maxLength={200} placeholder={t("customerName")} aria-label={t("customerName")} className={INPUT} />
        <input name="phone" type="tel" maxLength={40} placeholder={t("customerPhone")} aria-label={t("customerPhone")} autoComplete="off" className={INPUT} />
        <button disabled={busy} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-50">
          <Plus size={15} /> {t("addCustomer")}
        </button>
      </form>
      {customers.length ? (
        <ul className="divide-y divide-line">{customers.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              <p className="text-xs text-muted">{people.get(c.added_by ?? "")?.full_name ?? "—"} · {timeAgo(c.created_at, locale)}</p>
            </div>
            {c.phone && (
              <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-sm hover:bg-surface-2">
                <Phone size={13} /> {c.phone}
              </a>
            )}
            <button onClick={() => remove(c.id)} aria-label={t("delete")} title={t("delete")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-bad-text">
              <Trash2 size={14} />
            </button>
          </li>
        ))}</ul>
      ) : <p className="text-sm text-muted">{t("noCustomers")}</p>}
    </section>
  );
}
