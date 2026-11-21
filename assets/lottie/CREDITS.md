# Lottie animations used by the dashboard

The four time-of-day animations on the Dashboard date card (`tod-*.json`) come from the free public
LottieFiles library (LottieFiles Simple License: free for commercial use, no attribution required;
credit kept here anyway). All four are by the creator "animation free", chosen because they are one
matching icon family, tiny (2-5 KB each) and calm.

| File | LottieFiles name | LottieFiles id | Shown |
|---|---|---|---|
| `tod-sunrise.json` | sunrise | 148345 | 05:00 - 09:59 |
| `tod-sun.json` | clear sun (clear-day) | 148442 | 10:00 - 16:59 |
| `tod-sunset.json` | sunset | 148344 | 17:00 - 19:29 |
| `tod-night.json` | clear night | 148443 | 19:30 - 04:59 |

They are loaded by `mountDashTod()` in `index.html` and played with the Lottie player that is already
on the page (lottie-web 5.12.2, pinned with an integrity hash). Replace a file here to change the look;
no code change is needed (the `?v=` on the address follows the page's `app-build` stamp).
