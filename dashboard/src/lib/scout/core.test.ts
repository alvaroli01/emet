import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreOf, fitOf, normalizeJudgement, fingerprint, domainOf, parseMapsLink, overpassQuery, placesFromOsm, researchOrder, unitEconomics } from "./core.ts";

test("score is weighted, unknown criteria count against the lead (2026-10-21: 3, was the middle 5)", () => {
  assert.equal(scoreOf([]), 30);
  assert.equal(scoreOf(["need", "fit", "ability_to_pay", "reachability", "timing", "value_vs_effort", "low_risk"].map((key) => ({ key, score: 10 }))), 100);
  assert.equal(scoreOf([{ key: "need", score: 10 }]), 48); // 0.25*10 + 0.75*3 = 4.75
});

test("fit bands and deal-breakers", () => {
  assert.equal(fitOf(80, false), "strong");
  assert.equal(fitOf(60, false), "good");
  assert.equal(fitOf(50, false), "maybe");
  assert.equal(fitOf(30, false), "skip");
  assert.equal(fitOf(95, true), "skip");
});

test("judgement: app computes score, drops approach for weak fits", () => {
  const strong = normalizeJudgement({ criteria: [{ key: "need", score: 9, why: "no booking", source: "https://bar.es" }, { key: "fit", score: 9 }, { key: "ability_to_pay", score: 8, source: "https://bar.es/menu" }, { key: "reachability", score: 9 }, { key: "timing", score: 8, source: "https://bar.es/news" }, { key: "value_vs_effort", score: 8 }, { key: "low_risk", score: 9 }],
    approach: { channel: "visit", opener: "Hola…", objections: [{ objection: "no time", answer: "we do it" }] }, signals: [{ text: "4.6★", url: "javascript:x" }] })!;
  assert.equal(strong.fit, "strong");
  assert.equal(strong.worth_it, true);
  assert.equal(strong.approach?.channel, "visit");
  assert.equal(strong.signals[0].url, undefined); // only http(s) links survive
  const weak = normalizeJudgement({ criteria: [{ key: "need", score: 2 }], deal_breaker: "chain run from HQ", approach: { opener: "x" } })!;
  assert.equal(weak.fit, "skip");
  assert.equal(weak.worth_it, false);
  assert.equal(weak.approach, null);
  assert.equal(normalizeJudgement({}), null);
  assert.equal(normalizeJudgement({ criteria: [{ key: "need", score: 9 }], deal_breaker: "null" })!.dealBreaker, null);
});

test("fingerprint: same shop found twice gets the same key", () => {
  assert.equal(fingerprint({ name: "Café Iruña", lat: 43.26312, lng: -2.93451 }), fingerprint({ name: "cafe iruna", lat: 43.2629, lng: -2.9348 }));
  assert.equal(fingerprint({ name: "X", website: "https://www.shop.es/about" }), "d:shop.es");
  assert.equal(domainOf("instagram.com/shop"), null);
});

test("Google Maps links are read without fetching Google", () => {
  const p = parseMapsLink("https://www.google.com/maps/place/Caf%C3%A9+Iru%C3%B1a/@43.2630,-2.9345,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d43.2631!4d-2.9341")!;
  assert.equal(p.name, "Café Iruña");
  assert.equal(p.lat, 43.2631);
  assert.equal(p.lng, -2.9341);
  assert.equal(parseMapsLink("https://www.google.com/maps/search/?api=1&query=Bar+Pepe")!.name, "Bar Pepe");
  assert.equal(parseMapsLink("https://example.com/maps/place/x"), null);
});

