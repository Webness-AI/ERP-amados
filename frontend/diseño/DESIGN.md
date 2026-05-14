---
name: Architectural Precision
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c1c7d2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8b919b'
  outline-variant: '#414750'
  surface-tint: '#a1c9ff'
  primary: '#a1c9ff'
  on-primary: '#00325a'
  primary-container: '#005696'
  on-primary-container: '#a5cbff'
  inverse-primary: '#1961a1'
  secondary: '#f9ba82'
  on-secondary: '#4c2700'
  secondary-container: '#683d0f'
  on-secondary-container: '#e6a872'
  tertiary: '#b6c8df'
  on-tertiary: '#213243'
  tertiary-container: '#455669'
  on-tertiary-container: '#b9cbe1'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a1c9ff'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#004880'
  secondary-fixed: '#ffdcc1'
  secondary-fixed-dim: '#f9ba82'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#683d0f'
  tertiary-fixed: '#d2e4fb'
  tertiary-fixed-dim: '#b6c8df'
  on-tertiary-fixed: '#0a1d2d'
  on-tertiary-fixed-variant: '#37485b'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
  surface-base: '#0F0F0F'
  surface-elevated: '#1E1E1E'
  surface-overlay: '#2A2A2A'
  status-consulta: '#94A3B8'
  status-aprobado: '#10B981'
  status-produccion: '#F59E0B'
  status-instalacion: '#6366F1'
  data-positive: '#22C55E'
  data-negative: '#EF4444'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style

This design system is engineered for a high-fidelity ERP/CRM environment, drawing inspiration from the bespoke craftsmanship of premium furniture manufacturing. The brand personality is **authoritative, meticulous, and sophisticated**. It targets professional users managing complex production chains, financial data, and inventory logistics.

The aesthetic follows a **Corporate / Modern** style with a focus on **Tonal Layering**. It prioritizes information density and logical grouping over decorative flourishes. The interface utilizes deep charcoal and slate backgrounds to reduce eye strain during long working hours, while employing elegant gold and blue accents to denote high-value actions and brand heritage. The emotional response is one of stability and technical mastery.

## Colors

The palette is optimized for a dark-mode-first enterprise experience.

- **Primary Blue (#005696):** Used for primary navigation, brand touchpoints, and core action buttons.
- **Accent Gold (#8B5A2B):** Reserved for "premium" interactions, highlighting specific financial totals, or indicating specialized custom orders.
- **Neutral/Surface Palette:** Utilizes a four-tier dark scale. `#0F0F0F` is the canvas, `#1A1A1A` is the default container, and `#2D3E50` is used for headers or selected states to provide a subtle blue-tinted depth.
- **Semantic Statuses:** Specific colors are mapped to the ERP workflow (Consulta, Aprobado, etc.) to ensure immediate visual recognition of project phases without reading labels.

## Typography

This design system uses a dual-font strategy to balance character with utility. 

- **Manrope** is used for headings and display elements. Its wider apertures and modern geometric construction provide a sophisticated, high-end feel.
- **Inter** is used for all UI elements, data tables, and body text. It is chosen for its exceptional legibility at small sizes and its "tabular num" features, essential for accounting and stock lists.
- **Emphasis:** Heavy use of medium and semi-bold weights for labels ensures hierarchy is maintained even in high-density data views.

## Layout & Spacing

The layout uses a **12-column fluid grid** for desktop, optimized for a 1440px maximum width. For data-heavy ERP modules, the system switches to a **compact 4px grid base** to allow for high information density without feeling cluttered.

- **Desktop:** 32px side margins, 16px gutters.
- **Tablet:** 24px side margins, 16px gutters.
- **Mobile:** 16px side margins, 12px gutters.
- **Density:** Provide a "Compact" and "Comfortable" toggle for data tables. The default is "Compact" (8px cell padding) to maximize visible rows in stock and production lists.

## Elevation & Depth

Visual hierarchy in this system is achieved through **Tonal Layers** rather than heavy shadows. 

- **Base Level:** The darkest surface (#0F0F0F). Used for the main application background.
- **Level 1 (Cards/Sidebar):** Slightly lighter (#1A1A1A). Used for content containers and navigation panels.
- **Level 2 (Modals/Popovers):** Highest contrast (#2A2A2A). Uses a subtle, 1px low-contrast outline (#FFFFFF1A) to define boundaries against lower levels.
- **Interaction:** Hover states on rows or cards are indicated by a subtle blue tint (#2D3E50) rather than a lift effect, maintaining a flat, professional feel.

## Shapes

The shape language is **Soft (0.25rem / 4px)**. This minimal rounding conveys a sense of precision and architectural structure, fitting for a furniture and production management tool.

- **Buttons & Inputs:** 4px radius.
- **Cards:** 8px radius (`rounded-lg`) for a clear distinction from smaller UI components.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid `#005696` with white text. High contrast for main actions.
- **Secondary:** Outlined with `1px` border of `#8B5A2B` for "Gold" level actions (e.g., Approve Quote).
- **Tertiary:** Ghost buttons for navigation and secondary actions.

### Data Tables
- **Header:** Background `#2D3E50` with `label-md` typography.
- **Rows:** Alternating "Zebra" striping is discouraged; use subtle 1px bottom borders instead.
- **Alignment:** Numbers (Accounting/Stock) must be right-aligned and use `mono-data` tokens.

### Status Chips
- Small, uppercase labels inside pill shapes. 
- Use a low-opacity background of the status color (15%) with a high-saturation text of the same color for legibility in dark mode.

### Input Fields
- Dark backgrounds (#0F0F0F) with a 1px border (#333333). 
- On focus, the border transitions to Primary Blue (#005696) with a 2px outer glow.

### Cards
- Used to group related data points (e.g., "Customer Info", "Production Progress"). 
- Cards should have a subtle header area separated by a 1px border.