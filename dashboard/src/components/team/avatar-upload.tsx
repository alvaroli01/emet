"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

/** Square 512 px JPEG, cropped from the middle — phone photos (5+ MB) become ~60 KB. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/jpeg", 0.85));
}

/** "Change photo" on a profile: the person themselves or an admin. */
export function AvatarUpload({ profileId, current }: { profileId: string; current: string | null }) {
  const t = useTranslations("member");
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const supabase = createClient();
    const path = `${profileId}/${Date.now()}.jpg`;
    try {
      const up = await supabase.storage.from("avatars").upload(path, await shrink(file), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profileId);
      if (error) { await supabase.storage.from("avatars").remove([path]); throw error; }
      // Old photo out of the bucket (only ones we stored, not e.g. a Google picture)
      const old = current?.split("/storage/v1/object/public/avatars/")[1];
      if (old) await supabase.storage.from("avatars").remove([decodeURIComponent(old)]);
      toast("ok", t("photoSaved"));
      router.refresh();
    } catch {
      toast("error", t("photoError"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className="glass absolute right-3 top-3 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium disabled:opacity-60">
        <Camera size={15} /> {busy ? t("photoSaving") : t("changePhoto")}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </>
  );
}
