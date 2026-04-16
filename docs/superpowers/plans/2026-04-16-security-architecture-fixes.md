# LLM Translate Security & Architecture Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical security vulnerabilities and architectural bugs in the LLM Translate Chrome extension.

**Architecture:** The extension has 4 layers: manifest config, service-worker (background), content script (page injection), and popup (settings UI). Fixes proceed bottom-up: module system first (everything depends on it), then storage consistency, then encryption, then feature wiring, then hardening.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, Web Crypto API, chrome.storage API

---

## File Structure

| File | Responsibility | Changes |
|------|---------------|---------|
| `manifest.json` | Extension config | Add module type for service worker, narrow host_permissions |
| `background/service-worker.js` | API calls, encryption, config management | Fix storage read/write, fix resp.text bug, add cache invalidation, wire cancel flow |
| `content/content.js` | Page UI, text selection, translation trigger | Remove invalid import, inline constant, fix cancel wiring |
| `popup/popup.js` | Settings UI | Add encryption before save, add URL validation, notify SW on save |
| `shared/config.js` | Default config values | No changes |
| `shared/constants.js` | Shared constants | No changes (content.js can't use it as module) |

---

### Task 1: Fix module system — service worker declared as module

Content script **cannot** use ES modules in MV3 (Chrome does not support `"type": "module"` for content scripts). Service worker **can** use modules but must declare it. This task fixes the service worker declaration.

**Files:**
- Modify: `manifest.json:12-14`

- [ ] **Step 1: Add `"type": "module"` to service worker declaration**

In `manifest.json`, change:

```json
"background": {
  "service_worker": "background/service-worker.js"
}
```

to:

```json
"background": {
  "service_worker": "background/service-worker.js",
  "type": "module"
}
```

- [ ] **Step 2: Verify by loading the extension in Chrome**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the project directory
4. Check that the service worker shows "Active" with no errors
5. Click "Service Worker" link to open DevTools — console should have no import errors

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "fix: declare service worker as ES module in manifest"
```

---

### Task 2: Fix content.js — remove invalid IIFE import, inline constant

Content scripts in MV3 cannot use ES module `import`. The current code has `import` inside an IIFE which is a syntax error. Replace with inlined constant value.

**Files:**
- Modify: `content/content.js:1-6`

- [ ] **Step 1: Replace the invalid import with an inlined constant**

Change the top of `content/content.js` from:

```js
(() => {
  "use strict";

  import { PORT_NAME } from "../shared/constants.js";
```

to:

```js
(() => {
  "use strict";

  // Content scripts cannot use ES modules in MV3; inline the constant
  // Keep in sync with shared/constants.js PORT_NAME
  const PORT_NAME = "llmt-translate";
```

- [ ] **Step 2: Verify content script loads**

1. Reload the extension in `chrome://extensions`
2. Open any webpage
3. Open DevTools console — should have no errors from content.js
4. Select text on the page — the translate button should appear

- [ ] **Step 3: Commit**

```bash
git add content/content.js
git commit -m "fix: replace invalid ES module import with inlined constant in content script"
```

---

### Task 3: Fix storage read/write consistency

Currently `getConfig()` reads from `chrome.storage.sync`, `saveConfig()` writes to `chrome.storage.local`, and popup writes to `chrome.storage.sync`. Unify everything to `chrome.storage.sync` (which syncs across user's Chrome instances).

Also remove the dead `saveConfig()` function from the service worker — popup handles saving.

**Files:**
- Modify: `background/service-worker.js:113-121`

- [ ] **Step 1: Remove the dead `saveConfig` function**

In `background/service-worker.js`, delete the entire `saveConfig` function (lines 113-121):

```js
async function saveConfig(config) {
  if (config.apiKey) {
    config.apiKey = await encryptText(config.apiKey);
  }
  await chrome.storage.local.set(config);
  // Invalidate cache
  cachedConfig = null;
  cachedConfigTime = 0;
}
```

Replace it with nothing — the function is unused.

- [ ] **Step 2: Verify service worker still loads**

1. Reload extension in `chrome://extensions`
2. Service worker should show "Active" with no errors

- [ ] **Step 3: Commit**

```bash
git add background/service-worker.js
git commit -m "fix: remove dead saveConfig function that wrote to wrong storage"
```

---

### Task 4: Fix API Key encryption — encrypt in popup before saving

The popup saves API keys in plaintext to `chrome.storage.sync`, but the service worker tries to decrypt them. Fix by moving encryption logic to a shared utility and calling it from popup on save.

Since popup uses ES modules (`type="module"` in the script tag) but the encryption needs the Web Crypto API (available in both contexts), we extract the encrypt/decrypt functions to a shared file.

**Files:**
- Create: `shared/crypto.js`
- Modify: `background/service-worker.js:0-66` (import from shared/crypto.js instead of inline)
- Modify: `popup/popup.js:105-118` (encrypt API key before saving)

- [ ] **Step 1: Create `shared/crypto.js` with encryption utilities**

Create `shared/crypto.js`:

```js
// Shared encryption utilities for API key storage
// Uses AES-GCM via Web Crypto API

let cachedEncryptionKey = null;

async function getEncryptionKey() {
  if (cachedEncryptionKey) return cachedEncryptionKey;

  const storedKey = await chrome.storage.local.get("encryptionKey");
  if (storedKey.encryptionKey) {
    cachedEncryptionKey = await crypto.subtle.importKey(
      "jwk",
      storedKey.encryptionKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    return cachedEncryptionKey;
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const keyJWK = await crypto.subtle.exportKey("jwk", key);
  await chrome.storage.local.set({ encryptionKey: keyJWK });
  cachedEncryptionKey = key;
  return key;
}

export async function encryptText(plainText) {
  if (!plainText) return plainText;
  const key = await getEncryptionKey();
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plainText)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptText(encryptedB64) {
  if (!encryptedB64) return encryptedB64;
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
```

- [ ] **Step 2: Update service-worker.js to import from shared/crypto.js**

In `background/service-worker.js`, replace the entire inline crypto section (lines 0-66, from `import { DEFAULTS }` through the end of `decryptText`) with:

```js
import { DEFAULTS } from "../shared/config.js";
import {
  DEFAULT_TIMEOUT,
  DEFAULT_SYSTEM_PROMPT,
  ENCRYPTION_KEY_NAME,
  PORT_NAME,
} from "../shared/constants.js";
import { encryptText, decryptText } from "../shared/crypto.js";
```

This removes `cachedEncryptionKey`, `getEncryptionKey()`, `encryptText()`, and `decryptText()` from service-worker.js since they now live in `shared/crypto.js`.

- [ ] **Step 3: Update popup.js to encrypt API key before saving**

In `popup/popup.js`, add the crypto import at the top:

```js
import { DEFAULTS } from "../shared/config.js";
import { encryptText, decryptText } from "../shared/crypto.js";
```

Then change the `loadSettings` function to decrypt the API key when loading:

```js
function loadSettings() {
  chrome.storage.sync.get(null, async (items) => {
    apiBaseUrlInput.value = items.apiBaseUrl || DEFAULTS.apiBaseUrl;
    targetLangSelect.value = items.targetLang || DEFAULTS.targetLang;
    systemPromptInput.value = items.systemPrompt || "";

    // Decrypt API key for display
    if (items.apiKey) {
      try {
        apiKeyInput.value = await decryptText(items.apiKey);
      } catch {
        // Legacy plaintext key — show as-is, will be encrypted on next save
        apiKeyInput.value = items.apiKey;
      }
    } else {
      apiKeyInput.value = "";
    }

    const savedModel = items.model || DEFAULTS.model;
    const cachedModels = items.cachedModels || [];

    if (cachedModels.length > 0) {
      populateModels(cachedModels, savedModel);
    } else if (savedModel) {
      populateModels([savedModel], savedModel);
    }
  });
}
```

Then change `saveSettings` to encrypt before saving:

```js
async function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  const encryptedKey = await encryptText(apiKey);

  const config = {
    apiBaseUrl: apiBaseUrlInput.value.trim() || DEFAULTS.apiBaseUrl,
    apiKey: encryptedKey,
    model: modelSelect.value,
    targetLang: targetLangSelect.value,
    systemPrompt: systemPromptInput.value.trim(),
  };

  chrome.storage.sync.set(config, () => {
    statusEl.textContent = "设置已保存";
    setTimeout(() => { statusEl.textContent = ""; }, 2000);
  });
}
```

Also update `fetchModels` to use the raw (unencrypted) API key from the input field — it already does this correctly since it reads from `apiKeyInput.value`.

- [ ] **Step 4: Verify encryption round-trip**

1. Reload extension
2. Open popup, enter an API key, save
3. Inspect `chrome.storage.sync` via DevTools: the `apiKey` value should be a base64 string, not plaintext
4. Close and reopen the popup — the API key field should show the original plaintext
5. Translate some text — should work (service worker decrypts successfully)

- [ ] **Step 5: Commit**

```bash
git add shared/crypto.js background/service-worker.js popup/popup.js
git commit -m "fix: unify API key encryption — encrypt in popup, decrypt in service worker"
```

---

### Task 5: Add config cache invalidation on storage change

The service worker caches config for 60 seconds. When the user saves settings in the popup, the cache is stale. Add a `storage.onChanged` listener to invalidate.

**Files:**
- Modify: `background/service-worker.js` (add listener after the cache variables)

- [ ] **Step 1: Add storage change listener**

In `background/service-worker.js`, after the `CONFIG_CACHE_TTL` line (currently around line 71 after Task 4 changes), add:

```js
// Invalidate config cache when storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    cachedConfig = null;
    cachedConfigTime = 0;
  }
});
```

- [ ] **Step 2: Verify cache invalidation**

1. Reload extension
2. Translate text (this caches the config)
3. Open popup, change the target language, save
4. Immediately translate text again — should use the new target language, not the cached one

- [ ] **Step 3: Commit**

```bash
git add background/service-worker.js
git commit -m "fix: invalidate config cache when storage changes"
```

---

### Task 6: Wire up cancel functionality end-to-end

The cancel feature is broken: `requestId` is generated but never sent, requests aren't registered in `activeRequests`, and the cancel button handler uses an `AbortController` that's never assigned. Fix the full chain.

**Files:**
- Modify: `background/service-worker.js` (register requests in activeRequests, pass abort controller)
- Modify: `content/content.js` (send requestId, fix cancel button to use port-based cancel)

- [ ] **Step 1: Fix service worker to register active requests and wire abort**

In `background/service-worker.js`, change the `translate` message handler inside `chrome.runtime.onConnect.addListener`. Replace the existing translate handler:

```js
if (msg.type === "translate") {
  try {
    const config = await getConfig();
    if (!config.apiKey && !config.apiBaseUrl.includes("localhost")) {
      port.postMessage({ error: "请先在插件设置中配置 API Key" });
      return;
    }
    const translated = await callLLM(msg.text, config);
    port.postMessage({ translated });
  } catch (err) {
    port.postMessage({ error: err.message });
  }
}
```

with:

```js
if (msg.type === "translate") {
  const requestId = msg.requestId;
  try {
    const config = await getConfig();
    if (!config.apiKey && !config.apiBaseUrl.includes("localhost")) {
      port.postMessage({ error: "请先在插件设置中配置 API Key" });
      return;
    }
    const { abortController, timeoutId } = createAbortControllerWithTimeout();
    activeRequests.set(requestId, { abortController, timeoutId });
    const translated = await callLLM(msg.text, config, { abortController, timeoutId });
    activeRequests.delete(requestId);
    port.postMessage({ translated });
  } catch (err) {
    activeRequests.delete(requestId);
    if (err.message === "翻译已取消") {
      port.postMessage({ cancelled: true });
    } else {
      port.postMessage({ error: err.message });
    }
  }
}
```

Also fix the `callLLM` function signature — it currently expects `abortController` as the third parameter but then destructures it. Change the function to accept the `{ abortController, timeoutId }` object directly. Replace:

```js
async function callLLM(text, config, abortController = null) {
  const url = config.apiBaseUrl.replace(/\/+$/, "") + "/chat/completions";
  const template = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = template.replace("{targetLang}", config.targetLang);

  const { abortController: localAbortController, timeoutId } =
    abortController || createAbortControllerWithTimeout();
```

with:

```js
async function callLLM(text, config, controllers = null) {
  const url = config.apiBaseUrl.replace(/\/+$/, "") + "/chat/completions";
  const template = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = template.replace("{targetLang}", config.targetLang);

  const { abortController, timeoutId } =
    controllers || createAbortControllerWithTimeout();
```

And update the fetch call and finally block to use the new variable names. Replace `localAbortController.signal` with `abortController.signal`, and replace:

```js
  } finally {
    if (!abortController) {
      clearTimeout(timeoutId);
    }
  }
```

with:

```js
  } finally {
    if (!controllers) {
      clearTimeout(timeoutId);
    }
  }
```

- [ ] **Step 2: Fix content.js cancel button to use port-based cancel**

In `content/content.js`, the translate function needs to expose the requestId, and the cancel button needs to send a cancel message. 

First, add a module-level variable to track the current request. After `let currentAbortController = null;` (line ~86), add:

```js
let currentRequestId = null;
let currentPort = null;
```

Then rewrite the `translate` function to expose the port and requestId:

```js
function translate(text) {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: PORT_NAME });
    const requestId = Date.now() + Math.random();
    currentRequestId = requestId;
    currentPort = port;

    function cleanup() {
      currentRequestId = null;
      currentPort = null;
      port.onMessage.removeListener(handleMessage);
    }

    function handleMessage(msg) {
      cleanup();
      port.disconnect();
      if (msg.error) {
        reject(new Error(msg.error));
      } else if (msg.cancelled) {
        reject(new Error("Translation cancelled"));
      } else {
        resolve(msg.translated);
      }
    }

    port.onMessage.addListener(handleMessage);

    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        cleanup();
        reject(new Error(chrome.runtime.lastError.message));
      }
    });

    port.postMessage({ type: "translate", text, requestId });
  });
}
```

Then remove the unused `cancelRequest` function (the old standalone function at lines ~41-49).

Then fix the cancel button handler. Replace:

```js
cancelBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (currentAbortController) {
    currentAbortController.abort();
  }
  hideAll();
});
```

with:

```js
cancelBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (currentPort && currentRequestId) {
    currentPort.postMessage({ type: "cancel", requestId: currentRequestId });
    currentPort = null;
    currentRequestId = null;
  }
  hideBubble();
});
```

Remove the now-unused `currentAbortController` variable declaration.

- [ ] **Step 3: Verify cancel works**

1. Reload extension
2. Select text and click translate
3. While "正在翻译..." spinner is showing, click the cancel X button
4. Should show "翻译已取消" message
5. Translate again — should work normally

- [ ] **Step 4: Commit**

```bash
git add background/service-worker.js content/content.js
git commit -m "fix: wire cancel functionality end-to-end via port messaging"
```

---

### Task 7: Fix resp.text() after body consumed

After `resp.json()` fails, the response body is already consumed. The subsequent `resp.text()` call returns empty string and the variable is unused anyway.

**Files:**
- Modify: `background/service-worker.js` (the JSON parse try/catch in `callLLM`)

- [ ] **Step 1: Remove the dead `resp.text()` call**

In `background/service-worker.js`, inside `callLLM`, replace:

```js
    let data;
    try {
      data = await resp.json();
    } catch (err) {
      const text = await resp.text();
      throw new Error("API 返回了无效的 JSON 格式");
    }
```

with:

```js
    let data;
    try {
      data = await resp.json();
    } catch {
      throw new Error("API 返回了无效的 JSON 格式");
    }
```

- [ ] **Step 2: Commit**

```bash
git add background/service-worker.js
git commit -m "fix: remove dead resp.text() call after body already consumed"
```

---

### Task 8: Narrow host_permissions and add URL validation

Replace blanket `https://*/` and `http://*/` with `optional_host_permissions` so Chrome prompts the user only when needed. Also add basic URL validation in the popup.

**Files:**
- Modify: `manifest.json:7`
- Modify: `popup/popup.js` (add URL validation in save and fetch)

- [ ] **Step 1: Change host_permissions to optional**

In `manifest.json`, replace:

```json
"host_permissions": ["https://*/", "http://*/"],
```

with:

```json
"permissions": ["activeTab", "storage", "contextMenus"],
"optional_host_permissions": ["https://*/", "http://*/"],
```

And remove the duplicate `"permissions"` line that already exists above (merge them — keep only one `"permissions"` key). The final permissions section should look like:

```json
"permissions": ["activeTab", "storage", "contextMenus"],
"optional_host_permissions": ["https://*/", "http://*/"],
```

(Remove the old `"host_permissions"` line entirely.)

- [ ] **Step 2: Request host permission before API calls in service worker**

In `background/service-worker.js`, in the `callLLM` function, before the `fetch` call, add a permission request for the API URL's origin. However, `chrome.permissions.request()` can only be called from a user gesture context (popup/content script), not from the service worker. 

Instead, request permission in the popup when saving settings. In `popup/popup.js`, update `saveSettings`:

```js
async function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  const encryptedKey = await encryptText(apiKey);
  const baseUrl = apiBaseUrlInput.value.trim() || DEFAULTS.apiBaseUrl;

  // Request host permission for the API URL
  try {
    const urlOrigin = new URL(baseUrl).origin + "/*";
    await chrome.permissions.request({ origins: [urlOrigin] });
  } catch {
    statusEl.textContent = "URL 格式无效";
    return;
  }

  const config = {
    apiBaseUrl: baseUrl,
    apiKey: encryptedKey,
    model: modelSelect.value,
    targetLang: targetLangSelect.value,
    systemPrompt: systemPromptInput.value.trim(),
  };

  chrome.storage.sync.set(config, () => {
    statusEl.textContent = "设置已保存";
    setTimeout(() => { statusEl.textContent = ""; }, 2000);
  });
}
```

- [ ] **Step 3: Add URL validation in popup**

In `popup/popup.js`, add a validation helper before `saveSettings`:

```js
function isValidApiUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
```

Then add validation at the start of `saveSettings`, after the `baseUrl` assignment:

```js
  if (!isValidApiUrl(baseUrl)) {
    statusEl.textContent = "请输入有效的 API URL";
    return;
  }
```

And add the same validation at the start of `fetchModels`, replacing the existing `!baseUrl` check:

```js
  if (!baseUrl || !isValidApiUrl(baseUrl)) {
    setModelStatus("请填写有效的 API Base URL", true);
    return;
  }
```

- [ ] **Step 4: Verify permissions flow**

1. Reload extension
2. Open popup, enter API URL and key, click save
3. Chrome should show a permission prompt for the API domain
4. After granting, settings should save normally
5. Translate text — should work

- [ ] **Step 5: Commit**

```bash
git add manifest.json popup/popup.js
git commit -m "fix: narrow host_permissions to optional, add URL validation"
```

---

### Task 9: Clean up unused code and final verification

Remove unused variables and imports left over from the fixes.

**Files:**
- Modify: `background/service-worker.js` (remove unused ENCRYPTION_KEY_NAME import)
- Modify: `content/content.js` (ensure no stale references)

- [ ] **Step 1: Remove unused ENCRYPTION_KEY_NAME import**

In `background/service-worker.js`, change:

```js
import {
  DEFAULT_TIMEOUT,
  DEFAULT_SYSTEM_PROMPT,
  ENCRYPTION_KEY_NAME,
  PORT_NAME,
} from "../shared/constants.js";
```

to:

```js
import {
  DEFAULT_TIMEOUT,
  DEFAULT_SYSTEM_PROMPT,
  PORT_NAME,
} from "../shared/constants.js";
```

- [ ] **Step 2: Full end-to-end verification**

1. Reload extension from `chrome://extensions` — no errors
2. Open popup — settings load correctly, API key decrypts
3. Save settings — API key is encrypted in storage
4. Select text on any page — translate button appears
5. Click translate — translation works
6. Click cancel during translation — cancellation works
7. Change settings — next translation uses new settings immediately
8. Enter invalid URL — validation error shown

- [ ] **Step 3: Commit**

```bash
git add background/service-worker.js content/content.js
git commit -m "chore: remove unused imports and variables"
```

---

## Summary of Changes by File

| File | Tasks | Key Changes |
|------|-------|-------------|
| `manifest.json` | 1, 8 | Module type for SW, optional host_permissions |
| `background/service-worker.js` | 3, 4, 5, 6, 7, 9 | Remove dead code, import shared crypto, cache invalidation, wire cancel, fix resp.text |
| `content/content.js` | 2, 6 | Fix import, wire cancel via port messaging |
| `popup/popup.js` | 4, 8 | Encrypt/decrypt API key, URL validation, permission request |
| `shared/crypto.js` (new) | 4 | Shared AES-GCM encrypt/decrypt utilities |
