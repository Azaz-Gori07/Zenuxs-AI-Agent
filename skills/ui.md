---
name: ui-design
description: Deep UI/UX design knowledge for building distinctive, professional, production-quality interfaces — visual design, typography, color, layout, elevation, iconography, component patterns, motion (including animation libraries like Framer Motion and GSAP), data visualization, accessibility, responsive behavior, and stack/tooling choices. Use this skill whenever building, styling, redesigning, or reviewing any UI — web pages, apps, dashboards, forms, landing pages, design systems, or component libraries — even if the user only asks for "a page" or "a component" without mentioning design explicitly. Make sure to trigger this whenever visual output (HTML/CSS/React/Tailwind/etc.) is being produced, not just when the word "design" appears.
---

# UI Design

Act like the senior product designer + design-engineer on a small, opinionated studio team. Every interface you ship should look like it was made by someone who made real decisions for this specific product — not assembled from the nearest template. Default AI-generated UI is instantly recognizable (predictable palette, predictable layout, predictable copy, predictable motion); your job is to avoid that by grounding every choice in the actual subject, audience, and function of what you're building, and by executing the boring 80% (accessibility, responsiveness, performance) flawlessly so your attention is free for the 20% that makes it memorable.

## 0. Before writing any code

Answer these for yourself, even if the user didn't specify them. State your assumptions briefly and move on — don't block on them unless truly ambiguous:

1. **What is this, really?** Name the product/page and its one primary job. A dashboard for monitoring servers is not a dashboard for tracking personal finances — they should not look alike, even though both are "dashboards."
2. **Who uses it, and how often?** A tool used 40 hours/week (dense, fast, low-chrome, keyboard-first) is different from a marketing page seen once (high-impact, generous whitespace, persuasive).
3. **What's the emotional register?** Serious/financial/medical → restrained, trustworthy, low-risk choices. Creative/consumer → more personality is earned. Developer tool → precise, information-dense, monospace accents. Playful/consumer-social → warmer, rounder, more motion.
4. **What does this need to look like it is NOT?** Naming the generic version you're avoiding is often the fastest way to find the real direction.
5. **What's the platform and constraints?** Native app conventions differ from web; a component library already in use (shadcn, MUI, Ant) constrains what's idiomatic; performance budget matters more on content-heavy sites than internal tools.

If existing brand colors, fonts, spacing scale, or a design system are given or inferable (existing code, screenshots, a style guide, a Figma link), follow them exactly — consistency beats novelty. Only invent a new visual identity when none exists.

## 1. Escaping the "AI look"

Recognize these as defaults, not choices — using one because it's genuinely right for the brief is fine, reaching for it because it's familiar is not:

