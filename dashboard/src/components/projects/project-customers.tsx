"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

export type Customer = { id: string; name: string; phone: string | null; added_by: string | null; created_at: string };

export function ProjectCustomers({ projectId, customers, meId, isLeader }: { projectId: string; customers: Customer[]; meId: string; isLeader: boolean }) {
  const t = useTranslations("projects");
  const toast = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });

  async function addCustomer() {
    if (!form.name.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("customers").insert({ project_id: projectId, name: form.name, phone: form.phone || null });
    if (error) {
      toast("error", "Failed to add customer");
    } else {
      toast("ok", "Customer added");
      setForm({ name: "", phone: "" });
      setIsAdding(false);
    }
    setLoading(false);
  }

  async function deleteCustomer(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast("error", "Failed to delete customer");
    } else {
      toast("ok", "Customer deleted");
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="mb-4 font-semibold">{t("customers")}</h2>
        {customers.length > 0 ? (
          <ul className="space-y-3">
            {customers.map((customer) => (
              <li key={customer.id} className="flex items-center justify-between rounded-lg bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{customer.name}</p>
                  {customer.phone && <p className="text-sm text-muted">{customer.phone}</p>}
                </div>
                <button onClick={() => deleteCustomer(customer.id)} className="rounded-lg p-2 text-muted hover:bg-surface-1 hover:text-bad-text">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("noCustomers")}</p>
        )}
      </section>

      <section className="panel p-5">
        {!isAdding ? (
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-medium text-brand-contrast hover:opacity-90">
            <Plus size={14} /> {t("addCustomer")}
          </button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); addCustomer(); }} className="space-y-3">
            <input
              type="text"
              placeholder={t("customerName")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-brand"
            />
            <input
              type="tel"
              placeholder={t("customerPhone")}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-brand"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-contrast disabled:opacity-50">
                {loading ? t("adding") : t("add")}
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg px-4 py-2 hover:bg-surface-2">
                {t("cancel")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
