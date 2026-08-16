export const SYSTEM_ID = "mythras-foundry";

export const SETTING_KEYS = Object.freeze({
  actionPointMethod: "actionPointMethod",
  actionPointFixedValue: "actionPointFixedValue",
  culturePointMinimum: "culturePointMinimum",
  culturePointMaximum: "culturePointMaximum",
  professionPointMinimum: "professionPointMinimum",
  professionPointMaximum: "professionPointMaximum",
  socialClassMethod: "socialClassMethod",
  detailedReach: "detailedReach",
  catalogSources: "catalogSources",
  parties: "parties"
});

export const ACTION_POINT_METHODS = Object.freeze({
  calculated: "calculated",
  fixed: "fixed"
});

export const SOCIAL_CLASS_METHODS = Object.freeze({
  choose: "choose",
  random: "random"
});

export const SYSTEM_SETTING_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: SETTING_KEYS.actionPointMethod,
    options: Object.freeze({
      name: "MYTHRASF.Settings.ActionPoints.Method.Name",
      hint: "MYTHRASF.Settings.ActionPoints.Method.Hint",
      scope: "world",
      config: true,
      type: String,
      choices: Object.freeze({
        [ACTION_POINT_METHODS.calculated]:
          "MYTHRASF.Settings.ActionPoints.Method.Calculated",
        [ACTION_POINT_METHODS.fixed]: "MYTHRASF.Settings.ActionPoints.Method.Fixed"
      }),
      default: ACTION_POINT_METHODS.fixed,
      requiresReload: true
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.actionPointFixedValue,
    options: Object.freeze({
      name: "MYTHRASF.Settings.ActionPoints.FixedValue.Name",
      hint: "MYTHRASF.Settings.ActionPoints.FixedValue.Hint",
      scope: "world",
      config: true,
      type: Number,
      range: Object.freeze({ min: 1, max: 5, step: 1 }),
      default: 2,
      requiresReload: true
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.culturePointMinimum,
    options: Object.freeze({
      name: "MYTHRASF.Settings.CulturePoints.Minimum.Name",
      hint: "MYTHRASF.Settings.CulturePoints.Minimum.Hint",
      scope: "world",
      config: true,
      type: Number,
      range: Object.freeze({ min: 0, max: 100, step: 1 }),
      default: 5,
      requiresReload: true
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.culturePointMaximum,
    options: Object.freeze({
      name: "MYTHRASF.Settings.CulturePoints.Maximum.Name",
      hint: "MYTHRASF.Settings.CulturePoints.Maximum.Hint",
      scope: "world",
      config: true,
      type: Number,
      range: Object.freeze({ min: 1, max: 100, step: 1 }),
      default: 15,
      requiresReload: true
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.professionPointMinimum,
    options: Object.freeze({
      name: "MYTHRASF.Settings.ProfessionPoints.Minimum.Name",
      hint: "MYTHRASF.Settings.ProfessionPoints.Minimum.Hint",
      scope: "world",
      config: true,
      type: Number,
      range: Object.freeze({ min: 0, max: 100, step: 1 }),
      default: 0,
      requiresReload: true
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.professionPointMaximum,
    options: Object.freeze({
      name: "MYTHRASF.Settings.ProfessionPoints.Maximum.Name",
      hint: "MYTHRASF.Settings.ProfessionPoints.Maximum.Hint",
      scope: "world",
      config: true,
      type: Number,
      range: Object.freeze({ min: 1, max: 100, step: 1 }),
      default: 15,
      requiresReload: true
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.socialClassMethod,
    options: Object.freeze({
      name: "MYTHRASF.Settings.SocialClass.Method.Name",
      hint: "MYTHRASF.Settings.SocialClass.Method.Hint",
      scope: "world",
      config: true,
      type: String,
      choices: Object.freeze({
        [SOCIAL_CLASS_METHODS.choose]: "MYTHRASF.Settings.SocialClass.Method.Choose",
        [SOCIAL_CLASS_METHODS.random]: "MYTHRASF.Settings.SocialClass.Method.Random"
      }),
      default: SOCIAL_CLASS_METHODS.choose,
      requiresReload: true
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.detailedReach,
    options: Object.freeze({
      name: "MYTHRASF.Settings.DetailedReach.Name",
      hint: "MYTHRASF.Settings.DetailedReach.Hint",
      scope: "world", config: true, type: Boolean, default: true,
      requiresReload: false
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.catalogSources,
    options: Object.freeze({
      scope: "world",
      config: false,
      type: Object,
      default: Object.freeze({ version: 1, packIds: Object.freeze([]) })
    })
  }),
  Object.freeze({
    key: SETTING_KEYS.parties,
    options: Object.freeze({
      scope: "world",
      config: false,
      type: Object,
      default: Object.freeze({ version: 1, activePartyId: "", parties: [] })
    })
  })
]);

/** Register every Mythras setting during Foundry's init hook. */
export function registerSystemSettings(settings = game.settings) {
  for (const { key, options } of SYSTEM_SETTING_DEFINITIONS) {
    // Foundry enriches the received configuration with fields such as
    // namespace, key and id. Keep our exported definitions immutable while
    // giving Foundry a mutable registration object.
    settings.register(SYSTEM_ID, key, {
      ...options,
      ...(options.choices ? { choices: { ...options.choices } } : {}),
      ...(options.range ? { range: { ...options.range } } : {}),
      ...(options.default && typeof options.default === "object"
        ? { default: { ...options.default } }
        : {})
    });
  }
}

function defaultSystemSetting(key) {
  return SYSTEM_SETTING_DEFINITIONS.find((definition) => definition.key === key)
    ?.options.default;
}

export function getSystemSetting(key, settings = globalThis.game?.settings) {
  // Actor data is prepared before Foundry's setup hook, while world settings
  // are registered but cannot yet be read. Falling back to the registered
  // default keeps document preparation safe during that bootstrap window.
  try {
    return settings?.get(SYSTEM_ID, key) ?? defaultSystemSetting(key);
  } catch {
    return defaultSystemSetting(key);
  }
}

export function setSystemSetting(key, value, settings = game.settings) {
  return settings.set(SYSTEM_ID, key, value);
}

export function getActionPointRules(settings = game.settings) {
  return {
    method: getSystemSetting(SETTING_KEYS.actionPointMethod, settings),
    fixedValue: getSystemSetting(SETTING_KEYS.actionPointFixedValue, settings)
  };
}

export function getCultureAllocationRules(settings = game.settings) {
  const configuredMaximum = Math.max(1, Math.min(100, Number(
    getSystemSetting(SETTING_KEYS.culturePointMaximum, settings)
  ) || 1));
  const configuredMinimum = Math.max(0, Math.min(100, Number(
    getSystemSetting(SETTING_KEYS.culturePointMinimum, settings)
  ) || 0));
  return {
    minimum: Math.min(configuredMinimum, configuredMaximum),
    maximum: configuredMaximum
  };
}

export function getProfessionAllocationRules(settings = game.settings) {
  const configuredMaximum = Math.max(1, Math.min(100, Number(
    getSystemSetting(SETTING_KEYS.professionPointMaximum, settings)
  ) || 1));
  const configuredMinimum = Math.max(0, Math.min(100, Number(
    getSystemSetting(SETTING_KEYS.professionPointMinimum, settings)
  ) || 0));
  return {
    minimum: Math.min(configuredMinimum, configuredMaximum),
    maximum: configuredMaximum
  };
}

export function getSocialClassMethod(settings = game.settings) {
  return getSystemSetting(SETTING_KEYS.socialClassMethod, settings)
    || SOCIAL_CLASS_METHODS.choose;
}

/** Hide the fixed-value control unless that Action Point method is selected. */
export function activateActionPointSettingVisibility(element) {
  const root = element?.querySelector ? element : element?.[0];
  if (!root?.querySelector) return;

  const method = root.querySelector(
    `[name="${SYSTEM_ID}.${SETTING_KEYS.actionPointMethod}"]`
  );
  const fixedValue = root.querySelector(
    `[name="${SYSTEM_ID}.${SETTING_KEYS.actionPointFixedValue}"]`
  );
  const fixedValueGroup = fixedValue?.closest(".form-group");
  if (!method || !fixedValueGroup) return;

  const updateVisibility = () => {
    const visible = method.value === ACTION_POINT_METHODS.fixed;
    fixedValueGroup.hidden = !visible;
    fixedValueGroup.style.display = visible ? "" : "none";
  };
  method.addEventListener("change", updateVisibility);
  updateVisibility();
}
