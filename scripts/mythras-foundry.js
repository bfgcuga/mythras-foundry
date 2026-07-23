import { CharacterData } from "./data/character-data.js";
import { CharacterSheet } from "./sheets/character-sheet.js";

Hooks.once("init", () => {
  console.log("Mythras Foundry | Inicializando sistema");

  CONFIG.Actor.dataModels.character = CharacterData;

  foundry.documents.collections.Actors.registerSheet(
    "mythras-foundry",
    CharacterSheet,
    {
      types: ["character"],
      makeDefault: true,
      label: "Hoja de personaje de Mythras"
    }
  );
});