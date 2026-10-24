---
name: Synthetic Integrity
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.025em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an ultra-precise, mission-critical workspace tailored for cybersecurity investigators, legal counsel, and compliance automation officers. The product ethos bridges immutable evidentiary rigor with high-speed autonomous threat detection. The visual atmosphere balances cold, calculated authority with vibrant, luminescent telemetry signals.

### Visual Aesthetic & Philosophy
- **Tactical Cyber-Legal Precision**: An interface engineered like an intelligence HUD and modern regulatory ledger. Whitespace is strictly metered; density is high without inducing cognitive overload.
- **Controlled Luminescence**: Micro-glow accents and high-chroma neon status indicators cut through abyssal slate surfaces, guiding the auditor's gaze directly toward critical infractions and anomalies.
- **Glassmorphic Containment**: Semitransparent panels layered over deep oceanic-slate backdrops create structured spatial hierarchy while keeping complex evidentiary streams unified under an unbroken pane of glass.

## Colors

The palette employs deep light-absorbent slate foundations paired with sharp high-contrast boundary wires and distinct chromatic risk channels. Every hue is tied directly to legal posture and risk confidence scores.

### Color Tiers & Utility
- **Canvas Base (`#0a0f1d`)**: The bedrock viewport background, eliminating eye fatigue during protracted multi-modal review cycles.
- **Surface Panels (`#0f172a`)**: Primary structural card and panel background.
- **Elevated Surfaces (`#1e293b`)**: Modal overlays, flyout inspector drawers, and active table rows.
- **Structural Outlines (`#334155`)**: Crisp boundary definitions with high optical contrast against dark layers.
- **Primary Cyber Accent (`#06b6d4` & `#3b82f6`)**: Neon cyan and electric blue drive primary interaction paths, query triggers, AI confidence ribbons, and platform telemetry.
- **Status & Risk Grading**:
  - **Nominal / Cleared (`#10b981`)**: Compliant artifacts, authentic media validation, resolved audits.
  - **Advisory / Warning (`#f59e0b`)**: Policy ambiguity, medium-risk signals, unverified transcripts.
  - **Critical Infraction (`#f43f5e`)**: Regulatory breaches, severe illicit material flags, hard risk threshold triggers.

## Typography

The typographic hierarchy orchestrates three specialized typefaces to cleanly separate executive summaries, operational documentation, and raw forensic telemetry.

### Type Roles
- **Headlines & Section Anchors (`Plus Jakarta Sans`)**: Delivers geometric presence, sharp aperture clarity, and high-readability titles for dashboards and incident dossiers.
- **Narrative & Document Body (`Inter`)**: Serves dense legal citations, compliance rulesets, and audit descriptions with superior legibility across small sizes.
- **Telemetry, Laws, Code & Data (`JetBrains Mono`)**: Strictly assigned to evidentiary values, hash digests, timestamped audit rails, statutory article identifiers (e.g., `GDPR-Art.17`, `SEC-Rule-10b-5`), confidence scores, and raw metadata feeds.

## Layout & Spacing

The layout model is built around a rigorous fluid 12-column grid system paired with strict multi-viewport inspection panes.

### Responsive Breakpoints & Mechanics
- **Desktop (1440px+)**: 12 columns, 24px gutters, 32px canvas margins. Split-pane layout supports simultaneous investigation views: an evidence media viewer (left 7 cols) alongside an active violation telemetry stream and article cross-references (right 5 cols).
- **Tablet (768px - 1439px)**: 8 columns, 16px gutters, 24px margins. Inspector pane collapses into an expandable drawer or bottom-docked sheet.
- **Mobile (< 768px)**: 4 columns, 12px gutters, 16px margins. Evidence cards switch to unified vertical stacks; tabular audit logs transform into discrete scannable cards with mono-tagged indicators.

## Elevation & Depth

Visual hierarchy combines low-opacity frosted glass planes, sharp structural perimeter strokes, and chromatic micro-glow accents rather than broad diffuse drop shadows.

