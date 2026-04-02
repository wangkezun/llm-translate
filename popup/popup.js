import { DEFAULTS } from "../shared/config.js";

function loadSettings() {
  chrome.storage.sync.get(null, (items) => {
    const models = items.models && items.models.length > 0
      ? items.models
      : DEFAULTS.models;
    const activeModelId = items.activeModelId || models[0].id;

    // Render model dropdown
    const sel = document.getElementById("activeModel");
    sel.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.modelName || m.model || "未命名";
      sel.appendChild(opt);
    }
    sel.value = activeModelId;

    // Target language
    document.getElementById("targetLang").value = items.targetLang || DEFAULTS.targetLang;
  });
}

// Auto-save on model change
document.getElementById("activeModel").addEventListener("change", (e) => {
  chrome.storage.sync.set({ activeModelId: e.target.value });
});

// Auto-save on language change
document.getElementById("targetLang").addEventListener("change", (e) => {
  chrome.storage.sync.set({ targetLang: e.target.value });
});

// Open options page
document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.addEventListener("DOMContentLoaded", loadSettings);
