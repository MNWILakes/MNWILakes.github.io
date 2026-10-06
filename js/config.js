/* App configuration. Safe to publish: an OAuth *Client ID* is public by design (it is not a secret).
 * Paste the Web client ID from Google Cloud Console between the quotes, e.g.
 *   GOOGLE_CLIENT_ID: '1234567890-abc123def456.apps.googleusercontent.com'
 * You can instead paste it in the app under Settings -> Google Contacts -> Client ID
 * (stored only in this browser's localStorage; a value saved there overrides this file).
 * See GOOGLE_OAUTH_SETUP.md / USER_GUIDE.md "Connect Google Contacts". */
(function (root) {
  'use strict';
  var cfg = {
    GOOGLE_CLIENT_ID: '',
    // Read-only contacts access + the account's email address (only used to show "Connected as ...").
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email',
    // Background sync while the app is open and visible (3-5 minutes is the intended range).
    SYNC_INTERVAL_MS: 4 * 60 * 1000,
    // Automatic triggers (focus / visibility / online) are skipped if the last sync is newer than this.
    SYNC_MIN_GAP_MS: 45 * 1000
  };
  var o = root.CRM_CONFIG_OVERRIDE; // test hook only
  if (o) for (var k in o) cfg[k] = o[k];
  root.CRM_CONFIG = cfg;
})(typeof self !== 'undefined' ? self : this);
