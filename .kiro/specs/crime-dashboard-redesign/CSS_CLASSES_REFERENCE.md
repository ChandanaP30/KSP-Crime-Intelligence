# CSS Classes Reference Guide

## Quick Navigation

- [Header](#header-classes)
- [KPI Cards](#kpi-card-classes)
- [Filter Panel](#filter-panel-classes)
- [Map Container](#map-container-classes)
- [AI Panel](#ai-panel-classes)
- [Analytics](#analytics-classes)
- [Utilities](#utility-classes)

---

## Header Classes

### `.top-bar`
**Location:** Lines 23-45
- Sticky positioning (z-index: 200)
- Glassmorphism backdrop: blur(10px)
- Gradient background from surface to transparent
- Box shadow elevation
- Flexbox layout with centered items

**Usage:**
```css
.top-bar {
  position: sticky;
  top: 0;
  background: linear-gradient(180deg, var(--surface) 0%, rgba(15, 21, 39, 0.95) 100%);
  backdrop-filter: blur(10px);
}
```

### `.top-bar h1`
**Location:** Lines 46-58
- Font size: 32px (bold)
- Gradient text: primary to accent
- Letter-spacing: -1px
- Text clipping for gradient effect

### `.top-bar-sub`
**Location:** Lines 60-65
- Font size: 12px
- Color: text-muted
- Uppercase letters
- Increased letter-spacing

### `.top-bar-tabs`
**Location:** Lines 77-90
- Flexbox layout
- Horizontal button alignment
- 16px gap between buttons

### `.top-bar-tabs button`
**Location:** Lines 92-104
- Transparent background by default
- 13px font weight 600
- Hover: accent-soft background
- Active: accent color with underline

### `.lang-toggle-btn`
**Location:** Lines 106-120
- 11px uppercase text
- Surface-2 background
- Hover: surface-3 with glow

---

## KPI Card Classes

### `.kpi-strip`
**Location:** Lines 129-139
- Flexbox layout (row)
- 16px gap between cards
- Flex-wrap for responsive
- 24px padding all sides

### `.kpi-card`
**Location:** Lines 141-169
- Gradient background (blue + green)
- Border-radius: 12px
- Min-width: 220px
- Dual shadow: outer + inset
- Pseudo-element for glow effect

**Hover State:**
```css
.kpi-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(91, 141, 239, 0.25);
}
```

### `.kpi-label`
**Location:** Lines 186-192
- Font size: 11px
- Uppercase
- Letter-spacing: 1px
- Font weight: 700

### `.kpi-value`
**Location:** Lines 194-203
- Font size: 48px
- Font weight: 800
- Gradient text
- Letter-spacing: -1px

### `.kpi-icon`
**Location:** Lines 957-965
- Font size: 28px
- Margin-bottom: 8px
- Opacity: 0.7
- Hover: scale(1.1)

### `.kpi-trend`
**Location:** Lines 967-983
- Inline-flex
- 11px font size
- Success green by default
- Alert red when .down class applied

---

## Filter Panel Classes

### `.filter-rail`
**Location:** Lines 205-217
- Width: 280px
- Gradient background
- Border-right: 1px solid
- Overflow-y: auto
- Sticky sidebar

### `.filter-label`
**Location:** Lines 219-225
- Font size: 10px
- Uppercase
- Letter-spacing: 0.5px
- Font weight: 700

### `.filter-rail select`
**Location:** Lines 227-241
- Full width
- 12px padding
- Surface-2 background
- Hover: border-light + shadow
- Focus: accent color + glow

### `.case-count`
**Location:** Lines 259-270
- Gradient background (blue)
- Centered text
- Accent color
- Uppercase labels

### `.layer-toggles`
**Location:** Lines 272-275
- Margin-top: 24px
- Padding-top: 16px
- Border-top: 1px

### `.toggle-label`
**Location:** Lines 277-287
- Flexbox
- Hover: text-primary
- Accent checkbox color

### `.cctv-summary`
**Location:** Lines 289-303
- Gradient background (green + blue)
- Green border
- Success color text
- Uppercase letters

### `.filter-section`
**Location:** Lines 1020-1030
- Card-style container
- 16px padding
- Border radius: 8px
- Hover: border-light

---

## Map Container Classes

### `.map-container`
**Location:** Lines 305-319
- Flex: 1 (takes remaining space)
- Border-radius: 12px
- Premium shadows
- Gradient background
- Relative positioning for overlays

### `.map-title-container`
**Location:** Lines 321-335
- Position: absolute (top-left)
- Glassmorphism: blur(12px)
- Animation: slideDownFade 0.4s
- Z-index: 10

### `.map-title`
**Location:** Lines 337-346
- Font size: 14px
- Font weight: 700
- Flex with gap
- Letter-spacing: -0.3px

### `.map-status-badge`
**Location:** Lines 348-360
- Inline-flex
- Green background + border
- 9px font size
- Pulsing dot animation

### `.map-status-badge::before`
**Location:** Lines 362-367
- 6px circle
- Pulsing animation: 1.5s

### `.filter-chips-container`
**Location:** Lines 369-378
- Position: absolute (bottom-left)
- Flexbox row
- Flex-wrap: wrap
- Max-width: 450px

### `.filter-chip`
**Location:** Lines 380-395
- Inline-flex
- Accent color
- Border-radius: 16px (pill shape)
- Animation: slideUpFade 0.3s

### `.map-legend`
**Location:** Lines 397-413
- Position: absolute (bottom-right)
- Glass effect: blur(12px)
- Max-width: 280px
- Z-index: 10

### `.map-legend-item`
**Location:** Lines 421-428
- Flexbox
- 11px font
- Color-coded dots

---

## AI Panel Classes

### `.side-panel`
**Location:** Lines 448-461
- Width: 450px
- Gradient background
- Flex column layout
- Border-left: 1px
- Box shadow: -12px offset

### `.side-panel h3`
**Location:** Lines 463-472
- 14px bold
- Padding: 16px
- Gradient background
- Border-bottom: 1px

### `.ai-response-area`
**Location:** Lines 475-485
- Flex: 1 (fills available space)
- Min-height: 0
- Overflow-y: auto
- Gradient background
- Gap: 12px

### `.chat-message`
**Location:** Lines 487-491
- Flexbox
- Gap: 12px
- Animation: messageSlideUp 0.4s
- Align-items: flex-end

### `.message-avatar`
**Location:** Lines 493-502
- Size: 32x32px
- Border-radius: 50%
- Flex-shrink: 0

### `.message-avatar.assistant`
**Location:** Lines 504-509
- Gradient background (accent)
- White text
- Glow shadow

### `.message-avatar.user`
**Location:** Lines 511-515
- Gradient background (green + blue)
- Green border
- Success color

### `.message-bubble`
**Location:** Lines 517-524
- Flex: 1
- Gradient background
- Border-radius: 12px
- Padding: 16px

### `.message-bubble.assistant`
**Location:** Lines 526-531
- Blue-tinted (rgba(91, 141, 239, 0.08))
- Max-width: 95%

### `.message-bubble.user`
**Location:** Lines 533-539
- Green-tinted (rgba(16, 185, 129, 0.08))
- Max-width: 85%
- Margin-left: auto

### `.analysis-card`
**Location:** Lines 548-554
- Premium card styling
- Animation: messageSlideUp 0.4s
- Shadow: 0 4px 16px

### `.ai-confidence`
**Location:** Lines 591-603
- Inline-flex
- Accent color background
- 10px uppercase text

### `.chat-input-bar`
**Location:** Lines 615-625
- Flexbox
- Gap: 12px
- Padding: 16px
- Border-top: 1px

### `.ai-input`
**Location:** Lines 627-647
- Flex: 1
- 13px font
- Max-height: 100px
- Surface-2 background

### `.ai-submit`
**Location:** Lines 649-671
- Size: 44x44px
- Gradient background (accent)
- Hover: translateY(-3px)
- Box shadow glow

### `.mic-btn`
**Location:** Lines 673-700
- Size: 44x44px
- Transparent background with border
- Hover: glow effect
- Listening: pulse animation (alert color)

### `.typing-indicator`
**Location:** Lines 758-763
- Flexbox
- Gap: 4px
- Padding: 12px 16px

### `.typing-dot`
**Location:** Lines 765-769
- Size: 8x8px
- Border-radius: 50%
- Accent color
- Animation: typingBounce 1.4s

---

## Analytics Classes

### `.analytics-toggle-row`
**Location:** Lines 733-739
- Flexbox
- Centered
- Padding: 16px
- Gap: 12px

### `.analytics-toggle-btn`
**Location:** Lines 741-754
- Gradient background
- Padding: 12px 24px
- Hover: accent gradient
- Hover: translateY(-2px)

### `.analytics-drawer`
**Location:** Lines 756-762
- Flexbox
- Gap: 16px
- Padding: 24px
- Overflow-x: auto

### `.analytics-drawer-grid`
**Location:** Lines 764-776
- CSS Grid
- grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))
- Gap: 16px
- Responsive

### `.chart-panel`
**Location:** Lines 778-792
- Gradient background
- Border-radius: 12px
- Padding: 24px
- Flex: 1
- Min-width: 300px

### `.chart-panel:hover`
**Location:** Lines 794-800
- Border: accent
- Box-shadow: glow
- Transform: translateY(-4px)
- Accent background

### `.chart-panel h4`
**Location:** Lines 802-809
- 14px bold
- Uppercase
- Letter-spacing: 0.6px

### `.skeleton-line`
**Location:** Lines 848-858
- Height: 12px
- Gradient background
- Animation: shimmer 2s
- Border-radius: 8px

---

## Utility Classes

### `.premium-card`
**Location:** Lines 1520-1530
- Reusable card styling
- Gradient background
- Border + shadow
- Hover animation

### `.status-badge`
**Location:** Lines 1441-1470
- Inline-flex
- Padding: 4px 8px
- Font-weight: 700
- Uppercase text

### `.status-badge.active`
**Location:** Lines 1472-1481
- Green background
- Pulsing dot indicator

### `.status-badge.inactive`
**Location:** Lines 1483-1488
- Red background
- Alert color

### `.empty-state`
**Location:** Lines 415-430
- Centered absolute positioning
- Card styling
- Animation: slideUpFade 0.3s
- Box shadow

### `.text-muted`
**Location:** Lines 832-836
- Color: text-muted
- Font-size: 13px
- Line-height: 1.6

### `.disclaimer`
**Location:** Lines 838-846
- 11px text
- Red tinted background
- Alert border-left: 3px

---

## Animations Reference

### `slideUpFade`
```css
@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### `slideDownFade`
```css
@keyframes slideDownFade {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### `pulse-dot`
```css
@keyframes pulse-dot {
  0%, 100% { opacity: 0.4; box-shadow: 0 0 0 0; }
  50% { opacity: 1; box-shadow: 0 0 0 6px rgba(..., 0); }
}
```

### `shimmer`
```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### `typingBounce`
```css
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
  30% { transform: translateY(-8px); opacity: 1; }
}
```

---

## Design Tokens Used

### Colors
```css
--bg: #06091E
--surface: #0F1527
--surface-2: #151D35
--surface-3: #1A2442
--accent: #5B8DEF
--accent-hover: #4A7FD8
--text-primary: #E8ECFA
--text-secondary: #B4BACC
--success: #10B981
--warning: #F59E0B
--alert: #EF4444
```

### Spacing
```css
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 12px
--spacing-lg: 16px
--spacing-xl: 24px
--spacing-2xl: 32px
```

### Border Radius
```css
--radius-sm: 4px
--radius-md: 8px
--radius-lg: 12px
--radius-xl: 16px
```

### Transitions
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## Responsive Breakpoints

| Breakpoint | Usage |
|-----------|-------|
| >1600px | Desktop (2x2 grid) |
| 1200px-1600px | Tablet Large (2x1 grid) |
| 1024px-1200px | Tablet (1x1 grid) |
| 768px-1024px | Mobile Landscape |
| <768px | Mobile Portrait |

---

**Last Updated:** July 24, 2026
**Version:** 1.0.0
