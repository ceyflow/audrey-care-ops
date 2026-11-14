# Audrey Care Ops: standing rules from the owner

These are rules the owner has asked to be remembered. Follow them in every future session, without
needing to be told again. Add new rules below as they come up.

---

## Panel closing Rule

*(Named by the owner on 2026-11-11. When they say "apply the Panel closing Rule" to a panel, this is
what they mean.)*

**The rule.** A panel/window that contains a **form people type into** must **not** close when the
dim background outside it is clicked or tapped. It closes **only** through its own explicit controls:
**Close / Cancel / Save / Create / Log / Delete**. One stray click must never throw away half-typed work.

Windows that are **not** forms (viewers, simple pickers, lists, settings editors with nothing typed)
keep the normal behaviour: clicking outside closes them.

**Apply it by default.** Any *new* panel or window that contains a form must follow this rule from the
start. Don't wait to be asked, and mention it in your summary.

**Panels that follow the rule today**
| Panel | `state.modal` value |
|---|---|
| New order | `order:new…` |
| Mixing Step Templates editor | `mixingtemplatesteps…` |
| Log a complaint, and Complaint details | `complaint:new` and `complaint:<id>` (matched as `complaint:`) |
| Driver's stop form (Delivered / Not at home / Returned, with photo + note) | `driverstop:<status>:<order>` (matched as `driverstop:`) |
| Profile details (full name, mobile) | `profiledetails` |
| Notes & Reminders (`#notes-fab-popup`) | not `state.modal`-based — its own `state._notesFabOpen` flag and `#notes-fab-backdrop` handler (search for "Panel closing Rule: this popup holds the note-compose textarea"). Closes only via the X button or re-toggling the bell. The nested share-staff dropdown inside it is a picker, not a form, so it still closes on an outside click. |

Deliberately **not** covered (not forms): `complaintreasons`, `complaintpriorities`,
`complaintphotos:…`, `complaintcustomerview:…`, Box Count (closes on outside click on desktop; on
phones it is a full-screen page with its own back/Cancel/Save).

**Where it lives in the code.** In `index.html`, search for the comment
`Modal generic — clicking the overlay background closes the modal`. Just below it, the overlay's
`mousedown` handler returns early (does not close) when `state.modal` starts with one of the exempt
prefixes. To apply the rule to another form panel, add its `state.modal` prefix to that check and
update the comment and the table above.

**Two HTML files, kept identical.** The app ships as `index.html` and `audrey-care-ops-v9.html`.
Every change must be made in both; after editing `index.html`, copy it over the other and confirm
with `cmp`.

**How to verify (do this each time the rule is applied or a form panel is added)**
1. Open the panel, type something into a field.
2. Click on the dim background outside it (desktop: a click near the top-left corner of the page;
   phone: a tap near it).
3. The panel must stay open and the typed text must still be there.
4. Its Close/Cancel button must still close it.
5. A non-form window must still close on an outside click (nothing else changed).

**Applies to every role** (Admin, Sub Admin, Customer care, Packing, and the rest), including roles
that can only add an update to a complaint: they close it with Close like everyone else.

---

## System notes (written by Claude after the 2026-11-11 security work; not owner rules)

Keep these true when changing the app. Details and the audit are in the owner's private report, not in this repo.

- **Sign-in.** Name -> `resolve_login` (database function, anonymous-callable) -> one `signInWithPassword`. A person's
  role, name and on/off status come ONLY from the `profiles` row, which only an Admin (or a service-role Edge Function)
  can change. The browser never writes its own role, and never trusts the saved account list for it.
- **Accounts** are created, reset and deleted only by the Edge Functions `admin-create-account`,
  `admin-reset-password`, `admin-delete-account` (sources in `supabase/functions/`; they find accounts by exact
  profile name, never by matching the end of an address). Do not bring back browser sign-ups or browser-written profiles.
- **Deactivate** = `profiles.active = false`: the database gives that login no data and the app signs it out.
- **The account record** (`app_data` key `auth`) is readable by signed-in, switched-on people and writable by Admin only.
  It holds the roster (names, access levels, Employer codes, extra pages) and never any passwords. Only an Admin's
  browser writes it back on page load.
- **Database rules.** Logged-out visitors can only read the login-page branding keys (`theme`, `branding`,
  `loginCustomization`), call `resolve_login`, and use the order-tracking/rating functions. Private backups of the
  state before the change are in the database schema `private_backup` (tables `*_20261111`).
- **Third-party scripts** (supabase-js, lottie, leaflet) are pinned to exact versions with `integrity` hashes. When
  upgrading, change the version AND the hash together, and test in a real browser.
- **Service worker** is the real file `sw.js` at the site root (network-first, this site's own files only; it never
  touches Supabase or CDN requests). Never build it from a `blob:` address: browsers refuse that.
- **Order Product** is stored as small HTML (bold/italic/underline/line breaks). Always show it through `richText()`
  and read it as text through `stripTags()`; both are inert/allow-listed. Never insert it raw.
