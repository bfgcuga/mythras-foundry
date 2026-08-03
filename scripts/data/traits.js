const trait = (buildKey, name, description) => ({
  buildKey,
  name,
  type: "trait",
  img: "icons/svg/aura.svg",
  system: { description },
  flags: { "mythras-foundry": { source: "mythras-imperative-srd" } }
});

export const TRAIT_SOURCES = Object.freeze([
  trait("cold-blooded", "Sangre fría", "Su fisiología depende de la temperatura ambiental."),
  trait("night-vision", "Visión nocturna", "Puede ver en condiciones de iluminación muy escasa."),
  trait("formidable-natural-weapons", "Armas naturales formidables", "Sus armas naturales son especialmente peligrosas."),
  trait("venomous", "Venenoso", "Sus ataques indicados pueden inocular veneno."),
  trait("frenzy", "Frenesí", "Puede entrar en frenesí y priorizar el ataque sobre su propia seguridad."),
  trait("leaper", "Saltador", "Puede cubrir grandes distancias mediante saltos."),
  trait("intimidate", "Intimidar", "Puede forzar una tirada enfrentada de Voluntad para hacer retroceder o huir a un oponente."),
  trait("acid-blood", "Sangre ácida", "Al ser herido en cuerpo a cuerpo puede salpicar ácido a su atacante.")
]);

export function getTraitSource(key) {
  return TRAIT_SOURCES.find((source) => source.buildKey === key) ?? null;
}

