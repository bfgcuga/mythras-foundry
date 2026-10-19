import test from "node:test";
import assert from "node:assert/strict";
import { installHost, render } from "./helpers/ui.js";
import { npcNoteText, npcNoteChanges } from "../scripts/ui/npc-notes.js";

test("las notas del PNJ muestran párrafos sin etiquetas y conservan el HTML al editar otros campos", t => {
  const { document } = installHost(t);
  const system = { magicNotes: "<p>Ninguna</p>", description: "<p>Fuente: Mythras básico revisado, pág. 270.</p><p>Movimiento: 6m, 10m (volando). Rasgos: Apresar &amp; Volador.</p>" };
  const noteText = Object.fromEntries(Object.entries(system).map(([key,value]) => [key,npcNoteText(value)]));
  document.body.innerHTML = render("templates/actor/npc-sheet.hbs", {actor:{system},noteText,visibility:{full:true},editable:true});
  assert.equal(document.querySelector('[name="system.magicNotes"]').value,"Ninguna");
  assert.equal(document.querySelector('[name="system.description"]').value,"Fuente: Mythras básico revisado, pág. 270.\nMovimiento: 6m, 10m (volando). Rasgos: Apresar & Volador.");
  assert.deepEqual(npcNoteChanges(system, {"system.magicNotes":noteText.magicNotes,"system.description":noteText.description,"system.strength":17}),{"system.strength":17});
  assert.deepEqual(npcNoteChanges(system, {"system.magicNotes":"Magia nueva"}),{"system.magicNotes":"Magia nueva"});
  assert.equal(npcNoteText("Daño < 3; @UUID[Actor.foo]"),"Daño < 3; @UUID[Actor.foo]");
});
