(() => {
  "use strict";

  // ── 通过 Port 长连接调用 service worker ──────────────────────────
  // service worker 中的 fetch 不受页面 mixed-content 限制
  // Port 长连接不受 sendMessage 30 秒超时限制
  function translate(text) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: "llmt-translate" });

      port.onMessage.addListener((msg) => {
        port.disconnect();
        if (msg.error) {
          reject(new Error(msg.error));
        } else {
          resolve(msg.translated);
        }
      });

      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        }
      });

      port.postMessage({ type: "translate", text });
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
  const bubble = document.createElement("div");
  bubble.id = "llmt-bubble";
  bubble.innerHTML =
    `<div class="llmt-header">` +
      `<span>LLM Translate</span>` +
      `<button class="llmt-close-btn" title="关闭">&times;</button>` +
    `</div>` +
    `<div class="llmt-body"></div>` +
    `<div class="llmt-actions">` +
      `<button class="llmt-copy-btn">复制</button>` +
      `<span class="llmt-copied">已复制</span>` +
    `</div>`;
  document.body.appendChild(bubble);

  const bodyEl = bubble.querySelector(".llmt-body");
  const actions = bubble.querySelector(".llmt-actions");
  const closeBtn = bubble.querySelector(".llmt-close-btn");
  const copyBtn = bubble.querySelector(".llmt-copy-btn");
  const copiedTip = bubble.querySelector(".llmt-copied");

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

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ── 选中文本 → 显示按钮 ──────────────────────────────────────────
  document.addEventListener("mouseup", (e) => {
    if (isOurElement(e.target)) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";

      if (text.length > 0) {
        selectedText = text;
        hideBubble();
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

    // 显示 loading
    bodyEl.innerHTML =
      `<div class="llmt-loading">` +
        `<div class="llmt-spinner"></div>` +
        `<span>正在翻译...</span>` +
      `</div>`;
    actions.style.display = "none";
    showBubble(rect.left, rect.top);

    translate(text)
      .then((translated) => {
        bodyEl.textContent = translated;
        actions.style.display = "flex";
      })
      .catch((err) => {
        bodyEl.innerHTML = `<div class="llmt-error">${escapeHtml(err.message)}</div>`;
        actions.style.display = "none";
      });
  });

  // ── 关闭 ──────────────────────────────────────────────────────────
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideAll();
  });

  // ── 复制 ──────────────────────────────────────────────────────────
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(bodyEl.textContent).then(() => {
      copiedTip.classList.add("llmt-show");
      setTimeout(() => copiedTip.classList.remove("llmt-show"), 1500);
    });
  });
})();
