// Short sales playbooks per kind of business. The plan step picks the closest one; the judge step follows it.
// Kept as compact rules so a small model can apply them to any niche.

export const PLAYBOOKS = {
  b2b_service: "Selling a service to businesses. Decision-maker = owner/manager. Win with a free sample or audit that shows the gap (e.g. redo 1 post, 1 page). Visit or call off-peak; follow up in 3 days. Price per month or per project.",
  wholesale_retail: "Selling products for shops to stock. Ask for the owner/buyer. Bring samples, a 1-page price sheet with their margin, and offer consignment or a small first order. Best: weekday mornings, never Saturdays.",
  consignment: "Placing our products in their space for a % of sales. Low risk for them: lead with 'you pay nothing until it sells', a small display, and weekly restock. Target places with foot traffic and matching customers.",
  partnership_events: "Co-hosting events, sponsorships or cross-promotion. Lead with the audience we bring (numbers), a concrete date and a shared benefit. Contact the events/marketing person by Instagram DM or email with consent rules in mind.",
  local_services: "Hairdressers, gyms, clinics, repair shops, studios. Owners are busy: visit during quiet hours (opening or early afternoon), keep it under 2 minutes, leave something physical. Proof from a similar local business wins.",
  hospitality: "Cafés, bars, restaurants, hotels. Never visit during meal rush (Spain: 13:30–16:00, 20:30–23:00). Ask for the owner or manager; tie the offer to more covers or higher ticket. Instagram is often their main channel.",
  education: "Schools, academies, language centres, university clubs. Decision cycles are slow and tied to terms; contact the director/coordinator by phone or email well before term starts; bring a pilot proposal.",
  health_beauty: "Salons, clinics, physios, spas. Bookings and reviews matter most; show how we fill empty slots or raise reviews. Respect privacy rules; no health claims.",
  real_estate: "Agencies, landlords, coworkings. Value = filling vacancies faster or better listings. Agents answer phones and WhatsApp quickly; show a before/after.",
  consumer_direct: "Selling to people directly (not businesses): the 'clients' are places where those people gather (campuses, clubs, venues). Treat venues as distribution partners.",
} as const;
export type PlaybookKey = keyof typeof PLAYBOOKS;
export const PLAYBOOK_KEYS = Object.keys(PLAYBOOKS) as PlaybookKey[];
