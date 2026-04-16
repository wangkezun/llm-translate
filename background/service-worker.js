import { DEFAULTS } from "../shared/config.js";
import {
  DEFAULT_TIMEOUT,
  DEFAULT_SYSTEM_PROMPT,
  ENCRYPTION_KEY_NAME,
  PORT_NAME,
} from "../shared/constants.js";
import { encryptText, decryptText } from "../shared/crypto.js";

// In-memory cache for configuration
let cachedConfig = null;
let cachedConfigTime = 0;
const CONFIG_CACHE_TTL = 60000; // 60 seconds

async function getConfig() {
  const now = Date.now();
  if (cachedConfig && now - cachedConfigTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  const items = await chrome.storage.sync.get(null);

  // Support old single-model config
  let config;
  if (!items.models) {
    config = {
      apiBaseUrl: items.apiBaseUrl || DEFAULTS.apiBaseUrl,
      apiKey: items.apiKey || "",
      model: items.model || DEFAULTS.model,
      targetLang: items.targetLang || DEFAULTS.targetLang,
      systemPrompt: items.systemPrompt || "",
    };
  } else {
    const models = items.models || DEFAULTS.models;
    const activeId = items.activeModelId || models[0].id;
    const activeModel = models.find((m) => m.id === activeId) || models[0];

    config = {
      apiBaseUrl: activeModel.apiBaseUrl || DEFAULTS.apiBaseUrl,
      apiKey: activeModel.apiKey || "",
      model: activeModel.model || DEFAULTS.model,
      targetLang: items.targetLang || DEFAULTS.targetLang,
      systemPrompt: items.systemPrompt || "",
    };
  }

  if (config.apiKey) {
    config.apiKey = await decryptText(config.apiKey);
  }
  cachedConfig = config;
  cachedConfigTime = now;
  return config;
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
