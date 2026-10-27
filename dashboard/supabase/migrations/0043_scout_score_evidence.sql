-- Scout accuracy (Alvaro, 2026-10-27): a lead's score now agrees with its evidence (see scoreWithEvidence in
-- src/lib/scout/core.ts). Apply the same caps to leads judged before: little evidence ≤ 59 ("maybe"), none ≤ 44.
update public.scout_leads set score = 59 where evidence = 'little' and score > 59;
update public.scout_leads set score = 44 where evidence = 'none' and score > 44;
