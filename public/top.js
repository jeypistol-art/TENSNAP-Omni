// Top screen behavior with quiet, same-screen updates only.
(() => {
  const LAST_STATE_KEY = "scoreSnapLastState";
  const LAST_SCAN_KEY = "scoreSnapLastScan";
  const SCANNED_FLAG_KEY = "scoreSnapScanned";

  const MESSAGES = {
    scanFailed: "スキャンに失敗しました。より鮮明な画像で再度お試しください。",
    firstTime: "まずは学習状況をスキャンしてください",
    normal: "スキャンすると、今の状態が更新されます",
    scanComplete: "学習状況を更新しました。必要に応じて再度確認できます。"
  };

  const statusScore = document.getElementById("statusScore");
  const statusLabel = document.getElementById("statusLabel");
  const statusInterpretation = document.getElementById("statusInterpretation");
  const statusGuide = document.getElementById("statusGuide");
  const actionNote = document.getElementById("actionNote");
  const scanButton = document.getElementById("scanButton");
  const firstTimeNote = document.getElementById("firstTimeNote");

  if (!statusScore || !statusLabel || !statusInterpretation || !statusGuide || !actionNote || !scanButton) {
    return;
  }

  const states = [
    {
      score: 86,
      label: "良好",
      interpretation: "今は良好な学習状態の傾向です。集中して学習を進めやすい状態です。",
      guide: ["通常の学習を進めやすい", "重要な学習内容に絞りたい"],
      action: MESSAGES.scanComplete
    },
    {
      score: 72,
      label: "安定",
      interpretation: "今は安定した学習状態の傾向です。通常の学習を進めやすい状態です。",
      guide: ["通常の学習を進めやすい", "学習量を調整しやすい"],
      action: MESSAGES.scanComplete
    },
    {
      score: 58,
      label: "やや疲労",
      interpretation: "今はやや疲労が見られる学習状態の傾向です。学習量や内容を調整しやすい状態です。",
      guide: ["学習量を調整しやすい", "無理は避けたい"],
      action: MESSAGES.scanComplete
    },
    {
      score: 41,
      label: "消耗",
      interpretation: "今は消耗が見られる学習状態の傾向です。無理のない学習計画を立てやすい状態です。",
      guide: ["無理は避けたい", "学習量を調整しやすい"],
      action: MESSAGES.scanComplete
    }
  ];

  let lastIndex = -1;
  let failureActive = false;

  const safeGet = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch (_err) {
      return null;
    }
  };

  const safeSet = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch (_err) {
      // localStorage unavailable; keep UI functional without persistence.
    }
  };

  const updateGuide = (items) => {
    statusGuide.innerHTML = "";
    items.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      statusGuide.appendChild(li);
    });
  };

  const applyState = (state) => {
    statusScore.textContent = String(state.score);
    statusLabel.textContent = "/ " + state.label;
    statusInterpretation.textContent = state.interpretation;
    updateGuide(state.guide);
  };

  const getLastScanDays = () => {
    const raw = safeGet(LAST_SCAN_KEY);
    if (!raw) return null;
    const lastScanMs = Number(raw);
    if (!Number.isFinite(lastScanMs)) return null;
    const diff = Date.now() - lastScanMs;
    if (diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getBaseNote = () => {
    const lastScanRaw = safeGet(LAST_SCAN_KEY);
    if (!lastScanRaw) {
      return MESSAGES.firstTime;
    }
    const daysAgo = getLastScanDays();
    if (daysAgo !== null && daysAgo >= 3) {
      return "前回の作業：" + daysAgo + "日前";
    }
    return MESSAGES.normal;
  };

  const setActionNote = (text) => {
    actionNote.textContent = text;
  };

  const refreshNote = () => {
    if (failureActive) {
      setActionNote(MESSAGES.scanFailed);
      return;
    }
    setActionNote(getBaseNote());
  };

  const restoreLastState = () => {
    const raw = safeGet(LAST_STATE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      if (typeof parsed.score !== "number") return;
      if (typeof parsed.label !== "string") return;
      if (typeof parsed.interpretation !== "string") return;
      if (!Array.isArray(parsed.guide)) return;
      applyState(parsed);
    } catch (_err) {
      // Ignore invalid stored state.
    }
  };

  const getNextState = () => {
    let i;
    do {
      i = Math.floor(Math.random() * states.length);
    } while (i === lastIndex && states.length > 1);
    lastIndex = i;
    return states[i];
  };

  const simulateScan = () => {
    const roll = Math.random();
    if (roll < 0.2) return { ok: false, reason: "scan_failed" };
    if (roll < 0.3) return { ok: false, reason: "no_response" };
    return { ok: true, state: getNextState() };
  };

  // Restore last successful state when available, then compute the note priority.
  restoreLastState();
  if (safeGet(LAST_SCAN_KEY)) {
    if (firstTimeNote) firstTimeNote.style.display = "none";
  }
  refreshNote();

  scanButton.addEventListener("click", () => {
    failureActive = false;
    refreshNote();

    scanButton.disabled = true;
    scanButton.textContent = "スキャン中です…";

    window.setTimeout(() => {
      // TODO: fetch("/api/scan") and map the response to the same state shape.
      const result = simulateScan();

      if (result.ok && result.state) {
        applyState(result.state);
        safeSet(LAST_STATE_KEY, JSON.stringify(result.state));
        safeSet(LAST_SCAN_KEY, String(Date.now()));
        safeSet(SCANNED_FLAG_KEY, "1");
        if (firstTimeNote) firstTimeNote.style.display = "none";
        setActionNote(result.state.action);
      } else if (result.reason === "scan_failed") {
        failureActive = true;
        setActionNote(MESSAGES.scanFailed);
      } else {
        // no_response: keep last known state and base note without extra UI.
        refreshNote();
      }

      scanButton.disabled = false;
      scanButton.textContent = "まずはスキャンしてください";
    }, 900);
  });
})();
