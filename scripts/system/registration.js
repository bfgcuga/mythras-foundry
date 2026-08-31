import { CharacterData } from "../data/character-data.js";
import { NpcData } from "../data/npc-data.js";
import { BackgroundData, ArmorData, CombatEffectData, CombatStyleData, EquipmentData, HitLocationData,
  PassionData, SkillData, TraitData, WeaponData } from "../data/item-data.js";
import { MythrasItem } from "../documents/mythras-item.js";
import { MythrasActor } from "../documents/mythras-actor.js";
import { isCombatCoordinator, MythrasCombat } from "../documents/mythras-combat.js";
import { CharacterSheet } from "../sheets/character-sheet.js";
import { NpcSheet } from "../sheets/npc-sheet.js";
import { MythrasItemSheet } from "../sheets/item-sheet.js";
import { WeaponModeMergeTool } from "../apps/weapon-mode-merge-tool.js";
import { PartyManager } from "../apps/party-manager.js";
import { CatalogSourceManager } from "../apps/catalog-source-manager.js";
import { HomebrewItemCreator, createHomebrewApi } from "../apps/homebrew-item-creator.js";
import { createCatalogApi } from "../apps/item-catalog.js";
import { createPartyApi } from "../api/party-api.js";
import { registerSystemSettings, getSystemSetting, SETTING_KEYS } from "../settings.js";
import { INCAPACITATED_STATUS_ID } from "../rules/incapacitated.js";
import { MYTHRAS_STATUS_EFFECTS } from "../rules/statuses.js";
import { hasTrait, registerTraitRule, resolveTraitRules, traitReferences,
  unregisterTraitRule } from "../rules/traits.js";
import { openTacticalOverview, requestReachChange } from "../rules/reach-chat.js";
import { openCoverDeclaration } from "../rules/engagement-runtime.js";
import { openPassiveBlockDeclaration } from "../rules/round-consequences.js";
import { declareAim, reloadRangedWeapon } from "../rules/ranged-actions.js";
import { actionAvailability, actionPresentation, combatActionState,
  requestCombatAction } from "../rules/combat-action-runtime.js";
import { createHazardsApi } from "../rules/acid.js";
import { createFireApi } from "../rules/fire.js";
import { createFallApi } from "../rules/fall.js";
import { createSuffocationApi } from "../rules/suffocation.js";
import { createFatigueCheckApi } from "../rules/fatigue-check-chat.js";
import { createExsanguinationApi } from "../rules/exsanguination.js";
import { createDyingApi } from "../rules/dying.js";
import { createDirectDamageApi } from "../rules/direct-damage.js";
import { createStatusAssignmentApi } from "../rules/status-assignment.js";
import { createDiceApi } from "../rules/system-roll.js";

const PARTIALS = [
  "systems/mythras-foundry/templates/actor/parts/background-wizard.hbs",
  "systems/mythras-foundry/templates/actor/parts/characteristics.hbs",
  "systems/mythras-foundry/templates/actor/parts/combat-tab.hbs",
  "systems/mythras-foundry/templates/actor/parts/fatigue-table.hbs",
  "systems/mythras-foundry/templates/actor/parts/hit-location-table.hbs",
  "systems/mythras-foundry/templates/actor/parts/inventory-list.hbs",
  "systems/mythras-foundry/templates/actor/parts/inventory-tab.hbs",
  "systems/mythras-foundry/templates/actor/parts/inventory-tree.hbs",
  "systems/mythras-foundry/templates/actor/parts/penalties-tab.hbs",
  "systems/mythras-foundry/templates/actor/parts/permanent-wounds.hbs",
  "systems/mythras-foundry/templates/actor/parts/narrative-tab.hbs",
  "systems/mythras-foundry/templates/actor/parts/skill-overview.hbs"
];

