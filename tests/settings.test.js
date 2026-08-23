import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_POINT_METHODS,
  activateActionPointSettingVisibility,
  getActionPointRules,
  getCultureAllocationRules,
  getProfessionAllocationRules,
  getSocialClassMethod,
  getSystemSetting,
  registerSystemSettings,
  SETTING_KEYS,
  SOCIAL_CLASS_METHODS,
  setSystemSetting,
  SYSTEM_ID,
  SYSTEM_SETTING_DEFINITIONS
} from "../scripts/settings.js";

test("registra todas las opciones del sistema con claves centralizadas", () => {
  const registrations = [];
  const settings = {
    register: (namespace, key, options) => registrations.push({ namespace, key, options })
  };

  registerSystemSettings(settings);

  assert.equal(registrations.length, SYSTEM_SETTING_DEFINITIONS.length);
  assert.equal(registrations[0].namespace, SYSTEM_ID);
  assert.equal(registrations[0].key, SETTING_KEYS.actionPointMethod);
  assert.equal(registrations[0].options.scope, "world");
  assert.equal(registrations[0].options.config, true);
  assert.equal(registrations[1].key, SETTING_KEYS.actionPointFixedValue);
  assert.deepEqual(registrations[1].options.range, { min: 1, max: 5, step: 1 });
  const minimum = registrations.find(({ key }) => key === SETTING_KEYS.culturePointMinimum);
  const maximum = registrations.find(({ key }) => key === SETTING_KEYS.culturePointMaximum);
  assert.deepEqual(minimum.options.range, { min: 0, max: 100, step: 1 });
  assert.deepEqual(maximum.options.range, { min: 1, max: 100, step: 1 });
  const professionMinimum = registrations.find(
    ({ key }) => key === SETTING_KEYS.professionPointMinimum);
  const professionMaximum = registrations.find(
    ({ key }) => key === SETTING_KEYS.professionPointMaximum);
  assert.equal(professionMinimum.options.default, 0);
  assert.equal(professionMaximum.options.default, 15);
  const socialClassMethod = registrations.find(
    ({ key }) => key === SETTING_KEYS.socialClassMethod);
  assert.equal(socialClassMethod.options.default, SOCIAL_CLASS_METHODS.choose);
  const detailedReach = registrations.find(({ key }) => key === SETTING_KEYS.detailedReach);
  assert.equal(detailedReach.options.default, true);
  assert.equal(detailedReach.options.requiresReload, false);
  const passiveBlockContiguity = registrations.find(
    ({ key }) => key === SETTING_KEYS.passiveBlockContiguity);
  assert.equal(passiveBlockContiguity.options.default, false);
  assert.equal(passiveBlockContiguity.options.requiresReload, false);
  const catalogSources = registrations.find(
    ({ key }) => key === SETTING_KEYS.catalogSources);
  assert.deepEqual(catalogSources.options.default, { version: 1, packIds: [] });
  assert.equal(catalogSources.options.config, false);
});

test("entrega a Foundry definiciones mutables sin alterar el catálogo", () => {
  const settings = {
    register: (namespace, key, options) => {
      options.namespace = namespace;
      options.key = key;
      options.id = `${namespace}.${key}`;
    }
  };

  assert.doesNotThrow(() => registerSystemSettings(settings));
  assert.ok(SYSTEM_SETTING_DEFINITIONS.every(({ options }) => (
    !("namespace" in options) && !("key" in options) && !("id" in options)
  )));
});

test("compone y normaliza los límites de puntos profesionales", () => {
  const values = new Map([
    [`${SYSTEM_ID}.${SETTING_KEYS.professionPointMinimum}`, 0],
    [`${SYSTEM_ID}.${SETTING_KEYS.professionPointMaximum}`, 15]
  ]);
  const settings = { get: (namespace, key) => values.get(`${namespace}.${key}`) };
  assert.deepEqual(getProfessionAllocationRules(settings), { minimum: 0, maximum: 15 });
  values.set(`${SYSTEM_ID}.${SETTING_KEYS.professionPointMinimum}`, 25);
  assert.deepEqual(getProfessionAllocationRules(settings), { minimum: 15, maximum: 15 });
});

