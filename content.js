(() => {
  if (window.__pagePetCatInjected) return;
  window.__pagePetCatInjected = true;

  const STORAGE_KEY = "pagePetCatSettings";
  const defaultSettings = {
    size: 32,
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

  const frames = {
    idle: chrome.runtime.getURL("assets/cat_idle.png"),
    walk: chrome.runtime.getURL("assets/cat_walk.png"),
    hop: chrome.runtime.getURL("assets/cat_walk.png"),
    sleep: chrome.runtime.getURL("assets/cat_sleep.png")
  };

  const state = {
    x: 0,
    targetX: 0,
    pausedUntil: 0,
    sleeping: false,
    hopUntil: 0,
    lastInteraction: performance.now(),
    cursor: { x: null, y: null },
    viewportWidth: window.innerWidth,
    lastTick: performance.now()
  };

  let settings = { ...defaultSettings };
  let container;
  let petWrapper;
  let petImg;
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
    if (!container || !petImg || !petWrapper) return;
    petImg.style.width = `${settings.size}px`;
    petImg.style.height = `${settings.size}px`;
    container.style.height = `${settings.size + 24}px`;
    state.x = clamp(
      state.x || window.innerWidth * 0.5,
      4,
      window.innerWidth - settings.size - 4
    );
    petWrapper.style.bottom = "8px";
  };

  const initDom = () => {
    container = document.createElement("div");
    container.id = "page-pet-cat-container";
    petWrapper = document.createElement("div");
    petWrapper.className = "page-pet-cat-wrapper";
    petImg = document.createElement("img");
    petImg.className = "page-pet-cat";
    petImg.alt = "Little cat";
    petImg.src = frames.idle;
    petImg.draggable = false;
    petImg.setAttribute("aria-hidden", "true");
    petWrapper.appendChild(petImg);
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
    petImg.src = frames.idle;
  };

  const enterSleep = () => {
    state.sleeping = true;
    petWrapper.classList.remove("page-pet-hop");
    petWrapper.classList.add("page-pet-sleep");
    petImg.src = frames.sleep;
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
    if (state.sleeping) {
      petImg.src = frames.sleep;
      return;
    }
    if (state.hopUntil > performance.now()) {
      petImg.src = frames.hop;
      return;
    }
    petImg.src = moving ? frames.walk : frames.idle;
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

    chooseFrame(Math.abs(dx) > 0.6 && !state.sleeping);
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
    petImg.addEventListener("click", handlePetClick);
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
    attachEvents();
    handleMessages();
    await loadSettings();
    ready = true;
    pickWanderTarget();
    requestAnimationFrame(tick);
  };

  init();
})();
