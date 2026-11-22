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
| Log a complaint, and Complaint details | `complaint:new` and `complaint:<id>` (matched as `complaint:`) |
| Driver's stop form (Delivered / Not at home / Returned, with photo + note) | `driverstop:<status>:<order>` (matched as `driverstop:`) |
| Profile details (full name, mobile) | `profiledetails` |
| Add customer / Edit customer | `customer:new` and `customer:<id>` (matched as `customer:`; the colon keeps `customerimportreview`, `customercsvformat`, `customercolumns` as normal click-outside windows) |
| Chat -> Group info (Admin edits the group name) | not `state.modal`-based: `state._c2.gi` and its own `#wa-gi` overlay, which has no outside-click handler. Closes only with the X button. |
| Notes & Reminders (`#notes-fab-popup`) | not `state.modal`-based — its own `state._notesFabOpen` flag and `#notes-fab-backdrop` handler (search for "Panel closing Rule: this popup holds the note-compose textarea"). Closes only via the X button or re-toggling the bell. The nested share-staff dropdown inside it is a picker, not a form, so it still closes on an outside click. |
| Add color sheet (name + size + look) | `colorsheetnew` (`colorSheetNewModal`, form `#form-colorsheet-new`) |
| Mixing and Filling: New batch, and the batch window (variation rows) | `blend:new` and `blend:<id>` (matched as `blend:`; the colon keeps `manageblendstages` / `blendstageblocked`, which have nothing typed, as normal click-outside windows) |

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

## New permissions: switch them on for the right roles in the LIVE data too

*(Owner, 2026-11-21: "update the permission roles in future like these updates as well".)*

**The rule.** Whenever a change adds a NEW permission to `PERMISSION_REGISTRY`, do not stop at the code. In the same piece of work, also set it in the live
role records, because a saved role never has a key that did not exist when it was last saved (absent = OFF for every role except Admin). How:

1. Decide which roles get it. If the owner named them, use exactly that. If they did not, ask which roles (Admin always gets it).
2. Update the live row with the Supabase tools (project `mntnobzwbvqpvmaxqcuc`, table `app_data`, key `userRoles`, a JSON array of role records, each with a `permissions` object).
   Use ONE targeted statement that only sets the new keys with `jsonb_set(r, '{permissions,<id>}', 'true'::jsonb, true)` for the named roles, keeps the array order
   (`jsonb_agg(... order by ord)` over `jsonb_array_elements(value) with ordinality`), and sets `updated_at = now()`. Read the row first; check the result afterwards (still 10+ roles, only the intended keys changed). Never rewrite a whole role.
3. Say in the summary exactly which roles now have it. Setting a permission to `true` for Admin explicitly is fine (it shows ticked in Settings).
4. Also tell the owner people may need to refresh once.

**Current live state (2026-11-21).** `orders_print` (Print an order): Admin, Sub Admin, Packing. `batchsheets_assign_machine` (choose the machine on a batch sheet): Admin, Sub Admin. `colorsheets_view` (see Color sheets): Admin, Sub Admin, Production Executive. `colorsheets_edit` (edit / add / delete color sheets): Admin, Sub Admin.
`blending_manage_stages` (Manage Lists on Mixing and Filling: add / rename / reorder / delete stages): Admin only (owner, 2026-11-22). The old `blending_delete` switch is RETIRED: deleting a batch is now Admin only, hard-coded by the owner's decision (see the Mixing and Filling note below); stored `blending_delete` values in the roles are ignored.
Everyone else: off (switchable in Settings -> User role permission).

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
- **Every page / view / action must be switchable in Settings -> User role permission (owner, 2026-11-17).** The owner turns things on per role there
  and cannot do it if the switch is missing ("I told you to add every single data"). Any NEW page, view or action goes into `PERMISSION_REGISTRY`
  (and `ROLE_PERM_PAGE_DEPT` for a page) in the same change, and is checked with `roleCan()`. Do not hide a feature behind a hardcoded role name.
  Example: **`complaints_view_ongoing`** ("See ongoing complaints only (read only...)"): turning it on opens the Complaints page for that role BY ITSELF
  (`pagesForRole` adds `complaints`, so the database data grant follows; the page switch shows on + locked) and shows a trimmed read-only page
  (`complaintsOngoingOnly()` = has it AND lacks `complaints_manage`): tabs Open / Assigned / In Progress only (`ONGOING_COMPLAINT_STATUSES`), no Archive,
  no Log complaint, no customer link, no Customer view / Delete / Restore; rows say "View" and open a simple PREVIEW panel (`complaintview:<id>`, `complaintViewModal`; owner, 2026-11-17): customer, reason, logged date, status and images ONLY (tap an image to enlarge); no steps / update history, no assignee, no phone, no priority, no description, no form. It opens even when the complaint is assigned to someone else (`openComplaint`). It is a viewer, not a form, so it is NOT in the Panel closing Rule list: an outside click closes it. It is a SCREEN-level
  filter: the `complaints` data row is still delivered whole to anyone who can read the page (the Dashboard already reads it). Admin and roles with
  `complaints_manage` keep the full page.
- **Box Count: previous days (owner, 2026-11-18).** The Box Count panel (`boxCountModal`) can look back at earlier days, VIEW ONLY: arrows (day -/+), a date
  picker (never a future date), and shortcut chips for the 7 most recent earlier days that have counts (with box totals). A past day shows that day's totals and entries
  but no entry form, no edit / delete / tick-boxes (`boxCountSavedRowHtml(b, true)`); "Today" / "Back to today" returns (`state._bcDate`, reset by `closeModal`).
  Who: Admin and Sub Admin always, other roles through the switch `orders_boxcount_history` ("See previous days' box counts (view only)", Orders board section of User role
  permission) -- `canViewBoxCountHistory()`. Typed-but-unsaved rows block jumping away (toast "Save or clear today's rows first"). Gotcha: `render()` restores every typed field of the open
  panel to its OLD value (`captureOpenFormFields`), so `boxCountGoToDate` sets the date box AFTER render. Data was always kept per day (`boxCounts[].date`); nothing in the data changed.
- **"Recipe library" is now "Batch sheets"; Transfer moved to the Process template page; one clean phone preview (owner, 2026-11-21).** (1) The page id stays `recipelibrary` (no data / permission changes), only the words
  changed (nav label, page title, Blending Department card, Production Guide hint). A label the owner already renamed in Settings -> navigation still wins. (2) The "Transfer to Production Guide" button is GONE from the costing
  versions list. On the Process template page, left of the upper Cancel, there is **Transfer to batch sheets** (`transferProcessToBatchSheets`, needs `costing_edit`): NO popup; it builds a batch sheet from the ACTIVE version +
  the SAVED process template at a fixed **100 kg** (owner, 2026-11-21), adds it to `state.recipes`, and opens Batch sheets. It asks to save first when the page has unsaved changes and needs an Active version.
  The real size is typed on the OPEN batch sheet: a **Batch size (kg)** box (`#sheet-batch-kg`, `updateSheetBatchKg`) rewrites the Amount column live (percent x size); the typed value lives in `state._recipeDraft.sheetKg` until Save / Start the batch writes it to the recipe
  (`r.batchSizeKg`; since 2026-11-21 it IS saved, see the "Save and Start the batch save EVERYTHING" note) and `sheetBatchKg(r)` feeds the sheet, Print and Start batch (`activeBatch.batchSizeKg`, so the Mixing and Filling card gets that size). The saved process-template steps are the same at any size.
  (3) Settings -> Mobile appearance preview is one thin-outline phone (dynamic island, side buttons) at 390 x 844; the iPhone SE / 14 / 14 Pro Max buttons were removed (`MOBILE_PREVIEW_DEVICES` has one entry).