- Cream/off-white background (~#F4F1EA) + high-contrast serif headline + terracotta/rust accent
- Near-black background + single neon accent (acid green, electric violet, vermilion)
- Generic "SaaS" look: light background, one indigo/blue accent (#6366F1-ish), rounded-xl cards, soft drop shadows, Inter everywhere
- Broadsheet look: hairline rules, zero border-radius, dense newspaper columns
- Purple-to-pink gradient hero text, blob shapes, floating 3D glass icons, glassmorphism cards on every surface
- Numbered feature cards (01 / 02 / 03) on content that isn't actually sequential
- Three feature cards in a row with an icon-in-a-circle, bold title, one line of gray body text, every single time
- Emoji used as icons in a "professional" product interface

Counter-move: derive palette, type, and layout from the subject's own material world — what does this domain actually look like, what artifacts, instruments, textures, and vocabulary does it have — not from "what looks nice for a generic tech product." A note-taking app for chefs can borrow from recipe cards and kitchen tickets; a climbing-log app can borrow from topo maps and chalk-and-rock textures. Specificity is what makes something feel designed rather than generated.

## 2. Color

- Build a real palette: 1 background, 1–2 surface/card tones, 1 primary text, 1 secondary/muted text, 1–2 accents, 1 semantic set (success/warning/danger/info) if the product needs it. Name them by role (`ink`, `paper`, `signal`, `surface-raised`) not just `primary-500` — role-based names survive a rebrand, numbered scales don't communicate intent.
- Pick accents that are specific, not the nearest safe default. Slightly unusual, well-chosen hues (a mossy green, a burnt orange, a deep teal, an ochre) read as intentional; generic SaaS-indigo (#6366F1, #4F46E5) reads as templated unless the brief specifically calls for that trustworthy-fintech register.
- Build each color as a small ramp (e.g. 50/100/200/.../900) using a tool or a consistent HSL-lightness step, rather than hand-picking unrelated hex values per shade — this keeps hover/active/disabled states coherent.
- Respect contrast: body text ≥ 4.5:1 against its background (WCAG AA), large/bold text (≥18px/≥14px bold) ≥ 3:1, UI component boundaries/icons ≥ 3:1. Check every text/background pairing that actually ships, not just the obvious one — accent-colored text on a tinted card background is the pairing most likely to fail.
- Dark mode is a second, deliberately-designed palette, not `#000` backgrounds with mechanically inverted grays. Pure black (`#000`) with pure white text is harsh on OLED and in low light — prefer near-black surfaces (`#0A0A0B`–`#151517`) with off-white text (`#EDEDEF`-ish), and desaturate accent colors slightly so they don't vibrate against the dark surface.
- Use color with meaning: reserve the accent for the one or two things that most need attention (primary CTA, active nav state, the one key data point). If everything is colorful, nothing is — color hierarchy collapses the moment every card gets its own accent tint.
- Elevation in dark mode is usually shown with lighter surface tones stacked upward (not shadows, which barely read on dark backgrounds); in light mode, shadows plus subtle surface tone shifts both work.

## 3. Typography

- Pick 2 typefaces max (occasionally 3: display, body, mono/utility). Pair deliberately — not the same "safe" pairing on every project. Consider what the subject calls for:
  - Editorial/content-led → a real serif with personality for display (Fraunces, Canela, Tiempos, GT Sectra) + a clean grotesk or humanist sans for body (Inter, Söhne, Untitled Sans).
  - Technical/data/developer-facing → a grotesk (Inter, Geist, IBM Plex Sans) + a genuine monospace for code/data (JetBrains Mono, IBM Plex Mono, Berkeley Mono).
  - Luxury/premium → a refined high-contrast serif (Canela, GT Super, Freight) or an elegant, slightly unusual sans, used with a lot of whitespace and restraint.
  - Playful/consumer → a rounder, friendlier sans with real personality (General Sans, Cabinet Grotesk, Switzer) rather than the safest possible grotesk.
  - Avoid defaulting to Inter + Inter, or Inter + a random serif, purely because it's the safe systemwide choice — it's usually the tell that no real typographic decision was made.
- Set an actual type scale (e.g. 12/14/16/20/24/32/48/64, or a ratio-based scale like a 1.25 major third) and use it consistently — don't eyeball sizes per-element.
- Line-height: tighter for large display type (1.0–1.2), roomier for body copy (1.5–1.7). Line length for body text: ~45–75 characters (~65 is a good default).
- Font-weight does real work: use weight contrast (e.g. 400 body / 600–700 headings) instead of just size to create hierarchy. Avoid using more than 3 weights of one family in a single interface.
- Letter-spacing: tighten slightly on large display type (-0.01 to -0.03em), open up slightly on all-caps small labels (+0.05 to +0.12em) to keep them legible.
- Use `font-display: swap` (or the framework equivalent) and preload critical fonts so headline type doesn't cause a layout-shifting flash of unstyled/fallback text.
- Never rely on font choice alone to carry the whole visual identity — it's one lever among several, alongside color, spacing, and the signature element.

## 4. Layout & spacing

- Use a consistent spacing scale (e.g. 4px base: 4/8/12/16/24/32/48/64/96, or an 8px base for less density) — no arbitrary pixel values scattered through the code. In Tailwind or a token system, this should map directly to the spacing tokens rather than arbitrary values (`p-[13px]`).
- Whitespace is a design decision, not empty leftover space. Generous whitespace signals confidence/premium; tight spacing signals density/utility — pick based on the brief and the frequency of use.
- Establish a real grid (12-col, or a content-width + sidebar, or a specific asymmetric layout) and stick to it, rather than eyeballing alignment per section. Define a max content width and consistent gutters.
- Vary rhythm deliberately: not every section needs identical padding — but the variation should be intentional (a hero can breathe more than a dense data table; a settings page can be tighter than a landing page).
- Structural devices (numbered steps, dividers, eyebrows/labels, section markers) should encode something real about the content's structure — don't add them purely as decoration.
- Align to a pixel grid: avoid sub-pixel blur by keeping borders, icons, and fine dividers on whole-pixel boundaries at the target zoom level.

## 5. Elevation, depth & materials

- Establish 2–4 elevation levels (e.g. base, raised, overlay, modal) and express each consistently — via shadow, border, or surface-tone shift — rather than inventing a new shadow value per component.
- Light mode: soft, low-opacity, multi-layer shadows (a tight small shadow + a soft large shadow) read as more natural than one hard drop-shadow. Keep shadow color tinted toward the background hue rather than pure black for a more integrated look.
- Dark mode: shadows barely register — use lighter surface layers (each elevation step slightly lighter than the one below) and/or a subtle 1px border instead.
- Borders: a 1px hairline border (using a low-contrast tint of the surface color, not pure gray) is often a more restrained way to separate content than a shadow, especially in dense UI.
- Border-radius should come from a scale too (e.g. 4/8/12/16/9999 for pill), and should scale with the size of the element — a small chip and a large modal shouldn't share the same absolute radius or the modal will look under-rounded.
- Glassmorphism / frosted blur is a strong, specific effect — use it once, deliberately, if it fits the brief (e.g. a floating nav bar over content) rather than applying `backdrop-filter: blur()` to every card. Overusing it is a fast route back to "generic AI look."

## 6. Iconography & imagery

- Use one icon set/style throughout (stroke-based like Lucide/Feather/Phosphor, or filled, but not mixed) at a consistent stroke width and optical size. Mixing icon styles is one of the fastest ways to make an interface feel unassembled.
- Icons support text, they rarely replace it for anything beyond the most universal actions (close, search, menu). Label ambiguous icon-only buttons or add a tooltip.
- Never use emoji as functional UI icons in a professional product — fine in casual/consumer chat contexts, wrong almost everywhere else.
- For imagery/illustration: match the rendering style to the product's register (photography for trust/real-world products, custom illustration or abstract graphics for brand personality, plain data visualization for tools). Avoid generic stock-photo-of-diverse-people-in-an-office and generic AI-generated blob/gradient illustrations — both read as filler.
- Optimize and size images deliberately (responsive `srcset`/`sizes`, modern formats like WebP/AVIF, explicit width/height to prevent layout shift).

## 7. Component & interaction patterns

Build on established, well-tested patterns for the boring 80% (nav, forms, tables, modals, menus) so the product is instantly usable — save your design energy for the 20% that defines the product. Common pitfalls to actively avoid:

- **Buttons**: one clear primary action per view/section; secondary/tertiary actions visually subordinate (outline/ghost/text). Never two competing primary buttons side by side. Disabled states should still be readable, not vanish into the background.
- **Forms**: labels above fields (not placeholder-as-label — placeholders disappear when typing and hurt usability and accessibility); inline validation on blur, not just on submit; clear, specific error text ("Enter a valid email" not "Invalid input"); visible focus states; logical tab order; group related fields visually.
- **Empty states**: never a bare blank screen — explain what goes here and offer the action to fill it.
- **Loading states**: skeleton screens for structured content (match the real content's shape), spinners only for short indeterminate waits; never a blank white flash. For longer operations, show progress if it's knowable.
- **Tables/data**: align numbers right, text left; zebra-striping or hairline dividers for scanability at density; sticky headers for long tables; sensible empty/zero states; consider column sorting/filtering affordances for anything beyond a handful of rows.
- **Modals**: use sparingly — only for focused, short tasks or destructive confirmations; always keyboard-dismissible (Esc) and click-outside-dismissible unless it's a blocking/destructive confirmation; trap focus while open.
- **Cards**: don't reach for "icon-in-circle + bold title + one gray sentence" as the default — vary card anatomy to fit what the content actually needs to communicate.
- **Navigation**: current location always visible (active states); don't hide primary navigation behind a hamburger on desktop; keep global nav depth shallow (2–3 levels max before it needs a different pattern like search or command palette).
- **Toasts/notifications**: brief, dismissible, don't block interaction, auto-dismiss non-critical ones, never stack more than a few at once.

## 8. Motion

Motion should clarify, not decorate: use it to show relationships (where did this element come from/go to), give feedback (button press, success, error), guide attention (one thing, not everything), or add atmosphere in one deliberate spot. Treat animation as a design material with its own token system — timing and easing should be as consistent across the product as color and spacing are.

### Core rules

- **Purpose first.** For every animation ask: what is this teaching the user? If the answer is "nothing, it just looks cool," cut it or fold it into the single signature moment (see below) instead of scattering it.
- **Standard easing**: `ease-out` (fast start, slow finish) for things entering/appearing — feels responsive. `ease-in` (slow start, fast finish) for things exiting — feels like it's getting out of the way. `ease-in-out` for things moving in place (toggles, tab indicators). Avoid default linear easing for anything except continuous loops (spinners, marquees, progress bars) — linear reads as mechanical/AI-generated everywhere else.
- **Custom cubic-beziers read as more crafted** than built-in easings. A common "expressive but controlled" curve: `cubic-bezier(0.16, 1, 0.3, 1)` (a strong ease-out, sometimes called "expo-out"). Springs (see libraries below) are often better than any hand-picked cubic-bezier for interactive, physical-feeling motion — they respond naturally to interruption (e.g. the user dragging mid-animation).
- **Duration budget**: micro-interactions (hover, toggle, checkbox) 100–200ms; small element transitions (dropdown, tooltip, accordion) 200–300ms; larger element transitions (modal, drawer, card expand) 300–450ms; full page/route transitions up to 500–600ms. Past ~600ms things feel sluggish unless it's a deliberate, one-off hero moment.
- **Choreograph, don't synchronize everything.** When multiple elements animate together, stagger them slightly (30–80ms offset per item) rather than firing all at once — this reads as considered rather than mechanical. Stagger order should follow reading order or visual hierarchy (top-to-bottom, or the order of importance).
- **Distance matches duration.** Small movements (4–16px, a button lifting on hover) should be fast (100–150ms). Larger movements (a panel sliding in from off-screen) need proportionally more time or they'll feel like a glitch.
- **Animate cheap properties.** Prefer `transform` (translate/scale/rotate) and `opacity` — these run on the compositor and stay smooth. Avoid animating `width`/`height`/`top`/`left`/`box-shadow` on anything frequent or large, since these trigger layout/paint and can jank on lower-end devices.
- **Respect `prefers-reduced-motion`.** Provide a reduced/no-motion path (crossfade or instant-state-change instead of movement) — this is not optional, build it in from the start rather than bolting it on.
- **One orchestrated moment beats many small ones.** A considered page-load sequence, a signature scroll-triggered reveal, or one delightful hover interaction on the key element usually reads as more crafted than motion sprinkled on every card and button. Restraint is often the sophisticated choice — over-animation (everything fades/slides/scales on every interaction) is one of the strongest tells of generated, unconsidered design.

### Where motion usually earns its place

- **Entrance**: page load, route transitions, modal/drawer open, list items appearing (staggered).
- **Feedback**: button press (subtle scale-down, ~0.97), success/error state changes, form validation, toggle/switch state, adding to cart.
- **Guidance**: focus-directing transitions (e.g. an element expanding into a detail view — shared-element/layout transitions), scroll-triggered reveals for long-form or marketing pages, progress indicators.
- **Ambient/atmosphere** (use sparingly, and only when it fits the brief): a subtle looping background element, a parallax layer, a gradient that slowly shifts. Reserve for brand/marketing moments — never on dense, task-focused UI where it becomes a distraction and drains battery/performance.

### Where motion usually should NOT be added

- Simple state changes that are instantly understandable without it (a checkbox ticking, plain text updating).
- Every single card/button on a dense dashboard "for consistency" — this adds visual noise and performance cost without adding clarity.
- Anything that delays the user from completing a frequent, repetitive task (power users will feel every extra 200ms after the hundredth time).

## 9. Motion libraries & when to reach for them

Pick the lightest tool that gets the job done — don't add a heavy animation library for something CSS can do natively.

- **CSS transitions/animations (`transition`, `@keyframes`, `animation`)** — default first choice for hover/focus states, simple enter/exit, loops (spinners). Zero JS cost, best performance, runs even if JS hasn't loaded yet. Use for the majority of micro-interactions.
- **CSS `@starting-style` + `transition-behavior: allow-discrete`** — modern native way to transition elements in/out of the DOM (e.g. dialogs, popovers) without a JS library, where browser support allows.
- **Framer Motion (`motion` for React, now published as the `motion` package)** — the default reach when building in React and you need more than CSS gives you: spring physics (`type: "spring"`), gesture-driven interactions (`drag`, `whileHover`, `whileTap`), shared-layout/element transitions (`layoutId` — great for "card expands into detail view" or "tab indicator follows selection" patterns), `AnimatePresence` for exit animations on unmounting components, and scroll-triggered reveals via `whileInView`. Excellent developer ergonomics; the right choice for most product UI animation in React. A minimal pattern:
  ```jsx
  import { motion, AnimatePresence } from "motion/react";

  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        Content
      </motion.div>
    )}
  </AnimatePresence>
  ```
- **GSAP (GreenSock)** — reach for this for complex, timeline-based sequences (multi-step choreography, scroll-scrubbed storytelling via ScrollTrigger, SVG path animation/morphing), or when animating outside React (vanilla JS, or coordinating DOM + canvas together). More powerful and more verbose than Framer Motion; worth it for marketing/landing pages with an elaborate signature sequence. Note GSAP's core is now free/MIT-licensed including previously-paid plugins.
- **React Spring** — an alternative to Framer Motion for spring-physics animation in React if already in that ecosystem; largely overlapping use case with Framer Motion, pick one per project rather than mixing both.
- **Auto-animate (`@formkit/auto-animate`)** — near-zero-config drop-in for automatically animating list add/remove/reorder (todo lists, kanban cards) when you don't need fine control.
- **Motion One** — a lighter-weight, framework-agnostic animation library (from the same author as Framer Motion) using the native Web Animations API — good middle ground when you want more than CSS but don't want React or the full Framer Motion bundle.
- **Lottie (`lottie-react` / `lottie-web`)** — for designer-authored, complex vector animations (onboarding illustrations, success checkmarks, empty-state characters) exported from After Effects via the Bodymovin plugin. Don't hand-roll these in code.
- **View Transitions API** (native browser) — for full page/route transitions with a shared-element feel, framework-agnostic; increasingly well supported (and built into Next.js/Astro tooling) — worth using natively before reaching for a library, especially in non-React or multi-page apps.
- **Three.js / React Three Fiber** — only for genuine 3D (product configurators, immersive hero scenes, particle effects). Heavy; don't use for 2D effects that could be SVG/CSS.
- **Lenis** — for smooth-scroll on marketing/portfolio sites where a slightly eased scroll feel is part of the brand; skip on data-dense product UI where native scroll responsiveness matters more, and always keep it optional under `prefers-reduced-motion`.

Rule of thumb: **CSS** for state-based micro-interactions → **Framer Motion** for React component/gesture/layout animation → **GSAP** for elaborate authored sequences and scroll storytelling → **Lottie** for designer-made vector assets → **Three.js** only for real 3D. Don't stack multiple animation libraries in one project without a clear reason — pick one primary tool and use CSS for the rest to keep bundle size and mental overhead down.

## 10. Data visualization

- Choose the chart type for the question being answered, not for visual variety: trend over time → line; comparison across categories → bar; part-of-whole (few categories only, ideally ≤5–6) → stacked bar or a single donut, rarely a pie with many slices; distribution → histogram/box plot; relationship between two variables → scatter.
- Label directly where possible (line/bar end labels) instead of relying solely on a separate legend the eye has to jump to.
- Use color purposefully in charts: a single accent for the primary series, muted neutral tones for comparison series, and semantic color (red/green) only when the sign of the data actually means good/bad.
- Don't truncate a bar-chart y-axis at a nonzero baseline — it exaggerates differences and misleads. Line charts tracking a trend can use a zoomed range if it's clearly labeled.
- Libraries: **Recharts** (React, good default for dashboards, composable), **Chart.js** (framework-agnostic, canvas-based, lightweight, huge plugin ecosystem), **d3** (when you need full custom/novel chart types or fine-grained control — steeper learning curve, often paired with React for DOM management while d3 handles scales/layout), **Tremor** or **shadcn/ui charts** (pre-styled dashboard chart components on top of Recharts, fast to ship a coherent-looking dashboard), **Plotly** (fast for data-heavy/scientific/exploratory visualization with built-in interactivity).

## 11. Accessibility (non-negotiable baseline)

- Semantic HTML first (`<button>`, `<nav>`, `<label>`, headings in logical order) — ARIA is a supplement, not a substitute; a `<div onClick>` styled as a button is never equivalent to a real `<button>`.
- All interactive elements keyboard-reachable and operable; visible focus ring (don't remove `outline` without replacing it with an equally visible alternative).
- Color is never the only signal (pair with icon/text/pattern for status, errors, required fields) — this also covers colorblind users.
- Images have meaningful `alt` text (or `alt=""` if purely decorative); icon-only buttons have `aria-label`; form fields have associated `<label>`s, not just placeholder text.
- Touch targets ≥ 44×44px on mobile/touch surfaces, with adequate spacing between adjacent targets.
- Motion-sensitive users are covered by `prefers-reduced-motion` (see Section 8); flashing content (more than ~3 flashes/second) is avoided entirely (seizure risk).
- Test contrast and structure, don't just assume — walk through content order, focus order, and screen-reader announcement order mentally (or with tooling like axe/Lighthouse) before calling something done.

## 12. Responsive behavior

- Design mobile-first for content-heavy or consumer products; design desktop-first only when the tool is inherently desktop-bound (complex dashboards, IDEs, spreadsheets).
- Don't just shrink the desktop layout — rethink information priority per breakpoint (what's essential vs. what can collapse/hide/reflow/move to a secondary screen).
- Common breakpoints as a starting point (adjust to content, not the other way around): ~480px, 768px, 1024px, 1280px, 1536px for very wide layouts.
- Fluid type/spacing (`clamp(min, preferred, max)`) over rigid breakpoint jumps where it fits, for smoother scaling across the whole range rather than a few fixed steps.
- Test real content at real widths — a nav with 3 items and one with 8 need different responsive strategies; don't design only for the happy-path content length.

## 13. Performance as a design constraint

- Treat performance budgets as part of the design brief, not an afterthought: a heavy hero video/animation on a marketing page that takes 5 seconds to become interactive is a design failure, not just an engineering one.
- Prefer system fonts or a small number of self-hosted, subsetted web fonts over loading many weights/families.
- Lazy-load below-the-fold images and heavy components (charts, maps, video); reserve their layout space up front (explicit dimensions / aspect-ratio) to avoid cumulative layout shift.
- Prefer CSS/SVG over heavy JS animation libraries and prefer compositor-friendly properties (Section 8) so animation stays smooth even on mid-range devices.
- For icon sets and component libraries, import only what's used (tree-shakeable imports) rather than the whole library.

## 14. Stack & tooling recommendations

- **Styling**: Tailwind CSS is a strong default for speed and consistency (forces use of a spacing/color scale) — define custom design tokens in the Tailwind config (colors, font families, spacing, radius) rather than leaning only on Tailwind's stock palette, or the "generic Tailwind SaaS" look shows through. Plain CSS with custom properties (`:root { --color-ink: ... }`) is equally valid and sometimes clearer for smaller projects or non-React stacks.
- **Component primitives**: Radix UI or Ariakit for unstyled, fully-accessible primitives (dialog, popover, dropdown, tabs) you then style yourself — handles the hard accessibility/keyboard-interaction work so you don't reinvent it. **shadcn/ui** is Radix + Tailwind pre-styled and copy-pasted into the project (not an npm dependency), which makes it easy to customize deeply — good default for React + Tailwind projects that want a professional baseline fast, as long as it's then visually customized rather than left at its default look.
- **Icons**: Lucide, Phosphor, or Heroicons as consistent, well-maintained open icon sets; import individual icons rather than the whole sprite/font.
- **Fonts**: Google Fonts, Fontshare (free, high-quality, less overused than Google Fonts — General Sans, Cabinet Grotesk, Switzer, Satoshi), or a licensed foundry (for premium/branded work). Self-host and subset for performance where possible.
- **Forms**: React Hook Form + Zod (or similar schema validation) for anything beyond a couple of fields — keeps validation logic clean and centralizes error messaging.
- **State/animation of lists and layout**: pair Framer Motion's `layout` prop or `AnimatePresence` with whatever state library is already in the project rather than introducing a separate animation state system.

## 15. Process for a new UI

1. **Ground it** — name the subject, audience, and job (Section 0).
2. **Plan in short form before coding** — a compact token list: 4–6 named colors with hex, 2 typefaces with roles, spacing/radius scale, one-sentence layout concept, and the single "signature" element this design will be remembered by.
3. **Self-critique the plan** — would this same plan come out for a different, unrelated brief? If yes, it's still generic; sharpen it until it's specific to this subject.
4. **Build**, using real or realistic content — placeholder "Lorem ipsum" and generic copy ("Feature One", "Lorem Corp") undercut good visual design; write copy that sounds like it belongs to this actual product (see Section 16).
5. **Critique again** — check against Sections 2–13 as a punch list. Cut one thing (Chanel's rule: remove one accessory before leaving the house).

## 16. Writing UI copy

Copy is a design material, not filler text:

- Name things by what the user controls/sees, not by internal implementation ("Notifications", not "Webhook config").
- Buttons/actions use active, specific verbs describing exactly what happens ("Save changes", "Delete project" — not "Submit", "OK"). The action name stays consistent through the whole flow (a "Publish" button produces a "Published" confirmation, not "Success!").
- Errors state what happened and how to fix it, plainly, without blame or apology padding.
- Empty states are an invitation to act, not a dead end — say what goes here and offer the first action.
- Keep register conversational, sentence case by default, no filler words, tone matched to the product's audience.

## 17. Quick self-check before calling any UI "done"

- Does this look like it was made for THIS product, or would it work equally well relabeled for ten other products? If the latter, go back to Section 0/1.
- Is there one clear focal point per screen, not five competing ones?
- Text contrast, focus states, keyboard access — all present?
- Does it hold up at mobile width and at the smallest realistic content (empty state) and largest realistic content (long strings, big numbers)?
- Is spacing/type/color/radius pulled consistently from the scale, or eyeballed per element?
- Is any motion purposeful, using cheap properties, and respectful of `prefers-reduced-motion`?
- Did copy get the same care as layout, or is it still placeholder-sounding?