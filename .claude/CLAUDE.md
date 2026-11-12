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
