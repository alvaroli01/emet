"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Copy, QrCode, Plus, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { pct, num } from "@/lib/format";
import { disagreement, type SaleAttr } from "@/lib/marketing";
import { Panel, Empty, MetricCard } from "@/components/finance/overview";

export type GoLink = { id: string; slug: string; destination: string; label: string | null; utm_source: string; utm_medium: string; utm_campaign: string | null; created_at: string };

/** Funnel (last 30 days): views → profile visits → link clicks → DM inquiries → orders. Each step shows how many made it to the next. */
export function Funnel({ steps }: { steps: { key: string; value: number }[] }) {
  const t = useTranslations("marketing.attribution");
  const locale = useLocale();
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s.key}>
          <div className="mb-0.5 flex justify-between text-sm"><span>{t(`funnel.${s.key}`)}</span><span className="readout">{num(s.value, locale)}</span></div>
          <div className="h-6 overflow-hidden rounded-lg bg-surface-2"><div className="h-full rounded-lg bg-series-1" style={{ width: `${Math.max(1.5, (s.value / max) * 100)}%`, opacity: 1 - i * 0.13 }} /></div>
          {i < steps.length - 1 && <p className="mt-0.5 text-right text-[11px] text-muted">↓ {s.value ? pct(steps[i + 1].value / s.value, locale) : "—"}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Attribution({ links, clicks, sales, codeChannel, funnel, canEdit, origin }: {
  links: GoLink[]; clicks: Record<string, { total: number; week: number }>; sales: SaleAttr[]; codeChannel: Record<string, string>;
  funnel: { key: string; value: number }[]; canEdit: boolean; origin: string;
}) {
  const t = useTranslations("marketing.attribution");
  const locale = useLocale();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [qr, setQr] = useState<{ slug: string; src: string } | null>(null);
  const dis = disagreement(sales, codeChannel);
  const withHeard = sales.filter((s) => s.heard_about).length;
  const url = (slug: string) => `${origin}/go/${slug}`;

  async function showQr(slug: string) {
    const QR = await import("qrcode");
    setQr({ slug, src: await QR.toDataURL(url(slug), { width: 512, margin: 2 }) });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label={t("agreement")} value={dis === null ? "—" : pct(1 - dis, locale)} explain={t("agreementExplain")} tone={dis === null ? undefined : dis <= 0.2 ? "ok" : "warn"} />
        <MetricCard label={t("surveyed")} value={pct(sales.length ? withHeard / sales.length : null, locale)} explain={t("surveyedExplain")} />
        <MetricCard label={t("clicks7")} value={num(Object.values(clicks).reduce((a, c) => a + c.week, 0), locale)} explain={t("clicks7Explain")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("funnelTitle")}>{funnel.some((s) => s.value) ? <Funnel steps={funnel} /> : <Empty text={t("funnelEmpty")} />}</Panel>
        <Panel title={t("links")} action={canEdit && <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-brand-contrast"><Plus size={13} /> {t("newLink")}</button>}>
          {links.length ? (
            <ul className="divide-y divide-line">
              {links.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.label || l.slug}</p>
                    <p className="truncate text-xs text-muted">/go/{l.slug} → {l.destination.replace(/^https?:\/\//, "")}</p>
                  </div>
                  <span className="readout shrink-0 text-right text-xs" title={t("clicksTitle")}>{clicks[l.id]?.total ?? 0}<span className="block text-[10px] font-normal text-muted">{t("clicks")}</span></span>
                  <button onClick={() => { navigator.clipboard.writeText(url(l.slug)); toast("ok", t("copied")); }} aria-label={t("copy")} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"><Copy size={15} /></button>
                  <button onClick={() => showQr(l.slug)} aria-label={t("qr")} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"><QrCode size={15} /></button>
                </li>
              ))}
            </ul>
          ) : <Empty text={t("noLinks")} />}
        </Panel>
      </div>
      {adding && <LinkForm onClose={() => setAdding(false)} />}
      {qr && (
        <Modal title={`/go/${qr.slug}`} onClose={() => setQr(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.src} alt={t("qrAlt", { slug: qr.slug })} className="mx-auto w-64 rounded-xl bg-white p-2" />
          <p className="mt-2 text-center text-xs text-muted">{t("qrHint")}</p>
          <a href={qr.src} download={`emet-${qr.slug}.png`} className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast"><Download size={15} /> {t("download")}</a>
        </Modal>
      )}
    </div>
  );
}

function LinkForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("marketing.attribution");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState({ slug: "", destination: "", label: "", utm_source: "instagram", utm_medium: "social", utm_campaign: "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const slug = v.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("go_links").insert({ ...v, slug, label: v.label.trim() || null, utm_campaign: v.utm_campaign.trim() || null, destination: /^https?:\/\//i.test(v.destination.trim()) ? v.destination.trim() : `https://${v.destination.trim()}` });
    if (error) return toast("error", error.code === "23505" ? t("slugTaken") : t("saveError"));
    toast("ok", t("saved")); onClose(); router.refresh();
  }
  const f = (k: keyof typeof v, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="block"><span className="mb-0.5 block text-xs text-muted">{t(`f.${k}`)}</span>
    <input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="input" {...extra} /></label>;
  return (
    <Modal title={t("newLink")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {f("label", { placeholder: t("ph.label"), autoFocus: true })}
        {f("slug", { required: true, pattern: "[a-zA-Z0-9-]{2,40}", placeholder: "bio-oct" })}
        {f("destination", { required: true, inputMode: "url", placeholder: "shop.example.com/tote" })}
        <div className="grid grid-cols-3 gap-2">{f("utm_source")}{f("utm_medium")}{f("utm_campaign")}</div>
        <p className="text-xs text-muted">{t("utmHint")}</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button></div>
      </form>
    </Modal>
  );
}
