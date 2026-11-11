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
