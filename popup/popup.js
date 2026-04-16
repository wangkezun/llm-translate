import { DEFAULTS } from "../shared/config.js";
import { encryptText, decryptText } from "../shared/crypto.js";

const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const fetchModelsBtn = document.getElementById("fetchModelsBtn");
const modelStatus = document.getElementById("modelStatus");
const targetLangSelect = document.getElementById("targetLang");
const systemPromptInput = document.getElementById("systemPrompt");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

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

function populateModels(modelIds, selectedModel) {
  modelSelect.innerHTML = "";
  modelSelect.disabled = false;

  for (const id of modelIds) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    modelSelect.appendChild(opt);
  }

  if (selectedModel && modelIds.includes(selectedModel)) {
    modelSelect.value = selectedModel;
  }
}

function setModelStatus(message, isError) {
  modelStatus.textContent = message;
  modelStatus.className = "model-status " + (isError ? "error" : "success");
}

async function fetchModels() {
  const baseUrl = apiBaseUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!baseUrl) {
    setModelStatus("请先填写 API Base URL", true);
    return;
  }

  fetchModelsBtn.classList.add("loading");
  modelStatus.textContent = "";

  const url = baseUrl.replace(/\/+$/, "") + "/models";

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = "Bearer " + apiKey;
    }

    const resp = await fetch(url, { headers });

    if (!resp.ok) {
      if (resp.status === 401) {
        throw new Error("API Key 无效");
      }
      throw new Error("请求失败 (" + resp.status + ")");
    }

    const data = await resp.json();
    const models = (data.data || [])
      .map((m) => m.id)
      .sort((a, b) => a.localeCompare(b));

    if (models.length === 0) {
      throw new Error("未找到可用模型");
    }

    const currentModel = modelSelect.value || "";
    populateModels(models, currentModel);
    setModelStatus("已加载 " + models.length + " 个模型", false);

    chrome.storage.sync.set({ cachedModels: models });
  } catch (err) {
    if (err.message.includes("Failed to fetch")) {
      setModelStatus("网络连接失败，请检查 URL", true);
    } else {
      setModelStatus(err.message, true);
    }
  } finally {
    fetchModelsBtn.classList.remove("loading");
  }
}

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

fetchModelsBtn.addEventListener("click", fetchModels);
saveBtn.addEventListener("click", saveSettings);

document.addEventListener("DOMContentLoaded", loadSettings);