### Elevation Levels & Depth Tactics
- **Level 0 (Base Canvas)**: Solid `#0a0f1d` with an optional subtle 32px grid pattern rendered in `#1e293b` at 15% opacity for tactical structure.
- **Level 1 (Panels & Cards)**: Background `#0f172a` at 85% opacity, backdrop-filter blur of `12px`, with a hairline border of `1px solid #334155`.
- **Level 2 (Interactive Elements & Drawers)**: Background `#1e293b` at 92% opacity, backdrop-filter blur of `16px`, bordered by `1px solid #475569`. Casts an ambient shadow of `0 12px 32px -8px rgba(0, 0, 0, 0.6)`.
- **Micro-Glows (Status Anchors)**: 
  - Violations cast a selective accent glow: `0 0 16px rgba(244, 63, 94, 0.25)`.
  - Active cyber-scans emit: `0 0 16px rgba(6, 182, 212, 0.25)`.
  - Compliant seals emit: `0 0 16px rgba(16, 185, 129, 0.2)`.

## Shapes

The design system uses a precise **Soft (`1`)** shape language. Corners are slightly tempered to avoid hostile brutalist points while remaining strict, technical, and architectural.

### Radius Implementations
- **Base Components (`0.25rem` / `4px`)**: Badges, status chips, micro-toggles, table cells, code snippets, and audit tag pills.
- **Panels & Containers (`0.5rem` / `8px`)**: Inspection cards, multi-modal media frames, audio visualizer docks, and form elements.
- **Modals & Master Drawers (`0.75rem` / `12px`)**: System overlays, high-priority violation modals, and deep-dive forensic logs.

## Components

### Buttons
- **Primary / Actionable Scan**: High-saturation cyan-to-blue gradient fill (`#06b6d4` to `#3b82f6`), text in `#0a0f1d` (extra bold), with an active micro-glow: `box-shadow: 0 0 12px rgba(6, 182, 212, 0.4)`. Height: 36px/40px, font: `Inter` SemiBold 14px.
- **Secondary / Neutral**: Background `#1e293b`, 1px border `#334155`, text `#f8fafc`. Hover state transitions border to `#06b6d4` with zero layout shift.
- **Destructive / Flag Violation**: Background `rgba(244, 63, 94, 0.1)`, 1px border `rgba(244, 63, 94, 0.4)`, text `#f43f5e`. Hover: solid `#f43f5e` with text `#ffffff`.

### Chips & Badges
- Constructed exclusively with `JetBrains Mono` at 10px or 11px uppercase (`label-mono`).
- **Severity Badge**: Padding `2px 8px`, border-radius `4px`.
  - *Critical*: Background `rgba(244, 63, 94, 0.15)`, text `#f43f5e`, border `1px solid rgba(244, 63, 94, 0.3)`. Contains a pulsing 4px circular neon node.
  - *Warning*: Background `rgba(245, 158, 11, 0.15)`, text `#f59e0b`, border `1px solid rgba(245, 158, 11, 0.3)`.
  - *Verified*: Background `rgba(16, 185, 129, 0.15)`, text `#10b981`, border `1px solid rgba(16, 185, 129, 0.3)`.

### Cards & Evidentiary Containers
- Background: Semi-transparent `#0f172a` (80% opacity), `backdrop-filter: blur(12px)`, border: `1px solid #334155`.
- Integrated tactical header: A 32px top-shelf metadata bar displaying media source format (e.g., `TYPE: AUDIO_WAV`, `SHA-256`, `CONFIDENCE: 98.4%`) separated from the main content by a fine `1px solid #1e293b` divider.

### Inputs & Verification Search Bars
- Background `#0a0f1d`, border `1px solid #334155`, text `#f8fafc`, placeholder text `#64748b`.
- Focus state: Border instantly shifts to `#06b6d4`, triggering an internal hairline focus ring `0 0 0 1px #06b6d4` and micro-glow `0 0 8px rgba(6, 182, 212, 0.25)`. Monospaced helper hints sit below inputs.

### Tables & Audit Logs
- Header: Sticky `#0f172a`, uppercase mono text (`label-mono`), bottom border `2px solid #334155`.
- Rows: Alternate row background transitions (`#0a0f1d` to `#0d1527`), row height 44px, bottom border `1px solid #1e293b`.
- Interactive Row Hover: Highlighted with `#1e293b` alongside a 2px left border accent in `#06b6d4`.

### Specialized Domain Components
- **Multi-Modal Inspection Viewports**: Framing for images, web screenshot diffing, and audio waveforms. Includes overlay coordinates, bounding boxes in `#f43f5e` for flagged non-compliant regions, and contextual hover tags linking directly to statutory provisions.
- **Compliance Score Gauge**: Circular or linear meter with neon gradient traces (`#10b981` through `#f43f5e`) displaying overall regulatory readiness score with monospaced confidence values.