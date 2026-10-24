import { normalizeInventorySources, ammunitionPackage } from "../rules/inventory-ammunition.js";
import { modeAmmunition, count } from "../rules/ammunition.js";
import { weaponModes } from "../rules/weapon-modes.js";

const SCOPE = "mythras-foundry";
export async function migrateActorAmmunition(actor) {
  for (const item of Array.from(actor.items)) {
    if (item.type !== "equipment" || item.system.category !== "ammunition" || item.system.ammunitionUnitVersion) continue;
    const source = item.toObject();
    if (!ammunitionPackage(source)) continue;
    const normalized = normalizeInventorySources([source]);
    if (normalized.length === 1 && normalized[0].type === "equipment") {
      await item.update({ name: normalized[0].name, system: normalized[0].system }, { mythrasAmmo: true });
    } else {
      // An interrupted conversion can resume without creating the same exemplars twice.
      const marker = `pack:${item.id}`;
      const existing = actor.items.filter(candidate => candidate.getFlag?.(SCOPE, "ammunitionOrigin") === marker);
      const missing = normalized.slice(existing.length).map(source => {
        delete source._id; source.flags = { ...source.flags, [SCOPE]: { ...source.flags?.[SCOPE], ammunitionOrigin: marker } }; return source;
      });
      if (missing.length) await actor.createEmbeddedDocuments("Item", missing);
      await actor.deleteEmbeddedDocuments("Item", [item.id]);
    }
  }
  for (const weapon of actor.items.filter(item => item.type === "weapon")) {
    const modes = [];
    for (const source of weaponModes(weapon)) {
      const mode = { ...source }; const inferred = modeAmmunition(weapon, mode);
      if (count(mode.ammunitionVersion) >= 1) { modes.push(mode); continue; }
      if ((inferred.use === "none" && !mode.ammoUse) || (inferred.use === "projectile" && !inferred.type)) { modes.push(mode); continue; }
      Object.assign(mode, { ammoUse: inferred.use, ammoType: inferred.type, reloadProgress: 0, ammunitionVersion: 1 });
      if (inferred.use === "projectile") {
        const quantity = count(mode.ammoReserve) + count(mode.ammoLoaded);
        if (!mode.ammoItemId && quantity > 0) {
          const marker = `${weapon.id}:${mode.key}`;
          let stock = actor.items.find(item => item.getFlag?.(SCOPE, "ammunitionOrigin") === marker);
          if (!stock) {
            const names = { arrow: "Flechas", bolt: "Virotes", sling: "Proyectiles de honda", blowgun: "Dardos de cerbatana", siege: "Proyectiles de asedio" };
            [stock] = await actor.createEmbeddedDocuments("Item", [{ name: names[inferred.type] || inferred.type,
              type: "equipment", img: "icons/svg/arrow.svg", system: { category: "ammunition", ammoType: inferred.type,
                quantity, packageSize: 1, ammunitionUnitVersion: 1, parentContainerId: weapon.system.parentContainerId || "" },
              flags: { [SCOPE]: { ammunitionOrigin: marker } } }]);
          }
          mode.ammoItemId = stock.id;
        }
        mode.ammoReserve = 0;
      }
      modes.push(mode);
    }
    if (JSON.stringify(modes) !== JSON.stringify(weaponModes(weapon))) await weapon.update({ "system.modes": modes }, { mythrasAmmo: true });
    if (count(weapon.system.quantity) > 1 && modes.some(mode => modeAmmunition(weapon, mode).use === "thrown")) {
      const total = count(weapon.system.quantity); const marker = `split:${weapon.id}`;
      const existing = actor.items.filter(item => item.getFlag?.(SCOPE, "ammunitionOrigin") === marker).length;
      const source = weapon.toObject(); delete source._id; source.system.quantity = 1; source.system.equipped = false;
      source.flags = { ...source.flags, [SCOPE]: { ...source.flags?.[SCOPE], ammunitionOrigin: marker } };
      if (total - 1 > existing) await actor.createEmbeddedDocuments("Item", Array.from({ length: total - 1 - existing }, () => structuredClone(source)));
      await weapon.update({ "system.quantity": 1 });
    }
  }
}
