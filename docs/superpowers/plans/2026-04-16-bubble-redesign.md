# Translation Bubble Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the translation bubble and trigger button with Apple Popover aesthetics, glassmorphism, original/translated text comparison, TTS, and page-adaptive theming.

**Architecture:** Two files change: `content/content.css` gets a complete rewrite using CSS custom properties for theming, `content/content.js` gets updated DOM structure, luminance detection, and TTS. Tasks are ordered so each commit produces a working (though progressively enhanced) extension.

**Tech Stack:** Vanilla JS, CSS custom properties, Web Speech API (new for TTS), `backdrop-filter` for glassmorphism

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `content/content.css` | All bubble and button visual styles | Complete rewrite |
| `content/content.js` | DOM creation, event handling, theming logic, TTS | Modify |

No other files are affected.

---

### Task 1: Rewrite CSS with custom properties and new bubble styles

Complete rewrite of `content/content.css`. Establishes the CSS custom property system (light theme defaults) and all new visual styles. The bubble won't look right yet because the JS DOM structure hasn't been updated, but the CSS is ready.

**Files:**
- Rewrite: `content/content.css`

- [ ] **Step 1: Replace entire content of `content/content.css`**

```css
/* LLM Translate — Apple Popover Style
   All selectors use #llmt- prefix to avoid page conflicts.
   Theming via CSS custom properties set by JS. */

/* ── Theme defaults (light page) ─────────────────────────────────── */
#llmt-btn,
#llmt-bubble {
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
  --llmt-icon-color: #86868b;
  --llmt-icon-hover-color: #1d1d1f;
}

/* ── Trigger Button ──────────────────────────────────────────────── */
#llmt-btn {
  position: absolute;
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--llmt-bg);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 0.5px solid var(--llmt-border);
  cursor: pointer;
  box-shadow: var(--llmt-shadow);
  z-index: 2147483647;
  padding: 0;
  margin: 0;
  line-height: 1;
  font-size: 14px;
  transition: transform 0.15s ease, opacity 0.15s ease;
  opacity: 0.95;
}

#llmt-btn:hover {
  transform: scale(1.08);
  opacity: 1;
}

#llmt-btn svg {
  width: 17px;
  height: 17px;
  fill: var(--llmt-text-secondary);
  pointer-events: none;
}

/* ── Bubble (Popover) ────────────────────────────────────────────── */
#llmt-bubble {
  position: absolute;
  display: none;
  max-width: 420px;
  min-width: 240px;
  background: var(--llmt-bg);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 0.5px solid var(--llmt-border);
  border-radius: 12px;
  box-shadow: var(--llmt-shadow);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--llmt-text-primary);
  z-index: 2147483647;
  margin: 0;
  padding: 0;
}

/* Entrance animation */
#llmt-bubble.llmt-visible {
  display: block;
  animation: llmt-fadeIn 0.2s ease forwards;
}

/* Exit animation class */
#llmt-bubble.llmt-hiding {
  animation: llmt-fadeOut 0.15s ease forwards;
}

@keyframes llmt-fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes llmt-fadeOut {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(4px); }
}

/* ── Bubble body ─────────────────────────────────────────────────── */
#llmt-bubble .llmt-body {
  padding: 16px 18px;
  margin: 0;
}

/* ── Original text ───────────────────────────────────────────────── */
#llmt-bubble .llmt-original {
  font-size: 13px;
  color: var(--llmt-text-secondary);
  line-height: 1.6;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 0.5px dashed var(--llmt-separator);
  position: relative;
  padding-right: 36px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* ── Translated text ─────────────────────────────────────────────── */
#llmt-bubble .llmt-translated {
  font-size: 15px;
  color: var(--llmt-text-primary);
  line-height: 1.7;
  position: relative;
  padding-right: 36px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* ── Language badges ─────────────────────────────────────────────── */
#llmt-bubble .llmt-badge {
  position: absolute;
  right: 0;
  top: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.3px;
  line-height: 1.6;
  pointer-events: none;
}

#llmt-bubble .llmt-badge-source {
  background: var(--llmt-badge-bg);
  color: var(--llmt-badge-color);
}

#llmt-bubble .llmt-badge-target {
  background: var(--llmt-badge-accent-bg);
  color: var(--llmt-badge-accent-color);
}

/* ── Action bar ──────────────────────────────────────────────────── */
#llmt-bubble .llmt-actions {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  gap: 4px;
  background: var(--llmt-action-bg);
  border-top: 0.5px solid var(--llmt-separator);
  margin: 0;
  border-radius: 0 0 12px 12px;
}

#llmt-bubble .llmt-action-btn {
  background: none;
  border: none;
  color: var(--llmt-icon-color);
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  transition: background 0.15s, color 0.15s;
  margin: 0;
  padding: 0;
}

#llmt-bubble .llmt-action-btn:hover {
  background: var(--llmt-action-hover);
  color: var(--llmt-icon-hover-color);
}

#llmt-bubble .llmt-action-btn svg {
  width: 15px;
  height: 15px;
  fill: currentColor;
  pointer-events: none;
}

/* Checkmark state for copy button */
#llmt-bubble .llmt-action-btn.llmt-copied-state svg.llmt-icon-copy { display: none; }
#llmt-bubble .llmt-action-btn.llmt-copied-state svg.llmt-icon-check { display: block; }
#llmt-bubble .llmt-action-btn svg.llmt-icon-check { display: none; }
#llmt-bubble .llmt-action-btn.llmt-copied-state { color: #16a34a; }

/* Speaking state for TTS button */
#llmt-bubble .llmt-action-btn.llmt-speaking svg.llmt-icon-speak { display: none; }
#llmt-bubble .llmt-action-btn.llmt-speaking svg.llmt-icon-stop { display: block; }
#llmt-bubble .llmt-action-btn svg.llmt-icon-stop { display: none; }

#llmt-bubble .llmt-spacer { flex: 1; }

#llmt-bubble .llmt-close-btn {
  background: none;
  border: none;
  color: var(--llmt-text-tertiary);
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 18px;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
  margin: 0;
  padding: 0;
}

#llmt-bubble .llmt-close-btn:hover {
  background: var(--llmt-action-hover);
  color: var(--llmt-icon-hover-color);
}

/* ── Loading state ───────────────────────────────────────────────── */
#llmt-bubble .llmt-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--llmt-text-secondary);
  padding: 4px 0;
  margin: 0;
}

#llmt-bubble .llmt-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--llmt-separator);
  border-top-color: var(--llmt-badge-accent-color);
  border-radius: 50%;
  animation: llmt-spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes llmt-spin {
  to { transform: rotate(360deg); }
}

/* ── Error / Cancelled states ────────────────────────────────────── */
#llmt-bubble .llmt-error {
  color: #dc2626;
  font-size: 13px;
  margin: 0;
}

#llmt-bubble .llmt-cancelled {
  color: var(--llmt-text-secondary);
  font-size: 13px;
  margin: 0;
}

/* ── Visibility ──────────────────────────────────────────────────── */
#llmt-btn.llmt-visible {
  display: flex;
}
```

