# emet Books — connect the Google Sheet (no coding, ~5 minutes)

The Finance tab writes every sale, expense, stock change and project to a Google Sheet called **emet Books**
within seconds. The dashboard's database stays the master copy; the sheet is a live, read-only mirror you can
open in Google Sheets or download as Excel. It costs €0.

It uses the **same team Google connection** as the Meeting log audio archive, so you only set Google up once.

## 1. One-time Google setup (if not done yet for the Meeting log)

Follow the Google steps from the Meeting log setup (Google Cloud project "emet HQ", OAuth client with redirect
`https://emet-hq.vercel.app/api/drive/callback`), and **also enable the Google Sheets API**:

1. Open https://console.cloud.google.com/apis/library/sheets.googleapis.com with the team Google account.
2. Click **Enable**.

**Scope:** the dashboard asks only for `drive.file` — permission to the files *it creates itself* (the meeting
recordings folder, the emet Books sheet and its daily copies). That scope is enough for the Sheets API on a sheet
the app created, so **no extra permission is needed** and the rest of the Drive stays invisible to the app.

## 2. Connect

1. An admin opens **Meeting log** → bottom of the list → **Connect Google Drive** and signs in with the team account.
2. Open **Finance → Bookkeeper**. The status shows "Google Sheet not connected yet" until step 1 is done, then
   "N tabs waiting to sync". Press **Retry now** — the sheet **emet Books** is created in the team Drive and filled.
3. Click **Open sheet**, then **Share** → add the team as **Viewer** (people edit in emet HQ, not in the sheet).

## What's in the sheet

| Tab | Contents |
|---|---|
| Sales | Every sale (date, description, amount, cost of goods, gross profit, channel, payment method, project, who, when, reversals) |
| Expenses | Every expense (category, payment method, project, receipt yes/no, who, when, reversals) |
| Stock | Items, stock, unit cost, price, stock value (formula), low-stock alert |
| Projects | Revenue, cost of goods, expenses, net profit, ROI, over-budget — **live SUMIFS formulas** |
| Monthly Summary | Revenue, cost of goods, expenses, net profit and margin per month — **live formulas** |
| Audit Log | Who changed what, before → after |

Row 1 of each tab says "Edit in emet HQ. Changes made here get overwritten." — each sync rewrites the tab from the database.

## Safety nets

- **Never loses an entry:** if Google is unreachable, changes wait in a queue and retry on the next change, the
  daily job, or **Retry now**.
- **Daily copy:** every night a file `emet Books YYYY-MM-DD.xlsx` is saved in the Drive folder
  "emet Books — daily copies"; the last 30 are kept.
- **Download as Excel** (Finance → Overview or Bookkeeper) works even before Google is connected.
