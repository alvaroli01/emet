# Design references for emet HQ

These are the pictures Alvaro used (14–15 Oct 2026) to design the dashboard. They used to live only on his laptop (`~/Desktop/ui example emet`). Now every teammate's Claude can see them when building new screens.

> ⚠️ **For reference only.** These are other people's designs (Dribbble-style shots and a stock image). Copy the *ideas* (layout, density, feel), never the images, logos, photos or text. Never put these files in `dashboard/public/` or ship them in the app.

## The shared look ("emet glass")

- **Dark, near-black canvas** with soft glass panels: rounded corners (~20–28px), a 1px light edge, a strong blur, and a dark photo behind on hero screens.
- **One warm accent (orange `#ff6a1a`)** for the main action, the active item and highlights. Everything else stays white and grey.
- **Big bold numbers, small grey labels**: a card shows a title, one big figure, a small change chip (+12%), and then a small chart.
- **Mini charts inside cards** (bars, lines, gauges, heatmaps), never big empty charts.
- **Thin icon rail or folding menu on the left**, pills or a search bar along the top, avatar top-right.
- **Calm motion**: flowing lines and fade-ins, with a still version for reduced motion.

## Picture → screen

| # | File | Used for | What to take from it |
|---|---|---|---|
| 1 | `1-home-today.png` | **Today** (home) | Full-bleed dark photo, centred "Hey, need help? / Just ask me anything" prompt, round icon rail on the left, glass pills (search, date, actions) over the photo. A row of glass cards (activity bars, sleep lines, heart bars) is followed by a "Wellness score" card with 3 flowing sine waves (orange, gold, white), a waveform "Focus" card, and a tall gauge card (semicircle with tick marks and a big %) |
| 2 | `2-personal-dashboard-base-camp.png` | **Base camp** + Today's **Your week** calendar | Near-black panels. Focus timer card with a big orange play/pause button. Today's tasks and meetings as compact rows/tiles. Week calendar with a column per day, an hours axis, task cards with priority dots (Done / Medium / High / Low), today's column tinted red, a red "now" line with the time. Right column: activity % bars per weekday, a "projects worked" donut, and reminders with times |
| 3 | `3-finance.png` | **Finance** dashboard | Black and grey with orange-red as the only colour. Total balance up top with action buttons. Currency cards with sparklines. Big line chart with a tooltip. Vertical bar "spendings" with the current day highlighted. Recent activity list. **Sankey money flow**. Cashflow heatmap of squares |
| 4 | `4-finance-layout.png` | Finance **layout / organisation** | Folding sidebar tree (Main / Features / Tools), top pills (Reports, date, search). Cards with "compared to last year +x%", a segmented "spending limits" bar with a legend, a records table with filter tabs and status pills (Paid / Claimed / Pending), and an AI assistant panel. Teal is their accent: we keep orange |
| 5 | `5-marketing.png` | **Marketing** dashboard | Card set only: key performance, conversion rate, analytics sparkline, social traffic by channel (area chart), bar chart, a top-content table, goal donut and world map. **Stock image with watermark**: we took the structure, not the blue look |
| 6 | `6-member-page.png` | **Member page** (`/team/<id>`) | Top tiles (in progress / completed / money, each with a change line). Profile photo card with email and call buttons. Weekly activity semicircle gauge. Current task with a timer and play button. Stacked bars by project per weekday. Month calendar with dots. Today's events list. Their light purple look was **not** used, only the layout |
| 7 | `7-team-table.png` | **Team** page | Search box plus Inactive / Somewhat active / Active filter buttons. A table with avatar, name and role, status with icon **and** word, check/cross columns for the last 30 days, "x/y (%)" completion, and a "last active" column |

## When you build something new

1. Find the closest picture above and follow its layout.
2. Use the tokens in `dashboard/src/app/globals.css` (`--surface`, `--brand`, `--ok/--warn/--bad`, `.glass-*`, `.on-photo`), never new hard-coded colours.
3. Put sections in the `ToolWorkspace` pattern (Tools column on the right, assistant bubble bottom-right).
4. Show status with an icon **and** a word, not colour alone. Keep it phone-first and make it work in all 7 languages.
5. Use real data only: never fake revenue, customers or products (demo data must carry the `[DEMO]` tag).