- **No secrets in the page.** `send-sms` and `ask-dally` accept only a signed-in, switched-on member (the page sends the
  person's own token via `functionHeaders()`); `track-citypak` serves the public tracking page, so it only answers for
  a tracking number that belongs to a real CityPak order and limits each visitor. The real keys (send.lk, CityPak,
  Gemini) live only as Edge Function secrets. Never put a key or shared password in `index.html`.
- **Public order lookup** (`track_order`, `submit_order_rating`): attempts are limited per visitor (table
  `private.rate_limits`, helper `private.hit`), partial phone numbers do not match (a full number is needed), and the
  page shows the customer's FULL name (the owner chose this; do not shorten it). Keep the limits and the full-number rule.
- **Logged-out visitors save nothing** (`kvSet` / `saveQuietly` refuse). Saving "no value" (null) deletes the row.
- **Install (PWA).** `manifest.webmanifest` + `assets/icons/` are real files linked from the page; do not turn the
  manifest back into a `data:` address (phones cannot fetch that to build the installed app).
- **AC lorry runs (Delivery runs / My delivery run).** Office page `deliveryruns` (Admin and Sub Admin ONLY, by the owner's decision: the database
  function `private.is_run_manager()` allows just those two roles; do not add others) builds a run: a Driver account + AC Delivery orders at stage 3, in stop order. The driver
  signs in with a **Driver** account (custom role "Driver", only page `driverrun`; created automatically by an Admin's browser,
  and the page falls back to `ROLE_PAGES.Driver`), starts the run, and marks each stop Delivered (signed-invoice photo required) /
  Not at home / Returned. Marking a stop sets the order's `deliveryOutcome` (Delivered / On Hold / Returned) itself.
  Everything goes through database functions (`runs_overview`, `run_create`, `run_cancel`, `lorry_drivers`, `driver_run`,
  `driver_start_run`, `driver_mark_stop`, `driver_send_location`, `driver_finish_run`, `driver_device_token`, `lorry_ingest`,
  `track_lorry`); the tables live in the `private` schema (`delivery_runs`, `delivery_stops`, `lorry_positions`, `driver_devices`)
  with no direct access for anyone. A Driver account reads no shared data. Cancelling a run only marks it finished (no deletes).
- **Lorry position (switched OFF for now, by the owner).** No live location or map is used anywhere in the app: the driver page
  has no sharing button, stop updates send no GPS point, and the office page has no map or phone-tracking setup. The pieces are
  still in place but unused: the Edge Function `lorry-location` + database function `lorry_ingest` (Traccar Client, a driver's
  private device token from `driver_device_token`), `driver_send_location`, and the `lorry_positions` table. No device token
  exists, so nothing can be stored. To turn it on again, bring back the setup sheet, the office map and the driver backup button
  (see git history, PR #22 and #26).
- **Customers** (public tracking page, AC Delivery orders at stage 3+) call `track_lorry(order_id)`: state (loading / on the way /
  delivered / not home / returned), the driver's FIRST name and the delivery time. NO map, NO lorry position and NO
  "stops before yours" count, by the owner's decision (the function does not return them). Never other customers' names, phones or
  addresses. It is rate-limited per visitor. Keep it so.
- Driver proof photos go to the `order-photos` bucket under `proofs/<run>/`; like all buckets it is public by link (private
  buckets are still an open optional job).
- **Inactivity sign-off (screen off / app closed).** A phone freezes the page while the screen is off, so no timer can sign anyone
  out then. Three backstops: (1) at boot, BEFORE any data is fetched, `signedOffByTimeLimit()` compares the last real activity
  (`localStorage audrey_lastActivity`) with the role's limit remembered from the last visit (`audrey_signoff` = {role, mins},
  written by `scheduleSignOffTimer`) and signs out straight to the sign-in page; (2) a 3-second steady check, plus
  visibilitychange / pageshow / focus, signs out the moment the page runs again; (3) the older check at the end of `loadAll`.
  Sign-off always clears the session FIRST and only then shows the toast (`signOffForInactivity`). `saveSession()` restarts the
  activity clock, so only use it for a real login. Role limits are set per role in Settings -> User roles (0 = Off).
- **Phone header (owner, 2026-11-12).** One slim row, about 60px tall: page title + subtitle on the left, bell + avatar on the right,
  built from a reference screenshot. The AUDREY logo and the account line are NOT drawn in the phone header (the owner chose
  this; the logo is still in the side menu and on the sign-in page). Settings -> Mobile appearance options (icons left, dark
  background, header image) still apply. Desktop header: the title sits at the left edge (the phone-only `.topbar-img-layer`
  must stay `display:none` on desktop or it pushes the title to the middle).
- **Profile drawer + Profile details (owner, 2026-11-12).** On a phone the avatar in the header opens a LEFT slide-in drawer (big photo,
  name, Profile details, Activity log (Admin), Change password, Log out; slides in/out via the `drawer-in` / `drawer-out` keyframes and
  `closeHeaderMenuAnimated()`). On desktop the same items stay as plain header links. "Profile details" (`profiledetails`) edits a
  person's FULL NAME and mobile number, stored on their OWN `profiles` row (`full_name`, `mobile`; the guard trigger only blocks id /
  role / staff_name / active / created_at, so people may edit these two). The sign-in name (username) stays `profiles.staff_name`
  and is read-only. The printed attendance sheet shows the full name (falls back to the username): Admin and Sub Admin read everyone's
  full names through the database function `staff_full_names()` (`ensureFullNames()` / `fullNameFor()`); nobody else can list them.
