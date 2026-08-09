# ILORE — marketing site

Static website for ILORE: a homepage and a four-step AI Opportunity Assessment.
Plain HTML5, CSS3 and vanilla JavaScript — no framework, no build step, no
package dependencies.

## Project structure

```
.
├── index.html              # Homepage
├── assessment.html         # AI Opportunity Assessment
├── assets/
│   ├── css/
│   │   ├── base.css        # Design tokens, reset, typography, layout primitives
│   │   ├── components.css  # Buttons, badges, site header/nav, site footer (both pages)
│   │   ├── home.css        # Homepage-only sections
│   │   └── assessment.css  # Assessment-only workspace and form
│   ├── js/
│   │   ├── main.js         # Shared: mobile nav, tabs, accordion, reveal, scrollspy, CTA tracking
│   │   └── assessment.js   # Assessment: state, validation, progress, submission
│   └── images/             # (empty — the wordmark is type-set, not an image)
└── README.md
```

Both pages load `base.css` → `components.css` → their page stylesheet, in that
order. `main.js` runs on both pages; each behaviour no-ops when its markup is
absent, so the header and footer have exactly one implementation.

## Running it locally

There is nothing to build. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

A server is only needed if you want `?intent=` links and `history.replaceState`
to behave exactly as they do in production; the pages themselves work from the
file system.

## Where styles live

| Change | File |
| --- | --- |
| Colour, type, spacing, radius, shadow tokens | `assets/css/base.css` (`:root`) |
| Container width, section rhythm, breakpoint gutters | `assets/css/base.css` |
| Buttons, badges, header, navigation, footer | `assets/css/components.css` |
| Hero, divisions, Academy/Transform/Discover, About, CTA band | `assets/css/home.css` |
| Assessment layout, stepper, options, fields, review, controls | `assets/css/assessment.css` |

Every colour, radius and shadow comes from a custom property in `base.css`.
Change a token there and both pages follow. The container is `border-box`, so
`--container-width` (1384px) includes the two 52px gutters — 1280px of content.

### Interaction states

Hover behaviour is one system, defined as tokens in `base.css`:

- **Interactive cards** (division cards, About statements, assessment
  options) lift by `--hover-lift` (−3px) with `--shadow-hover` and a warm
  `--color-hover-border`. The About statements share the `.division-card`
  hover rule itself, not a copy of it.
- **Interactive rows** (Academy programs, Transform items, Discover layers,
  tabs) tint with `--color-hover-soft` and never move — no sliding, no padding
  changes, no reflow. Rows on the dark Purpose band use `--color-hover-on-dark`.
- **Buttons and links** keep their colour hierarchy; arrows nudge 3px.
- **The hero stack** is the one sanctioned exception: an −8px dimensional lift,
  still built from the shared tokens.

Everything shares `--hover-ease`; surface hovers run at `--hover-duration`
(0.22s) and micro colour fades at 0.18s. Decorative hovers are gated behind
`@media (hover: hover) and (pointer: fine)` so touch devices never hold a stale
hover state. Selected states always outrank hover (their rules follow the hover
rules in source order — keep it that way when editing).

### Breakpoints

`1180 · 1120 · 980 · 900 · 860 · 820 · 760 · 720 · 560` — each one exists
because a specific block reflows there (navigation swaps at 980, the hero and
split sections stack at 1120, card grids collapse at 820, and so on). Layouts
were checked at 320, 375, 390, 430, 768, 820, 1024, 1280, 1440 and 1600.

## How the assessment works

`assessment.html` is a four-step form: **Your organization → Your challenge →
About you → Review & submit**. All four steps are in the DOM; `assessment.js`
shows one at a time and keeps the stepper, the progress bar and the "Step X / 4"
count in sync.

**Conditional questions.** Choosing *Another industry* reveals a free-text
field. Choosing *Phone or video call* reveals (and requires) a phone number.
The challenge options depend on AI maturity: organizations that have not
started or are only experimenting informally see the early-stage set; those
with pilots underway or scaling see the advanced set. Changing the AI stage
swaps the options **and clears any challenge picked from the other set**, so an
answer that no longer applies is never carried forward.

**Validation** runs when the visitor tries to advance. Messages appear beside
the field they belong to, the offending control gets `aria-invalid`, focus
moves to the first problem, and a polite live region announces how many fields
need attention.

