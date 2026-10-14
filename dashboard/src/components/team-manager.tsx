"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Plus, Pencil, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { Modal } from "@/components/data-table";
import { LOCALE_NAMES, isLocale } from "@/i18n/config";
import type { Group, Profile } from "@/lib/session";

/** Roles from README section 4, per group (roles are still being decided — free text is allowed too) */
export const ROLES: Record<string, string[]> = {
  "team-leader": ["Team leader", "Operations monitor"],
  finance: ["Financial leader", "Bookkeeper", "Operations"],
  customer: ["Customer leader", "Sales rep"],
  marketing: ["Marketing leader", "Social media manager", "Content creator", "Editor & designer", "Market researcher"],
  communications: ["Project manager", "Documentation & wellness"],
};

export function TeamManager({ people, groups, meId, isAdmin }: { people: Profile[]; groups: Group[]; meId: string; isAdmin: boolean }) {
  const t = useTranslations("team");
  const tg = useTranslations("group.names");
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const groupOf = (id: string | null) => groups.find((g) => g.id === id);

  async function invite(p: Profile) {
    const res = await fetch("/api/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId: p.id }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return toast("ok", body.resent ? t("linkSent", { name: p.full_name }) : t("invited", { name: p.full_name }));
    toast("error", body.error === "placeholder-email" ? t("errors.placeholder") : body.error === "no-service-key" ? t("errors.noKey") : t("errors.invite"));
  }

  const visible = people.filter((p) => showInactive || p.active);
  const sorted = [...visible].sort((a, b) =>
    (groupOf(a.group_id)?.position ?? 99) - (groupOf(b.group_id)?.position ?? 99) || a.full_name.localeCompare(b.full_name));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast">
            <Plus size={15} /> {t("addMember")}
          </button>
        )}
        <button onClick={() => setEditing(people.find((p) => p.id === meId) ?? null)}
                className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2">
          <Pencil size={14} /> {t("editMe")}
        </button>
        {isAdmin && (
          <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> {t("showInactive")}
          </label>
        )}
      </div>

      <div className="panel">
        <ul className="divide-y divide-line">
          {sorted.map((p) => {
            const g = groupOf(p.group_id);
            const admin = p.is_admin || g?.slug === "team-leader";
            return (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${p.active ? "" : "opacity-50"}`}>
                <Avatar name={p.full_name} src={p.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {p.full_name}
                    {admin && <ShieldCheck size={14} className="text-muted" aria-label={t("admin")} />}
                    {p.id === meId && <span className="text-xs font-normal text-muted">({t("you")})</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {p.role_title ?? t("roleTbd")} · {LOCALE_NAMES[isLocale(p.locale) ? p.locale : "en"]}
                    {isAdmin && <> · {p.email}</>}
                  </p>
                </div>
                <span className="text-sm">{g ? <span style={{ color: g.color }}>{g.emoji}</span> : null} <span className="text-muted">{g ? tg(g.slug) : t("noGroup")}</span></span>
                {isAdmin && (
                  <div className="flex gap-1.5">
                    {p.active && (
                      <button onClick={() => invite(p)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-2">
                        <Mail size={12} /> {p.user_id ? t("sendLink") : t("invite")}
                      </button>
                    )}
                    <button onClick={() => setEditing(p)} aria-label={t("edit")} className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-2">
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
                {!isAdmin && !p.user_id && <span className="text-xs text-muted">{t("notJoined")}</span>}
              </li>
            );
          })}
        </ul>
      </div>

      {editing && (
        <MemberForm
          profile={editing === "new" ? null : editing}
          groups={groups}
          adminMode={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function MemberForm({ profile, groups, adminMode, onClose, onSaved }: {
  profile: Profile | null; groups: Group[]; adminMode: boolean; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations("team");
  const tg = useTranslations("group.names");
  const toast = useToast();
  const [v, setV] = useState({
    full_name: profile?.full_name ?? "",
    email: profile?.email ?? "",
    avatar_url: profile?.avatar_url ?? "",
    group_id: profile?.group_id ?? "",
    role_title: profile?.role_title ?? "",
    is_admin: profile?.is_admin ?? false,
    active: profile?.active ?? true,
  });
  const set = (k: keyof typeof v, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const slug = groups.find((g) => g.id === v.group_id)?.slug;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const base = { full_name: v.full_name.trim(), avatar_url: v.avatar_url.trim() || null };
    const payload = adminMode
      ? { ...base, email: v.email.trim().toLowerCase(), group_id: v.group_id || null, role_title: v.role_title.trim() || null, is_admin: v.is_admin, active: v.active }
      : base;
    const { error } = profile
      ? await supabase.from("profiles").update(payload).eq("id", profile.id)
      : await supabase.from("profiles").insert(payload);
    if (error) return toast("error", error.code === "23505" ? t("errors.emailTaken") : t("errors.save"));
    toast("ok", t("saved"));
    onSaved();
  }

  return (
    <Modal title={profile ? t("editTitle", { name: profile.full_name }) : t("addMember")} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <label className="block"><span className="mb-1.5 block text-sm font-medium">{t("fields.name")}</span>
          <input required value={v.full_name} onChange={(e) => set("full_name", e.target.value)} className="input" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium">{t("fields.photo")}</span>
          <input type="url" value={v.avatar_url} onChange={(e) => set("avatar_url", e.target.value)} placeholder="https://…" className="input" /></label>
        {adminMode && (
          <>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">{t("fields.email")}</span>
              <input required type="email" value={v.email} onChange={(e) => set("email", e.target.value)} className="input" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">{t("fields.group")}</span>
              <select value={v.group_id} onChange={(e) => set("group_id", e.target.value)} className="input">
                <option value="">{t("noGroup")}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.emoji} {tg(g.slug)}</option>)}
              </select></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">{t("fields.role")}</span>
              <input list="role-options" value={v.role_title} onChange={(e) => set("role_title", e.target.value)} placeholder={t("roleTbd")} className="input" />
              <datalist id="role-options">{(slug ? ROLES[slug] : Object.values(ROLES).flat()).map((r) => <option key={r} value={r} />)}</datalist>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.is_admin} onChange={(e) => set("is_admin", e.target.checked)} /> {t("fields.isAdmin")}</label>
            <p className="-mt-2 text-xs text-muted">{t("adminHint")}</p>
            {profile && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} /> {t("fields.active")}</label>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted hover:text-ink">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
