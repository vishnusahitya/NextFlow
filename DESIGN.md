# Design Brief: NextFlow

## Purpose & Context
Professional LLM workflow builder where technical users construct, visualize, and execute visual pipelines. The interface must feel sophisticated, capable, and responsive—not playful. Every interaction prioritizes precision and clarity.

## Visual Direction & Tone
**Minimalist luxury with tech sophistication.** Ultra-deep dark canvas (charcoal `#0a0a0a`), electric cyan accents, smooth gradients, premium typography. Function elevated by craft. No skeuomorphism, no corporate bloat. Every element is intentional.

## Differentiation
- Glowing node borders that pulse during execution
- Smooth gradient accents on active connection flows
- Real-time minimap with execution preview
- Expandable execution history with node-level traces
- Grid-based canvas rhythm without visual clutter

## Color Palette

| Role | Light | Dark | Usage |
|------|-------|------|-------|
| Background | `0.98 0 0` | `0.09 0 0` | Canvas, page fills |
| Foreground | `0.15 0 0` | `0.95 0 0` | Text, primary content |
| Card | `0.96 0 0` | `0.15 0 0` | Node containers, panels |
| Primary (Cyan) | `0.55 0.18 220` | `0.65 0.21 200` | Active states, primary actions |
| Secondary (Purple) | `0.85 0.08 280` | `0.35 0.08 290` | Hover states, secondary UI |
| Accent (Bright Cyan) | `0.65 0.21 200` | `0.65 0.21 200` | Glows, highlights, connections |
| Success (Mint) | Chart-2: `0.72 0.15 155` | Chart-2: `0.72 0.15 155` | Execution success badges |
| Warning (Amber) | Chart-3: `0.65 0.18 70` | Chart-3: `0.65 0.18 70` | Partial execution, caution |
| Destructive (Rose) | `0.65 0.19 22` | `0.65 0.19 22` | Errors, deletion, failed |
| Border | `0.88 0.04 220` | `0.22 0.06 200` | Node outlines, subtle dividers |
| Sidebar | `0.96 0 0` | `0.12 0 0` | Left/right panels with depth |

## Typography
- **Display**: General Sans (geometric, modern, professional)
- **Body**: Inter (versatile, highly legible, code-friendly)
- **Mono**: JetBrains Mono (technical content, timestamps, data)

## Shape Language
- **Node radius**: 6px (small, geometric, precise)
- **Button radius**: 4px (minimal, functional)
- **Input radius**: 4px (consistent with buttons)
- **Icon radius**: Sharp corners discourage softness

## Structural Zones

| Zone | Background | Border | Elevation | Rationale |
|------|-----------|--------|-----------|-----------|
| Header | `card` (light) / `card` (dark) | `border` | Raised | Organizes controls, separates from canvas |
| Left Sidebar | `sidebar` | `sidebar-border` | Recessed | Navigation and node palette—slightly darker |
| Canvas | `background` | None | Base | Ultra-deep fill for immersion; grid overlay |
| Right Sidebar | `sidebar` | `sidebar-border` | Recessed | History and metadata—consistent with left |
| Node | `card` with `node-glow` | `border` / `accent` | Floating | Cyan glow when active; subtle shadow at rest |

## Spacing & Rhythm
- **Grid unit**: 4px (Tailwind default)
- **Dense zones** (canvas, nodes): 8px padding, 12px gap
- **Loose zones** (panels, forms): 12px padding, 16px gap
- **Sidebar items**: 8px padding, 6px gap

## Component Patterns
- **Node cards**: Rounded rectangle with title, icon, input/output handles, live status badge
- **Connection handles**: Circular ports at node edges; cyan glow when hovered/connected
- **Status badges**: Inline pill-shaped indicators (success=mint, warning=amber, error=rose)
- **History items**: Collapsible row with timestamp, status, duration; expandable details
- **Buttons**: Minimal with underline on hover; primary buttons have cyan background
- **Inputs**: Dark background with subtle border; focus ring is cyan with glow

## Motion & Animation
- **Node creation**: `fade-in` + `scale-in` (0.2s) for appearing nodes
- **Connection draw**: Smooth spline with `glow-flow` animation pulsing
- **History expand**: `slide-down` (0.2s ease-out) for expandable details
- **Execution pulse**: `pulse-glow` (2s infinite) on active execution nodes
- **Hover transitions**: `transition-smooth` (0.3s cubic-bezier) for all interactive states

## Canvas & Background
- **Grid pattern**: Radial gradient at 32px spacing; opacity `0.3` in dark mode
- **Panning/Zooming**: Smooth, no snapping; 0.5x–2.0x range
- **Minimap**: Fixed corner preview of full workflow; 1:8 scale

## Constraints
- No full-page gradients (reduces canvas clarity)
- No drop shadows on connection lines (use glow-flow animation instead)
- Glow intensity capped at `0.6` opacity to avoid oversaturation
- No more than 3 simultaneous animations per node
- Sidebar width capped at 320px (preserves canvas focus)

## Signature Detail
**Cyan pulsating glow on execution nodes.** When a node executes, `pulse-glow` animation breathes from 40% to 70% opacity over 2 seconds. This creates visceral feedback that the workflow is alive and processing—the hallmark of professional AI tools.

## Accessibility
- Minimum contrast ratio 4.5:1 (WCAG AA) for all text
- Focus states use cyan ring with glow
- Animations respect `prefers-reduced-motion`
- Color-blind safe: icon + badge text redundancy (no color-only messaging)

