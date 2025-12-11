(() => {
  if (window.__pagePetCatInjected) return;
  window.__pagePetCatInjected = true;

  const STORAGE_KEY = "pagePetCatSettings";
  const defaultSettings = {
    size: 20,
    wanderSpeed: 55, // px per second
    followSpeed: 110,
    followDistance: 140,
    idleSleepMs: 20000,
    reactions: {
      followNear: true,
      hopOnPet: true,
      sleepOnIdle: true
    }
  };

  const DEFAULT_KAMOJI = "(´・ω・`)";
  let kamojiList = [DEFAULT_KAMOJI];

  const state = {
    x: 0,
    targetX: 0,
    pausedUntil: 0,
    sleeping: false,
    hopUntil: 0,
    lastInteraction: performance.now(),
    cursor: { x: null, y: null },
    viewportWidth: window.innerWidth,
    lastTick: performance.now(),
    pose: "idle",
    direction: "right"
  };

  let settings = { ...defaultSettings };
  let container;
  let petWrapper;
  let petText;
  let ready = false;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const deepMerge = (base, incoming) => {
    const merged = { ...base };
    Object.keys(incoming || {}).forEach((key) => {
      const value = incoming[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        merged[key] = deepMerge(base[key] || {}, value);
      } else {
        merged[key] = value;
      }
    });
    return merged;
  };

  const loadKamojiList = async () => {
    try {
      const url = chrome.runtime.getURL("EMOJIS.txt");
      const res = await fetch(url);
      const text = (await res.text()).replace(/^\uFEFF/, "");
      const parsed = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (parsed.length) {
        kamojiList = parsed;
      }
    } catch (err) {
      console.warn("Page Pet: could not load kamoji list", err);
      kamojiList = [DEFAULT_KAMOJI];
    }
  };

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      settings = deepMerge(defaultSettings, result[STORAGE_KEY] || {});
    } catch (err) {
      console.warn("Page Pet: could not load settings", err);
      settings = { ...defaultSettings };
    }
    applySettings();
  };

  const saveSettings = async (nextSettings) => {
    settings = deepMerge(defaultSettings, nextSettings);
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    } catch (err) {
      console.warn("Page Pet: could not save settings", err);
    }
  };

  const applySettings = () => {
    if (!container || !petText || !petWrapper) return;
    petText.style.fontSize = `${settings.size}px`;
    petText.style.lineHeight = "1";
    container.style.height = `${settings.size + 24}px`;
    state.x = clamp(
      state.x || window.innerWidth * 0.5,
      4,
      window.innerWidth - settings.size - 4
    );
    petWrapper.style.bottom = "8px";
    renderKamoji(state.pose || "idle");
  };

  const initDom = () => {
    container = document.createElement("div");
    container.id = "page-pet-cat-container";
    petWrapper = document.createElement("div");
    petWrapper.className = "page-pet-cat-wrapper";
    petText = document.createElement("span");
    petText.className = "page-pet-cat";
    petText.setAttribute("aria-hidden", "true");
    petText.draggable = false;
    petText.textContent = DEFAULT_KAMOJI;
    petWrapper.appendChild(petText);
    container.appendChild(petWrapper);
    document.documentElement.appendChild(container);
    applySettings();
  };

  const pickWanderTarget = () => {
    const padding = 8;
    const min = padding;
    const max = Math.max(settings.size + padding, state.viewportWidth - settings.size - padding);
    state.targetX = min + Math.random() * (max - min);
    state.pausedUntil = performance.now() + (Math.random() * 1800 + 400);
  };

  const wakeUp = () => {
    if (!state.sleeping) return;
    state.sleeping = false;
    state.pausedUntil = performance.now() + 400;
    petWrapper.classList.remove("page-pet-sleep");
    state.pose = "idle";
    renderKamoji("idle", state.direction);
  };

  const enterSleep = () => {
    state.sleeping = true;
    petWrapper.classList.remove("page-pet-hop");
    petWrapper.classList.add("page-pet-sleep");
    state.pose = "sleep";
    renderKamoji("sleep", state.direction);
  };

  const handlePointerMove = (event) => {
    state.cursor = { x: event.clientX, y: event.clientY };
    state.lastInteraction = performance.now();
    wakeUp();
  };

  const handleScroll = () => {
    state.lastInteraction = performance.now();
    wakeUp();
  };

  const handlePetClick = () => {
    state.lastInteraction = performance.now();
    if (!settings.reactions.hopOnPet) return;
    const now = performance.now();
    state.hopUntil = now + 650;
    petWrapper.classList.add("page-pet-hop");
    setTimeout(() => petWrapper.classList.remove("page-pet-hop"), 650);
  };

  const chooseFrame = (moving) => {
    if (state.sleeping) return "sleep";
    if (state.hopUntil > performance.now()) return "hop";
    return moving ? "walk" : "idle";
  };

  const renderKamoji = (pose, direction = state.direction) => {
    if (!petText) return;
    const base = kamojiList[0] || DEFAULT_KAMOJI;
    const right = kamojiList[1] || base;
    const left = kamojiList[2] || right || base;
    const face =
      pose === "walk" || pose === "hop"
        ? direction === "left"
          ? left
          : right
        : pose === "sleep"
          ? base
          : base;
    petText.textContent = face;
    petText.dataset.pose = pose;
    petText.dataset.direction = direction;
  };

  const tick = (timestamp) => {
    if (!ready) {
      state.lastTick = timestamp;
      requestAnimationFrame(tick);
      return;
    }
    const dt = (timestamp - state.lastTick) / 1000;
    state.lastTick = timestamp;
    state.viewportWidth = window.innerWidth;

    // Sleep detection
    if (
      settings.reactions.sleepOnIdle &&
      !state.sleeping &&
      timestamp - state.lastInteraction > settings.idleSleepMs
    ) {
      enterSleep();
    }

    const nearCursor =
      settings.reactions.followNear &&
      state.cursor.x !== null &&
      Math.abs(state.cursor.x - state.x) < settings.followDistance;

    if (state.sleeping && nearCursor) {
      wakeUp();
    }

    // Recalculate targets when needed
    if (!state.sleeping) {
      if (nearCursor) {
        state.targetX = clamp(
          state.cursor.x - settings.size * 0.3,
          4,
          state.viewportWidth - settings.size - 4
        );
      } else if (timestamp > state.pausedUntil || Math.abs(state.targetX - state.x) < 2) {
        pickWanderTarget();
      }
    }

    const speed = nearCursor ? settings.followSpeed : settings.wanderSpeed;
    const maxMove = speed * dt;
    const dx = state.sleeping ? 0 : clamp(state.targetX - state.x, -maxMove, maxMove);
    state.x = clamp(state.x + dx, 4, state.viewportWidth - settings.size - 4);

    if (Math.abs(dx) > 0.3) {
      state.direction = dx < 0 ? "left" : "right";
    }

    const pose = chooseFrame(Math.abs(dx) > 0.6 && !state.sleeping);
    if (pose !== state.pose || petText.dataset.direction !== state.direction) {
      state.pose = pose;
      renderKamoji(pose, state.direction);
    }
    petWrapper.style.transform = `translate3d(${state.x}px, 0, 0)`;

    requestAnimationFrame(tick);
  };

  const attachEvents = () => {
    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", () => {
      state.viewportWidth = window.innerWidth;
      state.x = clamp(state.x, 4, state.viewportWidth - settings.size - 4);
    });
    petText.addEventListener("click", handlePetClick);
  };

  const handleMessages = () => {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "refresh-page-pet") {
        loadSettings();
        sendResponse?.({ ok: true });
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes[STORAGE_KEY]) {
        settings = deepMerge(defaultSettings, changes[STORAGE_KEY].newValue || {});
        applySettings();
      }
    });
  };

  const init = async () => {
    initDom();
    await loadKamojiList();
    attachEvents();
    handleMessages();
    await loadSettings();
    ready = true;
    renderKamoji("idle", state.direction);
    pickWanderTarget();
    requestAnimationFrame(tick);
  };

  init();
})();