- [ ] **Step 2: Verify extension loads without CSS errors**

1. Reload the extension at `chrome://extensions`
2. Open any webpage — no console errors from the extension
3. Select text — button appears (it will look different now due to new styles, but the old JS DOM still renders)

- [ ] **Step 3: Commit**

```bash
git add content/content.css
git commit -m "feat: rewrite content.css with Apple Popover styles and CSS custom properties"
```

---

### Task 2: Update bubble DOM structure and element references

Update the bubble HTML in `content/content.js` to match the new layout: original text area with source badge, translated text area with target badge, icon-only action buttons (copy, TTS, close). Update all element references and event handlers.

**Files:**
- Modify: `content/content.js:52-212` (bubble creation, element refs, all event handlers)

- [ ] **Step 1: Replace the bubble creation and element references**

In `content/content.js`, replace lines 61-82 (from `const bubble = document.createElement("div")` through `const copiedTip = ...`) with:

```js
  // ── 创建翻译气泡 ──────────────────────────────────────────────────
  const bubble = document.createElement("div");
  bubble.id = "llmt-bubble";

  const bubbleBody = document.createElement("div");
  bubbleBody.className = "llmt-body";

  const originalSection = document.createElement("div");
  originalSection.className = "llmt-original";
  const sourceBadge = document.createElement("span");
  sourceBadge.className = "llmt-badge llmt-badge-source";
  sourceBadge.textContent = "EN";
  const originalEl = document.createElement("span");
  originalEl.className = "llmt-original-text";
  originalSection.appendChild(sourceBadge);
  originalSection.appendChild(originalEl);

  const translatedSection = document.createElement("div");
  translatedSection.className = "llmt-translated";
  const targetBadge = document.createElement("span");
  targetBadge.className = "llmt-badge llmt-badge-target";
  targetBadge.textContent = "ZH";
  const translatedEl = document.createElement("span");
  translatedEl.className = "llmt-translated-text";
  translatedSection.appendChild(targetBadge);
  translatedSection.appendChild(translatedEl);

  bubbleBody.appendChild(originalSection);
  bubbleBody.appendChild(translatedSection);

  const actionsBar = document.createElement("div");
  actionsBar.className = "llmt-actions";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "llmt-action-btn llmt-copy-btn";
  copyBtn.title = "复制";
  const copyIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  copyIcon.classList.add("llmt-icon-copy");
  copyIcon.setAttribute("viewBox", "0 0 24 24");
  const copyPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  copyPath.setAttribute("d", "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z");
  copyIcon.appendChild(copyPath);
  const checkIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  checkIcon.classList.add("llmt-icon-check");
  checkIcon.setAttribute("viewBox", "0 0 24 24");
  const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  checkPath.setAttribute("d", "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z");
  checkIcon.appendChild(checkPath);
  copyBtn.appendChild(copyIcon);
  copyBtn.appendChild(checkIcon);

  // TTS button
  const ttsBtn = document.createElement("button");
  ttsBtn.className = "llmt-action-btn llmt-tts-btn";
  ttsBtn.title = "朗读";
  const speakIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  speakIcon.classList.add("llmt-icon-speak");
  speakIcon.setAttribute("viewBox", "0 0 24 24");
  const speakPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  speakPath.setAttribute("d", "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z");
  speakIcon.appendChild(speakPath);
  const stopIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  stopIcon.classList.add("llmt-icon-stop");
  stopIcon.setAttribute("viewBox", "0 0 24 24");
  const stopPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  stopPath.setAttribute("d", "M6 6h12v12H6z");
  stopIcon.appendChild(stopPath);
  ttsBtn.appendChild(speakIcon);
  ttsBtn.appendChild(stopIcon);

  // Spacer
  const spacer = document.createElement("div");
  spacer.className = "llmt-spacer";

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "llmt-close-btn";
  closeBtn.title = "关闭";
  closeBtn.textContent = "\u00d7";

  actionsBar.appendChild(copyBtn);
  actionsBar.appendChild(ttsBtn);
  actionsBar.appendChild(spacer);
  actionsBar.appendChild(closeBtn);

  bubble.appendChild(bubbleBody);
  bubble.appendChild(actionsBar);
  document.body.appendChild(bubble);
```

