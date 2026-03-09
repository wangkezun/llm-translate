const FIELDS = ["apiBaseUrl", "apiKey", "model", "targetLang", "systemPrompt"];

const DEFAULTS = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  targetLang: "中文",
  systemPrompt: "",
};

function loadSettings() {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    for (const key of FIELDS) {
      const el = document.getElementById(key);
      if (el) el.value = items[key];
    }
  });
}

function saveSettings() {
  const values = {};
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    values[key] = el ? el.value.trim() : "";
  }

  chrome.storage.sync.set(values, () => {
    const status = document.getElementById("status");
    status.textContent = "设置已保存";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
}

document.addEventListener("DOMContentLoaded", loadSettings);
document.getElementById("saveBtn").addEventListener("click", saveSettings);