export function registerSystemInitialization() {
  Hooks.once("init", async () => {
    console.log("Mythras Foundry | Inicializando sistema");
    CONFIG.Actor.dataModels.character = CharacterData;
    CONFIG.Actor.dataModels.npc = NpcData;
    CONFIG.Actor.documentClass = MythrasActor;
    CONFIG.Combat.documentClass = MythrasCombat;
    const systemStatuses = [
      { id: INCAPACITATED_STATUS_ID, name: "MYTHRASF.Status.Incapacitated",
        img: "icons/svg/unconscious.svg" },
      ...MYTHRAS_STATUS_EFFECTS.map(({ id, name, img }) => ({ id, name, img }))
    ];
    for (const statusEffect of systemStatuses) {
      if (Array.isArray(CONFIG.statusEffects)) {
        const existing = CONFIG.statusEffects.findIndex((status) => status.id === statusEffect.id);
        if (existing >= 0) CONFIG.statusEffects[existing] = statusEffect;
        else CONFIG.statusEffects.push(statusEffect);
      } else CONFIG.statusEffects[statusEffect.id] = statusEffect;
    }
    CONFIG.Item.documentClass = MythrasItem;
    Object.assign(CONFIG.Item.dataModels, {
      skill: SkillData, combatStyle: CombatStyleData, culture: BackgroundData,
      profession: BackgroundData, equipment: EquipmentData, passion: PassionData,
      weapon: WeaponData, armor: ArmorData, hitLocation: HitLocationData, trait: TraitData,
      combatEffect: CombatEffectData
    });
    registerSystemSettings();
    game.settings.registerMenu("mythras-foundry", "partyManager", {
      name: "MYTHRASF.Party.Manager", label: "MYTHRASF.Party.ManagerOpen",
      hint: "MYTHRASF.Party.ManagerHint", icon: "fas fa-users", type: PartyManager,
      restricted: true
    });
    game.settings.registerMenu("mythras-foundry", "weaponModeMerge", {
      name: "MYTHRASF.Weapon.MergeTool", label: "MYTHRASF.Weapon.MergeTool",
      hint: "MYTHRASF.Weapon.MergeHelp", icon: "fas fa-object-group", type: WeaponModeMergeTool,
      restricted: true
    });
    game.settings.registerMenu("mythras-foundry", "catalogSources", {
      name: "MYTHRASF.Catalog.Sources.Title", label: "MYTHRASF.Catalog.Sources.OpenManager",
      hint: "MYTHRASF.Catalog.Sources.Hint", icon: "fas fa-store", type: CatalogSourceManager,
      restricted: true
    });
    game.settings.registerMenu("mythras-foundry", "homebrewItemCreator", {
      name: "MYTHRASF.Homebrew.Title", label: "MYTHRASF.Homebrew.Open",
      hint: "MYTHRASF.Homebrew.Hint", icon: "fas fa-hammer", type: HomebrewItemCreator,
      restricted: true
    });
    game.mythrasFoundry = {
      ...(game.mythrasFoundry ?? {}), shop: createCatalogApi(), homebrew: createHomebrewApi(),
      dice: createDiceApi(),
      party: createPartyApi({
        getConfig: () => getSystemSetting(SETTING_KEYS.parties), getActors: () => game.actors,
        openManager: () => {
          if (!game.user.isGM) return null;
          const manager = new PartyManager();
          manager.render({ force: true });
          return manager;
        }
      }),
      hazards: Object.freeze({ ...createHazardsApi(), damage: createDirectDamageApi(),
        fire: createFireApi(), fall: createFallApi(), suffocation: createSuffocationApi() }),
      fatigueChecks: createFatigueCheckApi(),
      conditions: Object.freeze({ exsanguination: createExsanguinationApi(),
        dying: createDyingApi(), statuses: createStatusAssignmentApi() }),
      traits: { has: hasTrait, list: traitReferences, resolveRules: resolveTraitRules,
        registerRule: registerTraitRule, unregisterRule: unregisterTraitRule },
      combat: { isCoordinator: isCombatCoordinator, changeReach: requestReachChange,
        openTacticalOverview, declarePassiveBlock: openPassiveBlockDeclaration,
        declareCover: openCoverDeclaration, aim: declareAim, reload: reloadRangedWeapon,
        action: requestCombatAction, availableActions: actionAvailability,
        actionPresentation,
        actionState: combatActionState }
    };
    foundry.documents.collections.Actors.registerSheet("mythras-foundry", CharacterSheet, {
      types: ["character"], makeDefault: true, label: "MYTHRASF.Sheet.Character"
    });
    foundry.documents.collections.Actors.registerSheet("mythras-foundry", NpcSheet, {
      types: ["npc"], makeDefault: true, label: "MYTHRASF.Sheet.Npc"
    });
    foundry.documents.collections.Items.registerSheet("mythras-foundry", MythrasItemSheet, {
      types: ["skill", "combatStyle", "culture", "profession", "passion", "equipment",
        "weapon", "armor", "hitLocation", "trait", "combatEffect"],
      makeDefault: true, label: "MYTHRASF.Sheet.Item"
    });
    await loadTemplates(PARTIALS);
  });
}
