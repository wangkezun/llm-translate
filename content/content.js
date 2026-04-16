(() => {
  "use strict";

  // Content scripts cannot use ES modules in MV3; inline the constant
  // Keep in sync with shared/constants.js PORT_NAME
  const PORT_NAME = "llmt-translate";

  // ── 通过 Port 长连接调用 service worker ──────────────────────────
  // service worker 中的 fetch 不受页面 mixed-content 限制
  // Port 长连接不受 sendMessage 30 秒超时限制
  let currentRequestId = null;
  let currentPort = null;

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

  // ── 创建翻译按钮 ──────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.id = "llmt-btn";
  btn.title = "翻译选中文本";
  btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
  </svg>`;
  document.body.appendChild(btn);

  // ── 创建翻译气泡 ──────────────────────────────────────────────────
  const SVG_NS = "http://www.w3.org/2000/svg";

  function makeSvgIcon(pathD, className) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", className);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }

  const bubble = document.createElement("div");
  bubble.id = "llmt-bubble";

  // Body
  const bubbleBody = document.createElement("div");
  bubbleBody.className = "llmt-body";

  // Original section
  const originalSection = document.createElement("div");
  originalSection.className = "llmt-original";
  const sourceBadge = document.createElement("span");
  sourceBadge.className = "llmt-badge llmt-badge-source";
  sourceBadge.textContent = "EN";
  const originalEl = document.createElement("span");
  originalEl.className = "llmt-original-text";
  originalSection.appendChild(sourceBadge);
  originalSection.appendChild(originalEl);

  // Translated section
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

  // Actions bar
  const actionsBar = document.createElement("div");
  actionsBar.className = "llmt-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "llmt-action-btn llmt-copy-btn";
  copyBtn.appendChild(makeSvgIcon("M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z", "llmt-icon-copy"));
  copyBtn.appendChild(makeSvgIcon("M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z", "llmt-icon-check"));

  const ttsBtn = document.createElement("button");
  ttsBtn.className = "llmt-action-btn llmt-tts-btn";
  ttsBtn.appendChild(makeSvgIcon("M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z", "llmt-icon-speak"));
  ttsBtn.appendChild(makeSvgIcon("M6 6h12v12H6z", "llmt-icon-stop"));

  const spacer = document.createElement("div");
  spacer.className = "llmt-spacer";

  const closeBtn = document.createElement("button");
  closeBtn.className = "llmt-close-btn";
  closeBtn.textContent = "\u00d7";

  actionsBar.appendChild(copyBtn);
  actionsBar.appendChild(ttsBtn);
  actionsBar.appendChild(spacer);
  actionsBar.appendChild(closeBtn);

  bubble.appendChild(bubbleBody);
  bubble.appendChild(actionsBar);
  document.body.appendChild(bubble);

  // ── 状态 ──────────────────────────────────────────────────────────
  let selectedText = "";

  // ── 工具函数 ──────────────────────────────────────────────────────
  function showBtn(x, y) {
    btn.style.left = (x + window.scrollX) + "px";
    btn.style.top = (y + window.scrollY) + "px";
    btn.classList.add("llmt-visible");
  }

  function showBubble(x, y) {
    bubble.style.left = (x + window.scrollX) + "px";
    bubble.style.top = (y + window.scrollY) + "px";
    bubble.classList.add("llmt-visible");

    requestAnimationFrame(() => {
      const rect = bubble.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (rect.right > vw - 8) bubble.style.left = (vw - rect.width - 8 + window.scrollX) + "px";
      if (rect.bottom > vh - 8) bubble.style.top = (vh - rect.height - 8 + window.scrollY) + "px";
      if (rect.left < 8) bubble.style.left = (8 + window.scrollX) + "px";
      if (rect.top < 8) bubble.style.top = (8 + window.scrollY) + "px";
    });
  }

  function hideBtn() { btn.classList.remove("llmt-visible"); }
  function hideBubble() { bubble.classList.remove("llmt-visible"); }
  function hideAll() { hideBtn(); hideBubble(); selectedText = ""; }

  function isOurElement(el) {
    return el && (el === btn || el === bubble || btn.contains(el) || bubble.contains(el));
  }

  // ── 选中文本 → 显示按钮 ──────────────────────────────────────────
  document.addEventListener("mouseup", (e) => {
    if (isOurElement(e.target)) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";

      if (text.length > 0) {
        // 新的选中文本，重置之前的状态
        selectedText = text;
        hideBubble();
        hideBtn();
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showBtn(rect.right + 6, rect.bottom + 6);
      }
    }, 10);
  });

  // ── 点击页面其他地方 → 关闭 ──────────────────────────────────────
  document.addEventListener("mousedown", (e) => {
    if (isOurElement(e.target)) return;
    hideAll();
  });

  // ── 点击翻译按钮 ──────────────────────────────────────────────────
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const text = selectedText;
    if (!text) return;

    const rect = btn.getBoundingClientRect();
    hideBtn();

    // Show original text
    originalEl.textContent = text;
    originalSection.style.display = "";
    translatedSection.style.display = "none";

    // Clean up previous status elements
    bubbleBody.querySelectorAll(".llmt-loading, .llmt-error, .llmt-cancelled").forEach(el => el.remove());

    // Create loading element
    const loading = document.createElement("div");
    loading.className = "llmt-loading";
    const spinner = document.createElement("div");
    spinner.className = "llmt-spinner";
    const loadingText = document.createElement("span");
    loadingText.textContent = "正在翻译...";
    loading.appendChild(spinner);
    loading.appendChild(loadingText);
    bubbleBody.appendChild(loading);

    actionsBar.style.display = "none";
    showBubble(rect.left, rect.top);

    translate(text)
      .then((translated) => {
        loading.remove();
        translatedEl.textContent = translated;
        translatedSection.style.display = "";
        actionsBar.style.display = "";
      })
      .catch((err) => {
        loading.remove();
        if (err.message === "Translation cancelled") {
          const cancelled = document.createElement("div");
          cancelled.className = "llmt-cancelled";
          cancelled.textContent = "翻译已取消";
          bubbleBody.appendChild(cancelled);
        } else {
          const errorEl = document.createElement("div");
          errorEl.className = "llmt-error";
          errorEl.textContent = err.message;
          bubbleBody.appendChild(errorEl);
        }
        actionsBar.style.display = "none";
      });
  });

  // ── 关闭（兼取消） ──────────────────────────────────────────────────
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentPort && currentRequestId) {
      currentPort.postMessage({ type: "cancel", requestId: currentRequestId });
      currentRequestId = null;
      currentPort = null;
    }
    hideAll();
  });

  // ── 复制 ──────────────────────────────────────────────────────────
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(translatedEl.textContent).then(() => {
      copyBtn.classList.add("llmt-copied-state");
      setTimeout(() => copyBtn.classList.remove("llmt-copied-state"), 1500);
    });
  });
})();
