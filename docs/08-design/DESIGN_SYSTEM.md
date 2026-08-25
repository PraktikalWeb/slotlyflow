# SlotlyFlow Design System

**Status:** Authoritative  
**Applies to:** SlotlyFlow product interface  
**Initial scope:** Phase 01 and all later product UI unless superseded by an approved design decision  
**Brand:** SlotlyFlow

---

# 1. Purpose

SlotlyFlow is a software platform, not a corporate business website.

The interface must feel:

- operational;
- polished;
- calm;
- modern;
- distinctive;
- capable;
- human;
- colourful in a controlled way;
- easy to use for non-technical business owners.

The product must **not** look like a generic AI-generated SaaS dashboard.

The visual system should feel intentionally designed rather than assembled from default component-library patterns.

---

# 2. Core Design Principle

SlotlyFlow uses a restrained neutral application shell with colour concentrated in:

- active states;
- messaging activity;
- automation state;
- data visualisation;
- selected controls;
- progress;
- contextual emphasis.

Do not colour every card or section.

The primary visual identity is:

**Deep SlotlyFlow Green + Flow Lime**

Supporting accents add product depth without turning the interface into a rainbow dashboard.

---

# 3. Canonical Brand Colour

The official SlotlyFlow logo uses:

```css
--brand-green: #003B2D;
```

This is the canonical SlotlyFlow brand green.

Do not approximate it with another green.

The logo artwork is authoritative. Do not recreate the wordmark using a UI font.

---

# 4. Product Colour System

## 4.1 Core palette

```css
:root {
  --brand-green: #003B2D;

  --flow-lime: #B7F34A;
  --flow-aqua: #3CE6D0;
  --flow-violet: #8B7CF6;
  --flow-coral: #FF7A66;

  --canvas: #F7F9F8;
  --surface: #FFFFFF;
  --surface-subtle: #F1F5F3;
  --surface-strong: #E9EFEC;

  --ink: #111816;
  --ink-secondary: #66736F;
  --ink-tertiary: #8B9692;

  --border: #E1E8E4;
  --border-strong: #C9D4CF;

  --danger: #C9362B;
  --warning: #A45B09;
  --success: #087A5B;
  --info: #147B8F;
}
```

---

## 4.2 Colour responsibilities

### Brand Green `#003B2D`

Use for:

- official logo;
- primary brand marks;
- important primary actions;
- strong selected/navigation states;
- dark text accents;
- key product moments.

Do not use it as a full-page background for the standard application shell.

---

### Flow Lime `#B7F34A`

This is SlotlyFlow's distinctive product accent.

Use for:

- live automation indicators;
- active workflow emphasis;
- progress accents;
- selected markers;
- small high-attention UI details;
- controlled brand moments.

Do not use lime for body text on white.

Do not turn every primary button lime.

Lime should remain visually valuable because it is used selectively.

---

### Flow Aqua `#3CE6D0`

Use for:

- messaging activity;
- conversation-related data;
- information visualisation;
- secondary chart series;
- subtle communication states.

---

### Flow Violet `#8B7CF6`

Use for:

- automation logic;
- branching/configuration;
- future AI-assisted features;
- analytics series where a distinct category is required.

Do not use violet merely to make a screen "more colourful."

---

### Flow Coral `#FF7A66`

Use for:

- human handover;
- attention states;
- selected chart series;
- controlled warning emphasis.

Do not use brand coral as the destructive-action colour.

Destructive actions use the semantic danger token.

---

# 5. Colour Usage Rule

A normal SlotlyFlow screen should remain approximately:

- **75–85% neutral surfaces**
- **10–20% brand green / ink**
- **5–10% product accents**

The interface should feel colourful because colour is meaningful, not because every surface is coloured.

---

# 6. Typography

## 6.1 Primary interface typeface

Use:

**Spline Sans**

as the primary SlotlyFlow interface typeface.

Preferred weights:

- 400 — regular body text;
- 500 — labels and controls;
- 600 — headings and strong emphasis;
- 700 — rare, high-emphasis display use only.

Do not default to:

- Inter;
- Geist;
- Poppins;
- Plus Jakarta Sans;
- generic system UI as the intended visual identity.

System fonts may be used only as fallback fonts.

Example stack:

```css
font-family:
  "Spline Sans",
  "Segoe UI",
  Arial,
  sans-serif;
```

The official SlotlyFlow logo remains an image/vector asset and must not be recreated using Spline Sans.

---

## 6.2 Technical/data typeface

For technical values where monospace meaningfully improves scanning, use:

**IBM Plex Mono**

Examples:

- message IDs;
- webhook references;
- API/debug references;
- internal support identifiers;
- code-like values.

Do not use monospace decoratively across the product.

---

## 6.3 Type scale

Use a compact product-oriented scale.

```css
--text-xs: 12px;
--text-sm: 13px;
--text-base: 14px;
--text-md: 15px;
--text-lg: 18px;
--text-xl: 22px;
--text-2xl: 28px;
--text-3xl: 36px;
```

Typical use:

| Token | Use |
|---|---|
| 12px | metadata, timestamps, compact labels |
| 13px | secondary table/list text |
| 14px | standard UI body |
| 15px | comfortable forms / important body |
| 18px | section heading |
| 22px | page heading |
| 28px | major page value or onboarding title |
| 36px | rare auth/onboarding display use |

Do not use oversized 48–72px SaaS marketing headings inside the authenticated application.

---

## 6.4 Typography behaviour

- Headings should be concise.
- Use weight before size to create hierarchy.
- Avoid excessive all-caps.
- Avoid letter-spacing tricks on ordinary labels.
- Do not make every section heading bold and oversized.
- Numeric dashboard data should be clear, not theatrical.

---

# 7. Iconography

## 7.1 Icon philosophy

Icons are functional aids, not decoration.

SlotlyFlow must **not** use the generic AI-dashboard pattern where every:

- card;
- metric;
- heading;
- menu item;
- feature;
- status;
- empty state

gets an icon.

Use icons only where they improve recognition or interaction.

---

## 7.2 Prohibited icon patterns

Do not:

- place arbitrary icons inside coloured circles for every card;
- add sparkle icons to imply AI;
- use shields/checkmarks merely to make content look trustworthy;
- decorate page headings with icons;
- use an icon next to text when the text is already unambiguous;
- mix multiple icon families;
- use emojis as interface icons;
- use random 3D illustrations.

---

## 7.3 Icon family

Do not make Lucide the automatic/default visual language.

For Phase 01, use a **small curated set of SVG icons** with:

- simple geometry;
- approximately 1.75px–2px optical stroke;
- rounded joins only where appropriate;
- no filled cartoon look;
- consistent 20px and 24px grids.

Prefer reusing a tightly controlled approved icon set rather than importing hundreds of icons into visual usage.

Core navigation icons should be selected deliberately and remain consistent.

If an icon is not necessary, use text.

---

## 7.4 Brand-specific product symbols

For high-value concepts such as:

- Inbox;
- Automations;
- Human handover;
- WhatsApp connection state;

custom SlotlyFlow-specific glyph treatment may be introduced later.

Do not invent brand-specific icons casually during feature implementation.

---

# 8. Shape Language

SlotlyFlow should not use excessive rounded rectangles.

## Radius tokens

```css
--radius-xs: 4px;
--radius-sm: 7px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-pill: 999px;
```

Usage:

- small controls: `7px`;
- buttons: `8–10px`;
- cards/panels: `10px`;
- dialogs: `14px`;
- badges/chips only: pill radius.

Do not use 20px–32px radius on every card.

Do not make the entire application look soft, bubbly, or toy-like.

---

# 9. Borders and Elevation

The application should rely more on:

- spacing;
- grouping;
- subtle tonal changes;
- fine borders

than on heavy shadows.

## Borders

```css
border: 1px solid var(--border);
```

Use stronger borders only for:

- focused control groups;
- selected surfaces;
- important structural separation.

---

## Shadows

Default cards should generally have **no visible drop shadow**.

Use shadows for:

- dropdowns;
- command menus;
- popovers;
- floating toolbars;
- dialogs;
- temporary elevated surfaces.

Example:

```css
box-shadow:
  0 1px 2px rgba(17, 24, 22, 0.05),
  0 8px 24px rgba(17, 24, 22, 0.08);
```

Avoid:

- giant blurred shadows;
- green glows;
- neon glow;
- glassmorphism;
- frosted cards.

---

# 10. Application Shell

## Desktop

Standard product shell:

