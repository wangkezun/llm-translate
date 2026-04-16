# Translation Bubble Redesign — Apple Popover Style

## Goal

Redesign the translation bubble and trigger button with an Apple-style popover aesthetic, featuring glassmorphism, original/translated text comparison, TTS, and dynamic page-adaptive theming.

## Visual Style

### Bubble (Popover)

- **Shape:** 12px rounded corners, 0.5px border, soft layered shadow
- **Material:** `backdrop-filter: blur(24px) saturate(1.8)` glassmorphism
- **No title bar, no branding** — content-first, minimal chrome
- **Entrance animation:** fade-in + 4px upward shift, 200ms ease
- **Exit animation:** fade-out, 150ms ease

### Trigger Button

- **Shape:** 32px circle, glassmorphism (semi-transparent white/dark background + blur)
- **Icon:** existing translate SVG icon, inherits text color
- **Hover:** subtle scale(1.08) + slightly increased opacity
- **Click:** scale down + fade out, bubble appears from button position

## Layout Structure

```
+------------------------------------------+
|  [Original text, gray, 13px]        [EN] |
|  Machine learning models can now...      |
|  ·········································|
|  [Translated text, primary, 15px]   [ZH] |
|  机器学习模型现在能够理解上下文...         |
+------------------------------------------+
|  [copy] [speak]                    [close]|
+------------------------------------------+
```

### Sections

1. **Original text area**
   - Font: 13px, secondary color (gray)
   - Language badge: 10px uppercase, positioned top-right (e.g., "EN")
   - Badge style: pill with subtle background

2. **Separator**
   - 0.5px dashed line, very low opacity

3. **Translated text area**
   - Font: 15px, primary color
   - Language badge: top-right, accent-colored (e.g., "ZH" in indigo)
   - This is the visual focus — larger, bolder

4. **Action bar**
   - Border-top: 0.5px solid, low opacity
   - Subtle background tint (`rgba` overlay)
   - Left: icon buttons (copy, TTS) — 30px touch targets, 7px border-radius
   - Right: close button (x icon)
   - Hover: light background fill

### Loading State

- Replace body content with centered spinner + "正在翻译..." text
- Cancel button replaces close button during loading
- Same popover shell, no layout shift

### Error State

- Red-tinted text in body area
- Cancel button hidden, close button shown

### Cancelled State

- "翻译已取消" message in body
- Same styling as error but neutral color

## Trigger Button Design

- **Current:** solid purple (#4f46e5) circle, white SVG icon
- **New:** glassmorphism circle matching the bubble material
  - Light pages: `rgba(255, 255, 255, 0.85)` + blur, dark icon
  - Dark pages: `rgba(30, 30, 46, 0.85)` + blur, light icon
- **Size:** 32px diameter (up from 28px) for better touch target
- **Shadow:** `0 2px 8px rgba(0,0,0,0.1)`
- **Z-index:** same max z-index as current

## Page-Adaptive Theming

### Detection Method

When the translate button is clicked:
1. Get the `backgroundColor` of the element behind the selected text using `getComputedStyle`
2. Walk up the DOM if transparent, until a non-transparent background is found (or fall back to `document.body`)
3. Parse the RGB values and compute relative luminance: `L = 0.2126*R + 0.7152*G + 0.0722*B` (values normalized to 0-1)
4. Use luminance to set CSS custom properties on the bubble element

### CSS Custom Properties

```css
/* Light page defaults */
--llmt-bg: rgba(255, 255, 255, 0.92);
--llmt-border: rgba(0, 0, 0, 0.12);
--llmt-text-primary: #1d1d1f;
--llmt-text-secondary: #86868b;
--llmt-text-tertiary: #aeaeb2;
--llmt-separator: rgba(0, 0, 0, 0.08);
--llmt-action-bg: rgba(0, 0, 0, 0.02);
--llmt-action-hover: rgba(0, 0, 0, 0.06);
--llmt-badge-bg: #f5f5f7;
--llmt-badge-color: #aeaeb2;
--llmt-badge-accent-bg: #eef2ff;
--llmt-badge-accent-color: #6366f1;
--llmt-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.12);

/* Dark page overrides (luminance < 0.5) */
--llmt-bg: rgba(30, 30, 46, 0.88);
--llmt-border: rgba(255, 255, 255, 0.1);
--llmt-text-primary: #cdd6f4;
--llmt-text-secondary: #a6adc8;
--llmt-text-tertiary: #6c7086;
--llmt-separator: rgba(255, 255, 255, 0.08);
--llmt-action-bg: rgba(255, 255, 255, 0.02);
--llmt-action-hover: rgba(255, 255, 255, 0.08);
--llmt-badge-bg: rgba(255, 255, 255, 0.08);
--llmt-badge-color: #6c7086;
--llmt-badge-accent-bg: rgba(99, 102, 241, 0.15);
--llmt-badge-accent-color: #a5b4fc;
--llmt-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 12px 28px rgba(0,0,0,0.4);
```

### Interpolation

Rather than a hard switch at 0.5 luminance, use a smoothstep-like interpolation between 0.3 and 0.7 luminance:
- L < 0.3: full dark theme
- L > 0.7: full light theme
- 0.3-0.7: linearly interpolate between the two sets of values

This avoids jarring switches on medium-toned pages.

## Features

### Copy

- Click copy icon → copy translated text to clipboard via `navigator.clipboard.writeText`
- Show brief "已复制" tooltip or swap icon to checkmark for 1.5s

### TTS (Text-to-Speech)

- Click speaker icon → use `window.speechSynthesis.speak()` with translated text
- While speaking: icon changes to a "stop" icon, click again to cancel
- Auto-select voice matching target language via `lang` parameter
- If no matching voice found, degrade gracefully (hide button or show tooltip)

### Cancel Translation

- During loading, close button becomes cancel button (same position)
- Sends cancel message through existing port messaging

## File Changes

| File | Change |
|------|--------|
| `content/content.css` | Complete rewrite — new bubble and button styles using CSS custom properties |
| `content/content.js` | Add: luminance detection, theme computation, TTS logic, updated DOM structure |

No changes to service-worker.js, popup, manifest, or shared modules.

## Constraints

- All CSS must use `#llmt-` prefixed selectors to avoid page style conflicts
- Use `!important` sparingly — only where host page styles are known to override
- Bubble z-index stays at `2147483647`
- No external dependencies — pure vanilla JS + Web APIs
- Must work on Chrome 120+
