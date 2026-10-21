"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { ProjectIcon } from "./project-icon";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import type { Member } from "@/lib/boards";
import type { Project } from "./project-page";

const COLORS = ["#ff7a2e", "#ffc23d", "#3fb67f", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#ef4444"];

/** Leaders: create or edit a project and choose its people. A new project gets its own task board (To do / Doing / Done). */
export function ProjectForm({ project, people, onClose }: { project?: Project & { memberIds: string[] }; people: Member[]; onClose: () => void }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState({
    name: project?.name ?? "", description: project?.description ?? "", goal: project?.goal != null ? String(project.goal) : "",
    starts_on: project?.starts_on ?? "", ends_on: project?.ends_on ?? "", status: project?.status ?? "planning", color: project?.color ?? COLORS[0],
  });
  const [chosen, setChosen] = useState<Set<string>>(new Set(project?.memberIds ?? []));
  // Icon: a photo (≤ 2 MB) shown on the project's cards and page
  const [icon, setIcon] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(project?.icon_url ?? null);
  const [dropIcon, setDropIcon] = useState(false);
  function pickIcon(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("error", t("iconType"));
    if (file.size > 2 * 1024 * 1024) return toast("error", t("iconBig"));
    setIcon(file); setDropIcon(false); setPreview(URL.createObjectURL(file));
  }
  async function saveIcon(id: string) {
    const old = project?.icon_path ?? null;
    if (icon) {
      const path = `${id}/icon/${crypto.randomUUID()}.${(icon.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png"}`;
      const up = await supabase.storage.from("projects").upload(path, icon, { contentType: icon.type });
      if (up.error) return false;
      if ((await supabase.from("projects").update({ icon_path: path }).eq("id", id)).error) return false;
      if (old) await supabase.storage.from("projects").remove([old]);
    } else if (dropIcon && old) {
      await supabase.from("projects").update({ icon_path: null }).eq("id", id);
      await supabase.storage.from("projects").remove([old]);
    }
    return true;
  }
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    const row = { name: f.name.trim(), description: f.description.trim() || null, goal: f.goal ? Number(f.goal) : null,
                  starts_on: f.starts_on || null, ends_on: f.ends_on || null, status: f.status, color: f.color };
    let id = project?.id;
    if (id) {
      const { error } = await supabase.from("projects").update(row).eq("id", id);
      if (error) return fail();
      const before = new Set(project!.memberIds);
      const add = [...chosen].filter((x) => !before.has(x)), drop = [...before].filter((x) => !chosen.has(x));
      if (add.length && (await supabase.from("project_members").insert(add.map((user_id) => ({ project_id: id, user_id })))).error) return fail();
      if (drop.length && (await supabase.from("project_members").delete().eq("project_id", id).in("user_id", drop)).error) return fail();
      if (row.name !== project!.name) await supabase.from("boards").update({ name: row.name }).eq("project_id", id);
    } else {
      const made = await supabase.from("projects").insert(row).select("id").single();
      if (made.error) return fail();
      id = made.data.id as string;
      const board = await supabase.from("boards").insert({ slug: `project-${id}`, name: row.name, project_id: id }).select("id").single();
      if (board.error) return fail();
      if ((await supabase.from("board_lists").insert([t("lists.todo"), t("lists.doing"), t("lists.done")].map((name, position) => ({ board_id: board.data.id, name, position })))).error) return fail();
      if (chosen.size && (await supabase.from("project_members").insert([...chosen].map((user_id) => ({ project_id: id, user_id })))).error) return fail();
    }
    if (!(await saveIcon(id!))) toast("error", t("iconError"));
    setBusy(false);
    onClose();
    if (project) router.refresh(); else router.push(`/projects/${id}`);
  }
  function fail() { setBusy(false); toast("error", t("error")); }

  const field = "input w-full";
  // Portal to <body>: inside a glass card (backdrop blur) a fixed overlay gets trapped under the top bar
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={project ? t("edit") : t("new")}>
      <button className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label={t("cancel")} onClick={onClose} />
      <form onSubmit={save} className="relative max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl bg-solid p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold">{project ? t("edit") : t("new")}</h2>
          <button type="button" onClick={onClose} aria-label={t("cancel")} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-3">
          <ProjectIcon url={preview} color={f.color} name={f.name || "?"} size={56} />
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line">
            <ImagePlus size={15} /> {preview ? t("iconChange") : t("iconUpload")}
            <input type="file" accept="image/*" hidden onChange={(e) => { pickIcon(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {preview && <button type="button" onClick={() => { setIcon(null); setPreview(null); setDropIcon(true); }} aria-label={t("iconRemove")} title={t("iconRemove")}
                              className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={15} /></button>}
        </div>
        <label className="block"><span className="mb-1 block text-sm font-medium">{t("form.name")}</span><input required maxLength={80} value={f.name} onChange={set("name")} className={field} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">{t("form.description")}</span><textarea rows={2} value={f.description} onChange={set("description")} className={field} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("form.goal")}</span><input type="number" min={0} step="1" inputMode="decimal" value={f.goal} onChange={set("goal")} className={field} placeholder="2000" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("form.start")}</span><input type="date" value={f.starts_on} onChange={set("starts_on")} className={field} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("form.end")}</span><input type="date" value={f.ends_on} onChange={set("ends_on")} className={field} /></label>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("form.status")}</span>
            <select value={f.status} onChange={set("status")} className={field}>{(["planning", "live", "closed"] as const).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></label>
          <fieldset><legend className="mb-1 text-sm font-medium">{t("form.color")}</legend>
            <div className="flex gap-1.5">{COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, color: c })} aria-label={c} aria-pressed={f.color === c}
                      className={`size-7 rounded-full ${f.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-solid" : ""}`} style={{ background: c }} />
            ))}</div></fieldset>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t("form.people", { n: chosen.size })}</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl bg-surface-2/60 p-2 sm:grid-cols-2">
            {people.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={chosen.has(p.id)} onChange={(e) => { const n = new Set(chosen); if (e.target.checked) n.add(p.id); else n.delete(p.id); setChosen(n); }} />
                <Avatar name={p.full_name} src={p.avatar_url} size={22} /> <span className="truncate">{p.full_name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button disabled={busy || !f.name.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-semibold text-brand-contrast disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />}{project ? t("save") : t("create")}
        </button>
      </form>
    </div>
  , document.body);
}