```text
┌───────────────┬───────────────────────────────────────────────┐
│               │                                               │
│   Sidebar     │                Main workspace                 │
│               │                                               │
│               │                                               │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

Recommended sidebar width:

```css
--sidebar-width: 244px;
```

The sidebar is generally white or near-white.

Do **not** default to a large solid dark-green sidebar.

Brand green should appear through:

- logo;
- selected state;
- important controls;
- subtle identity details.

This keeps SlotlyFlow feeling like a product workspace rather than a corporate portal.

---

# 11. Sidebar

The sidebar should contain only durable top-level product navigation.

Future target structure may include:

- Overview
- Inbox
- Automations
- Contacts
- Analytics
- Team
- WhatsApp
- Settings

Only items belonging to the currently implemented phase should appear.

Do not show fake/unimplemented navigation.

---

## Selected navigation state

Avoid a generic fully filled green pill.

Preferred treatment:

- slight tonal background;
- dark text;
- a controlled SlotlyFlow green or lime marker;
- icon/text remains crisp.

Example concept:

```text
│  Overview
│
│▌ Inbox
│
│  Automations
```

or a subtle rectangular selected surface with a small brand marker.

---

# 12. Main Canvas

```css
background: var(--canvas);
```

Pages should use a clear workspace width rather than placing every section in separate cards.

Recommended desktop content behaviour:

```css
max-width: 1440px;
```

depending on feature.

Inbox and future automation-builder screens may use the full available application width.

Settings/forms should use narrower readable columns.

---

# 13. Page Headers

A normal authenticated page header consists of:

- page title;
- short contextual description only where necessary;
- primary action on the right where relevant.

Do not add:

- decorative icon;
- eyebrow;
- gradient heading;
- oversized welcome statement;
- fake motivational copy.

Example:

```text
Automations                                      + New automation
Control how SlotlyFlow responds to customers.
```

Not:

```text
✨ AUTOMATION HUB

Supercharge your customer journey
with intelligent conversational workflows.
```

---

# 14. Cards and Panels

Cards should represent meaningful bounded objects or groups.

Do not wrap every piece of content in a card.

A card may contain:

- one coherent metric;
- a connected WhatsApp number;
- an automation;
- a billing item;
- a grouped settings area.

Card appearance:

```css
background: #FFFFFF;
border: 1px solid #E1E8E4;
border-radius: 10px;
```

Avoid decorative top gradients and random coloured icon circles.

---

# 15. Metric Presentation

Do not use the generic dashboard pattern:

```text
[icon bubble] Total Messages
              2,384
              +12.4%
```

repeated four times without context.

Metrics should be quiet and data-first.

Example:

```text
Messages
2,384
↑ 12% from previous period
```

Accent colour may identify the data series, not decorate the whole card.

---

# 16. Buttons

## Primary

Default:

```css
background: #003B2D;
color: #FFFFFF;
```

Primary buttons should feel confident but compact.

Use only one primary action per local decision area where possible.

---

## Secondary

```css
background: #FFFFFF;
color: #111816;
border: 1px solid #C9D4CF;
```

---

## Tertiary / ghost

Text-first with restrained hover surface.

---

## Destructive

Use semantic danger tokens.

Do not use Flow Coral as the primary destructive colour.

---

## Button sizing

Typical desktop:

```css
height: 38px;
padding-inline: 14px;
border-radius: 8px;
```

Large auth/onboarding actions may use `42–44px`.

Avoid oversized 52–60px generic landing-page buttons inside the product.

---

# 17. Forms

Forms are a major Phase 01 surface and must feel deliberate.

## Field anatomy

```text
Label
┌──────────────────────────────────┐
│ Value                            │
└──────────────────────────────────┘
Supporting/error text
```

Rules:

- labels remain visible;
- placeholder is not a substitute for label;
- field height approximately 42px;
- clear focus state;
- errors appear next to the affected control;
- required fields should be communicated consistently;
- do not add an icon to every input.

---

## Focus

Use a restrained green focus treatment.

Example:

```css
border-color: #003B2D;
box-shadow: 0 0 0 3px rgba(0, 59, 45, 0.10);
```

---

# 18. Auth Screens

Phase 01 includes:

- sign up;
- login;
- email verification;
- password recovery/reset.

These must not look like a generic template.

## Direction

Use a clean editorial split or focused centred composition.

The page should have:

- prominent official SlotlyFlow logo;
- strong typography;
- minimal copy;
- high-quality form composition;
- one controlled brand-colour moment;
- optional abstract brand geometry derived from the SlotlyFlow conversation/wave identity.

Do not use:

- stock photography;
- generic people illustrations;
- gradient blobs;
- floating chat bubbles;
- 3D robot graphics;
- testimonial cards on the login screen;
- fake dashboard mockups as decoration;
- giant abstract mesh gradients.

---

# 19. Organization Creation

This screen should feel like the beginning of a workspace, not a corporate registration form.

Use:

- clear single-column progression;
- limited fields;
- visible progress only if there are genuinely multiple steps;
- concise explanations.

Do not create a multi-step wizard merely to make onboarding look sophisticated.

---

# 20. Dashboard Shell — Phase 01

Phase 01 does **not** need a fake completed dashboard.

The initial authenticated shell should establish:

- sidebar;
- top-level page framing;
- organization context;
- account/user menu;
- loading/error/empty states;
- navigation styling;
- responsive behaviour.

Do not fabricate WhatsApp metrics, conversation graphs, automation counts, or sample business data unless explicitly required as labelled demo data.

---

# 21. Tables and Lists

Prefer lists/tables when they improve scanning.

Do not convert every dataset into cards.

Tables should use:

- subtle row separators;
- compact density;
- clear alignment;
- sticky headers only where useful;
- accessible row actions;
- no excessive vertical whitespace.

---

# 22. Badges and Status

Badges are for real states.

Examples:

- Connected
- Disconnected
- Draft
- Live
- Waiting
- Agent active
- Failed

Do not use badges for ordinary nouns or metadata merely for decoration.

Status colour must be semantic and accessible.

Lime can be used as an accent background/marker for positive live automation states, but readable text should use an accessible dark tone.

---

# 23. Empty States

Empty states should tell the user what is absent and what they can do.

Use:

- concise heading;
- one sentence where needed;
- one appropriate action.

Illustrations are optional, not mandatory.

Do not generate generic line-art illustrations for every empty state.

Example:

```text
No automations yet