- [ ] **Step 2: Update the translate button click handler**

Replace lines 150-186 (the `btn.addEventListener("click", ...)` handler) with:

```js
  // ── 点击翻译按钮 ──────────────────────────────────────────────────
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const text = selectedText;
    if (!text) return;

    const rect = btn.getBoundingClientRect();
    hideBtn();

    // Show original text and loading state
    originalSection.style.display = "block";
    originalEl.textContent = text;
    translatedSection.style.display = "none";

    // Clear any previous loading/error/cancelled elements
    bubbleBody.querySelectorAll(".llmt-loading, .llmt-error, .llmt-cancelled")
      .forEach(el => el.remove());

    const loadingEl = document.createElement("div");
    loadingEl.className = "llmt-loading";
    const spinner = document.createElement("div");
    spinner.className = "llmt-spinner";
    const loadingText = document.createElement("span");
    loadingText.textContent = "正在翻译...";
    loadingEl.appendChild(spinner);
    loadingEl.appendChild(loadingText);
    bubbleBody.appendChild(loadingEl);

    actionsBar.style.display = "none";
    showBubble(rect.left, rect.top);

    translate(text)
      .then((translated) => {
        loadingEl.remove();
        translatedEl.textContent = translated;
        translatedSection.style.display = "block";
        actionsBar.style.display = "flex";
      })
      .catch((err) => {
        loadingEl.remove();
        if (err.message === "Translation cancelled") {
          const el = document.createElement("div");
          el.className = "llmt-cancelled";
          el.textContent = "翻译已取消";
          bubbleBody.appendChild(el);
        } else {
          const el = document.createElement("div");
          el.className = "llmt-error";
          el.textContent = err.message;
          bubbleBody.appendChild(el);
        }
        actionsBar.style.display = "none";
      });
  });
```

