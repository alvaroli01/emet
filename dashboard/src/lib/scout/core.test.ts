import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreOf, fitOf, normalizeJudgement, fingerprint, domainOf, parseMapsLink, overpassQuery, placesFromOsm, researchOrder, unitEconomics } from "./core.ts";

test("score is weighted, unknown criteria count as the middle", () => {
  assert.equal(scoreOf([]), 50);
  assert.equal(scoreOf(["need", "fit", "ability_to_pay", "reachability", "timing", "value_vs_effort", "low_risk"].map((key) => ({ key, score: 10 }))), 100);
  assert.equal(scoreOf([{ key: "need", score: 10 }]), 63); // 0.25*10 + 0.75*5 = 6.25
});

test("fit bands and deal-breakers", () => {
  assert.equal(fitOf(80, false), "strong");
  assert.equal(fitOf(60, false), "good");
  assert.equal(fitOf(50, false), "maybe");
  assert.equal(fitOf(30, false), "skip");
  assert.equal(fitOf(95, true), "skip");
});

test("judgement: app computes score, drops approach for weak fits", () => {
  const strong = normalizeJudgement({ criteria: [{ key: "need", score: 9, why: "no booking" }, { key: "fit", score: 9 }, { key: "ability_to_pay", score: 8 }, { key: "reachability", score: 9 }, { key: "timing", score: 8 }, { key: "value_vs_effort", score: 8 }, { key: "low_risk", score: 9 }],
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