Create your first automation to start handling
common WhatsApp enquiries automatically.

[Create automation]
```

---

# 24. Loading States

Use structural skeletons that resemble the actual destination layout.

Do not:

- introduce fake delays;
- show a full-screen spinner for ordinary navigation;
- animate every skeleton aggressively.

Use subtle motion and preserve stable application chrome.

---

# 25. Error States

Errors should be:

- specific;
- calm;
- actionable;
- non-technical unless the user is in an explicitly technical support view.

Never expose:

- stack traces;
- provider secrets;
- raw database errors;
- raw Meta token information.

---

# 26. Motion

Motion should reinforce state change.

Preferred duration:

```css
--motion-fast: 120ms;
--motion-standard: 180ms;
--motion-slow: 260ms;
```

Use for:

- hover;
- selected-state movement;
- dropdowns;
- panel transitions;
- small confirmation transitions.

Avoid:

- bouncy spring motion everywhere;
- floating cards;
- looping decorative animation;
- dramatic page transitions;
- parallax inside the product.

Respect `prefers-reduced-motion`.

---

# 27. Product Colour by Domain

This mapping should remain consistent where colour is useful.

| Product domain | Accent |
|---|---|
| Brand / primary | Deep Green |
| Active automation / live flow | Lime |
| Messaging / conversations | Aqua |
| Logic / branching / future AI assistance | Violet |
| Human handover / attention | Coral |
| Destructive actions | Semantic Danger |
| Warning | Semantic Warning |

This does not mean every instance of a domain must be coloured.

---

# 28. Charts

Charts should use the SlotlyFlow product palette.

Priority series order:

1. Deep Green
2. Aqua
3. Violet
4. Coral
5. Lime where sufficient contrast exists

Avoid:

- rainbow palettes;
- gradients under every line;
- unnecessary donut charts;
- decorative charts with no decision value;
- 3D charts.

Axes and labels should remain quiet and legible.

---

# 29. Responsive Behaviour

SlotlyFlow is a web platform and must work well on mobile.

## Breakpoints

Do not build layout logic around arbitrary device names.

Use content-driven responsive breakpoints.

Suggested starting points:

```css
--bp-sm: 640px;
--bp-md: 768px;
--bp-lg: 1024px;
--bp-xl: 1280px;
--bp-2xl: 1536px;
```

---

## Mobile

On smaller screens:

- collapse the sidebar;
- preserve primary actions;
- avoid horizontal clipping;
- convert appropriate tables into usable compact list treatments;
- maintain 44px minimum touch targets where practical;
- keep forms single-column;
- avoid desktop-only hover dependencies.

The inbox later should be designed as a genuine mobile workflow, not merely squeezed desktop columns.

---

# 30. Accessibility

Minimum requirements:

- WCAG 2.2 AA target for normal product interaction;
- visible keyboard focus;
- semantic HTML;
- labelled inputs;
- accessible dialog/menu behaviour;
- colour is never the only status signal;
- minimum readable contrast;
- keyboard-accessible navigation;
- `prefers-reduced-motion` support;
- meaningful screen-reader labels for icon-only buttons.

Flow Lime, Aqua, Violet, and Coral must not automatically be used as text colours on white. Verify contrast for each use.

---

# 31. Dark Mode

Dark mode is **not required for Phase 01**.

Do not implement dark mode prematurely.

The design system should remain token-based so dark mode can be introduced later without rewriting components.

When introduced, create a deliberate dark palette rather than simply inverting colours.

---

# 32. Component Architecture

Reusable UI primitives should be intentionally built and documented.

Likely primitives:

- Button
- Input
- Textarea
- Select
- Checkbox
- Radio
- Switch
- Badge
- Tooltip
- Dropdown
- Dialog
- Sheet
- Tabs
- Toast
- Skeleton
- Avatar
- EmptyState
- PageHeader
- FormField

Do not create abstractions before repeated use demonstrates a real pattern.

Do not allow third-party component defaults to dictate SlotlyFlow's visual identity.

If a headless component library is used for accessibility/behaviour, SlotlyFlow styling remains authoritative.

---

# 33. Anti-Generic-AI Design Rules

These rules are mandatory.

Do not use:

- Inter as the deliberate primary brand/product typeface;
- Geist as the deliberate primary brand/product typeface;
- Lucide icons indiscriminately across every surface;
- sparkle icons for AI;
- icons in coloured circular backgrounds on every metric;
- generic purple/blue SaaS gradients;
- mesh gradients;
- glassmorphism;
- excessive blur;
- excessive shadows;
- giant border radii;
- pill-shaped everything;
- huge dashboard greeting text;
- generic "Welcome back, [Name] 👋" hero sections;
- fake metrics;
- decorative charts;
- floating cards;
- stock SaaS illustrations;
- generic robot/AI imagery;
- feature cards where plain structured content is better;
- repeated gradient CTA panels;
- random decorative blobs;
- fake testimonials inside application screens;
- "eyebrow" labels above every heading;
- excessive explanatory copy;
- icons simply because a component looks empty without one.

---

# 34. Copy Tone Inside the Product

UI copy should be:

- concise;
- plain;
- operational;
- reassuring without being cute;
- understandable to non-technical business owners.

Prefer:

**Connect WhatsApp**

over:

**Integrate your WhatsApp ecosystem**

Prefer:

**Automation is live**

over:

**Your intelligent conversational workflow is now activated**

Prefer:

**We couldn't send this message**

over:

**An unexpected provider integration exception occurred**

Technical details may be available in support/admin views, not forced on ordinary users.

---

# 35. Phase 01 Visual Scope

Codex should implement only the design required for Phase 01.

Required visual foundation:

- official SlotlyFlow logo integration;
- Spline Sans typography;
- product colour tokens;
- spacing tokens;
- radius tokens;
- button styles;
- form controls;
- auth layouts;
- verification/reset states;
- organization creation;
- application shell;
- sidebar/navigation;
- user/account menu;
- page header;
- empty state;
- skeleton/loading state;
- error state;
- responsive behaviour;
- accessible focus states.

Do not design Phase 02+ screens simply to populate the navigation.

---

# 36. Phase 01 Design Acceptance Criteria

Phase 01 visual implementation is complete only when:

- [ ] The official SlotlyFlow logo is used correctly.
- [ ] Canonical brand green is `#003B2D`.
- [ ] Spline Sans is the intended interface typeface.
- [ ] UI does not fall back visually to a generic Inter/Geist SaaS appearance.
- [ ] Colour tokens are implemented centrally.
- [ ] Product accents are used selectively.
- [ ] Auth screens look like SlotlyFlow, not a stock auth template.
- [ ] Forms have clear labels, errors, focus and keyboard behaviour.
- [ ] Button hierarchy is consistent.
- [ ] Application shell works on desktop and mobile.
- [ ] Navigation contains only implemented features.
- [ ] No fake analytics/data is used to make the dashboard look complete.
- [ ] Cards are used only where structurally appropriate.
- [ ] Generic icon-in-circle visual patterns are absent.
- [ ] No gradient blobs, glassmorphism or excessive radii are introduced.
- [ ] Loading states match destination structure.
- [ ] Error states are clear and non-technical.
- [ ] Keyboard focus is visible.
- [ ] Colour is not the only communication mechanism for status.
- [ ] Responsive layouts do not horizontally overflow.
- [ ] Production UI remains visually coherent at common desktop and mobile sizes.

---

# 37. Implementation Authority

This file is authoritative for SlotlyFlow visual implementation.

If an implementation choice conflicts with this file:

1. follow this file;
2. do not silently substitute a component-library default;
3. record a genuine unresolved design conflict rather than inventing a new design direction.

Any substantial change to:

- primary typography;
- canonical brand colour;
- application shape language;
- icon philosophy;
- navigation architecture;
- core product visual identity

requires an explicit design decision before implementation.