test("la clase social se elige por defecto y admite modo aleatorio", () => {
  const values = new Map([
    [`${SYSTEM_ID}.${SETTING_KEYS.socialClassMethod}`, SOCIAL_CLASS_METHODS.random]
  ]);
  const settings = { get: (namespace, key) => values.get(`${namespace}.${key}`) };
  assert.equal(getSocialClassMethod(settings), SOCIAL_CLASS_METHODS.random);
  values.clear();
  assert.equal(getSocialClassMethod(settings), SOCIAL_CLASS_METHODS.choose);
});

test("compone las reglas de puntos de acción desde los ajustes del mundo", () => {
  const values = new Map([
    [`${SYSTEM_ID}.${SETTING_KEYS.actionPointMethod}`, ACTION_POINT_METHODS.calculated],
    [`${SYSTEM_ID}.${SETTING_KEYS.actionPointFixedValue}`, 3]
  ]);
  const settings = {
    get: (namespace, key) => values.get(`${namespace}.${key}`)
  };

  assert.deepEqual(getActionPointRules(settings), {
    method: ACTION_POINT_METHODS.calculated,
    fixedValue: 3
  });
});

test("compone y normaliza los límites de puntos culturales", () => {
  const values = new Map([
    [`${SYSTEM_ID}.${SETTING_KEYS.culturePointMinimum}`, 5],
    [`${SYSTEM_ID}.${SETTING_KEYS.culturePointMaximum}`, 15]
  ]);
  const settings = { get: (namespace, key) => values.get(`${namespace}.${key}`) };
  assert.deepEqual(getCultureAllocationRules(settings), { minimum: 5, maximum: 15 });

  values.set(`${SYSTEM_ID}.${SETTING_KEYS.culturePointMinimum}`, 20);
  assert.deepEqual(getCultureAllocationRules(settings), { minimum: 15, maximum: 15 });
});

test("solo muestra el valor fijo cuando se selecciona ese método", () => {
  const listeners = {};
  const method = {
    value: ACTION_POINT_METHODS.calculated,
    addEventListener: (event, listener) => { listeners[event] = listener; }
  };
  const group = { hidden: false, style: { display: "" } };
  const fixedValue = { closest: () => group };
  const root = {
    querySelector: (selector) => selector.includes(SETTING_KEYS.actionPointMethod)
      ? method : fixedValue
  };

  activateActionPointSettingVisibility(root);
  assert.equal(group.hidden, true);
  assert.equal(group.style.display, "none");

  method.value = ACTION_POINT_METHODS.fixed;
  listeners.change();
  assert.equal(group.hidden, false);
  assert.equal(group.style.display, "");
});

test("lee y escribe opciones usando siempre el identificador del sistema", async () => {
  const calls = [];
  const settings = {
    get: (namespace, key) => ({ namespace, key }),
    set: async (namespace, key, value) => calls.push({ namespace, key, value })
  };

  assert.deepEqual(getSystemSetting(SETTING_KEYS.parties, settings), {
    namespace: SYSTEM_ID,
    key: SETTING_KEYS.parties
  });

  const value = { version: 1, activePartyId: "", parties: [] };
  await setSystemSetting(SETTING_KEYS.parties, value, settings);
  assert.deepEqual(calls, [{ namespace: SYSTEM_ID, key: SETTING_KEYS.parties, value }]);
});

test("usa valores seguros antes de que Foundry permita leer ajustes", () => {
  const unavailableSettings = {
    get: () => { throw new Error("Settings are not available before setup"); }
  };

  assert.deepEqual(getActionPointRules(unavailableSettings), {
    method: ACTION_POINT_METHODS.fixed,
    fixedValue: 2
  });
  assert.deepEqual(getCultureAllocationRules(unavailableSettings), {
    minimum: 5,
    maximum: 15
  });
  assert.equal(getSocialClassMethod(unavailableSettings), SOCIAL_CLASS_METHODS.choose);
});
