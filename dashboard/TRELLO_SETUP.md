# Trello sync (optional, off by default)

The task boards are built into emet HQ, so **you don't need Trello at all**. This is only for a group that wants to work in the Trello app and see the same cards in the dashboard.

## Why the boards aren't in Trello by default

Trello's **free plan allows only 10 collaborators per workspace**. emet has 15 people, so a free company-wide board in Trello isn't possible. A single group's board (2–5 people) fits easily.

## What the sync does

When a team leader switches it on for a board:

- **Trello → dashboard:** any change in Trello (new card, moved, renamed, due date, members) reaches the dashboard within seconds, through a Trello webhook. A backup sync also runs every night at 03:00.
- **Dashboard → Trello:** adding, moving, editing or deleting a card in the dashboard updates Trello.
- Lists are matched by name first (*To do / Doing / Review / Done*). Lists that exist only in Trello are added to the dashboard board.
- Assignees sync for people you've matched on the mapping screen (see step 4).
- Checklists and comments stay in the dashboard only.

Everything uses Trello's free API. No paid plan or Power-Up subscription is needed.

## Set it up (one time, about 10 minutes)

1. **Get a Trello API key.** Logged into Trello, go to <https://trello.com/power-ups/admin> → **New** → name it `emet HQ`, workspace: yours, Iframe connector URL: your dashboard link → **Create**. Open it → **API key** → **Generate a new API key**. Copy the **API key** and the **Secret**.
2. **Get a token.** On the same page, click the **Token** link next to the key → **Allow**. Copy the token. It acts as the Trello account that clicked Allow, so use an account that's a member of the boards you'll link.
3. **Add them to Vercel** (Project → Settings → Environment Variables), then **Redeploy**:

   | Name | Value |
   |---|---|
   | `TRELLO_KEY` | the API key |
   | `TRELLO_TOKEN` | the token |
   | `TRELLO_SECRET` | the secret (used to check webhook calls really come from Trello) |
   | `CRON_SECRET` | any long random text (protects the nightly sync) |

   Never put these in GitHub.
4. **Link a board.** In the dashboard, open a board (as a team leader) → **Trello sync** at the bottom → paste the Trello board link → **On**. Then match each Trello username to a team member so assignees sync.

To stop: **Trello sync → Off**. The cards stay in the dashboard.

## Good to know

- If Trello can't be reached, dashboard changes are still saved. Cards that didn't reach Trello are sent at the next sync.
- If the same card is changed in both places at nearly the same moment, Trello's version wins at the next sync.
- Trello's API limit (100 requests per 10 seconds per token) is far above what 15 people will use.
