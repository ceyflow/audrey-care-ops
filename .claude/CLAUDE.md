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
