"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AtSign, Globe2, MapPin, Phone, Radar } from "lucide-react";
import { mapsLink } from "@/lib/scout/core";

export type ProjectLead = { id: string; score: number | null; fit: string | null; status: string; evidence: string | null; why: string | null; scout_project_id: string;
  place: { name: string; address: string | null; city: string | null; lat: number | null; lng: number | null; website: string | null; instagram: string | null; phone: string | null; maps_url: string | null } };

const FIT = { strong: "bg-ok/15 text-ok-text", good: "bg-[#3b82f6]/20 text-[#93c5fd]", maybe: "bg-warn/15 text-warn-text", skip: "bg-surface-2 text-muted" } as Record<string, string>;

/** Places found with Scout and saved to this project: who they are, how good a fit, and one tap to reach them. */
export function ProjectLeads({ leads }: { leads: ProjectLead[] }) {
  const t = useTranslations("projects.leads");
  const tf = useTranslations("scout.fit");
  const ts = useTranslations("scout.status");
  const chip = "inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs hover:bg-line";
  return (
    <section className="panel space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("hint")}</p>
        <Link href="/scout" className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line"><Radar size={15} /> {t("openScout")}</Link>
      </div>
      <ul className="divide-y divide-line/60 rounded-2xl bg-surface-2/40 ring-1 ring-line">
        {leads.map((l) => (
          <li key={l.id} className="space-y-1.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="readout w-9 text-lg font-semibold">{l.score ?? "—"}</span>
              <span className="min-w-0 flex-1"><Link href={`/scout?p=${l.scout_project_id}`} className="block truncate font-medium hover:text-link">{l.place.name}</Link>
                <span className="block truncate text-xs text-muted">{l.place.address ?? l.place.city}</span></span>
              {l.fit && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FIT[l.fit] ?? ""}`}>{tf(l.fit)}</span>}
              {l.status !== "new" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">{ts(l.status)}</span>}
            </div>
            {l.why && <p className="line-clamp-2 text-xs text-muted">{l.why}</p>}
            <div className="flex flex-wrap gap-1.5">
              <a href={mapsLink({ ...l.place })} target="_blank" rel="noopener noreferrer" className={chip}><MapPin size={12} /> Maps</a>
              {l.place.website && <a href={l.place.website} target="_blank" rel="noopener noreferrer" className={chip}><Globe2 size={12} /> Web</a>}
              {l.place.instagram && <a href={l.place.instagram} target="_blank" rel="noopener noreferrer" className={chip}><AtSign size={12} /> Instagram</a>}
              {l.place.phone && <a href={`tel:${l.place.phone.replace(/\s/g, "")}`} className={chip}><Phone size={12} /> {l.place.phone}</a>}
            </div>
          </li>
        ))}
        {!leads.length && <li className="p-6 text-center text-sm text-muted">{t("empty")}</li>}
      </ul>
    </section>
  );
}
