# Mobile was hard-locked by a viewport meta tag; config gains a string form

Found: 2026-08-06, working through three requests from Ben.
Attribution: root cause found by AI, prompted by Ben reporting "when I click
recover and then it opens the modal, I cannot close it."

## The headline bug

`App.tsx` rendered this inside the React tree:

    <meta name="viewport" content="width=650, initial-scale=1.0">

React injects it into the DOM at mount, where it **overrides** the correct
`width=device-width` tag in `index.html`. Caught in the act by polling
`window.innerWidth` on an iPhone 13 profile:

    t=123ms  390   <- index.html's correct meta
    t=324ms  390
    t=516ms  650   <- React mounts, App.tsx meta wins

Phones therefore laid out at 650px inside a ~390px screen. Anything past
x=390 was rendered, hit-testable by the DOM, and **physically unreachable** —
you cannot scroll to it, because the layout viewport is not overflowing, it
is lying about its width.

Measured consequence for the recovery modal:

    RECOVERY X BUTTON: { layoutInnerWidth: 650, visualWidth: 390,
                         xBtn: 518, rightBtn: 550, offscreen: true }

The handlers were all fine. Driving `.click()` directly (bypassing hit
testing) opened the confirm dialog correctly — whose "Yes, Close" button was
*also* off-screen at x=331–496. So every modal was a dead end on mobile:
open it, and there is no way out.

Ben later clarified he hit the close problem **on desktop**. That repro is
still open — see below.

## What "anything is better than what we have now" turned into

Removing the meta tag exposes the real layout for the first time. Everything
else is behind `@media (max-width: 640px)`, so desktop never evaluates it
(verified: desktop geometry diffed before/after at 1280x800, identical).

The practice screen was the interesting design problem. The loop is
"read progress -> tap a word -> repeat", but the word grid started at
**y≈2205** on a 664px-tall viewport — more than three screens down, under a
tall header, a 520px config panel, and an unbounded progress box.

Fixes, in order of how much they bought:

- Word grid is `position: sticky; bottom: 0` — it is the interaction loop, so
  it stays put while progress scrolls above it. No more scroll-tap-scroll.
- Config/security panels collapse behind a `<details>` (mobile only, gated by
  a `useIsMobile` hook matching the same 640px breakpoint).
- Progress box capped at 22vh and scrolls internally.
- Header buttons and practice controls pack horizontally instead of stacking.

Grid went 2205 -> ~800, and is now *always* on screen regardless of scroll.

## Button survey

Automated audit clicking every button on both desktop and mobile: 44/44 pass.
Before the viewport fix, mobile had these unreachable: all four main-page
buttons, every modal's `×`, Start Recovery, Generate, Got it, and "Yes, Close".

One genuinely dead thing removed: `handleDownloadConfig` in
`GeneratePasswordModal` was defined and never referenced.

Latent issue noted, not caused by this work: `.config-download-button` and
`.download-config-button` are two separate "Save Config" buttons rendered on
the same page. On mobile the first is inside the collapsed panel, so it is
hidden there; the page-level one is the reachable one.

## Config string format (v2)

    v2:<seed>:<rows>x<cols>:<algorithm>:<param>...:<salt>

Escaping is exactly two rules: `:` -> `\:` and `\` -> `\\`. Nothing else.

The format is unambiguous without a length prefix because **arity is fixed
per algorithm** — read the algorithm name, consume exactly that many params,
and whatever remains is the salt:

    sha256   0    bcrypt 1 (cost)      pbkdf2 2 (iterations, hash)
    argon2id 3 (memoryCost, timeCost, parallelism)
    scrypt   3 (N, r, p)

Ben, on why the booleans go: "they're use salt and use recommended hash which
is stupid so I want them gone."

Both were safe to drop, which is the part worth recording:

- `useRecommendedHash` never touched derivation at all — pure UI affordance.
- `includeSalt` only gated the salt: `hash-function.ts` does
  `effectiveSalt = includeSalt ? salt : ''`. An empty salt already expresses
  "no salt", so the flag was redundant with the value.

`config-migration.test.ts` pins the safety-critical property: a v1 config
must derive a **byte-identical hash** after import, for both
`includeSalt: true` and `false`. If that test ever fails, someone's stored
data has become unrecoverable.

## Still open

Ben reports the modal not closing **on desktop**. Could not reproduce, and it
was chased hard:

- Chromium and Firefox, local dev and production build
- 60 viewport sizes from 420x400 to 1600x900
- With the privacy banner expanded, page scrolled, form fields filled and
  checkboxes toggled
- Real coordinate clicks, checking `elementFromPoint` at the button centre

Every path closes correctly, and `elementFromPoint` never returns anything
covering the `×`.

One real defect *was* found in that area, which may or may not be what he hit:
on short windows the whole modal scrolls **including its header**, so the `×`
leaves the viewport (at 1440x600, `X.top = -103` after scrolling to the
footer). The mobile sheet layout pins the header; desktop still scrolls it.
Making the desktop modal header sticky is the obvious follow-up, and would
fix that class of "I can't close it" regardless of the original trigger.
