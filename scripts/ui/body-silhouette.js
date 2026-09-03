import { hitLocationDisplayName, humanArmorFactors, isLocationCrippled, isLocationDisabled,
  locationWoundState } from "../rules/hit-locations.js";
import { totalArmorPoints, wornArmorPoints } from "../rules/armor.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "../rules/timed-conditions.js";
import { activateDelayedTooltips } from "./tooltips.js";
import { getSystemSetting, SETTING_KEYS, SILHOUETTE_ORIENTATIONS } from "../settings.js";

const SVG_PATH = "systems/mythras-foundry/assets/Silueta/Silueta.svg";
const REGION_IDS = Object.freeze({ head: "head", chest: "chest", abdomen: "abdomen",
  leftArm: "left-arm", rightArm: "right-arm", leftLeg: "left-leg", rightLeg: "right-leg" });
let silhouetteText;

export function silhouetteRegionId(nameKey, orientation = SILHOUETTE_ORIENTATIONS.front) {
  if (orientation !== SILHOUETTE_ORIENTATIONS.front) return REGION_IDS[nameKey] ?? "";
  const mirrored = { leftArm: "rightArm", rightArm: "leftArm",
    leftLeg: "rightLeg", rightLeg: "leftLeg" };
  return REGION_IDS[mirrored[nameKey] ?? nameKey] ?? "";
}

async function svgText() {
  silhouetteText ??= fetch(SVG_PATH).then((response) => {
    if (!response.ok) throw new Error(`Unable to load silhouette (${response.status})`);
    return response.text();
  });
  return silhouetteText;
}

function linkedConditions(actor, location) {
  return Array.from(actor.effects ?? []).map((effect) => ({ effect,
    timed: effect.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG) }))
    .filter(({ timed }) => timed?.locationId === location.id)
    .map(({ effect }) => effect.name).filter(Boolean);
}

function tooltip(actor, location, armors) {
  const system = location.system;
  const natural = Math.max(0, Number(system.armorPoints ?? 0));
  const worn = wornArmorPoints(location, armors);
  const level = locationWoundState(location);
  const conditions = linkedConditions(actor, location);
  return [hitLocationDisplayName(location),
    game.i18n.format("MYTHRASF.Silhouette.HitPoints", { current: system.currentHitPoints,
      maximum: system.maxHitPoints }),
    game.i18n.format("MYTHRASF.Silhouette.Armor", { natural, worn,
      total: totalArmorPoints(location, armors) }),
    game.i18n.format("MYTHRASF.Silhouette.Wound", { wound: game.i18n.localize(`MYTHRASF.Wound.${level}`) }),
    isLocationDisabled(location) ? game.i18n.localize("MYTHRASF.HitLocation.Disabled") : "",
    isLocationCrippled(location)
      ? game.i18n.localize("MYTHRASF.HitLocation.Crippled") : "",
    conditions.length ? conditions.join(", ") : ""].filter(Boolean).join(" · ");
}

export async function renderBodySilhouette(actor, root) {
  const container = root?.querySelector?.("[data-body-silhouette]");
  if (!container) return;
  try { container.innerHTML = await svgText(); }
  catch (error) { console.warn("Mythras Foundry | Silhouette unavailable", error); return; }
  const locations = actor.system.morphologyKey === "humanoid"
    ? actor.items.filter((item) => item.type === "hitLocation") : [];
  const armors = actor.items.filter((item) => item.type === "armor" && item.system.equipped);
  const orientation = getSystemSetting(SETTING_KEYS.silhouetteOrientation);
  const byRegion = new Map(locations.map((location) => {
    const factor = humanArmorFactors(location);
    return [factor ? silhouetteRegionId(factor.nameKey, orientation) : "", location];
  }).filter(([id]) => id));
  for (const id of Object.values(REGION_IDS)) {
    const region = container.querySelector(`#${id}`);
    if (!region) continue;
    region.classList.remove("state-none", "state-light", "state-serious", "state-grave");
    const location = byRegion.get(id);
    region.setAttribute("role", location ? "button" : "img");
    region.setAttribute("tabindex", location ? "0" : "-1");
    if (!location) {
      region.classList.add("body-location--unbound");
      region.dataset.mythrasTooltip = game.i18n.localize("MYTHRASF.Silhouette.Unbound");
      continue;
    }
    const level = locationWoundState(location);
    const crippledWithoutWound = level === "healthy" && isLocationCrippled(location);
    region.classList.add(crippledWithoutWound ? "body-location--crippled"
      : `body-location--${level}`);
    const label = tooltip(actor, location, armors);
    region.setAttribute("aria-label", label);
    region.dataset.mythrasTooltip = label;
    const open = (event) => {
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault(); location.sheet.render({ force: true });
    };
    region.addEventListener("click", open); region.addEventListener("keydown", open);
  }
  activateDelayedTooltips(container);
}
