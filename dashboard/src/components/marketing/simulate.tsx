import { getTranslations } from "next-intl/server";
import { mirofishUrl } from "@/lib/mirofish";
import { SimulateFrame } from "./simulate-frame";

/** MiroFish (github.com/666ghj/MiroFish) running on our Azure VM (see mirofish-space/README.md), opened with a fresh signed pass. */
export async function Simulate() {
  const t = await getTranslations("marketing.simulate");
  const src = mirofishUrl();
  if (!src) return <section className="panel p-5 text-sm text-muted">{t("notSetUp")}</section>;
  return <SimulateFrame src={src} intro={t("intro")} open={t("open")} />;
}