**Saved progress.** State is written to `localStorage` under the key
`ilore-assessment-v1` on every change:

```json
{ "step": 0, "data": { "industry": "", "size": "", "…": "" } }
```

Only the answers this form collects are stored, and only on the visitor's
device. Corrupt or wrongly-typed entries are discarded and the form starts
clean rather than throwing. The key is removed after a successful submission.

### Configuring `SUBMIT_ENDPOINT`

Delivery is off until you configure it. At the top of `assets/js/assessment.js`:

```js
var SUBMIT_ENDPOINT = "";
```

Set it to your own URL (or a form service) and the form POSTs the payload as
JSON with `Content-Type: application/json`. The submit button is disabled while
the request is in flight, a failed request restores the button and shows a
retry message with the answers still saved, and only a successful response
clears the saved state and shows the confirmation.

While the endpoint is empty the form does **not** fake a confirmation. It keeps
the payload under `ilore-assessment-last-submission`, logs it to the console,
and shows a "submission isn't connected yet" panel with a way back to the
answers.

> **Never put API keys, tokens, or credentials in this file.** Everything in
> `assets/js/` is served to every visitor. Keep secrets on the server behind
> your endpoint.

A hidden honeypot field (`company_website`) silently drops automated
submissions. It is positioned off-screen and excluded from the tab order — do
not give it a visible style or a label a person could reach.

### URL intent

Deep links carry the topic through to the assessment and show it as a
dismissible chip:

```
assessment.html?intent=academy      → An Academy education program
assessment.html?intent=transform    → An AI transformation project
assessment.html?intent=discover     → Search & AI visibility
assessment.html?intent=project      → A specific project
```

Unrecognised values are ignored. Clearing the chip strips the query string with
`history.replaceState`, so the visitor's back button is unaffected.

## Analytics

No analytics library is loaded. Both pages push plain objects onto
`window.dataLayer`, ready for a tag manager if one is ever installed:

`cta_click` (with `cta` and `href`), `assessment_start`,
`assessment_step_complete`, `assessment_validation_error`,
`assessment_submit_success`, `assessment_submit_pending`,
`assessment_submit_error`.

Every call to action carries a `data-cta` attribute; that value is what lands in
the event.

## Accessibility notes

- One `<h1>` per page and a heading order that does not skip levels.
- Skip link, landmarks (`header` / `main` / `footer` / labelled `nav`), and a
  single visible focus style on every interactive element.
- Academy tabs implement the tab pattern: roving `tabindex`, arrow keys in both
  axes, Home/End, and `aria-selected` / `aria-controls` kept in sync.
- The Transform accordion keeps `aria-expanded` in sync, and collapsed panels
  are `visibility: hidden`, so screen readers do not read hidden copy.
- The mobile menu uses the `hidden` attribute — it leaves the accessibility
  tree when closed — and closes on link selection, Escape (returning focus to
  the button), an outside click, or a resize back to desktop.
- Form errors are conveyed by text next to the field, not colour alone.
- Reduced motion is respected: `prefers-reduced-motion: reduce` disables scroll
  reveal entirely rather than animating it faster, and content is never hidden
  waiting for an animation.
- Content is visible without JavaScript. Reveal animations only arm themselves
  once the script confirms it can undo them, and the inline navigation stays on
  screen instead of collapsing into a menu button that could not open.

## Browser support

Current Chrome, Safari, Firefox, Edge, iOS Safari and Android Chrome.
Progressive extras degrade rather than break:

- `backdrop-filter` on the header and the sticky form controls sits behind
  `@supports`; without it the surfaces stay near-opaque.
- `:has()` styles the selected option; a mirrored `is-selected` class from the
  script covers browsers without it.
- The accordion animates `grid-template-rows`; browsers that cannot interpolate
  `0fr` snap open instead of clipping content.

## Content

Copy, structure and visual design are approved — the refactor did not change
them. If you edit copy, keep `index.html`'s `<title>`, meta description, Open
Graph tags and the `Organization` JSON-LD block in step with it.

Before going live, set the absolute canonical URLs. Both pages carry a
commented `<link rel="canonical">` in `<head>` marking the spot.
