import { DEFAULTS } from "../shared/config.js";
import {
  DEFAULT_TIMEOUT,
  DEFAULT_SYSTEM_PROMPT,
  ENCRYPTION_KEY_NAME,
  PORT_NAME,
} from "../shared/constants.js";

// AES-GCM encryption for API key using Web Crypto API
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

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  const keyJWK = await crypto.subtle.exportKey("jwk", key);
  await chrome.storage.local.set({ encryptionKey: keyJWK });
  cachedEncryptionKey = key;
  return key;
}

async function encryptText(plainText) {
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

async function decryptText(encryptedB64) {
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

// In-memory cache for configuration
let cachedConfig = null;
let cachedConfigTime = 0;
const CONFIG_CACHE_TTL = 60000; // 60 seconds

async function getConfig() {
  const now = Date.now();
  if (cachedConfig && now - cachedConfigTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  const config = await chrome.storage.local.get(DEFAULTS);
  if (config.apiKey) {
    config.apiKey = await decryptText(config.apiKey);
  }
  cachedConfig = config;
  cachedConfigTime = now;
  return config;
}

async function saveConfig(config) {
  if (config.apiKey) {
    config.apiKey = await encryptText(config.apiKey);
  }
  await chrome.storage.local.set(config);
  // Invalidate cache
  cachedConfig = null;
  cachedConfigTime = 0;
}

// Track active abort controllers for cancel functionality
const activeRequests = new Map();

function createAbortControllerWithTimeout() {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), DEFAULT_TIMEOUT);
  return { abortController, timeoutId };
}

async function callLLM(text, config, abortController = null) {
  const url = config.apiBaseUrl.replace(/\/+$/, "") + "/chat/completions";
  const template = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = template.replace("{targetLang}", config.targetLang);

  const { abortController: localAbortController, timeoutId } =
    abortController || createAbortControllerWithTimeout();

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: "Bearer " + config.apiKey } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      }),
      signal: localAbortController.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      // Improved error handling based on status code
      let errorMessage = "API 请求失败 (" + resp.status + ")";
      if (resp.status === 401) {
        errorMessage = "API Key 无效，请检查设置";
      } else if (resp.status === 429) {
        errorMessage = "API 请求频率过高，请稍后重试";
      } else if (resp.status >= 500) {
        errorMessage = "API 服务器错误，请稍后重试";
      }
      throw new Error(errorMessage + ": " + errText);
    }

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      const text = await resp.text();
      throw new Error("API 返回了无效的 JSON 格式");
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error("API 返回了空的结果");
    }

    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error("API 响应缺少翻译内容");
    }

    return content.trim();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("翻译已取消");
    }
    if (err.message.includes("Failed to fetch")) {
      throw new Error("网络连接失败，请检查网络");
    }
    throw err;
  } finally {
    if (!abortController) {
      clearTimeout(timeoutId);
    }
  }
}

// 使用 chrome.runtime.connect 长连接，不受 sendMessage 30 秒超时限制
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;

  port.onMessage.addListener(async (msg) => {
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
    } else if (msg.type === "cancel") {
      // Handle cancel request
      const requestId = msg.requestId;
      if (activeRequests.has(requestId)) {
        const { abortController, timeoutId } = activeRequests.get(requestId);
        abortController.abort();
        clearTimeout(timeoutId);
        activeRequests.delete(requestId);
        port.postMessage({ cancelled: true });
      }
    }
  });

  port.onDisconnect.addListener(() => {
    // Clean up any active requests for this port
    for (const [requestId, controller] of activeRequests.entries()) {
      if (controller.portId === port.sender?.id) {
        controller.abortController.abort();
        clearTimeout(controller.timeoutId);
        activeRequests.delete(requestId);
      }
    }
  });
});
