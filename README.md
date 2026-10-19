# audrey-care-ops

## SMS notifications (send.lk)

Automatically texts the customer when an order reaches **Picked Up by Delivery**, and adds a manual
**Send SMS** button in the order drawer. The send.lk API key never touches the browser — it lives only
in a Supabase Edge Function.

### One-time setup

1. Install the Supabase CLI and log in, then link this project:
   ```
   supabase login
   supabase link --project-ref mntnobzwbvqpvmaxqcuc
   ```
2. Set the secrets the function needs (your send.lk API token + sender ID, plus a password you invent
   yourself for `SMS_APP_SECRET` — any long random string):
   ```
   supabase secrets set SEND_LK_API_TOKEN=your_send_lk_api_token
   supabase secrets set SEND_LK_SENDER_ID=your_send_lk_sender_id
   supabase secrets set SMS_APP_SECRET=some-long-random-string
   ```
3. Deploy the function:
   ```
   supabase functions deploy send-sms --no-verify-jwt
   ```
   (`--no-verify-jwt` is required — the app calls this function with the public anon key, not a
   per-user login token, since the app itself doesn't have real user accounts.)
4. Open `audrey-care-ops-v9.html`, find `SMS_APP_SECRET` near the top of the `<script>` block, and set
   it to the **exact same string** you used in step 2. SMS sending stays off until this is changed from
   the placeholder value.

### If a test message doesn't send

Open the order drawer, click **Send SMS**, and check the toast message — it echoes back whatever
send.lk's API returned. The request format lives entirely in
`supabase/functions/send-sms/index.ts`, so if send.lk expects different field names than what's there
(`recipient` / `sender_id` / `message` / `api_token`), that's the only file to change; redeploy with the
same `supabase functions deploy send-sms --no-verify-jwt` command afterward.

### Security note

`SMS_APP_SECRET` stops casual requests to the function URL, but it still ships inside the page's
JavaScript (same as the Supabase anon key already does) — anyone who reads the page source can find it.
This is a limitation of the app having no real per-user login backend, not something a stronger secret
would fix. If SMS usage ever looks abnormal on your send.lk dashboard, rotate `SEND_LK_API_TOKEN` and
`SMS_APP_SECRET` and redeploy.

## Live delivery tracking (CityPak)

The public "Track your order" page shows CityPak's live delivery status (a full timeline: picked up,
in transit, out for delivery, delivered) directly on our own site, once staff have entered the CityPak
tracking number for an order. Customers never need to visit CityPak's own tracking site. Same pattern
as SMS above — the CityPak API key never touches the browser, it lives only in a Supabase Edge Function.

### One-time setup

1. (If not already done for SMS) install the Supabase CLI, log in, and link this project:
   ```
   supabase login
   supabase link --project-ref mntnobzwbvqpvmaxqcuc
   ```
2. Set the secrets the function needs (the CityPak Falcon API key they issued you, plus a password you
   invent yourself for `CITYPAK_APP_SECRET` — any long random string):
   ```
   supabase secrets set CITYPAK_API_KEY=your_citypak_falcon_api_key
   supabase secrets set CITYPAK_APP_SECRET=some-long-random-string
   ```
3. Deploy the function:
   ```
   supabase functions deploy track-citypak --no-verify-jwt
   ```
4. Open `audrey-care-ops-v9.html`, find `CITYPAK_APP_SECRET` near the top of the `<script>` block, and
   set it to the **exact same string** you used in step 2. Live tracking stays off (falls back to a
   plain link to CityPak's own site) until this is changed from the placeholder value.

CityPak's docs describe a staging environment at `https://staging.citypak.lk` separate from production
(`https://falcon.citypak.lk`). To test against staging first, also run
`supabase secrets set CITYPAK_BASE_URL=https://staging.citypak.lk`, then unset it (or set it back to the
production URL) before going live.

### If tracking doesn't show up

Open a track link for an order with a CityPak tracking number entered — you'll see either the live
timeline, a plain error message, or the fallback "Track with CityPak" button, depending on what went
wrong. The request/response format lives entirely in `supabase/functions/track-citypak/index.ts`, per
CityPak's own Falcon API documentation (ORDER TRACKING → "Track order by tracking number").

### Not included yet (optional future work)

This only wires up **tracking display**. CityPak's API also supports creating orders and pickups, and
printing waybills, directly from our system instead of using CityPak's own portal — and a push API so
CityPak notifies us the moment a status changes, instead of us asking. None of that is built yet; ask if
you want it added later.

## Dally, the workspace assistant (Gemini)

The **Dally** button opens a chat that answers questions about live workspace data — orders, blending
batches, complaints, revenue, customers, ratings, GMP — in plain language, not just the fixed set of
questions the old keyword-matching assistant understood. Same pattern as SMS/CityPak above: the Gemini
API key never touches the browser, it lives only in a Supabase Edge Function, which is handed a snapshot
of the live data and the question, and forwards both to Google's free-tier Gemini API.

Until this is set up, Dally still works using its built-in local answers (the original keyword matcher) —
it just can't understand open-ended phrasing or hold a real conversation until you complete the steps
below.

### One-time setup

1. Get a free Gemini API key — no credit card needed for the free tier:
   - Go to https://aistudio.google.com/apikey, sign in with a Google account, and click **Create API key**.
2. (If not already done for SMS/CityPak) install the Supabase CLI, log in, and link this project:
   ```
   supabase login
   supabase link --project-ref mntnobzwbvqpvmaxqcuc
   ```
3. Set the secrets the function needs (the Gemini key from step 1, plus a password you invent yourself
   for `DALLY_APP_SECRET` — any long random string):
   ```
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   supabase secrets set DALLY_APP_SECRET=some-long-random-string
   ```
4. Deploy the function:
   ```
   supabase functions deploy ask-dally --no-verify-jwt
   ```
5. Open `audrey-care-ops-v9.html`, find `DALLY_APP_SECRET` near `SMS_APP_SECRET`/`CITYPAK_APP_SECRET` in
   the `<script>` block, and set it to the **exact same string** you used in step 3. Dally keeps using its
   built-in local answers until this is changed from the placeholder value.

### If Dally gives an error instead of an answer

It falls back to its built-in local answer automatically and shows a small note why (the error Gemini or
the Edge Function returned). The most common cause is a free-tier model name that's since been retired —
check https://aistudio.google.com for the current recommended free-tier model, then run
`supabase secrets set GEMINI_MODEL=that-model-name` and it takes effect immediately, no redeploy needed.

### What data Dally can see

Exactly the same facts the old keyword-matching assistant already exposed in its replies — order counts
and stages, blending batches, open complaints, revenue, customer/supplier/staff counts and names, recipe
names, ratings, GMP entry counts — packaged as one JSON snapshot per question instead of hidden behind
fixed if/else branches. It does not get recipe formulas, costing figures, passwords, or anything beyond
what `answerAiQuery` in the HTML file already reads from `state`; check that function if you want to see
the exact fields.