- **iPhone safe areas (owner, 2026-11-13).** The app runs full-screen (`viewport-fit=cover`, translucent status bar), so anything pinned
  to the top or bottom of the screen on a phone must be padded with `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`, or its
  buttons end up under the status bar / home bar and cannot be tapped (Box Count's back button was exactly this). Already handled:
  the header, `.overlay` (centred modals), `.drawer` (order / blend / R&D / complaint drawers, incl. their back + close buttons),
  Box Count (`.bc-modal`), Profile details, the account drawer, `.batch-focus` (Production Guide full screen), chat toolbar, the red
  error bar. Any NEW full-screen or fixed phone surface must do the same. To check: emulate the notch in Chromium with the CDP call
  `Emulation.setSafeAreaInsetsOverride` (top 47, bottom 34) and look for buttons whose top is above 47px.
- **Profile drawer / panel animation.** The drawer's slide-in plays only on the opening render (`state._headerMenuAnim` -> `.anim`),
  never when the page re-renders behind it; closing slides out first (`closeHeaderMenuAnimated`), and the Profile details panel
  slides in from the right on phones and slides out (`closeProfileAnimated`) before it is removed.
- **Speed on older PCs (owner, 2026-11-13).** Staff pictures were saved as the full camera photo (60-225 KB each, 1.4 MB for eight people)
  INSIDE the shared `staff` data, so every sign-in downloads it, every live update re-sends it and every redraw pastes it into the page
  again, which made slower PCs sluggish. Staff photos are now stored at 256px (about 15 KB): `uploadStaffPhoto` downscales, and
  `shrinkOversizedStaffPhotosIfNeeded()` (Admin's browser, once, after load) shrinks old ones. NEVER store a full-size image inside shared
  `app_data` rows (branding's login hero photo is the other known case). A "Lite mode" (no blur / animations) was built and then REMOVED
  at the owner's request: do not bring it back unless asked.
- **Profile details is a phone-only feature (owner, 2026-11-13).** The "Profile details" link is hidden on a PC (`@media (min-width:761px)`),
  where the header links stay Activity log / Change password / Log out.
- **Chat (owner, 2026-11-14): WhatsApp-style Team chat + private 1-to-1 chats.** Staff-only (no customers, no bots). Who can chat = Admin + roles
  that have the `chat` page (`role_data_access` data_key `chat`; Staff/Driver roles have none). Data lives in tables `chat_threads` (the Team thread has the
  fixed id `00000000-0000-0000-0000-00000000c0de`), `chat_messages`, `chat_reads`, `chat_reactions`, `chat_monitor_log` (unused now; RLS on, no direct writes for anyone) and
  is reached through the `chat_*` database functions (`chat_people`, `chat_open_dm`, `chat_threads_overview`, `chat_send`, `chat_edit` (own, 15 min),
  `chat_remove` (own, "deleted for everyone"), `chat_react`, `chat_mark_read`, `chat_mark_delivered`). Realtime uses
  `postgres_changes` on the three message tables (RLS-filtered) + a per-thread broadcast channel for "typing". Client code: `c2*` functions and
  `renderChat2Page` in `index.html` (search "Chat (WhatsApp-style)"); CSS classes `.wa-*`. The old `app_data` key `chat` is NOT used or fetched any more;
  its 275 messages were copied into the Team thread (`legacy` column keeps the old fields) and the old row is left in place as a backup.
  * **Private chats are private (owner, 2026-11-14).** Nobody, Admin included, can read a private chat they are not part of. There is no Monitor page and
    no logging of Admin openings (the owner called it unnecessary; the `chat_monitor_*` database functions are switched off for everyone and unused).
    Do not add an Admin way to read private chats unless the owner asks.
  * **90 days.** Messages older than 90 days are invisible to everyone immediately (RLS) and are physically removed by the Edge Function `chat-purge`
    (source `supabase/functions/chat-purge/`, Admin-only, called about once a day by an Admin's browser after load, `localStorage audrey_chat_purge`).
  * **Admin message panel (owner, 2026-11-14):** when an Admin writes to someone (Team chat OR private) who is not watching that conversation, a message
    panel (`state.adminBroadcast`, `renderAdminBroadcastPanel`) opens in front of everything. A Packing session must reply to dismiss it (no outside
    click / Close); every other role can reply or press Close. The reply goes into the same chat as a reply to that message. Not shown while the person
    is watching that conversation. The page/menu is named "Chat"; the group conversation inside it is still "Team chat". Old @mentions, pins, chat
    themes and "Delete chat history" were not carried over.
  * Phone layout is one pane at a time, full screen (header/tab bar hidden on `page-chat`), padded with `env(safe-area-inset-*)`; on a PC the list and the
    conversation sit side by side. No popup notice is shown while the chat page itself is open (the list shows unread badges).