- **Batch sheet = a PAGE; machine on each card (owner, 2026-11-21).** Clicking "Batch sheet" on a Batch sheets card no longer opens a popup: `openBatchSheetModal(id)` (name kept) sets `state._batchSheetId` and
  `renderRecipeLibraryPage` draws the same sheet as a page (`recipeBatchSheetInner(id, true)`, `#batchsheet-page`). It is a browser-history step (`s.bs` in `navSnapshot`); its **Close** button steps back
  (`closeBatchSheetPage` -> `navBackIfParent`); unsaved step edits (`batchSheetDirty`) make browser Back and the sidebar ask "Discard changes?". The old modal route (`recipesheet:`) still exists but nothing opens it.
  Each card has a three-dots button (`.rc-dots`) with Machine 1 / 2 / 3 (+ "Clear machine"); the choice is saved on the recipe (`r.machine`, `setRecipeMachine`)
  and shown in colour on the card and at the top of the open sheet (`BATCH_MACHINES`: blue / amber / green, dark enough for text). Needs the permission **`batchsheets_assign_machine`** (Costing & Recipe section; Admin has it
  automatically, every other role starts OFF until switched on in User role permission).
- **Batch sheet in two columns, kg in the steps, machine on the Production Guide card, machine alert sounds, no auto-advance (owner, 2026-11-21).**
  (1) The open Batch sheet page (`recipeBatchSheetInner`) is TWO columns: LEFT `.bs-left` = logo, date, product, machine, **Batch No. + Batch size side by side** (`.bs-run`, ids `sheet-batch-no` / `sheet-batch-kg`) and the materials table
  (sticky on wide screens, scrolls on its own); RIGHT `.bs-right` = Production Steps. One column on a phone, sheet first. (2) The **Wait (min) box stays** on every phrase of the sheet, next to the Instruction (owner, 2026-11-21: "Don't remove wait time"; an earlier version of this change removed it by mistake).
  A step with a wait still counts down on the Production Guide; the printed ledger keeps its Wait column; read-only roles see the wait as a chip. (3) A phrase made on the Process template keeps `{lines:[{name,percent}], instruction, ingredient}`; the sheet, the Production Guide card, the Big screen, "All steps", the toast and both prints show each raw
  material on its own line with the quantity in **kg of the typed batch size** (percent x size; `phraseQtyText`, `stepRawLines`, `stepSummaryText`, `batchMaterialsHtml`), live while typing the size (`updateSheetBatchKg`, cells `.bs-qty[data-pct]`).
  Percentages appear only if no batch size is known at all. On the sheet only the INSTRUCTION of such a phrase is typed (`step-instr-<id>`; `syncDraftStepFieldsFromDOM` rebuilds the old one-line `ingredient` via `phraseIngredientSummary`);
  the raw-material lines are edited on the Process template page. A plain-text phrase (old sheets, "+ Add phrase", templates) still uses `step-ing-<id>` / `ingredient`. `saveBatchSheetSteps` MUST keep `lines`/`instruction` (it used to drop everything but
  `ingredient`). People without `costing_edit_steps` get the same cards read-only. (4) Starting a batch copies the sheet's machine into `activeBatch.machine` (and onto the finished `blendBatches` record); the Production Guide card and the Big screen show it
  (`machineChipHtml`). Start first saves unsaved step edits, then jumps to the Production Guide (`goTo('recipes')`). Batches now run SEVERAL AT ONCE, one per machine (2026-11-22, see the "Several batches at once" note below).
  (5) **Never auto-advance:** when a timed step's countdown reaches 00:00 the batch stays on that step (counter 00:00, alert repeats every 15 s) until a person presses Next; Next / Previous / Restart / Pause / Stop also silence a sounding alert (`stopAlertSound`).
  Do not bring the auto-advance back. (6) Settings -> **Machine alert sounds** (was "Timer alert sound"; ids `settings-timer-alert-sound` / `form-alert-sound` unchanged): one sound per machine in `branding.machineAlertSounds`
  ({'Machine 1': 'chime', ...}) plus the "No machine chosen" sound in `branding.alertSound`; an unset machine uses its own starter sound (`MACHINE_DEFAULT_SOUNDS`: chime / bell / alarm) so they never sound alike (`alertSoundForMachine`,
  `playBatchAlertSound(machine)`). The sound plays when a TIMED step (one with a wait) has finished; a phrase with 0 wait never sounds. No new permission was added (nothing to switch on in the live roles).
- **Batch sheet: Save and Start the batch save EVERYTHING typed (owner, 2026-11-21: "batch size, batch number or any changes should save once click Save and click Start the batch").**
  `saveBatchSheetSteps(recipeId)` writes the steps AND the typed **batch number** (`r.batchNo`) AND **batch size** (`r.batchSizeKg`) to the recipe; the Start button first calls it when `batchSheetDirty()` (which now also
  counts a changed batch number / size), then starts the batch with those values and opens the Production Guide. Opening a sheet shows the last saved number and size (`startBatchSheetPage`). Leaving with any of it unsaved asks "Discard changes?".
