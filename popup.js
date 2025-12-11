const STORAGE_KEY = "pagePetCatSettings";

const defaultSettings = {
  size: 32,
  wanderSpeed: 55,
  followSpeed: 110,
  followDistance: 140,
  idleSleepMs: 20000,
  reactions: {
    followNear: true,
    hopOnPet: true,
    sleepOnIdle: true
  }
};

let settings = { ...defaultSettings };

const el = (id) => document.getElementById(id);

const merge = (base, incoming) => {
  const next = { ...base };
  Object.keys(incoming || {}).forEach((key) => {
    const value = incoming[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      next[key] = merge(base[key] || {}, value);
    } else {
      next[key] = value;
    }
  });
  return next;
};

const fields = {
  followNear: el("followNear"),
  hopOnPet: el("hopOnPet"),
  sleepOnIdle: el("sleepOnIdle"),
  wanderSpeed: el("wanderSpeed"),
  followDistance: el("followDistance"),
  size: el("size")
};

const valueLabels = {
  wanderSpeedValue: el("wanderSpeedValue"),
  followDistanceValue: el("followDistanceValue"),
  sizeValue: el("sizeValue")
};

const formatValues = () => {
  valueLabels.wanderSpeedValue.textContent = `${settings.wanderSpeed} px/s`;
  valueLabels.followDistanceValue.textContent = `${settings.followDistance} px`;
  valueLabels.sizeValue.textContent = `${settings.size} px`;
};

const render = () => {
  fields.followNear.checked = settings.reactions.followNear;
  fields.hopOnPet.checked = settings.reactions.hopOnPet;
  fields.sleepOnIdle.checked = settings.reactions.sleepOnIdle;
  fields.wanderSpeed.value = settings.wanderSpeed;
  fields.followDistance.value = settings.followDistance;
  fields.size.value = settings.size;
  formatValues();
};

const load = async () => {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  settings = merge(defaultSettings, result[STORAGE_KEY] || {});
  render();
};

const save = async () => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  chrome.runtime.sendMessage({ type: "refresh-page-pet" }).catch(() => {});
  const status = document.getElementById("status");
  status.textContent = "Saved";
  setTimeout(() => (status.textContent = ""), 1200);
};

const wireInputs = () => {
  fields.followNear.addEventListener("change", (e) => {
    settings.reactions.followNear = e.target.checked;
    save();
  });
  fields.hopOnPet.addEventListener("change", (e) => {
    settings.reactions.hopOnPet = e.target.checked;
    save();
  });
  fields.sleepOnIdle.addEventListener("change", (e) => {
    settings.reactions.sleepOnIdle = e.target.checked;
    save();
  });
  fields.wanderSpeed.addEventListener("input", (e) => {
    settings.wanderSpeed = Number(e.target.value);
    formatValues();
  });
  fields.wanderSpeed.addEventListener("change", save);
  fields.followDistance.addEventListener("input", (e) => {
    settings.followDistance = Number(e.target.value);
    formatValues();
  });
  fields.followDistance.addEventListener("change", save);
  fields.size.addEventListener("input", (e) => {
    settings.size = Number(e.target.value);
    formatValues();
  });
  fields.size.addEventListener("change", save);

  document.getElementById("reset").addEventListener("click", async () => {
    settings = { ...defaultSettings };
    render();
    await save();
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  await load();
  wireInputs();
});
