const DEFAULT_CONFIG = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  targetLang: "中文",
  systemPrompt: "",
};

const DEFAULT_SYSTEM_PROMPT =
  "You are a professional translator. Translate the following text to {targetLang}. Only return the translated text without any explanation or extra content.";

async function getConfig() {
  return await chrome.storage.sync.get(DEFAULT_CONFIG);
}

async function callLLM(text, config) {
  const url = config.apiBaseUrl.replace(/\/+$/, "") + "/chat/completions";
  const template = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = template.replace("{targetLang}", config.targetLang);

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
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error("API 请求失败 (" + resp.status + "): " + errText);
  }

  const data = await resp.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("API 返回了空的结果");
  }

  return data.choices[0].message.content.trim();
}

// 使用 chrome.runtime.connect 长连接，不受 sendMessage 30 秒超时限制
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "llmt-translate") return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== "translate") return;

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
  });
});