- [ ] **Step 3: Replace cancel and close handlers with a single close handler**

Remove the old separate `cancelBtn` and `closeBtn` event handlers (lines 188-203) and replace with:

```js
  // ── 关闭（兼顾取消）──────────────────────────────────────────────
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentPort && currentRequestId) {
      currentPort.postMessage({ type: "cancel", requestId: currentRequestId });
      currentPort = null;
      currentRequestId = null;
    }
    hideAll();
  });
```

- [ ] **Step 4: Update copy button handler**

Replace the old copy button handler (lines 205-212) with:

```js
  // ── 复制 ──────────────────────────────────────────────────────────
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const text = translatedEl.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.classList.add("llmt-copied-state");
      setTimeout(() => copyBtn.classList.remove("llmt-copied-state"), 1500);
    });
  });
```

- [ ] **Step 5: Verify basic functionality**

1. Reload extension
2. Select text on any page — glassmorphism trigger button appears
3. Click button — popover shows original text + loading spinner
4. Translation completes — shows original + translated with language badges
5. Copy button works (icon swaps to checkmark briefly)
6. Close button works

- [ ] **Step 6: Commit**

```bash
git add content/content.js
git commit -m "feat: update bubble DOM to Apple Popover layout with icon actions"
```

---

### Task 3: Add page-adaptive luminance detection and theming

Detect the page background color near the selected text and dynamically set CSS custom properties on the bubble and button to adapt between light/dark themes.

**Files:**
- Modify: `content/content.js` (add `detectTheme` functions after `escapeHtml`, call in `mouseup` handler)

- [ ] **Step 1: Add the luminance detection and theme functions**

In `content/content.js`, after the `escapeHtml` function (around line 118-122), add:

