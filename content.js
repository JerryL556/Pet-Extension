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

  const palette = {
    ".": null,
    "1": "#0f172a",
    "2": "#1f2937",
    "3": "#374151",
    "4": "#e6d8c8",
    "5": "#fefefe",
    "6": "#f59e0b"
  };

  const buildFrame = (lines) =>
    lines.map((row) => row.split("").map((ch) => palette[ch] || null));

  const pixelFrames = {
    idle: [
      buildFrame([
        "..11..11........",
        ".111111111......",
        ".133333331......",
        ".133333331......",
        ".133333331......",
        ".113333311......",
        "..33333331.11...",
        ".333333333111...",
        ".3333333331.11..",
        ".3333333331.....",
        ".3333333331.....",
        "1111....1111....",
        "11......11......",
        "................",
        "................",
        "................"
      ])
    ],
    walk: [
      buildFrame([
        "..11..11........",
        ".111111111......",
        ".133333331......",
        ".133333331......",
        ".133333331......",
        ".113333311......",
        "..33333331.11...",
        ".333333333111...",
        ".3333333331.11..",
        ".3333333331.....",
        ".3333333331.....",
        "1111....1.11....",
        "11......1.......",
        "................",
        "................",
        "................"
      ]),
      buildFrame([
        "..11..11........",
        ".111111111......",
        ".133333331......",
        ".133333331......",
        ".133333331......",
        ".113333311......",
        "..33333331.11...",
        ".333333333111...",
        ".3333333331.11..",
        ".3333333331.....",
        ".3333333331.....",
        "11..11..11......",
        "..11....11......",
        "................",
        "................",
        "................"
      ])
    ],
    hop: [
      buildFrame([
        "..11..11........",
        ".111111111......",
        ".133333331......",
        ".133333331......",
        ".133333331......",
        ".113333311......",
        "..33333331.11...",
        ".333333333111...",
        ".3333333331.11..",
        ".3333333331.....",
        "..33333331......",
        "...111111.......",
        "...11..11.......",
        "................",
        "................",
        "................"
      ]),
      buildFrame([
        "..11..11........",
        ".111111111......",
        ".133333331......",
        ".133333331......",
        ".133333331......",
        ".113333311......",
        "..33333331.11...",
        ".333333333111...",
        ".3333333331.11..",
        ".3333333331.....",
        "...333331.......",
        "....1111........",
        "....11..........",
        "................",
        "................",
        "................"
      ])
    ],
    sleep: [
      buildFrame([
        "................",
        "...11111........",
        "..1333331.......",
        ".133333331......",
        ".1333333331.....",
        "..1333333331....",
        "...133333331....",
        "....1333331.....",
        ".....13331......",
        ".....1111......1",
        "...........1111.",
        "................",
        "................",
        "................",
        "................",
        "................"
      ])
    ]
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
    lastTick: performance.now(),
    pose: "idle",
    frameIndex: 0,
    lastFrameChange: performance.now()
  };

  let settings = { ...defaultSettings };
  let container;
  let petWrapper;
  let petCanvas;
  let ctx;
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
    if (!container || !petCanvas || !petWrapper) return;
    petCanvas.width = settings.size;
    petCanvas.height = settings.size;
    petCanvas.style.width = `${settings.size}px`;
    petCanvas.style.height = `${settings.size}px`;
    container.style.height = `${settings.size + 24}px`;
    state.x = clamp(
      state.x || window.innerWidth * 0.5,
      4,
      window.innerWidth - settings.size - 4
    );
    petWrapper.style.bottom = "8px";
    if (ctx) {
      drawFrame(state.pose || "idle");
    }
  };

  const initDom = () => {
    container = document.createElement("div");
    container.id = "page-pet-cat-container";
    petWrapper = document.createElement("div");
    petWrapper.className = "page-pet-cat-wrapper";
    petCanvas = document.createElement("canvas");
    petCanvas.className = "page-pet-cat";
    petCanvas.width = settings.size;
    petCanvas.height = settings.size;
    petCanvas.setAttribute("aria-hidden", "true");
    petCanvas.draggable = false;
    ctx = petCanvas.getContext("2d");
    petWrapper.appendChild(petCanvas);
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
    state.frameIndex = 0;
    state.lastFrameChange = performance.now();
    drawFrame("idle");
  };

  const enterSleep = () => {
    state.sleeping = true;
    petWrapper.classList.remove("page-pet-hop");
    petWrapper.classList.add("page-pet-sleep");
    state.pose = "sleep";
    state.frameIndex = 0;
    state.lastFrameChange = performance.now();
    drawFrame("sleep");
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

  const drawFrame = (pose) => {
    if (!ctx || !petCanvas) return;
    const frames = pixelFrames[pose] || pixelFrames.idle;
    const frame = frames[state.frameIndex % frames.length];
    if (!frame) return;

    const baseSize = frame.length;
    const scale = settings.size / baseSize;
    ctx.clearRect(0, 0, petCanvas.width, petCanvas.height);
    frame.forEach((row, y) => {
      row.forEach((color, x) => {
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      });
    });
  };

  const updateAnimation = (pose, timestamp) => {
    const frameSet = pixelFrames[pose] || pixelFrames.idle;
    const durations = { walk: 160, hop: 140, idle: 420, sleep: 650 };
    const frameDuration = durations[pose] || 220;
    let needsDraw = false;

    if (pose !== state.pose) {
      state.pose = pose;
      state.frameIndex = 0;
      state.lastFrameChange = timestamp;
      needsDraw = true;
    } else if (frameSet.length > 1 && timestamp - state.lastFrameChange > frameDuration) {
      state.frameIndex = (state.frameIndex + 1) % frameSet.length;
      state.lastFrameChange = timestamp;
      needsDraw = true;
    }

    if (needsDraw) {
      drawFrame(pose);
    }
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

    const pose = chooseFrame(Math.abs(dx) > 0.6 && !state.sleeping);
    updateAnimation(pose, timestamp);
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
    petCanvas.addEventListener("click", handlePetClick);
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
    drawFrame("idle");
    pickWanderTarget();
    requestAnimationFrame(tick);
  };

  init();
})();
