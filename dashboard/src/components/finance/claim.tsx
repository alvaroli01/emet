"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ReceiptText, Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { METHODS } from "@/lib/finance";

/** Shrinks a photo on the device (max 1600 px, JPEG) so receipts stay small in the free storage. PDFs pass through. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.72));
}

/** Uploads to the private receipts bucket under the uploader's own folder; returns the storage path. */
export async function uploadReceipt(supabase: ReturnType<typeof createClient>, file: File): Promise<string | null> {
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return null;
  const blob = await compressImage(file);
  const ext = blob.type === "application/pdf" ? "pdf" : "jpg";
  const path = `${me}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: blob.type || "image/jpeg" });
  return error ? null : path;
}

export function ReceiptInput({ file, onFile, label }: { file: File | null; onFile: (f: File | null) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted hover:text-ink">
      <Camera size={16} /> <span className="flex-1 truncate">{file ? file.name : label}</span>
      <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/** "I paid for something": any member submits an expense claim with a receipt; Finance approves it. */
export function ClaimButton({ projects, categories }: { projects: { id: string; name: string }[]; categories: { value: string; label: string }[] }) {
  const t = useTranslations("finance.claims");
  const tm = useTranslations("finance.ledgers.methods");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [v, setV] = useState({ amount: "", description: "", category: "other", payment_method: "cash", project_id: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const receipt_path = file ? await uploadReceipt(supabase, file) : null;
    if (file && !receipt_path) { setBusy(false); return toast("error", t("receiptError")); }
    const { error } = await supabase.from("expense_claims").insert({ amount: Number(v.amount), description: v.description.trim(), category: v.category,
      payment_method: v.payment_method, project_id: v.project_id || null, receipt_path });
    setBusy(false);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("submitted")); setOpen(false); setFile(null); setV({ ...v, amount: "", description: "" }); router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line">
        <ReceiptText size={15} /> {t("button")}
      </button>
      {open && (
        <Modal title={t("title")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-muted">{t("hint")}</p>
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <input required type="number" min="0.01" step="0.01" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="€" aria-label={t("amount")} className="input readout text-lg" />
              <input required value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder={t("what")} aria-label={t("what")} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} className="input" aria-label={t("category")}>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              <select value={v.payment_method} onChange={(e) => setV({ ...v, payment_method: e.target.value })} className="input" aria-label={t("method")}>{METHODS.map((m) => <option key={m} value={m}>{tm(m)}</option>)}</select>
            </div>
            <select value={v.project_id} onChange={(e) => setV({ ...v, project_id: e.target.value })} className="input" aria-label={t("project")}>
              <option value="">{t("general")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ReceiptInput file={file} onFile={setFile} label={t("receipt")} />
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-contrast disabled:opacity-60">
              {busy && <Loader2 size={15} className="animate-spin" />}{t("submit")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