```js
  // ── 页面自适应主题 ────────────────────────────────────────────────
  function getPageBackgroundColor(el) {
    let current = el;
    while (current && current !== document.documentElement) {
      const bg = getComputedStyle(current).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        return bg;
      }
      current = current.parentElement;
    }
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent") {
      return bodyBg;
    }
    return "rgb(255, 255, 255)";
  }

  function parseRgb(colorStr) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return { r: 255, g: 255, b: 255 };
    return { r: +match[1], g: +match[2], b: +match[3] };
  }

  function getLuminance(r, g, b) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(light, dark, t) {
    return "rgba(" +
      Math.round(lerp(light[0], dark[0], t)) + ", " +
      Math.round(lerp(light[1], dark[1], t)) + ", " +
      Math.round(lerp(light[2], dark[2], t)) + ", " +
      lerp(light[3], dark[3], t).toFixed(2) + ")";
  }

  function applyAdaptiveTheme(targetEl, anchorEl) {
    const bgColor = getPageBackgroundColor(anchorEl || document.body);
    const { r, g, b } = parseRgb(bgColor);
    const lum = getLuminance(r, g, b);

    // Smoothstep: L>0.7 full light (t=0), L<0.3 full dark (t=1)
    let t;
    if (lum >= 0.7) t = 0;
    else if (lum <= 0.3) t = 1;
    else t = 1 - (lum - 0.3) / 0.4;

    const s = targetEl.style;
    s.setProperty("--llmt-bg", lerpColor([255,255,255,0.92], [30,30,46,0.88], t));
    s.setProperty("--llmt-border", lerpColor([0,0,0,0.12], [255,255,255,0.1], t));
    s.setProperty("--llmt-text-primary", lerpColor([29,29,31,1], [205,214,244,1], t));
    s.setProperty("--llmt-text-secondary", lerpColor([134,134,139,1], [166,173,200,1], t));
    s.setProperty("--llmt-text-tertiary", lerpColor([174,174,178,1], [108,112,134,1], t));
    s.setProperty("--llmt-separator", lerpColor([0,0,0,0.08], [255,255,255,0.08], t));
    s.setProperty("--llmt-action-bg", lerpColor([0,0,0,0.02], [255,255,255,0.02], t));
    s.setProperty("--llmt-action-hover", lerpColor([0,0,0,0.06], [255,255,255,0.08], t));
    s.setProperty("--llmt-badge-bg", lerpColor([245,245,247,1], [255,255,255,0.08], t));
    s.setProperty("--llmt-badge-color", lerpColor([174,174,178,1], [108,112,134,1], t));
    s.setProperty("--llmt-badge-accent-bg", lerpColor([238,242,255,1], [99,102,241,0.15], t));
    s.setProperty("--llmt-badge-accent-color", lerpColor([99,102,241,1], [165,180,252,1], t));
    s.setProperty("--llmt-icon-color", lerpColor([134,134,139,1], [108,112,134,1], t));
    s.setProperty("--llmt-icon-hover-color", lerpColor([29,29,31,1], [205,214,244,1], t));

    if (t > 0.5) {
      s.setProperty("--llmt-shadow", "0 2px 4px rgba(0,0,0,0.2), 0 12px 28px rgba(0,0,0,0.4)");
    } else {
      s.setProperty("--llmt-shadow", "0 2px 4px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.12)");
    }
  }
```

- [ ] **Step 2: Call `applyAdaptiveTheme` in the mouseup handler**

In the `mouseup` event handler, inside the `if (text.length > 0)` block, after getting `range` and `rect`, add the theme detection. The full block becomes:

```js
      if (text.length > 0) {
        selectedText = text;
        hideBubble();
        hideBtn();
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const anchorEl = range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : range.startContainer;
        applyAdaptiveTheme(btn, anchorEl);
        applyAdaptiveTheme(bubble, anchorEl);
        showBtn(rect.right + 6, rect.bottom + 6);
      }
```

- [ ] **Step 3: Verify adaptive theming**

1. Reload extension
2. Light page (Wikipedia) — button and bubble have light glassmorphism
3. Dark page (GitHub dark mode) — button and bubble adapt to dark theme
4. Medium-toned page — intermediate blend, no jarring switch

- [ ] **Step 4: Commit**

```bash
git add content/content.js
git commit -m "feat: add page-adaptive luminance detection and dynamic theming"
```

---

### Task 4: Add TTS (Text-to-Speech) functionality

Add speech synthesis via the Web Speech API. Speaker icon reads translated text; click again to stop.

**Files:**
- Modify: `content/content.js` (add TTS handler after copy handler, update hideAll)

- [ ] **Step 1: Add TTS state and handler**

After the copy button handler, add:

