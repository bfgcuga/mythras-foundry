import { CharacterData } from "./data/character-data.js";

Hooks.once("init", () => {
  console.log("Mythras Foundry | Inicializando sistema");

   CONFIG.Actor.dataModels.character = CharacterData;
});