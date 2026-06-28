# Yura — iOS App (Web Preview)

A high-fidelity, runnable preview of the **Yura** iOS app — the consumer health
companion from the pitch deck. This is **phase 1**: a clickable, screenshot-able
preview you review *before* opening Xcode. Phase 2 ports it to native SwiftUI.

> Yura connects every wearable, learns your **personal baseline**, explains *what
> changed* in plain language, builds **doctor-ready summaries** with secure sharing,
> **books physician-partner appointments**, and matches you to **clinical trials /
> care opportunities** — wellness insights and physician discussion prompts, never
> diagnoses.

## Run the preview

No build step, no dependencies. From this folder:

```powershell
python -m http.server 4100
```

Open <http://localhost:4100>. (A short splash auto-advances to onboarding.)
Sign-in is mocked — tap **Sign in** (or Apple/Google) → **Enter Yura**.

## What's in it

**Brand**: your supplied logo — pinwheel **icon** for app-icon/in-app marks, full
**wordmark** for splash/auth. Deck palette: void black + warm bone + the iridescent
soap-bubble gradient. **Dark + light themes** with the logo inverting per mode
(bone-on-black ↔ black-on-bone). Toggle in the profile/settings sheet.

**Screens**
- Onboarding (deck's three hooks) · mock email/Apple/Google auth · profile setup.
- **Today** — readiness ring, "what changed" insight cards (the core value), signal
  tiles with sparklines, quick links to labs & family.
- **Connect** — all major wearables, connect flow, per-device quality scores, and the
  **Cross-device Truth Layer**.
- **Trends** — 90-day charts with your **personal baseline band**.
- **Doctor** — pre-visit packet → secure share link, physician partner directory +
  **booking flow**, upcoming appointments.
- **Discover** — clinical-trial / care matches with fit scores + safe "discuss with
  physician" framing.

**Competitive differentiators** (built in): **Ask Yura** (context-aware Q&A over your
own data), **Cross-device Truth Layer** (reconciles conflicting devices with a
confidence level), **Weekly Health Story** (shareable recap), **Caregiver/Family
mode**, **Labs → plain-English**.

## File map

| File | Role | SwiftUI / Supabase equivalent |
|------|------|-------------------------------|
| `index.html` | iPhone frame + mount points | `App` + `RootView` + `TabView` |
| `styles.css` | brand tokens, theming, iOS component kit, motion | `Assets.xcassets` colors + `Theme` + view modifiers |
| `app.js` | router, screens, sheets, interactions | `NavigationStack`, `.sheet`, screen `View`s + `@Observable` view-models |
| `data/yura-sdk.js` | **mock client mirroring the Supabase JS SDK** | `YuraService` protocol → swap mock for **Supabase Swift SDK** |
| `data/interpret.js` | baseline + insight engine | keep server/edge-side; optional Claude enrichment |
| `assets/*.png` | themed logo (bone + black, icon + wordmark) | `Assets.xcassets` image sets (Light/Dark) |

## Phase 2 — SwiftUI port (when you approve)

The data layer is intentionally shaped like Supabase so the port is mechanical:

```js
// preview (mock)
yura.from('daily_metrics').select().eq('metric','hrv').order('date')
```
```swift
// SwiftUI + Supabase Swift SDK
try await supabase.from("daily_metrics")
  .select().eq("metric", value: "hrv").order("date").execute()
```

`auth.signInWithPassword / signInWithOAuth`, `from().select().eq().order().limit()`,
and `channel().on().subscribe()` all map 1:1. Each screen becomes a SwiftUI `View`
backed by an `@Observable` view-model calling a `YuraService` protocol; the mock impl
here becomes the Supabase-backed impl.

## Honest constraints

- Real wearable OAuth isn't wired in the preview — the connect UX, normalization and
  quality scoring are real concepts; the data is realistic synthetic behind the SDK
  seam. Live device sync uses each provider's OAuth in production.
- Trial matches use a bundled sample for a reliable offline preview; the call is shaped
  to swap in live ClinicalTrials.gov / Supabase later.
- **Yura is a demonstration product, not a certified medical device.** It provides
  wellness insights and physician discussion prompts, not diagnoses.
```