- **Shared settings are readable by everyone signed in (owner, 2026-11-22; found by an audit).** The owner-chosen settings `navLabels`, `navOrder` (menu names / order), `smsTemplates` (customer SMS wording), `batchDisplay` (Production Guide instruction style),
  `batchSheetTemplate` (printed batch sheet look) and `dallySettings` (Dally AI on/off) had NO `role_data_access` grant, so every role except Admin silently used the built-in defaults (e.g. Packing sent the default "picked up" SMS, not the owner's wording).
  Database policy `signed-in can read shared settings` (migration `shared_settings_readable_by_signed_in`) lets any signed-in, switched-on person READ exactly those six keys; WRITING is unchanged (Admin, or a role explicitly granted the key). A NEW owner-chosen setting that every role must see needs
  its key added to that policy's list (or a grant), otherwise only Admin sees it. `systemNotices` was left out on purpose: nothing in the app creates system messages any more, and dismissing one needs write access.
- **Supabase egress / billing (2026-11-22): the project is on the FREE plan and went over its 5 GB monthly egress (6.58 GB, 132%); grace period until 17 Dec 2026, after which requests can be refused with HTTP 402 (the whole app would stop) unless the plan is upgraded or usage drops.**
  What drives it (measured / estimated): (1) every sign-in or refresh downloads every readable row in one query (`.in('key', SYNCED_KEYS)`), about 2 MB for a signed-in person and about 0.7 MB for a logged-out visitor (the public `branding` row alone is 678 KB because its logo / hero / background images
  are stored inside it as base64); (2) EVERY logged action (`logActivity`) re-saves the whole `activityLog` row (about 310 KB) and Realtime broadcasts that whole row to every connected device; `orders` (about 334 KB) does the same on every order change; (3) automated tests that hit the live
  database. RULES: browser tests must ALWAYS stub Supabase (`page.route('**/*.supabase.co/**', ...)`) - one unstubbed page load costs 0.7-2 MB of the monthly allowance; never store images inside `app_data` rows (use the storage bucket and keep only the URL); do not add big rows to `SYNCED_KEYS`.
  DONE (owner chose "reduce the usage", 2026-11-22): (a) the activity log is now DATABASE ROWS, not a synced row: `private.activity_log` (no direct access), the functions `log_activity(p_actor, p_role, p_message)` (any signed-in, switched-on person; `logActivity()` calls it after every action) and
  `activity_log_recent(p_limit, p_before)` (Admin only; the Activity log window calls it when it OPENS, 1000 at a time with "Load older entries" and "Refresh"; the full backup also fetches it). Entries older than 180 days are removed by `log_activity` itself (about 1 insert in 100). `activityLog` is no longer in `SYNCED_KEYS`
  or in any role's data keys (`PAGE_DATA_KEYS_VERSION` 23); the old 2025 entries were copied with `legacy_id` (repeatable: `insert ... on conflict (legacy_id) do nothing`). (b) the branding images live in the PUBLIC storage bucket `branding` (only an Admin can add / replace / delete: storage policies use `current_user_is_admin()`), and
  `branding.addons[].image` holds the public link. `brandImageToStorage(image, addonId)` is used at every place an image is saved (cropped logo, custom addon, Mobile appearance background); if the upload fails the image is kept inside the row so nothing breaks; `migrateBrandingImagesToStorage()` (Admin's browser, after load) moves any leftover base64 image. If another role is
  ever given `branding_manage` its uploads will fall back to base64 until the storage policy allows it. Still big and recurring: the `orders` row (about 334 KB, 303 of 310 orders are ARCHIVED = 98% of it, re-sent whole on every order change) - the next saving would be an on-demand archive store (the public `track_order` / `submit_order_rating` functions read `orders` and would need to read both).
  Rough estimate after (a) + (b): about 2.7 GB a month instead of 6.6 GB (check Supabase -> Usage -> Egress a few days after deploying).
- **Several batches at once, one per machine + "Time's up" notifications (owner, 2026-11-22: "if any running batch ended a timer, alert with a notification message with details ... if 2 machines ran out together, show 2 notifications").**
  (1) DATA: every machine has its OWN saved key = its own slot: `activeBatchM1` / `M2` / `M3` for Machine 1 / 2 / 3 (`batchKeyForMachine`, `BATCH_SLOT_KEYS`), and a batch with NO machine chosen uses the original `activeBatch` key (only one of those at a time). Separate keys, NOT one array, on purpose: each slot keeps the
  hardened single-object save / verify / stale-copy code, and two tablets on different machines can never overwrite each other. All four are in `SYNCED_KEYS`, `PAGE_DATA_KEYS.recipes` (`PAGE_DATA_KEYS_VERSION` 22) and `role_data_access` (live: Blending, Production Executive, R&D Officer, Sub Admin, same as `activeBatch`). A fourth machine needs its own key in all those places.
  Helpers: `runningBatches()` -> `[{key, b}]`, `batchSlotBusy(machine)`, `batchFocusEntry()`, `resolveBatchKey()`. EVERY control takes the batch's key (`startBatch` returns true/false, `pauseBatch(key)`, `resumeBatch`, `nextBatchStep`, `prevBatchStep`, `restartCurrentStep`, `stopBatch`, `finishBatchIntoBlendingBoard(b, key)`, `saveActiveBatchVerified(key)`, `verifyActiveBatchStillCurrent(key, id)`).
  Starting a batch on a machine that already runs one is REFUSED with a toast naming it ("Machine 1 is already running ..."); the Start items on Batch sheets show "Machine N is busy". A batch that was running in the old `activeBatch` key with a machine is copied to its machine's slot by `loadAll` (only cleared after the copy is saved). Finishing one batch goes to Mixing and Filling only when no other batch is still running; otherwise it stays on the Production Guide.
  (2) SCREEN: the Production Guide is a grid of tiles (`.batch-tiles`, one `.batch-tile[data-bt-key]` per batch; buttons use `data-bt-act` + `data-bt-key`). The big screen shows the CHOSEN batch (`state.batchFocusKey`) with a pill switcher (`.bf-switch`, an amber ring + clock on a machine whose time is up); its own buttons keep their ids and act on that batch.
  (3) ALERTS: ONE ticker (`batchTick`, every second, Production Guide page only, like the sound before) goes over every running batch. When a TIMED step reaches 00:00 the batch stays on the step (never auto-advances) and: that machine's tile gets an amber ring + "Time's up" tag, its sound plays every 15 s in the sound chosen for the MACHINE on its OWN sound channel
  (`playAlertSoundById(id, seconds, channel)`: channels = slot keys, so two machines can sound at once; `stopAlertSound(channel)`; the Settings preview uses channel 'main'), and a NOTIFICATION CARD (`#timer-alerts`, `timerAlertCardsHtml`) shows machine, product, batch no. / size, step, how long over, with **Open batch** (big screen on that machine), **Next step** (people who can run batches) and **Silence**
  (that machine's sound only; the card stays, marked "sound off"); the small x hides the card for this step. Two machines out together = two cards. Silence / hide are per device, per step (`state._alertSilenced` / `_alertHidden`, keyed by `batchStepSid`), nothing is saved. Cards sit top-right (kept clear of the tiles by `.batch-tiles{max-width}` on wide screens), compact bottom-right on the big screen, full width on a phone.
  No new permission (part of the Production Guide). Tests: build a state with several recipes on different machines, `startBatch` each, push `stepDeadline` into the past and call `batchTick()`.
- **Batch sheets card: the three dots = Start the batch / Machine / Delete; the Production Guide big screen shows the batch sheet (owner, 2026-11-21).** (1) The card's three-dots menu (`.rc-dots`, `data-recipe-menu`) holds, each only for roles allowed to do it:
  **Start the batch** (`blending_manage` = `canManageBlendBoard()`; `startBatchFromCard` runs the sheet with its SAVED batch size and batch number and opens the Production Guide; disabled with "A batch is running" while one runs), **Machine** 1 / 2 / 3 + Clear
  (`batchsheets_assign_machine`), and **Delete** (`costing_delete_recipe`, asks first). The button shows when any of the three is allowed. The old separate Delete button on the card is gone. No new permission. (2) The big screen's RIGHT column (`.bf-right-col`) is the
  **batch sheet** of the running batch (`batchRunSheetHtml`: batch no., size, machine, materials No / Raw material / % / Amount at THIS batch size, the raw materials of the step on screen highlighted) above "All steps". `startBatch` saves the sheet's materials onto
  `activeBatch.materials` (older running batches fall back to the recipe's); the finished record uses them. The backup table of the removed templates (`private_backup.mixing_step_templates_20261121`) was dropped at the owner's request.
  **Big screen: Batch sheet + All steps side by side, no scrolling (owner, 2026-11-21: "need both batch sheet and all steps in one visible area, no need scroll, add to right side both of them"; "plan neatly and clearly").** From 1200px wide `.bf-right-col` is a 2-column grid (width `clamp(600px,46vw,980px)`): Batch sheet left, All steps right, each as tall as the screen (`.batch-focus-body` is `overflow:hidden` there; a card scrolls inside itself only as a last resort). Row height follows the screen height AND the number of raw materials (`--bf-rows` set on `.bf-sheet-card`, `calc(((100vh - 320px) / (rows + 1) - 19px) / 2)`), so even 18 materials + 12 steps fit at 1904 x 846 and 1366 x 768. Batch no. / size / machine are three tidy cells; the % column is hidden below 1500px (the kg amount is what matters); the step being worked on is highlighted in All steps. 1100-1199px stays stacked (compact rows) and phones / tablets keep the normal stacked page.
  Test with `bf-shot.js`-style scripts (set `state.activeBatch` + `state.batchFocusMode=true`) and compare each card's `scrollHeight` with `clientHeight`.
- **Color sheets + the 2-page printed batch sheet (owner, 2026-11-21: "color sheets button near + New batch ... create exactly like I gave"; "change the print batch sheet ui design like the order print, clean better template, structured to 2 pages").**
  (1) COLOR SHEETS. Mixing and Filling (`renderBlendingBoardPage`) has a **Color sheets** button (`#btn-open-colorsheets`) before **+ New batch**. It opens a page (`state._colorSheetsOpen`, a browser-history step `s.cs` in `navSnapshot` / `navApply`, no tiny back button)
  of small `.landing-card` pills, one per sheet (Shampoo, Shower Gel, Conditioner, Hand Wash, Air Freshener), plus **+ Add color sheet** (needs `colorsheets_edit`). Opening a card shows the sheet as a paper page (`colorSheetPaperHtml`, the same markup for screen, Print and the
  editor preview) with Print / Edit / Close. Data = app_data key `colorSheets` (`SYNCED_KEYS`, `PAGE_DATA_KEYS.blending`, `PAGE_DATA_KEYS_VERSION` 21): `[{id, name, subtitle, qtyHeader, barColor, tintColor, subtitleColor, footer, rows:[{id, product, lines:[{id, color, qty}]}], createdAt, createdBy}]`.
  The five starter sheets were typed from the owner's four PDFs and inserted by SQL (NOT by page code, so nothing can re-seed them): Air Freshener keeps its subtitle "( 5Kg )" next to the table header "Quantity ( 50Kg )" exactly as the PDF shows (editable). Editing (`#colorsheet-edit`, `startColorSheetEdit`)
  is a full PAGE: name, subtitle, quantity heading, footer, the three colours, and every row (product + one or more colour / quantity lines, add / remove row and line); `captureOpenFormFields` includes `#colorsheet-edit` in its selector; unsaved edits are guarded by `colorSheetDirty()` ("Discard changes?").
  Look: the paper is drawn in container-query units (`cqw`) so it scales exactly; the container must have NO padding (padding lives on `.cs-inner`) or the scale shrinks. Fonts El Messiri + Montserrat (Google Fonts, approximations of the PDF fonts); logo = real file `assets/colorsheet/dallin-logo.png`. Print = `printColorSheet`:
  an A4 page with `@page{margin:0}`, `min-height:294mm` (a little under A4 so rounding can never add a blank second page), white html/body. PERMISSIONS (both in `PERMISSION_REGISTRY`, "Blending Department (board)" section of User role permission): **`colorsheets_view`** (open the Color sheets page) and **`colorsheets_edit`** (edit rows, add / delete sheets): ONLY Admin and Sub Admin edit, by the owner's decision.
  Live roles: view = Admin, Sub Admin, Production Executive (the owner named only the edit roles; Production Executive runs Mixing and Filling so it can look, view only); edit = Admin, Sub Admin. Data access (`role_data_access` key `colorSheets`) = Blending, Production Executive, Sub Admin, same as `blendBatches`.
  (2) PRINTED BATCH SHEET = one template, `batchSheetPrintHtml(d, tpl, opts)`, used by `printBatchSheet` (blank pre-run form), `printDocumentedBatchSheet` (finished record, `mode:'record'`) and the Settings -> Batch sheet template preview (`opts.only` 1 or 2 draws one page thumbnail). PAGE 1 = company + logo, product + batch number,
  size / machine / date (record: started / completed), raw materials table (percentage, kg of the batch size, Weighed tick box) and, pre-run only, the "Before you start" check list (production area, equipment, water + operator signature). PAGE 2 (`.bsp-p2`, forced page break) = the production steps ledger (`bsmcLedgerStepsHtml`: step letter, kg lines, instruction,
  temperature, wait), then the template-ordered combine note / pH / footer, then the "After the batch" check list (finished product, batch finishing + supervisor signature) or, in record mode, three sign-off lines, then "Printed ... by ...". Each check list is `break-inside:avoid`. Checked with `page.pdf()`: a typical sheet (11 materials, 7 steps) is exactly 2 pages in both modes; a very long one (18 materials, 14 steps) simply continues onto
  more pages. The old header / logo-drag code (`batchSheetHeaderHtml`, `attachBatchSheetLogoDragHandlers`, `logoX / logoY`) is gone; the template's "header color" now colours the table headings (white lettering is chosen automatically on a dark colour). `@media print` makes html / body plain white for EVERY print (the app's green gradient used to print).
- **Mixing and Filling: editable stages, new cards, variations, Admin-only delete, new printed record (owner, 2026-11-22).**
  (1) STAGES: the board's stages are app_data key `blendStages` = `[{key, label, color?}]` (Manage Lists button, `manageBlendStagesModal`, permission `blending_manage_stages`; the same draft / Done pattern as the Orders board's Manage Lists; add goes BEFORE the last stage, a stage that
  still holds batches cannot be deleted and the window lists them, at least two stages, "Reset to the original stages"). Empty / missing = the original seven (`BLEND_STAGES` / `BLEND_STAGE_KEYS` stay only as that starting list and as the meaning of the OLD numeric `stage`).
  A batch points at its stage by KEY: `b.stageKey` (the old number `b.stage` is still written next to it for an old cached page; a batch with no `stageKey` means `BLEND_STAGE_KEYS[b.stage]`); history entries carry `stageKey` + `stageLabel`. ALWAYS go through the helpers
  (`blendStageList`, `blendStageKeyOf`, `blendStageIdx`, `blendStageName`, `blendIsFinal`, `blendPlaceInStage`, `blendHistoryLabel`); never index `BLEND_STAGES` with `b.stage`. The LAST stage is the finished one (not "active" for Dally, no Next button). Records have `key`, NOT `id`, on purpose:
  the merging save only diffs arrays whose records have an `id`, and a re-ordered list must be saved exactly as it is. Data grants for `blendStages` (Blending, Production Executive, Sub Admin = same as `blendBatches`) are in `role_data_access` and in `PAGE_DATA_KEYS.blending` (`PAGE_DATA_KEYS_VERSION` 24).
  (2) CARDS (`renderBlendCard`): priority colour edge + pill like the Orders board, product, batch number + formulation code, size, the batch sheet's machine (`machineChipHtml`; `finishBatchIntoBlendingBoard` copies it, so it shows by itself; editable in the batch window), up to 3 variation lines, "In stage · 3 h". Priority / Machine / Formulation code are fields in the New batch form and the batch window.
  The phone now has a stage-tab view of the board too (`renderBlendBoardMobile`; before, a phone saw an empty board because `.board` is hidden below 760px).
  (3) VARIATIONS: `b.variations = [{id, product, fragrance, fragranceId, qty, unit}]` (units kg / g / L / mL / pcs), edited as rows (`blendVariationsSectionHtml`, a draft `state._blendVarDraft` because the window is redrawn on every change; typed text is copied in by `syncBlendVarDraftFromDOM` before add / remove / save).
  The old text field `b.variation` (one "Name - quantity" per line, which the live batches use) is still written from the rows and is parsed into rows when a batch only has the text (`parseLegacyVariationText`; no unit is guessed). The Fragrance picker (typing in Product OR Fragrance) suggests Item List entries, ignoring spaces
  (`aloevera` finds "Aloe Vera Fragrance"), fragrance-like names first; nothing matching = the typed name stays. The Item List names come from the read-only database function `public.inventory_item_names()` (id, name, item code, short code, unit; NO costs, no writes; Admin or any role that can read `blendBatches` / `inventoryItems`), so the Blending
  role can pick fragrances without being granted the Item List (a data grant is read AND write because the policy is `FOR ALL`; the owner chose "only view the items"). The suggestion list lives on `<body>` because a window with `backdrop-filter` is the containing block of fixed children. Today the Item List has NO fragrance entries: add them there (e.g. "Aloe Vera Fragrance") to have them suggested.
  (4) DELETE: Admin only AND the password again (`requirePassword`), checked in `deleteBlendBatch` as well as on the button.
  (5) FORMULATION CODE: `b.formulationCode`; when empty it is made from the batch sheet's name ("Shower Gel — Version 1" -> `SG-V1`, `formulationCodeFor`), and a batch added by hand (no batch sheet) has none unless typed. This is a derived label, not an owner-defined numbering scheme: ask before changing it.
  (6) PRINT (`printDocumentedBatchSheet`, button in the batch window, now for EVERY board batch, with what is typed in the open window even if unsaved): page 1 adds Formulation code + Priority to the details and a **Variations** table (No / Product / Fragrance / Quantity / Unit + total per unit; three empty lines when none); materials are left out when there are none;
  page 2 adds **Stage by stage — floor sign-off** (one line per stage of the CURRENT list: when and by whom it moved in, and an empty box to sign) above the Operator / Supervisor / QC lines. Still exactly 2 pages for a typical sheet (11 materials, 7 steps, 4 variations; checked with `page.pdf()`). The blank pre-run form from Batch sheets (`printBatchSheet`) deliberately stays the
  original 2 pages and only gains the formulation code: adding the variation and stage tables to it pushed it to 4 pages.
- **Finishing a batch asks first; the 50 x 50 mm vessel sticker; the Batch Verification page its QR code opens (owner, 2026-11-22).**
  (1) FINISH: pressing Finish on the last step of a run no longer moves it to Mixing and Filling by itself. `nextBatchStep` -> `askFinishTransfer(key)`: "Do you want to transfer it to Mixing and Filling?" **Yes** -> `transferFinishedBatch` -> `finishBatchIntoBlendingBoard` (unchanged job: adds the batch, clears the slot, goes to
  Mixing and Filling) -> `askPrintVesselSticker`: "Need to print the batch sticker?" **Yes** -> `openVesselSticker` (the print view window), **No** -> nothing. **No** to the first question -> `markBatchFinishedNotTransferred`: the slot gets status `'finished'` and STAYS on the Production Guide (card + big screen show the done view with a
  **Transfer to Mixing and Filling** button; no timer / alerts; its machine stays busy). `'completed'` is the OLD invisible leftover and still counts as nothing, so a finished-but-untransferred batch MUST use `'finished'` (helper `batchIsDone(b)` = either). Dismissing a finished batch asks first (its run record is lost). `openConfirmModal` gained
  `cancelLabel`, `onCancel` and `sticky` (a sticky question ignores a click on the dim background; only its own two buttons answer it).
  (2) STICKER (`vesselStickerHtml`, `printVesselSticker`, `openVesselSticker` / `vesselStickerModal` = `vesselsticker:<batch id>[:<variation id>]`): top to bottom ONLY product name (big, bold, top left; the costing "— Version N" is dropped; a variation sticker prints the product on line 1 and the variation on line 2), Parent Batch, Machine No.,
  MFD Date & Time (completed, else created), Batch Size (just the size; text in brackets such as "(40 x 5L cans)" is dropped; a variation sticker shows that variation's quantity), an empty ~10 mm writing space, a 14 x 14 mm QR with a white quiet zone, "Audrey Care (Pvt) Ltd". Exactly 50 x 50 mm (checked with `page.pdf()`: one page, nothing overflows).
  The 50 mm `@page` is a `<style id="vessel-sticker-page">` added only for the print and removed on `afterprint` (a permanent `@page` would shrink every A4 print). The QR is drawn by the MIT-licensed qrcode-generator 1.4.4 kept as the real file `assets/vendor/qrcode-generator-1.4.4.js`, loaded only when a sticker is made (`ensureQrLib`), as SVG so it stays sharp;
  decoded in tests with jsQR. Buttons: **Print Vessel Sticker** in the batch window and one small sticker button on every SAVED variation row; they print what is typed in the open window (even unsaved) and do not close it. No separate permission (like "Print batch sheet"). The print view window is a viewer, so an outside click closes it.
  (3) QR TARGET: `<site origin>/batch/<batch RECORD id>` (not the typed batch number: numbers are free text and can repeat; a variation sticker adds `?v=<variation id>`). GitHub Pages has no such file, so the root `404.html` forwards `/batch/<id>` or `/vessel/<id>` to `/?batch=<id>`; a script before `let state` turns that into the in-app route
  `#batch/<id>[/<variation id>]` (`state.batchMode`, like `trackMode`; `navCommit` and the page-hash restore skip it). If the site is ever moved to a host with no 404-page fallback, the QR path breaks: keep `404.html` working. The view (`renderBatchVerifyPage`) is READ ONLY and needs a SIGN-IN on purpose (it shows variations, operators and QC readings, so it is not a public page;
  a signed-out scan lands on the sign-in page first, a role that cannot read `blendBatches` sees "Batch not found"). It shows: company + batch number + the live stage badge; the sticker's own details; variations (the scanned one highlighted); started / completed by and when (or created); formulation code; the **1st QC (Base)** status worked out from the stage list
  (`batchVerifyQc1`: in the `qc1` stage = Pending, past it = Approved with when / by whom, before it = Not reached yet; hidden if the `qc1` stage was removed in Manage Lists) and the pH / viscosity / notes. Those three are NEW optional fields on a batch (`qcPH`, `qcViscosity`, `qcNotes`), typed in the batch window; nothing else records QC readings.
- **No `backdrop-filter` (blur) on surfaces that are always on screen (owner, 2026-11-21: scrolling "open orders" lagged).** Measured with software rendering (a PC without graphics acceleration): the Ongoing orders page ran at ~67 ms a frame
  (about 15 fps) because the big `.panel` carried `backdrop-filter`; the sticky top bar, the sidebar and the phone order cards did too. All of those are now plain (slightly more opaque) backgrounds: 16.5 ms a frame, no slow frames. Do NOT put `backdrop-filter`
  (or a big `filter:blur`) on `.sidebar`, `.topbar`, `.panel`, `.stat-card`, `.card`, `.session-chip` or any list / page-sized element; keep it only on pop-ups that are open briefly (modal, drawer, overlay). Test a change like this by scrolling a page
  with a few hundred synthetic orders in headless Chromium and counting frames slower than 33 ms. `content-visibility` on cards did NOT help (measured), do not add it for this reason.
- **Phone Packing queue v2 (Orders board on a phone, owner, 2026-11-21: "not user friendly, need a better ui design to work effectively").** `renderOrdersMobileQueue` / `renderOqCard`: a STICKY bar (search + Box Count + "..." menu, the 4 stage tabs
  with counts and a red dot when high priority orders wait there, the delivery-line chips) stays right under the header (`--oq-top` is measured from `.topbar` after each render); compact cards (4+ a screen) with a priority colour edge (red / amber / green),
  the order number, a High pill, the delivery line (only under "All lines"), the waiting time (amber from 4 h, red from 24 h, `oqWaitClass`), the customer, each product on its OWN row (`oqProductLines`, max 3 then "+ N more"), the note, and ONE big
  next-stage button (`data-oq-advance`, same label / rule as the order screen: `canAdvance` + `NEXT_ACTION_LABEL`; CityPak "picked up" still asks for the tag first). Tapping the card body still opens the order. Search is view state (`state._oqQuery`).
  Box Count and Archive are in the "..." menu too. The order screen (drawer) and the Box Count window on a phone were NOT changed in this pass.
- **Dashboard "Orders overview" chart (owner, 2026-11-21: "improve the chart design and all the points in there").** `dashOrdersChartHtml` + `attachDashOrdersChart` replace the old 78 px sparkline (and its peak-pill / tap-tip code, which is gone). Two series from
  `state.orders`: Received (`createdAt`) and Picked up (`completedAt`), per day (per week for 90D) from `ordersOverviewSeries(days)` (which now also returns `done`, `doneTotal`, `doneChangePct`, `avgPerDay`). Four tiles (Received + % against the period before,
  Picked up + %, daily average, busiest day / week), a real y axis with nice round ticks and gridlines, a dot on EVERY point, the busiest point flagged, x labels thinned to stay readable (fewer on a phone), and a readout for any point by hover, touch / drag or
  the arrow keys. Lines are SVG with non-scaling strokes; dots, labels and the readout are HTML so they stay round and sharp at any width. The entrance animation (`.oc-play`, only on a fresh visit, reduced-motion safe) is switched on from `animateDashboardCharts`.
- **Elegant sidebar + date-focused Dashboard (owner, 2026-11-21: "leftside panel more decent with icons and animations; dashboard more elegant with colors and date focus").**
  CSS block "Elegant sidebar + date-focused dashboard" (just before `@media print`). All colours come from the palette (`--accent*`, `--accent-rgb`); white text sits on `--ui-solid` (the palette's DEEP shade, `--ui-deep` ->
  `--ui-deeper`), NOT on the light `--accent-grad`, because the default green / yellow / mint gradients are too pale for white small print. Keep it that way.
  (1) SIDEBAR (`renderShell`): ONE FLAT LIST, no section labels / dividers, NO profile card (owner, 2026-11-21: "no need divide sectionwise, I don't want to scroll, remove the profile part"). Each row is an icon TILE
  (`.nav-ico`); the active row has a deep-shade tile + 4px bar; hover moves the tile. The list FITS the window height with no scrolling: `.nav-group{--nav-h:clamp(30px,(100vh - 172px)/17 - 2px,44px)}` sizes every row
  (so up to 17 pages fit from about 680px high; on a phone the menu keeps 44px rows and may scroll). Do not add a fixed `min-height` to `.nav-item`. ICONS: the Lucide set (ISC licence) in `SIDEBAR_ICONS`, keyed by PAGE id and used
  ONLY by the sidebar via `sidebarIcon(it)`; `icon()` and every other place keep their own icons. Entrances: `.nav-enter` (real login) staggers the rows, `.nav-fresh` (fresh page) pops the active tile; never on a plain redraw;
  all inside `prefers-reduced-motion:no-preference`. Item markup keeps `data-nav` and the `nav-item` / `nav-item-unread` classes. Width is still 240px; `.sidebar{bottom:34px}` on >=761px clears the clock bar.
  (2) DASHBOARD top (`renderDashDateTop`): LEFT a date card (greeting by hour, big Fraunces day number, weekday, month/year, ISO week + "N days left in YYYY" bar, and a sun / sunrise / sunset / moon Lottie from
  `assets/lottie/tod-*.json`, chosen by hour in `dashTodKey`, credits in `assets/lottie/CREDITS.md`); RIGHT a Monday-first week strip with prev / next week + Today, one dot per kind per day (Due = `o.dueDate`, Received = `o.createdAt`,
  Completed = `o.completedAt`), an "N overdue" shortcut to Orders (open, not archived, dueDate before today), and a detail for the picked day (3 counters + up to 6 orders, each opens its order window when the role has the Orders
  page; otherwise plain rows). Picked day = `state._dashDay` (YYYY-MM-DD, null = today); it is a view filter, NOT a browser-history step. Counts come straight from `state.orders`, nothing new is stored.
  (3) `mountDashTod()` runs from `attachShellHandlers()` after every render: the JSON text is fetched once per file and parsed fresh each mount (lottie edits what it is given), the old frame is carried over so a redraw
  does not restart the animation, and with reduced motion it is shown paused. Do not add more Lottie instances casually: older PCs were already slow (see "Speed on older PCs").
  (4) Desktop-only restyle (>=761px) of `.dash-stat-card` (icon badge shown, hover lift) and dashboard `.panel`s; panels sit in `.dash-grid` (2 columns from 1280px, `.dg-span2` = full width, else one column).
  The PHONE dashboard keeps the layout picked earlier (2-column stat cards, hero colour still from Settings -> Mobile appearance via `--mobile-hero-bg`). The old `.dash-hero` markup is gone (its CSS is unused).
- **Browser Back / Forward walks EVERY screen step; no tiny back buttons (owner, 2026-11-21: "no need these tiny buttons to go backward ... all the pages should go backwards with the
  website's own buttons, every backward step").** ONE mechanism in `index.html` (search "Browser Back / Forward walks EVERY screen step"): `navSnapshot()` describes the screen being shown (page + the
  open drill-down), `navCommit()` runs at the end of every `render()` and pushes a real history entry whenever that description changes (the first draw of a visit and a forced redirect REPLACE
  instead, `state._navReplace`), and the `popstate` listener puts the saved screen back with `navApply()`. History entries carry `{navKey, nav, idx}`. Screens that are history steps today: every
  page (sidebar, tabs, hub cards, `goTo`), Settings panels, GMP cards, Costing product -> versions -> version sheet / Archive / Process template page, Attendance Records / Staff / Edit requests,
  R&D outcome list, Orders Archive. The address bar keeps the old shapes (`#page`, `#gmp/<card>`, `#settings/<panel>`, `#costing/<product>/<version>`) so a refresh still lands in the same place; the
  other drill-downs live only in the history entry. REMOVED on purpose (do not bring back): "← Products", "← <product> versions" (x3), "‹ Settings", "‹ GMP", "‹ Attendance" (x2), "‹ Staff", "‹ Products" (R&D).
  NOT changed: windows (`state.modal`) are not history steps. Back never closes one (it leaves it open and toasts "Close this window first, then use Back"), because an accidental back-swipe must not
  throw away half-typed work (Panel closing Rule); so the order / complaint / R&D drawers keep their "← Back to board" and X, Box Count keeps its back arrow, and Chat keeps its own arrow (conversation <-> list is
  NOT a history step). Back with unsaved costing typing stays and asks "Discard changes?" (only Discard goes back). A Cancel / Save that leaves a drill-down should call `navBackIfParent()` (see
  `closeProcessTemplatePage`) so it steps back instead of stacking a copy. To make a NEW drill-down a Back step: add it to `navSnapshot()` and `navApply()` (and `navHash()` if it should survive a refresh), set its state
  and call `render()`; do NOT call `history.pushState` / `replaceState` yourself (public track / board / complaint pages and the `?chat=` link are the only exceptions). Caveat for the owner: an iPhone
  Home Screen app has no browser Back button (only the edge swipe), so with the tiny buttons gone that swipe is the way back there.
- **Order Print button + Soap / Sample box types (owner, 2026-11-21).** (1) The order window (`renderOrderDrawer`) has a **🖨️ Print** button directly UNDER "Copy tracking link"
  (both sit in `.od-badge-actions`, stacked, same width). It calls `printOrderSheet(id)`: a plain A4 "Order Sheet" (customer, order number, stage, priority, dates, contact, delivery method,
  tracking number, product, notes, address, picture, history, printed-by line) is written into `#print-area` and `window.print()` is called, the same pattern as `printAttendanceSheet`.
  It prints the SAVED order (unsaved typing in the window is not included). Product goes through `richText()`, everything else through `esc()`. It is switchable per role:
  permission **`orders_print`** ("Print an order", Orders board section of User role permission; Admin has it automatically, every other role starts OFF until the owner switches it on), and it is NOT shown in the
  trimmed Ongoing orders view (that view hides contact / address / tracking number on purpose). `printOrderSheet` itself also refuses without the permission.
  (2) Box Count box types are now **Large / Medium / Small / Soap / Sample**, defined ONCE in `BOX_COUNT_TYPES` (entry row select, the phone buttons and the saved-entry edit row all read it; the label
  says "Box type"). The stored value is the word itself (`boxType`), so older entries are unchanged. One row = one customer + one box type + a quantity; a customer who got several types is entered as
  several rows (a "one row, five quantity boxes per customer" layout was NOT built; ask the owner before changing the data shape). On the phone the five buttons sit 3 + 2 (`.bc-seg` is a 6-column grid).
- **Costing: active version + Process template (owner, 2026-11-18).** On a product's versions list (Costing & recipe) each version has an **Active** switch; ONLY ONE version can be
  active (one pointer on the product, `product.activeVersionId`; `''` = none chosen on purpose; a product that never chose and has exactly one live version shows that one as active;
  archiving the active version clears it; `costingActiveVersion(product)`). Next to Archive there is a **Process template** button (needs `costing_manage_templates`, the same switch
  the old Phrases templates button used) that opens the Process template as a full PAGE inside Costing (owner, 2026-11-18: "should open a page, not a popup"; `state._costingProcessPage`, `renderProcessTemplatePage`, Cancel (and the browser Back button, see "Browser Back / Forward" note) asks "Discard changes?" through `_costingDirty` when something was changed; `render()` syncs the typed text into the draft first because a page is not covered by the modal field snapshot): LEFT = the batch sheet of the ACTIVE version (No / Raw material / Percentage, water balanced like the costing sheet), RIGHT =
  the phrases + preparation-checking editor MOVED here from the Recipe library (shared markup `templateStepsEditorHtml`, same `state._templateDraft` and handlers as the phrases-template editor, plus
  `processProductId`). Saved on the product as `product.processTemplate = {steps, updatedAt, updatedBy}` (`saveProcessTemplate`, `cleanTemplateSteps` drops blank rows; saving with NO phrases and NO lists is allowed). A PHRASE on this page is a small table (owner, 2026-11-18): `+` adds raw-material lines one by one (No / Raw material / %), the Raw material box suggests the ACTIVE version's materials (`ptShowSuggestions`), and what is typed in % is subtracted LIVE from the left batch sheet (water 80, type 50 -> sheet shows 30; `ptUpdateRemaining`, `ptRemainingRowsHtml`; negative shows red; a name not on the sheet turns red and takes nothing); each phrase has an **Add instruction** button that opens its Instruction box; there is NO wait (min) box. Saved phrase = `{lines:[{name,percent}], instruction, temperature, waitMinutes(kept, not editable), ingredient}` where `ingredient` is a one-line summary ("Edta 0.1% — instruction") so the Production Guide keeps working; a phrase saved before the table existed opens with its text as the instruction. The left sheet is `position:sticky` BELOW the sticky top bar (`top:92px`); `#process-template-page` has bottom padding so the floating bell / phone tab bar never covers Cancel / Save. A product with nothing saved opens EMPTY: the right side shows ONLY the two buttons "+ Add phrase" and "+ Add preparation checking step" (owner, 2026-11-18; nothing is copied from the old phrases templates any more, and the page has no description lines); a saved Process template is copied (fresh ids, text included) into the batch sheet by **Transfer to Production Guide**.
  The Recipe library toolbar has NO buttons any more: "Instruction style" was removed too (owner, 2026-11-18); the saved choice (`batchDisplay.instructionStyle`, currently `arrowflow`) keeps applying in the Production Guide and the old `instructionstyle` modal code is still in the file, just unreachable. The old global **phrases / mixing-step templates are GONE entirely** (owner, 2026-11-21: "if I say remove something, remove entirely from backend too"): the "Phrases templates" button, the batch sheet's "Use template" button and its picker, the template editor popup, the
  `mixingStepTemplates` data key (page code, `SYNCED_KEYS`, the page -> data map, the load-time seeding that made the ~40 empty copies, the database row and its `role_data_access` grants) no longer exist. Do not bring any of it back. `costing_manage_templates` now only
  gates the per-product Process template (button + page). Lesson: when something is removed, remove its stored data and database grants too, and ship the code removal BEFORE deleting the row (an older page that still seeds it would re-create it).
- **Bug-fix pass (2026-11-19).** (1) EXPIRED SIGN-IN: `pingServerLastSeen` (once a minute) used to give up silently when the login had expired, so one device sat half signed in, asking
  every minute for hours (123 refused `/auth/v1/user` calls in 2 hours in the logs). Now a refused / "session missing" answer tries one `refreshSession()`; if that fails `handleExpiredSignIn()`
  signs the person out cleanly (via `logOut`) with the toast "Your sign-in expired. Please sign in again." A bad network is NOT a refusal and signs nobody out. (2) The sign-in page now DRAWS toasts
  (`renderInner`): the reason after an automatic sign-out ("Signed off after being inactive") was set but never visible. (3) DATABASE `push_unsubscribe(p_endpoint)` may now be called signed-out
  (anon): the phone's push address is a long secret, so a phone whose login already expired can still switch itself off at sign-out; a signed-in person still cannot switch off someone else's. Before, those
  calls were refused and the phone kept getting the previous person's chat notifications. (4) `private.client_ip` has a pinned search_path. (5) An accidental phone back-swipe (popstate) with unsaved typing on
  a full costing page (Process template page, costing version sheet; `_costingDirty`) stays on the page and (since 2026-11-21) asks "Discard changes?" instead of a toast, so the typing is never silently thrown away (popups were already protected). (6) Dead
  leftover removed: the old `chat-form` / `sendChatMessage` binding. NOT changed on purpose: "Leaked password protection" in Supabase Auth is a dashboard switch (needs the owner), the SECURITY DEFINER
  functions the advisor lists are the app's own RPC design (each checks the caller), RLS-without-policy on the private tables is deliberate (no direct access for anyone).
- **Order stage moves are instant, with rollback (owner report, 2026-11-19).** Moving an order (button, CityPak tag form, or drag and drop) to "Picked up by delivery" (or any stage) used to wait for
  3-5 sequential server round trips (who-am-I check, read orders, write orders, read the SMS setting) before the card moved or the "Send SMS?" question showed, and a FAILED save left an unsaved "ghost" move
  that later snapped back (or was saved by accident with another order's save). Now `commitOrderMove` (used by `advanceOrder` and `moveOrderToStage`) starts the save in the background, shows the card in its
  new column AND the SMS question at once, and `orderMoveRestore` puts the card back (stage, assignee, completedAt, delivery line, CityPak tag, board order, history entry) with a clear toast if the save fails.
  "Yes, send SMS" waits for that save (`pendingSmsConfirm.saved`) and NEVER texts about a move that did not save. A second tap within 900 ms on the same order is ignored (`_lastAdvanceAt`: it was skipping stages).
  The fresh read of the SMS setting (`triggerAutoOrderSms`) now only happens on the automatic-SMS path (where it matters: a stale tab must not text a customer the Admin turned off) and no longer
  closes a window the person opened in the meantime (`keepModal`). Test: `order-move-test.js` (fails on the old build at the first check).
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
- **Only CityPak deliveries ask for the tracking number (owner, 2026-11-16).** Moving an order to "Picked up by delivery" opens the CityPak tag form ONLY when `courierService==='CityPak'`; AC Delivery, Customer Pickup and any other delivery line advance directly (the form used to appear for them too and then switched the order to CityPak).
- **No "Load sample data" on the Orders board (owner, 2026-11-16).** The empty-board hint that offered to add fake orders was removed (and `loadSampleData` with it): an empty board can mean the orders failed to load, and adding sample orders to the real workspace then is dangerous. Do not bring back any one-click way to add sample orders to the live data.
- **Costing products: select + delete, and the duplicate bug (owner, 2026-11-15).** On Costing & recipe, Vihanga and Rumesh (`isCostingSuperAdmin()`) have a
  "Select" button: tick products, "Select all", "Select extras" (only EMPTY extra copies of a name; the copy with saved versions is always kept; the owner does not want the word "duplicates" in the screen text),
  then "Delete selected (n)" with a password confirm that names any product that has saved versions (`state._costSel`, `costingDeleteSelected`).
  Root cause of the 30 empty copies of the six starter products: the starter seeding ran for an Admin whose load got an empty answer and the merging save
  added them again each time. `seedDefaultCostingProducts()` now adds them ONLY when this load found no row AND a fresh read confirms the server has none
  AND the list is empty (and never when it cannot confirm). Do not reintroduce seeding keyed only on "the local list is empty".
- **iPhone-style motion (owner, 2026-11-15).** CSS block "iPhone-style motion" near the end of the main `<style>` (search that title), phone only
  (`max-width:760px`; press feedback only on touch screens). Tokens `--ease-ios` (everything that slides) and `--ease-spring` (pops, releases). Modals
  (`.overlay` > `.modal`) are bottom sheets on phones with a grabber, sliding up (`ios-sheet-up`); Box Count (`.bc-overlay`), the profile panel and
  the Dally panel keep their own layouts. Screens push in from the right (`ios-push`, same stagger as before), the opened bottom tab pops (`tab-pop`,
  `ios-pop`), a sent / arriving chat bubble pops (`m._popAt`, `ios-bubble-in`, carries on across quick redraws), and tabs, tiles, chat rows and icon
  buttons squish when pressed. Rules: entrances play ONLY on a fresh open / fresh page (`freshPage`, `freshModal` / `.reopen-noanim`, `_popAt`),
  never on a redraw, because `render()` rebuilds the whole page; every moving part is inside `prefers-reduced-motion:no-preference`. Closing a sheet
  is instant (no slide-out: `closeModal()` is called synchronously all over the app). Remotion was NOT installed: it renders videos, it is not a
  runtime animation library, and this app has no build step. A bottom sheet must keep its own bottom padding for the home bar.
- **Chat (owner, 2026-11-14): WhatsApp-style Team chat + private 1-to-1 chats.** Staff-only (no customers, no bots). Who can chat = Admin + roles
  that have the `chat` page (`role_data_access` data_key `chat`; Staff/Driver roles have none). Data lives in tables `chat_threads` (the Team thread has the
  fixed id `00000000-0000-0000-0000-00000000c0de`), `chat_messages`, `chat_reads`, `chat_reactions`, `chat_monitor_log` (unused now; RLS on, no direct writes for anyone) and
  is reached through the `chat_*` database functions (`chat_people`, `chat_open_dm`, `chat_threads_overview`, `chat_send`, `chat_edit` (own, 15 min),
  `chat_remove` (own, "deleted for everyone"), `chat_react`, `chat_mark_read`, `chat_mark_delivered`). Realtime uses
  `postgres_changes` on the three message tables (RLS-filtered) + a per-thread broadcast channel for "typing". Client code: `c2*` functions and
  `renderChat2Page` in `index.html` (search "Chat (WhatsApp-style)"); CSS classes `.wa-*` (the "Clean" look the owner chose from six designs on 2026-11-14: white, light grey bubbles, blue own bubbles `--wa-blue`, centred conversation header; the other five designs were only mock-ups, not built). The old `app_data` key `chat` is NOT used or fetched any more;
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
  * **Phone notifications (owner, 2026-11-14, Web Push).** Each person turns them on once per phone/browser from the banner / bell on the Chat list (the banner's X only hides it for that visit; the bell, 🔔 on / 🔕 off, is always in the header so they can be turned on later) (the browser
    asks only after a tap; iPhone needs the app added to the Home Screen first, iOS 16.4+). The device is stored by `push_subscribe` (table
    `push_subscriptions`, no direct access; `push_unsubscribe` just switches it off). After each message the SENDER's app calls the Edge Function `chat-push`
    (source `supabase/functions/chat-push/`, JWT verified): it only accepts the sender's own message from the last 10 minutes, once (`chat_messages.pushed_at`),
    and sends to the chat's members who have chat access (`chat_push_targets`, service role only; Team chat = everyone with chat access except the sender).
    The signing (VAPID) keys are in `private.push_vapid`, readable only through the service-role function `push_vapid_keys()` (NOT an Edge Function secret,
    so no one has to type it); the public key is in `index.html` (`PUSH_PUBLIC_KEY`). `sw.js` shows the notification (always, because iPhone requires it; silent
    + tidied away when the app is open) and a tap opens `?chat=<id>#chat`. Signing out switches this phone off for that person (`pushUnregister`); the next
    sign-in registers it again. Dead phones (404/410) are switched off automatically. If the keys are ever replaced, everyone has to turn notifications on again.
  * **Order links, swipe to reply, group profile (owner, 2026-11-14).** Typing `#SO2611100` (an order number; `#2611100` digits-only works when unambiguous) in a
    message makes a link that opens that order (`c2LinkText` / `c2OpenOrder`; needs the person's account to have orders loaded, otherwise a friendly message).
    On a phone, swiping a message to the right starts a reply (`c2AttachSwipe`). Tapping the Team chat header opens "Group info" (`renderChat2GroupInfo`): everyone
    sees the members; ONLY an Admin can change the name / photo (`chat_group_update`, photo shrunk to 256px and stored in `chat_threads.photo`), export the chat
    to a .txt file (client side, the visible 90 days), clear the chat (`chat_group_clear` sets `chat_threads.cleared_at`; older messages are hidden at once and
    physically removed by `chat-purge`), and add / remove members (`chat_group_set_member`, table `chat_group_members` lists only the people taken OUT; everyone
    with chat access is in by default, an Admin cannot be removed, and a person whose access level has no Chat page cannot be added: give the level the Chat page first).
  * Phone layout is one pane at a time, full screen (header/tab bar hidden on `page-chat`), padded with `env(safe-area-inset-*)`; on a PC the list and the
    conversation sit side by side. No popup notice is shown while the chat page itself is open (the list shows unread badges).
  * **Chat row menu (owner, 2026-11-16).** Each chat in the left list has a three-dot button (always visible on a phone, on hover on a PC) with: **Pin chat / Unpin chat**
    (private chats; pinned ones sit under the Team chat, newest pin first, with a small pin icon; `chat_pin_for_me`, `chat_reads.pinned_at`), **Clear chat**
    (clears MY history, the chat stays in my list; `chat_clear_for_me`; on the Team chat it is "Clear chat for me" and affects only the person who pressed it, the Admin's
    clear-for-everyone is in Group info) and **Delete chat** (private chats; removes it from MY list and history, `chat_hide_for_me` sets `hidden_at`; it comes back with
    the next newer message). The other person always keeps their copy. All marks are per person in `chat_reads` (`cleared_at`, `hidden_at`, `pinned_at`); the messages policy and
    `chat_threads_overview` honour them.
  * **Opening Chat opens the Team chat by default** (owner, 2026-11-16; `c2Enter`), unless a tapped notification points at another conversation. On a phone the back arrow shows the list.
