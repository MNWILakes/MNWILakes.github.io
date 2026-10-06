# Wholesale CRM: User Guide

**Web address:** <https://mnwilakes.github.io>

This is a simple guide for using the app day to day. It covers what this version (**1.1.0**) can do and uses the same labels you see on the screen.

**New in 1.1.0:** live, read-only **Google Contacts sync** (see [Connect Google Contacts](#connect-google-contacts-live-sync-recommended)), and a **Date added** on every contact.

---

## Before you start: how your data is stored

- The website has **no contacts on it**. Your contacts live **only on the device** where you sync or import them, inside the browser's own storage.
- With **Google Contacts sync** on, each device pulls names, phones, emails, labels and notes **from Google** on its own. The app only reads from Google. It never changes anything there.
- Your **app-only work** doesn't sync between devices: priorities you set, follow-ups, logged calls, and addresses you confirmed or added. Your phone and your computer each keep their own copy.
- To move that work from one device to another, use a **JSON backup** (see [Section 9](#9-backups-restore-and-moving-between-phone-and-computer)).
- Each browser keeps its own copy too. Chrome and Edge on the same computer do **not** share data.
- Private or Incognito windows don't keep your data. Don't use them.

**Phone vs. computer layout**

- **Phone (narrow screen):** a bottom bar with **Dashboard**, **Contacts**, **Call Queue**, and **Settings**. Filters open from the **☰** button next to search. To add a contact, tap the round **+** button.
- **Computer (wide screen):** the same four links are at the top right. On **Contacts**, filters sit in a panel on the left. The list is a table, and you can click a column header to sort.

---

## 1. Open and install the app

### On an Android phone (Chrome)

1. Open **Chrome**.
2. Go to **mnwilakes.github.io**.
3. Tap the Chrome menu **⋮** (top right).
4. Tap **Add to Home screen** or **Install app**. You'll see one or the other.
5. Confirm. A **CRM** icon appears on your home screen.
6. From now on, open the app from that icon.

Tip: In the app, **Settings → Storage & install** has an **Install app** button. It only works when Chrome offers to install. Otherwise it's greyed out, and that's normal. Use the ⋮ menu instead.

### On a computer (Chrome or Edge)

1. Open **Chrome** or **Edge**.
2. Go to **https://mnwilakes.github.io**.
3. Optional: install it so it opens in its own window.
   - In **Settings → Storage & install**, click **Install app** if it's not greyed out.
   - Or use the browser's own install option. In **Chrome**, that's the install icon at the right end of the address bar, or the **⋮** menu. In **Edge**, it's the **…** menu → **Apps**. Menu wording varies by browser version.
4. The installed app and the browser it came from share the same data.

---

## Connect Google Contacts (live sync, recommended)

Instead of downloading contacts.csv by hand, the app can read your contacts **straight from Google Contacts** and keep them up to date.

- **Read-only.** The app never adds, changes, or deletes anything in your Google account.
- **Google wins** for name, phones, emails, labels, and the note text. To change those, edit the contact in Google Contacts. The change shows up in the app at the next sync.
- **The app keeps its own work:** priority you set by hand, follow-up dates, **calls you logged** (shown at the top of the note, but never written to Google), confirmed or added property addresses, and **Date added**.

### One-time setup: the OAuth Client ID

Google needs a free **OAuth Client ID** for the app. You do this once, and it takes about 10 minutes. The exact clicks are in **GOOGLE_OAUTH_SETUP.md**. In short:

1. In Google Cloud Console, create the project **CRM App** and enable the **People API**.
2. Set up the OAuth consent screen: **External**, status **Testing**, add **your own Gmail** as a test user, and add the scope **contacts.readonly**.
3. Create an **OAuth client ID** of type **Web application**, with Authorized JavaScript origin `https://mnwilakes.github.io`.
4. Copy the Client ID (it ends in `.apps.googleusercontent.com`).

Until this is done, **Settings → Google Contacts** says **Setup needed**. Everything else, including CSV import, works as before.

### Connect

1. Go to **Settings → Google Contacts**.
2. Paste the Client ID and tap **Save Client ID**. Do this once on each device, unless it was built into the website (`js/config.js`).
3. Tap **Connect Google Contacts** and pick your Gmail in the Google window. Allow pop-ups if the browser asks.
4. You'll see **"Google hasn't verified this app."** That's normal for your own app in Testing mode. Tap **Continue**.
5. Allow **"See and download your contacts"**.
6. The first sync downloads everything: about 1,500 contacts in a few seconds.
7. **Already imported contacts.csv on this device?** The app offers **Match & switch to Google**. It matches your existing contacts **by name + phone number** and carries over your priorities, follow-ups, call logs, addresses, and Date added. It replaces the CSV copies, so you don't get duplicates. If a CSV contact isn't found in Google and has none of your app work, a checkbox lets you remove it. If it has app work, it's kept as a local-only contact.

When connected, Settings shows **Connected as** your email, how many **Google contacts** you have, and the **Last sync** time. You'll also see **Sync now** and **Disconnect** buttons.

### How "live" is it?

- The app syncs **every 4 minutes while it's open**, **whenever you come back to it** (switch back to the app or tab), and **when you're back online**. You can also tap **Sync now**.
- After the first sync, each sync downloads only what changed: new contacts, edits, and deletions. A contact deleted in Google disappears from the app.
- A browser app can't be told the instant something changes in Google. So a change you make in Google Contacts shows up here **within a few minutes**, or right away when you tap **Sync now**.
- Every few hours Google's sign-in needs refreshing. The app tries quietly. If the browser blocks that, a small **"Reconnect Google"** bar appears at the top. Tap it once and syncing resumes. It won't keep nagging.

### Contacts synced from Google

On a synced contact you'll see **☁ Synced from Google Contacts** under the name.

- **Edit**, **Edit note** and **Edit fields** become **Edit in Google ↗**. That opens the contact in Google Contacts.
- Labels show without ✕. Change labels in Google, and priorities follow automatically (CALL PRIORITY → Hot, etc.).
- **Log call**, priority buttons, follow-ups, and addresses work exactly as before.
- **Delete contact** only removes it from this device. To delete it for good, delete it in Google Contacts.

### Disconnect

**Settings → Google Contacts → Disconnect** stops syncing. Your contacts and app work stay on the device. You can also remove the app's access at <https://myaccount.google.com/permissions>.

---

## 2. Fallback: get contacts.csv onto your phone and import it

Use this if Google sync isn't set up yet, or as a backup way in. If Google sync is on, you normally don't need it. Importing a CSV then makes the next sync do a full re-check and offer the name + phone match again.

### Step A: Download the file from Google Drive

1. Open the **Google Drive** app.
2. Go to **RE Apps → CRM APP**.
3. Find **contacts.csv**.
4. Tap the **⋮** next to it.
5. Tap **Download**. The file goes to your phone's **Downloads** folder.

### Step B: Import it in the app

1. Open the app and go to **Settings**. On a brand-new device, the **Dashboard** shows a button: **Import contacts.csv or a JSON backup**.
2. Under **Import contacts**, tap the box that says **Tap to choose a file**.
3. Pick **contacts.csv** from **Downloads**. You can also browse to it in Drive from the file picker.
4. A **Preview** appears. Check the line that reads **1,523 contacts · … columns**.
5. Tap **Import 1,523 contacts**.
6. Wait a moment. The app then opens the contact with the longest note so you can see that notes came through in full.
7. A box asks **Download a backup now?** Tap **JSON backup**. You can also tap **Download backup CSV**, or **Not now**.

On a computer you can also **drag and drop** the file onto that box.

### Step C: Check the numbers

| Where | You should see |
|---|---|
| Preview line | **1,523 contacts** |
| **Settings → Last import** | **Total contacts: 1,523** |
| **Dashboard** tiles | **Contacts 1,523 · Hot 262 · Warm 0 · Cold 57 · Unreviewed 1,204** |
| **Settings → Storage & install** | "1,523 contacts stored in IndexedDB on this device." |

You should also see a green line that says **"✓ Verified after saving: every stored note is the full length of its source field (no truncation)."**

On the Dashboard, a small link may say **"10 have both Hot & Cold labels (counted as Hot)."** Tap it to review those contacts.

### Importing again later (what really happens)

The first import just loads the file. After that, choosing a CSV again gives you **two buttons**:

- **Replace all 1,523 contacts on this device**
  - Wipes everything and loads the file fresh.
  - You **lose** priorities, follow-ups, call logs, and edits made in the app.
  - It asks you to confirm first.
- **Merge (update from CSV, keep my priorities, follow-ups & call logs)**
  - Matches contacts by **first, middle, and last name, organization, and the digits of the first phone number**.
  - For each match, it **keeps**: your priority, follow-up date, call log (the logged-call lines are put back at the top of the note), addresses you added or confirmed, and addresses you deleted (they stay deleted).
  - For each match, the **CSV wins** on: name, phone, and other fields, **labels**, and the **note text**. Note edits you made in the app are lost, apart from the logged-call lines.
  - Contacts that exist **only in the app** (ones you added, for example) are **kept**.
  - Contacts in the CSV with no match are **added as new**.
  - Contacts you deleted in the app **come back** if they're still in the CSV.
- **Date added** is never changed by a re-import. Matched contacts keep their original date.
- **Duplicates:** neither button duplicates a matched contact. But **Merge can create a duplicate** if a contact's name, organization, or first phone changed in the app or in the CSV. The old copy stays, and the CSV copy is added.
- **Cancel** stops without changing anything.

**Best practice:** tap **JSON full backup** before any re-import.

---

## 3. Keep your data safe on the device

Go to **Settings → Storage & install**.

1. Read the status line. It shows how many contacts are stored, the space used, whether **Persistent storage** is ON, and whether **Offline mode** is ready.
2. Tap **Keep data permanently**.
   - "**Storage will be kept**" means you're set.
   - "**Browser declined – installing the app usually fixes this**" means you should install the app (Section 1), then tap the button again.
3. The status should then say **Persistent storage: ON.**

Even with this ON, clearing Chrome's site data or uninstalling Chrome can erase your contacts. Keep backups.

Other settings:

- **Appearance → Theme:** **Match device**, **Light**, or **Dark**.
- **AI summaries (coming later):** this isn't built yet. You can save a key with **Save key**. It stays on this device and is never included in backups.
- **Danger zone → Delete all data on this device:** erases everything. It asks twice, and you must type **DELETE**.
- **Google Contacts** (top of Settings): connect, sync now, disconnect. See [Connect Google Contacts](#connect-google-contacts-live-sync-recommended).
- The bottom of Settings shows the shortcut list and the **Version** number (**1.1.0**).

---

## 4. Find contacts: search, filters, priorities

### Search

1. Tap the search box at the top. On a computer, press **/**.
2. Type a name, phone, address, label, or any word from the notes. The list updates as you type.
3. A few rules:
   - **Several words** must **all** match. For example, `superior catlin` finds contacts with both words.
   - Put a phrase in **quotes** to match it exactly, like `"over 70"`.
   - **Phone numbers** match with or without dashes, spaces, or brackets. Type 3 or more digits.
   - Search looks at name, nickname, organization, title, phones, emails, addresses, labels, and notes.
4. Matches are highlighted. When you open a contact during a search, tap **Next match** to jump through hits in the note.
5. Tap **✕** in the search box to clear it.

Typing in search from any screen takes you to **Contacts**.

### Filters

- **Phone:** tap **☰** next to the search box. The number on it shows how many filters are on. When done, tap **Show N results**, or **Clear all**.
- **Computer:** filters are in the left panel on **Contacts**.

The filter groups are:

- **Priority:** chips for **Hot**, **Warm**, **Cold**, and **Unreviewed**, each with a count.
- **Follow-up:** Any · Overdue + due today · Overdue · Due today · Due this week (next 7 days) · Has a follow-up · No follow-up set.
- **Last contact:** Any · Contacted this month · Last 7 days · Last 30 days · Not contacted 90+ days (or never) · Not contacted 180+ days (or never) · Not contacted 1 year+ (or never) · No date found in notes.
- **Date added:** Any · Added today · Last 7 days · Last 30 days · Last 90 days · This month · More than 90 days ago.
- **Property city:** a list of cities pulled from addresses, with counts.
- **Other:** Has phone · Has notes · Unconfirmed auto-extracted address · Hot + Cold label conflict.
- **Labels (tap several to combine):** each label with a count, most common first.
  - Tapping several labels shows contacts that have **all** of them.
  - Counts update to match your other filters.

Labels in your file are separated by ` ::: `. The app splits them into separate chips. With the full file you should see, for example: **CALL PRIORITY 237**, **RE FOLLOW UP ASAP 39**, **NO INTEREST 67**, **Wholesale Seller 942**, **Duluth - Superior 863**. The built-in Google label "* myContacts" is hidden.

Active filters show as chips above the list. Tap **✕** on a chip to remove that filter, or **Clear** to remove them all. The line **Showing X of 1,523** tells you how many contacts match.

### Sorting

- **Phone:** use the sort menu above the list. Options are Name A–Z · Last contact (recent) · Last contact (oldest) · Next follow-up · Priority · Organization · Date added (newest).
- **Computer:** click a column header (Name, Organization, Phone, Priority, Labels, Property address, Last contact, Follow-up, Added). Click it again to reverse the order (▲/▼).

### Priorities (Hot / Warm / Cold / Unreviewed)

The app sets a priority **automatically from labels**:

- **Hot:** the contact has **CALL PRIORITY** or **RE FOLLOW UP ASAP**.
- **Cold:** the contact has **NO INTEREST** and no Hot label.
- **Unreviewed:** everything else.
- **Warm:** never set automatically. You set it by hand.
- A contact with both a Hot label and a Cold label counts as **Hot** and is marked as a conflict.

To change a priority by hand, open the contact and tap **Hot**, **Warm**, **Cold**, or **Unreviewed**. To undo that, tap **reset to automatic (…)**.

### Dashboard

- **Tiles:** **Contacts**, **Hot**, **Warm**, **Cold**, **Unreviewed**, and **Due now** (overdue plus due today). Tap a tile to see those contacts.
- **Lists:** **Overdue**, **Due today**, **Due this week**, and **Hot – no follow-up set**. Tap a name to open it, or **☎** to call. Long lists end with "**+N more – view all**".
- **Button:** **☎ Start call queue (N)**.

---

## 5. The call queue

The call queue shows one contact at a time, on one screen: the full note, phones, **Log call**, and follow-up buttons.

### Start it

1. Tap **Call Queue**. A red badge shows how many follow-ups are due. You can also tap **☎ Start call queue (N)** on the Dashboard.
2. Choose one of two buttons:
   - **Start: N due (overdue + today)** lists overdue contacts first (oldest first), then today's.
   - **Hot with no follow-up (N)** lists Hot contacts with no follow-up date. Contacts with no date in their notes come first, then the ones contacted longest ago.

**First day after importing:** no contact has a follow-up yet, so **Start** is greyed out and says 0. Use **Hot with no follow-up (262)**.

### Move through it

- The top bar shows your place, for example **3 / 25**.
- **← Prev** goes back one contact.
- **Skip →** moves on without changes.
- **End** stops the queue.
- **Setting a follow-up moves you to the next contact automatically.** You can set it with a follow-up button or inside **Log call**.
- When you reach the end, you'll see **Queue finished 🎉** with a count. Tap **Done**.
- On a computer, **j** is Skip and **k** is Prev.

### Log the outcome

1. Tap **☎ Call** next to a number. The phone dialer opens.
2. After the call, come back to the app. **The Log call form opens by itself**, with the number you called already picked. This works if you return within 30 minutes. You can also tap **Log call** yourself, or press **c** on a computer.
3. Pick an outcome: **No answer**, **Left VM**, **Talked**, **Not interested**, or **Wrong number**.
   - If you pick **Not interested**, a box appears: **Also set priority to Cold**. It's ticked by default.
4. Optional: check **Number called**.
5. Optional: type **Details**, for example "wants $85k, call back after the holidays."
6. Under **Next follow-up (optional)**, pick **Tomorrow**, **3 days**, **1 week**, **2 weeks**, **1 month**, or a date.
   - The first button reads **None** for a contact with no follow-up. If one is already set, it reads **Keep MM/DD/YY**.
7. Check the preview line, **Adds to top of notes:**, which looks like `100626 – called (218) 555-0191, talked – wants $85k`.
8. Tap **Save call**.

What saving does:

- Adds that dated line to the **top of the note**.
- Sets **Last contact = today**.
- Saves the follow-up date if you picked one.
- Moves the queue to the next contact if you set a follow-up.

**Cancel** (or **Esc**) closes the form without saving.

### Set a follow-up without logging a call

In the **Follow-up** section of any contact:

1. Tap **Tomorrow**, **3 days**, **1 week**, **2 weeks**, or **1 month**, or pick a date.
2. To remove it, tap **Clear**.

The line **Next follow-up:** shows the date. It turns red if overdue and orange if due today.

---

## 6. Call, text, and email

Open a contact. Under **Phones**:

- **☎ Call** opens the phone dialer with that number.
- **✉ Text** opens your texting app with that number.
- Each number shows its label (Mobile, Home, and so on).

Phone shortcuts elsewhere:

- On the phone's contact list, each card has a **☎** button to call right away.
- On a computer, phone numbers in the list are links.
- On the Dashboard lists, **☎** calls.
- Phone numbers written **inside notes** are highlighted and can be tapped to call.

**Email:** email addresses under the phone numbers are links that open your email app.

**Maps:** this version has **no map button**. Property addresses are plain text. Copy an address and paste it into Google Maps.

---

## 7. Edit contacts, notes, labels, and addresses

Open a contact by tapping it in the list. On a phone, go back with **←** or the phone's Back button. On a computer, use **✕** or **Esc**.

### Edit the main fields

**Contacts synced from Google** are edited in Google Contacts: tap **Edit in Google ↗**. The rest of this section applies to contacts from a CSV import or added in the app.

1. On a computer, tap **Edit** at the top. On a phone, scroll to **All fields** and tap **Edit fields**.
2. Change any field: name, organization, phones, e-mails, address, and others. One empty phone slot and one empty e-mail slot are shown so you can add a new one.
3. Tap **Save**, or **Cancel**.

### Edit the note

1. In **Notes**, tap **Edit note**.
2. Type your changes. A character count shows below.
3. Tap **Save note**, or **Cancel**.

### Last-contact date

There's **no separate box** for the last-contact date. The app works it out:

- It uses the **most recent date found in the note** that isn't in the future.
- It also counts any call you logged with **Log call**.

To update it:

- **Easiest:** use **Log call**. It sets today.
- **Or** add a dated line to the note with **Edit note**. These formats are recognized:
  - `100626` (MMDDYY)
  - `10/6/26` or `10/6/2026`
  - `Oct 6, 2026`

Note dates from **2015 through next year** are recognized. The upper limit moves forward automatically each New Year, so 2027 dates work from now on.

### Date added

Every contact has a **Date added**. It shows under the name as **Date added: MM/DD/YY**, with where it came from.

- **CSV import:** the day you imported it, unless the CSV has a created-date column (for example **Date Added** or **Created**).
- **Google sync:** the day the app first saw the contact. Google doesn't share the real creation date.
- **+ Contact** in the app: today.
- Contacts you had before version 1.1.0 got their earliest known date, which is usually the import date.
- It's **set once and never changed** by later syncs, merges, or re-imports. It's included in CSV and JSON backups and restored from them.
- Use the **Date added** filter (for example, last 7 days) to see new leads. To sort by it, use the **Added** column on a computer, or **Date added (newest)** on a phone.

### Labels

- Remove a label: tap **✕** on its chip.
- Add a label: type in **Add label…** (suggestions appear), then tap **Add** or press Enter.
- Adding or removing a Hot or Cold label changes the automatic priority. A priority you set by hand stays.

### Property addresses

The app finds addresses in notes and tags each one:

- **auto-extracted:** found in the note, not yet checked.
- **confirmed:** checked by you.
- **address field:** from the contact's address field.
- **manual:** added by you.

You can:

- **✓** confirm an auto-extracted address.
- **✎** edit an address. Change the address and the **City (for filtering)**, then tap **Save**.
- **🗑** delete an address. It won't be pulled from the note again.
- **+ Add** a new address.

### Other things on the contact screen

- **Calls logged in app:** a list of calls you logged.
- **AI summary (coming soon):** greyed out. Not built yet.
- **Delete contact:** removes the contact from this device after you confirm. You can't undo this without a backup. For a Google-synced contact it only removes the local copy. The contact stays in Google and comes back on the next full re-check, or when it's edited in Google.

### Add a new contact

1. On a phone, go to **Contacts** and tap the round **+**. On a computer, click **+ Contact**.
2. Fill in the fields. At the bottom, add **Notes** and **Labels (separate with commas)**.
3. Tap **Create**. The new contact opens. Its **Date added** is today.
4. Contacts added here live only in this app. They aren't sent to Google Contacts.

---

## 8. Keyboard shortcuts (computer)

| Key | What it does |
|---|---|
| **/** | Jump to the search box |
| **j** | Next contact. With a contact open, moves to the next one. In the call queue, it's **Skip** |
| **k** | Previous contact. In the call queue, it's **Prev** |
| **Enter** (or **o**) | Open the selected contact on **Contacts** |
| **c** | **Log call** for the open contact, the queue contact, or the selected row |
| **Esc** | Leave the search box, close the filter panel, close the contact, or close a pop-up |
| **↓** (in the search box) | Leave the search box so **j**/**k** work |
| **Enter** (in **Add label…**) | Add the label |

Shortcuts don't work while you're typing in a box or holding Ctrl, Alt, or Cmd. While a pop-up is open, only **Esc** works.

---

## 9. Backups, restore, and moving between phone and computer

All of these are in **Settings → Backup & export**.

### Make a backup

- **JSON full backup** saves everything: contacts, priorities, follow-ups, call logs, edits, addresses, and Date added. It never includes your Google sign-in.
  - The file is named `crm_full_backup_YYYY-MM-DD_HHMM.json`.
  - **Use this to move data or restore it.**
- **Export CSV** saves all contacts in Google Contacts format, plus extra columns: **Priority**, **Last Contact**, **Next Follow-Up**, **Property Addresses**, and **Date Added** (YYYY-MM-DD).
  - The file is named `crm_contacts_….csv`.
  - Good for spreadsheets. It does **not** bring back priorities or follow-ups if you import it again. **Date Added** does come back from it.
- **Export shown** (computer only, above the list) saves just the contacts that match your current search and filters, as `crm_filtered_….csv`.

On Android, downloaded files go to **Downloads**.

These backups hold all your contact details. Store them somewhere private, such as your own Google Drive.

### Restore from a JSON backup

1. Tap **Restore JSON backup…**. You can also pick the .json file in the **Tap to choose a file** box.
2. Choose the `crm_full_backup_….json` file.
3. Confirm. **Restoring replaces everything on this device.** There's no merge for JSON.
4. You'll see "**Restored N contacts**".
5. If Google sync is on, the next sync re-checks everything against Google. Google-synced contacts in the backup keep your app work.

### Move your work from phone to computer (or back)

1. On the device with your latest work, tap **JSON full backup**.
2. Get the file to the other device. For example, upload it to your Google Drive or email it to yourself.
3. On the other device, open the app and go to **Settings → Restore JSON backup…**. Pick the file and confirm.
4. Check that the **Dashboard** counts match.

**Important:** the restore **overwrites** the other device. Work on **one device at a time** between transfers. Otherwise, changes made on the receiving device are lost.

---

## 10. Offline use, updates, and troubleshooting

### Offline use

- After the app has loaded once while online, it works without internet. Contacts, search, notes, editing, and the call queue all work.
- Google sync pauses while you're offline and catches up automatically when you're back online.
- Check **Settings → Storage & install**. It should say **Offline mode: ready.** If it says "not active yet (reload once)", reload the page once while online.
- Calls and texts still need phone service.

### Getting a new version

- The app checks for a new version **each time you open it while online**.
- Sometimes the new version only shows on the **next** open.
- **To update:** open the app while online, close it fully (swipe it away), and open it again.
- Your contacts are **not** affected by updates.

### Troubleshooting

**My contacts are missing on a new device (or in a different browser)**

- That's expected. Data stays on the device and browser where you imported it.
- Fix: on the old device, tap **JSON full backup**. On the new one, use **Restore JSON backup…**.
- Or import **contacts.csv** again. You'll lose priorities, follow-ups, and call logs if you do.
- Make sure you're not in a Private or Incognito window.

**The import count is wrong (not 1,523)**

1. Look at the **Preview** line *before* importing. It should say **1,523 contacts**.
2. Make sure you picked the newest file. Old downloads may be named `contacts (1).csv`, and so on.
3. Do you see "**This does not look like a Google Contacts CSV**"? Then the file isn't a Google CSV export. Use the contacts.csv from **RE Apps → CRM APP**.
4. Yellow warnings like "**Parser reported … issue(s)**" or "**… row(s) have a different number of columns**" mean the file is damaged. Download it again.
5. Is the **Dashboard** total *more* than 1,523 after a **Merge**? You have contacts added in the app, or duplicates from changed names or phones (see Section 2). To start clean, tap **JSON full backup**, then re-import with **Replace all…**.
6. Do the Hot and Cold counts differ from 262 and 57? Priorities you set by hand override the automatic ones, and **Warm** only comes from you.

**The old version still shows**

1. Open the app while online. Close it fully. Open it again.
2. Check the **Version** number at the bottom of **Settings**.
3. On a computer, do a hard reload: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac).
4. **Don't** use Chrome's "Clear data", "Delete data", or "Clear & reset" for this site unless you have a fresh JSON backup. **It deletes all your contacts.**

**Settings says "Setup needed" under Google Contacts**

The OAuth Client ID hasn't been entered on this device. Follow [Connect Google Contacts](#connect-google-contacts-live-sync-recommended) and GOOGLE_OAUTH_SETUP.md. CSV import still works in the meantime.

**A "Reconnect Google" bar appears at the top**

Google's sign-in expired and the browser blocked the quiet refresh. Tap **Reconnect Google**. If nothing happens, allow pop-ups for mnwilakes.github.io. Your contacts stay on the device either way.

**Google sign-in errors**

- **"origin_mismatch"**: the Client ID needs `https://mnwilakes.github.io` as an Authorized JavaScript origin.
- **"access_denied"** or **"app is in testing"**: add the Gmail you sign in with as a **Test user**.
- **"People API has not been used…"**: enable the People API in the same Google Cloud project.
- **"Contacts permission was not granted"**: tap **Connect Google Contacts** again and tick **See and download your contacts**.

**A change I made in Google Contacts isn't showing**

Tap **Settings → Google Contacts → Sync now**. Automatic syncs run every 4 minutes while the app is open, and whenever you come back to it. If **Last sync** is old, look for a yellow message under it (offline, sign-in expired, or a Google error).

**I see duplicates after connecting Google**

You probably skipped **Match & switch to Google**, or a contact's name and phone both changed. Remove the extra copy with **Delete contact** on the one without **☁ Synced from Google Contacts**.

**"Could not open the local database"**

Private or Incognito mode, or a browser setting, is blocking storage. Open the app in a normal window.

---

## 11. Daily routine

1. **Open** the app from the home screen icon. With Google sync on, it pulls the latest from Google Contacts by itself. Add new leads in Google Contacts, and they appear in the app within minutes.
2. **Dashboard:** check **Due now**, **Overdue**, and **Due today**. The small line at the bottom shows when Google last synced. Use the **Date added → Last 7 days** filter to see this week's new leads.
3. Tap **☎ Start call queue (N)**. If nothing is due, go to **Call Queue → Hot with no follow-up**.
4. For each contact:
   1. Read the note.
   2. Tap **☎ Call**.
   3. Come back to the app.
   4. In **Log call**, pick the outcome, add details, and pick a follow-up.
   5. Tap **Save call**. The queue moves on.
5. Not calling someone today? Tap **Skip →**.
6. Use **Text** or email when it fits. Then use **Log call** to record it. On contacts not synced from Google you can also use **Edit note**.
7. Mark new leads **Warm** or **Hot** by hand as needed.
8. **End of day:** **Settings → JSON full backup**. Save the file to your Drive. Google keeps your contacts, but your follow-ups, priorities, and call logs live only in the app.
9. If you see the **Reconnect Google** bar, tap it once.
10. **Once a week:** check **Hot – no follow-up set** on the Dashboard, and give each one a date.
