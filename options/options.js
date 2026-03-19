const MODEL_FIELDS = ["modelName", "apiBaseUrl", "apiKey", "model"];

const DEFAULT_MODEL = {
  id: "default",
  modelName: "GPT-4o-mini",
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

const DEFAULTS = {
  models: [DEFAULT_MODEL],
  activeModelId: "default",
  targetLang: "简体中文",
  systemPrompt: "",
};

let models = [];
let activeModelId = "";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getActiveModel() {
  return models.find((m) => m.id === activeModelId) || models[0];
}

function renderModelSelect() {
  const sel = document.getElementById("activeModel");
  sel.innerHTML = "";
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.modelName || m.model || "未命名";
    sel.appendChild(opt);
  }
  sel.value = activeModelId;
}

function fillModelFields() {
  const m = getActiveModel();
  if (!m) return;
  for (const key of MODEL_FIELDS) {
    const el = document.getElementById(key);
    if (el) el.value = m[key] || "";
  }
}

function readModelFields() {
  const m = getActiveModel();
  if (!m) return;
  for (const key of MODEL_FIELDS) {
    const el = document.getElementById(key);
    m[key] = el ? el.value.trim() : "";
  }
}

// Migrate from old single-model config
function migrateOldConfig(items) {
  if (items.models) return items;
  const migrated = {
    models: [{
      id: "default",
      modelName: items.model || "GPT-4o-mini",
      apiBaseUrl: items.apiBaseUrl || DEFAULTS.models[0].apiBaseUrl,
      apiKey: items.apiKey || "",
      model: items.model || "gpt-4o-mini",
    }],
    activeModelId: "default",
    targetLang: items.targetLang || DEFAULTS.targetLang,
    systemPrompt: items.systemPrompt || "",
  };
  chrome.storage.sync.set(migrated);
  chrome.storage.sync.remove(["apiBaseUrl", "apiKey", "model"]);
  return migrated;
}

function loadSettings() {
  chrome.storage.sync.get(null, (items) => {
    const config = migrateOldConfig(items);

    models = config.models && config.models.length > 0
      ? config.models
      : DEFAULTS.models;
    activeModelId = config.activeModelId || models[0].id;

    renderModelSelect();
    fillModelFields();

    document.getElementById("targetLang").value = config.targetLang || DEFAULTS.targetLang;
    document.getElementById("systemPrompt").value = config.systemPrompt || "";
  });
}

function saveSettings() {
  readModelFields();

  const values = {
    models,
    activeModelId,
    targetLang: document.getElementById("targetLang").value,
    systemPrompt: document.getElementById("systemPrompt").value.trim(),
  };

  chrome.storage.sync.set(values, () => {
    const status = document.getElementById("status");
    status.textContent = "设置已保存";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
}

// Switch active model in dropdown
document.getElementById("activeModel").addEventListener("change", (e) => {
  readModelFields();
  activeModelId = e.target.value;
  fillModelFields();
});

// Add new model
document.getElementById("addModelBtn").addEventListener("click", () => {
  readModelFields();
  const newModel = {
    id: generateId(),
    modelName: "",
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
  };
  models.push(newModel);
  activeModelId = newModel.id;
  renderModelSelect();
  fillModelFields();
  document.getElementById("modelName").focus();
});

// Delete current model
document.getElementById("delModelBtn").addEventListener("click", () => {
  if (models.length <= 1) {
    const status = document.getElementById("status");
    status.textContent = "至少保留一个模型";
    status.classList.add("status-warn");
    setTimeout(() => { status.textContent = ""; status.classList.remove("status-warn"); }, 2000);
    return;
  }
  const idx = models.findIndex((m) => m.id === activeModelId);
  models.splice(idx, 1);
  activeModelId = models[Math.min(idx, models.length - 1)].id;
  renderModelSelect();
  fillModelFields();
});

document.addEventListener("DOMContentLoaded", loadSettings);
document.getElementById("saveBtn").addEventListener("click", saveSettings);
