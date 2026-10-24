import { AMMUNITION_PACKS, modeAmmunition, count } from "./ammunition.js";
import { AMMUNITION_SOURCES } from "../data/equipment.js";
import { WEAPON_SOURCES } from "../data/weapons.js";

export function ammunitionPackage(source) {
  const system = source.system ?? {};
  const official = source.flags?.["mythras-foundry"]?.source === "mythras-basic-revised"
    ? AMMUNITION_SOURCES.find(item => item.img === source.img) : null;
  const key = source.buildKey || system.ammunitionProfile || official?.buildKey || "";
  return AMMUNITION_PACKS[key] ?? (system.ammoType ? {
    ammoType: system.ammoType, packageSize: Math.max(1, count(system.packageSize)),
    unitName: system.unitName || source.name, thrownProfile: system.thrownProfile || ""
  } : null);
}
export function normalizeInventorySources(sources) {
  return sources.flatMap(original => {
    const source = structuredClone(original); const system = source.system ??= {};
    if (source.type === "equipment" && system.category === "ammunition" && !system.ammunitionUnitVersion) {
      const pack = ammunitionPackage(source);
      if (pack) {
        const units = count(system.quantity ?? 1) * pack.packageSize;
        const values = Object.fromEntries(["value", "weight", "cheapValue", "reasonableValue", "superiorValue"]
          .map(key => [key, Number(system[key] ?? 0) / pack.packageSize]));
        if (pack.thrownProfile) {
          const template = WEAPON_SOURCES.find(item => item.buildKey === pack.thrownProfile);
          if (!template) throw new Error(`Missing thrown profile: ${pack.thrownProfile}`);
          return Array.from({ length: units }, () => ({ ...structuredClone(template), name: pack.unitName,
            system: { ...structuredClone(template.system), ...values, quantity: 1, equipped: false,
              encumbrance: Number(system.weight ?? 0) / pack.packageSize, zeroEncumbranceUnits: pack.packageSize,
              parentContainerId: system.parentContainerId ?? "", ammunitionUnitVersion: 1 } }));
        }
        source.name = pack.unitName;
        Object.assign(system, pack, values, { quantity: units, packageSize: 1, zeroEncumbranceUnits: pack.packageSize, ammunitionUnitVersion: 1 });
      }
    }
    if (source.type === "weapon" && system.modes?.some(mode => modeAmmunition(source, mode).use === "thrown")
      && count(system.quantity ?? 1) > 1) {
      return Array.from({ length: count(system.quantity) }, () => {
        const copy = structuredClone(source); delete copy._id;
        copy.system.quantity = 1; copy.system.equipped = false;
        return copy;
      });
    }
    return [source];
  });
}
