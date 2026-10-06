# Google Contacts live sync: one-time OAuth setup (about 10 minutes)

The CRM (v1.1.0) can read your Google Contacts directly from the browser. To do that, Google needs an
**OAuth Client ID** that identifies the app. A Client ID is public by design, so it's safe to put in the website.
**There's no client secret and no server.** These steps are written for Philip, or for an assistant driving
Philip's browser while he's signed in to his own Google account (the Gmail that holds the contacts).

> Read-only: the app asks only for `contacts.readonly` (plus `userinfo.email`, which it uses only to show
> "Connected as …"). It never changes, adds or deletes anything in Google Contacts.

## 1. Create the project
1. Open <https://console.cloud.google.com/> and sign in with **Philip's Gmail**.
2. Click the project picker at the top left, then **New project**.
3. Project name: **CRM App**. Organization/location: leave it as "No organization". Click **Create**.
4. Make sure **CRM App** is selected in the project picker before you continue.

## 2. Enable the People API
1. Go to **APIs & Services → Library** (<https://console.cloud.google.com/apis/library>).
2. Search for **People API**, open it, and click **Enable**.

## 3. Set up the OAuth consent screen (Google Auth Platform)
Open **APIs & Services → OAuth consent screen**. In the current console this is **Google Auth Platform**:
<https://console.cloud.google.com/auth/overview>. Click **Get started** if you're asked to.
1. **App information / Branding**: App name **CRM App**. User support email: Philip's Gmail. Click Next.
2. **Audience**: choose **External**. Click Next.
3. **Contact information**: Philip's Gmail. Click Next, accept the Google API Services User Data Policy, then **Create**.
4. **Audience** page (left menu): the publishing status should be **Testing**. Leave it that way.
   Under **Test users** click **Add users**, enter **Philip's Gmail address**, and **Save**.
   Only listed test users can sign in while the app is in Testing.
5. **Data Access** page (left menu): click **Add or remove scopes** and tick:
   - `https://www.googleapis.com/auth/contacts.readonly` ("See and download your contacts"). This is a sensitive scope.
   - `https://www.googleapis.com/auth/userinfo.email` ("See your primary Google Account email address"). This one is non-sensitive and optional; without it the app just shows "Connected" without the email.

   If a scope isn't in the list, paste it into **Manually add scopes**. Click **Update**, then **Save**.
   (Don't add `contacts` without `.readonly`, and don't add `contacts.other.readonly`; the app doesn't use them.)

## 4. Create the OAuth Client ID
1. Go to **Clients** (left menu of Google Auth Platform, or **APIs & Services → Credentials → Create credentials → OAuth client ID**).
2. Click **Create client**. **Application type: Web application**. Name: **CRM App web**.
3. **Authorized JavaScript origins**: add both of these, with no trailing slash and no path:
   - `https://mnwilakes.github.io`
   - `http://localhost:8080` (for local testing)
4. **Authorized redirect URIs**: leave this **empty**. The app uses the Google Identity Services popup token flow, which doesn't redirect.
5. Click **Create**. Copy the **Client ID**. It looks like `1234567890-abcdefg123.apps.googleusercontent.com`.
   Ignore the client secret: the app doesn't use it, so don't paste it anywhere.

New Client IDs can take a few minutes to work (Google says up to a few hours). If you see `origin_mismatch`
or `invalid_client` right after creating it, wait and try again. Then check that the origin is exactly
`https://mnwilakes.github.io`.

## 5. Put the Client ID into the app (pick one)
- **A. Settings field (easiest, per device):** open <https://mnwilakes.github.io/> → **Settings → Google Contacts**,
  paste the Client ID, then tap **Save Client ID**. It's stored only in that browser's localStorage, so do it once on the
  phone and once on the desktop. A value saved here overrides config.js.
- **B. `js/config.js` (everywhere at once):** edit `GOOGLE_CLIENT_ID: ''` to
  `GOOGLE_CLIENT_ID: '1234567890-abcdefg123.apps.googleusercontent.com'`, then push `js/config.js` to the
  `MNWILakes/MNWILakes.github.io` repo. Because the Client ID isn't a secret, publishing it is fine.
  (If you change config.js later, also bump `CACHE` in `sw.js` so installed apps pick it up quickly.)

## 6. Connect (Philip)
1. In the app, go to **Settings → Google Contacts → Connect Google Contacts**.
2. Pick Philip's Gmail in the Google popup. Allow popups for mnwilakes.github.io if the browser asks.
3. Expect a **"Google hasn't verified this app"** warning. That's normal for an app in **Testing** mode that only you use.
   Click **Continue** (on some screens it's **Advanced → Go to CRM App (unsafe)**).
4. On the permissions screen, **tick "See and download your contacts"** if it shows a checkbox, then **Continue**.
5. The first sync downloads all contacts (about 1,500 in a few seconds). If this device already has contacts from a CSV
   import, the app offers to **match them by name + phone** so priorities, follow-ups, call logs and dates carry over.
   Choose **Match & switch to Google**.

## Notes on Testing mode
- Testing mode is fine for personal use. Google limits it to the test users you listed (up to 100), and you never need to
  submit the app for verification.
- The app uses short-lived **access tokens** (about 1 hour) and no refresh tokens. When one expires, the app tries a
  silent renewal. If the browser blocks that (common after a long break, or on phones), a small
  **"Reconnect Google"** banner appears, and one tap fixes it. In Testing mode, Google may also ask you to approve again
  about once a week.
- To remove access at any time, go to <https://myaccount.google.com/permissions> → CRM App → **Remove access**, or
  tap **Disconnect** in the app.

## Troubleshooting
| Message | Fix |
|---|---|
| `Error 400: origin_mismatch` | Add exactly `https://mnwilakes.github.io` (or `http://localhost:8080`) under Authorized JavaScript origins, wait a few minutes. |
| `Error 403: access_denied` / "app is in testing" | Add the Gmail you're signing in with as a **Test user** (step 3.4). |
| "People API has not been used in project …" (403) | Enable the **People API** in the same project (step 2). |
| "Contacts permission was not granted" | Click Connect again and tick "See and download your contacts". |
| Popup blocked / nothing happens | Allow popups for mnwilakes.github.io, or tap **Reconnect Google** (user taps aren't blocked). |
