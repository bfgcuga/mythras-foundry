import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareStatusCatalog, CORE_STATUS_IDS } from "../scripts/ui/status-catalog.js";
const es = JSON.parse(readFileSync(new URL("../lang/es.json", import.meta.url)));
const i18n = { lang: "es", localize: (key) => es[key] ?? key };

test("mezcla estados básicos, Mythras y módulos por su nombre castellano sin perder datos", () => {
  const input = [
    { id: "poison", name: "Poisoned", img: "poison.svg", changes: [{ key: "x" }] },
    { id: "prone", name: "MYTHRASF.Status.Prone" },
    { id: "custom", name: "Ágil" },
    { id: "disease", name: "Diseased" }
  ];
  const result = prepareStatusCatalog(input, i18n);
  assert.deepEqual(result.map((s) => s.id), ["custom", "prone", "disease", "poison"]);
  assert.equal(result[3].img, "systems/mythras-foundry/assets/icons/statuses/poison.png");
  assert.deepEqual(result[3].changes, input[0].changes);
  assert.equal(input[0].name, "Poisoned");
});

test("conserva formato objeto y las etiquetas propias del sistema", () => {
  const result = prepareStatusCatalog({ poison: { name: "Poisoned" },
    dead: { name: "MYTHRASF.Status.Waiting" } }, i18n);
  assert.deepEqual(Object.keys(result), ["poison", "dead"]);
  assert.equal(result.dead.name, "MYTHRASF.Status.Waiting");
});

test("todos los nombres básicos tienen traducción española e inglesa", () => {
  const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url)));
  for (const id of CORE_STATUS_IDS) {
    assert.ok(es[`MYTHRASF.CoreStatus.${id}`], id);
    assert.ok(en[`MYTHRASF.CoreStatus.${id}`], id);
  }
});

test("traduce los identificadores de escudo en minúsculas de Foundry", () => {
  const [status] = prepareStatusCatalog([{ id: "shieldfire", name: "Fire Shield" }], i18n);
  assert.equal(i18n.localize(status.name), "Escudo de fuego");
});

test("traduce y asigna iconos a variantes de identificador y etiquetas básicas de Foundry", () => {
  const input = [
    { id: "sleep", name: "EFFECT.StatusAsleep" },
    { id: "frozen", name: "EFFECT.StatusFrozen" },
    { id: "upgrade", name: "EFFECT.StatusEmpowered" },
    { id: "downgrade", name: "EFFECT.StatusWeakened" },
    { id: "legacy-mark", name: "EFFECT.StatusMarked" }
  ];
  const output = prepareStatusCatalog(input, i18n);
  for (const [id, label, icon] of [
    ["sleep", "Dormido", "asleep"], ["frozen", "Congelado", "cold"],
    ["upgrade", "Potenciado", "empower"], ["downgrade", "Debilitado", "weaken"],
    ["legacy-mark", "Marcado", "mark"]
  ]) {
    const status = output.find((entry) => entry.id === id);
    assert.equal(i18n.localize(status.name), label);
    assert.equal(status.img, `systems/mythras-foundry/assets/icons/statuses/${icon}.png`);
  }
});