test("overpass query: main business keys only, one filter per key, bounding box", () => {
  const q = overpassQuery(["amenity=cafe", "amenity=bar", "shop=*", "cuisine=brunch", 'x"];out;'], 43.26, -2.93, 2);
  assert.match(q, /nwr\["amenity"~"\^\(cafe\|bar\)\$"\]\["name"\]\(43\.24198,-2.95/);
  assert.match(q, /nwr\["shop"\]\["name"\]/);
  assert.doesNotMatch(q, /cuisine|out;"/);
});

test("OSM elements become business places; research order prefers evidence", () => {
  const ps = placesFromOsm([
    { type: "node", id: 1, lat: 43.3, lon: -2.9, tags: { name: "Far w/ site", amenity: "cafe", website: "a.es" } },
    { type: "way", id: 2, center: { lat: 43.26, lon: -2.93 }, tags: { name: "Near", shop: "bakery", "contact:instagram": "@near" } },
    { type: "node", id: 3, lat: 43.26, lon: -2.93, tags: { amenity: "cafe" } },
  ]);
  assert.equal(ps.length, 2);
  assert.equal(ps[1].instagram, "https://instagram.com/near");
  assert.equal(ps[0].category, "amenity=cafe");
  const ordered = researchOrder([...ps, { ...ps[0], name: "none", website: null, instagram: null }], 43.26, -2.93);
  assert.equal(ordered[0].name, "Near");
  assert.equal(ordered[2].name, "none");
});

test("unit economics: break-even ROAS and CPA", () => {
  const u = unitEconomics("€25", "€8,50")!;
  assert.equal(u.fees, 0.75);
  assert.equal(u.profit, 15.75);
  assert.equal(u.breakEvenRoas, 1.59);
  assert.equal(unitEconomics("free", "€1"), null);
  assert.equal(unitEconomics("€1.200", "€300")!.price, 1200);
});

// ── Scout v2 phase 1 (2026-10-21): accuracy, exact links, relevance filter, enrichment, Open Places ──
import { evidenceLevel, applyEvidence, mapsLink, parseRelevance, keepRealLinks, placesFromOpenPlaces, verifyWebPlaces } from "./core.ts";

test("unknown criteria count against the lead (3, not 5)", () => {
  assert.equal(scoreOf([]), 30);
  const j = normalizeJudgement({ criteria: [{ key: "need", score: 9, why: "x" }] })!;
  assert.equal(j.criteria.find((c) => c.key === "fit")!.score, 3);
});

test("evidence level: strong / some / little", () => {
  assert.equal(evidenceLevel(2, 3), "strong");
  assert.equal(evidenceLevel(1, 0), "some");
  assert.equal(evidenceLevel(0, 2), "some");
  assert.equal(evidenceLevel(0, 1), "little");
});

test("little evidence caps the lead at 'maybe' and not worth it", () => {
  assert.deepEqual(applyEvidence({ fit: "strong", worth_it: true }, "little"), { fit: "maybe", worth_it: false });
  assert.deepEqual(applyEvidence({ fit: "skip", worth_it: false }, "little"), { fit: "skip", worth_it: false });
  assert.deepEqual(applyEvidence({ fit: "strong", worth_it: true }, "some"), { fit: "strong", worth_it: true });
});

test("maps link: saved Google link, else the exact spot, else a search", () => {
  assert.equal(mapsLink({ name: "Bar Pepe", maps_url: "https://maps.app.goo.gl/abc", lat: 1, lng: 2, address: null, city: null }), "https://maps.app.goo.gl/abc");
  assert.equal(mapsLink({ name: "Bar Pepe", maps_url: null, lat: 43.26312, lng: -2.93451, address: null, city: "Bilbao" }),
    "https://www.google.com/maps/place/Bar%20Pepe/@43.26312,-2.93451,19z");
  assert.equal(mapsLink({ name: "Bar Pepe", maps_url: null, lat: null, lng: null, address: "Calle Mayor 1", city: "Bilbao" }),
    "https://www.google.com/maps/search/?api=1&query=Bar%20Pepe%2C%20Calle%20Mayor%201");
});

test("relevance reply: keeps listed matches, reasons for the rest, ignores junk", () => {
  const r = parseRelevance({ match: [0, 2, 9, "x"], not_match: [{ n: 1, why: "pharmacy, not a café" }] }, 3);
  assert.deepEqual([...r.keep].sort(), [0, 2]);
  assert.equal(r.reasons.get(1), "pharmacy, not a café");
  // nothing understandable → keep everyone (never drop places because the AI failed)
  assert.equal(parseRelevance(null, 3).keep.size, 3);
});

test("enrichment keeps only links that really appeared in the search, and real phone numbers", () => {
  const results = ["https://www.barpepe.es/", "https://www.instagram.com/barpepe/", "https://www.google.com/maps/place/Bar+Pepe/@43.2,-2.9,17z"];
  const got = keepRealLinks({ official_website: "https://barpepe.es", instagram: "https://instagram.com/barpepe", google_maps_url: "https://www.google.com/maps/place/Bar+Pepe/@43.2,-2.9,17z", phone: "+34 944 12 34 56" },
    results, "Phone: +34 944 12 34 56. Open daily.");
  assert.equal(got.website, "https://www.barpepe.es/");
  assert.equal(got.instagram, "https://www.instagram.com/barpepe/");
  assert.ok(got.maps_url?.startsWith("https://www.google.com/maps/place/"));
  assert.equal(got.phone, "+34 944 12 34 56");
  const fake = keepRealLinks({ official_website: "https://invented.example", phone: "123" }, results, "no phone here");
  assert.equal(fake.website, null);
  assert.equal(fake.phone, null);
});

test("Open Places results become places; closed ones are skipped", () => {
  const got = placesFromOpenPlaces([
    { place_id: "abc", name: "Café Iruña", lat: 43.26, lon: -2.93, distance_mi: 0.2, categories: ["cafe", "bar"], address: { street: "Colón de Larreátegui 13", locality: "Bilbao" }, phone: "+34944237021", website: "https://cafeirunabilbao.net", confidence: 0.92 },
    { place_id: "def", name: "Old Shop", lat: 43.2, lon: -2.9, distance_mi: 1, categories: ["shop"], address: { formatted: "X 1" }, confidence: 0.8, operating_status: "permanently_closed" },
  ]);
  assert.equal(got.length, 1);
  assert.equal(got[0].name, "Café Iruña");
  assert.equal(got[0].category, "cafe");
  assert.equal(got[0].address, "Colón de Larreátegui 13, Bilbao");
  assert.equal(got[0].osm_id, "ovt:abc");
});

test("web-found places are kept only if the search really returned them (no invented bars)", () => {
  const results = [
    { title: "Café Iruña Bilbao – Restaurante histórico", url: "https://www.cafeirunabilbao.net/" },
    { title: "Bar Bertoldo (@barbertoldo) • Instagram", url: "https://www.instagram.com/barbertoldo/" },
  ];
  const got = verifyWebPlaces([
    { name: "Café Iruña", website: "https://cafeirunabilbao.net", instagram: null, address: "Jardines de Albia" },
    { name: "Bar Bertoldo", website: null, instagram: "https://instagram.com/barbertoldo", address: null },
    { name: "Bar Javi", website: null, instagram: null, address: "Calle Javi, 7" },          // invented: nothing in results
    { name: "Bar Xaman", website: "https://barxaman.es", instagram: null, address: null },    // invented link
  ], results);
  assert.deepEqual(got.map((p) => p.name), ["Café Iruña", "Bar Bertoldo"]);
  assert.equal(got[0].website, "https://www.cafeirunabilbao.net/");
});

import { JUDGE_MODELS, RELEVANCE_MODELS } from "./models.ts";
test("the final score only ever comes from the strongest models", () => {
  assert.deepEqual(JUDGE_MODELS, ["openai/gpt-oss-120b", "mistral/mistral-medium-latest"]);
  assert.equal(RELEVANCE_MODELS.at(-1), "mistral/mistral-small-latest");
});

test("accuracy: a high score needs evidence — thin evidence can't show more than 'maybe'", async () => {
  const { scoreWithEvidence } = await import("./core.ts");
  assert.equal(scoreWithEvidence(82, "strong"), 82);
  assert.equal(scoreWithEvidence(82, "some"), 82);
  assert.equal(scoreWithEvidence(82, "little"), 59);
  assert.equal(scoreWithEvidence(82, "none"), 44);
  assert.equal(scoreWithEvidence(30, "little"), 30);
});

test("accuracy: need, ability to pay and timing can't score above 6 without a source", async () => {
  const { normalizeJudgement } = await import("./core.ts");
  const j = normalizeJudgement({ criteria: [
    { key: "need", score: 9, why: "x" }, { key: "ability_to_pay", score: 9, why: "x", source: "https://a.es" },
    { key: "timing", score: 8, why: "x", source: "null" }, { key: "fit", score: 9, why: "x" },
  ] })!;
  const s = (k: string) => j.criteria.find((c) => c.key === k)!.score;
  assert.equal(s("need"), 6);
  assert.equal(s("ability_to_pay"), 9);
  assert.equal(s("timing"), 6);
  assert.equal(s("fit"), 9); // judged from the kind of place, no link needed
});

test("learning: outcomes of visited / closed leads", async () => {
  const { outcomeOf, pastOutcomes, trackRecord } = await import("./core.ts");
  assert.equal(outcomeOf({ visit_result: "yes", status: "new" }), "yes");
  assert.equal(outcomeOf({ visit_result: "no", status: "new" }), "no");
  assert.equal(outcomeOf({ visit_result: null, status: "won" }), "yes");
  assert.equal(outcomeOf({ visit_result: null, status: "lost" }), "no");
  assert.equal(outcomeOf({ visit_result: "maybe", status: "new" }), "maybe");
  assert.equal(outcomeOf({ visit_result: null, status: "contacted" }), null);

  const rows = [
    { name: "Bar A", score: 82, fit: "strong", visit_result: "yes", status: "new", visit_note: "wants 20" },
    { name: "Bar B", score: 78, fit: "strong", visit_result: "no", status: "new", visit_note: "has a supplier" },
    { name: "Bar C", score: 40, fit: "skip", visit_result: null, status: "won", visit_note: null },
    { name: "Bar D", score: 65, fit: "good", visit_result: null, status: "new", visit_note: null },
  ];
  const lines = pastOutcomes(rows);
  assert.equal(lines.length, 3);
  assert.match(lines[1], /Bar B.*78.*NO.*has a supplier/);
  assert.deepEqual(trackRecord(rows), { rated: 2, yes: 1, missed: 1 }); // 2 rated good/strong & decided, 1 said yes; 1 rated skip but won
});

test("the verdict keeps one checked hook (the reason to contact today)", async () => {
  const { normalizeJudgement } = await import("./core.ts");
  const j = normalizeJudgement({ criteria: [{ key: "need", score: 5 }], hook: { kind: "hiring", text: "Buscan camarero", url: "https://bar.es/empleo" } })!;
  assert.deepEqual(j.hook, { kind: "hiring", text: "Buscan camarero", url: "https://bar.es/empleo" });
  assert.equal(normalizeJudgement({ criteria: [{ key: "need", score: 5 }] })!.hook, null);
});