```js
  // ── 朗读 (TTS) ───────────────────────────────────────────────────
  let currentUtterance = null;

  function stopTTS() {
    window.speechSynthesis.cancel();
    currentUtterance = null;
    ttsBtn.classList.remove("llmt-speaking");
  }

  ttsBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    if (currentUtterance) {
      stopTTS();
      return;
    }

    const text = translatedEl.textContent;
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = {
      "简体中文": "zh-CN", "繁體中文（台灣）": "zh-TW", "繁體中文（香港）": "zh-HK",
      "English": "en-US", "日本語": "ja-JP", "한국어": "ko-KR",
      "Français": "fr-FR", "Deutsch": "de-DE", "Español": "es-ES",
      "Português": "pt-BR", "Русский": "ru-RU", "العربية": "ar-SA",
    };

    chrome.storage.sync.get("targetLang", (items) => {
      const targetLang = items.targetLang || "简体中文";
      utterance.lang = langMap[targetLang] || "zh-CN";
      utterance.rate = 1.0;

      utterance.onend = () => {
        currentUtterance = null;
        ttsBtn.classList.remove("llmt-speaking");
      };

      utterance.onerror = () => {
        currentUtterance = null;
        ttsBtn.classList.remove("llmt-speaking");
      };

      currentUtterance = utterance;
      ttsBtn.classList.add("llmt-speaking");
      window.speechSynthesis.speak(utterance);
    });
  });
```

- [ ] **Step 2: Update hideAll to stop TTS**

Change:

```js
  function hideAll() { hideBtn(); hideBubble(); selectedText = ""; }
```

to:

```js
  function hideAll() {
    hideBtn();
    hideBubble();
    selectedText = "";
    if (currentUtterance) stopTTS();
  }
```

Note: `stopTTS` is defined later in the file than `hideAll`, but this is fine because `hideAll` is only called at runtime (event handlers), never during initial script execution. Both are within the same IIFE scope.

- [ ] **Step 3: Verify TTS**

1. Reload extension
2. Translate some text
3. Click speaker icon — hear translated text, icon changes to stop square
4. Click stop — speech stops, icon reverts
5. Close bubble while speaking — speech stops

- [ ] **Step 4: Commit**

```bash
git add content/content.js
git commit -m "feat: add TTS text-to-speech with language auto-detection"
```

---

### Task 5: Add exit animation and final polish

Add the fade-out animation when closing the bubble.

**Files:**
- Modify: `content/content.js` (update `hideBubble` function)

- [ ] **Step 1: Update `hideBubble` with exit animation**

Replace:

```js
  function hideBubble() { bubble.classList.remove("llmt-visible"); }
```

with:

```js
  function hideBubble() {
    if (!bubble.classList.contains("llmt-visible")) return;
    bubble.classList.add("llmt-hiding");
    bubble.addEventListener("animationend", function onEnd() {
      bubble.removeEventListener("animationend", onEnd);
      bubble.classList.remove("llmt-visible", "llmt-hiding");
    }, { once: true });
  }
```

- [ ] **Step 2: Full end-to-end verification**

Test on multiple pages:

1. **Light page (Wikipedia/Google):**
   - Select text — glassmorphism button with light theme
   - Click — popover: original (gray, 13px) + loading — translated (primary, 15px)
   - Language badges: "EN" gray, "ZH" indigo
   - Copy: icon swaps to checkmark for 1.5s
   - TTS: speaker toggles to stop square
   - Close: fade-out animation (0.15s)

2. **Dark page (GitHub dark mode):**
   - Same flow, adapted dark theme colors
   - Button and bubble have dark glassmorphism

3. **Edge cases:**
   - Long text: body area scrollable
   - Near viewport edge: repositions correctly
   - Cancel during loading: "翻译已取消"
   - Network error: red error text

- [ ] **Step 3: Commit**

```bash
git add content/content.js
git commit -m "feat: add exit animation for bubble close"
```

---

## Summary

| File | Tasks | Key Changes |
|------|-------|-------------|
| `content/content.css` | 1 | Complete rewrite: CSS custom properties, glassmorphism, Apple Popover, icon states |
| `content/content.js` | 2, 3, 4, 5 | New DOM (safe createElement), adaptive theming, TTS, exit animation |
