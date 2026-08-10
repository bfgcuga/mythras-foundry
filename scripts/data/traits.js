import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

const trait = (buildKey, name, description, traitType, {
  source = MYTHRAS_REVISED_SOURCE, requiresAllGroupMembers = false,
  ruleKey = "", ruleParameters = []
} = {}) => ({
  buildKey,
  name,
  type: "trait",
  img: "icons/svg/aura.svg",
  system: { key: buildKey, source, traitType, requiresAllGroupMembers,
    ruleKey, ruleParameters, description },
  flags: { "mythras-foundry": { source: source === MYTHRAS_REVISED_SOURCE
    ? "mythras-basic-revised" : "mythras-imperative-srd" } }
});

const creature = (key, name, description) => trait(key, name, description, "creature", {
  source: "Mythras Imperativo SRD"
});

export const CREATURE_TRAIT_SOURCES = Object.freeze([
  creature("cold-blooded", "Sangre fría", "Su fisiología depende de la temperatura ambiental."),
  creature("night-vision", "Visión nocturna", "Puede ver en condiciones de iluminación muy escasa."),
  creature("formidable-natural-weapons", "Armas naturales formidables", "Sus armas naturales son especialmente peligrosas."),
  creature("venomous", "Venenoso", "Sus ataques indicados pueden inocular veneno."),
  creature("frenzy", "Frenesí", "Puede entrar en frenesí y priorizar el ataque sobre su propia seguridad."),
  creature("leaper", "Saltador", "Puede cubrir grandes distancias mediante saltos."),
  creature("intimidate", "Intimidar", "Puede forzar una tirada enfrentada de Voluntad para hacer retroceder o huir a un oponente."),
  creature("acid-blood", "Sangre ácida", "Al ser herido en cuerpo a cuerpo puede salpicar ácido a su atacante.")
]);

const style = (key, name, description, options = {}) => trait(key, name, description,
  "combatStyle", options);

export const COMBAT_STYLE_TRAIT_SOURCES = Object.freeze([
  style("aporrear", "Aporrear", "Si el Modificador de Daño del guerrero es dos o más grados mayor que el de su oponente, su arma se considera una categoría de Tamaño mayor a efectos de superar paradas."),
  style("apresador", "Apresador", "Este Estilo le da a su usuario ventaja al enredar o inmovilizar oponentes, haciendo que las tiradas enfrentadas de un oponente para Evadir o liberarse aumenten su dificultad en un Grado."),
  style("armas-ocultas", "Armas Ocultas", "Permite al usuario usar como armas letales objetos aparentemente inofensivos incluidos como parte del Estilo de Combate, sin posibilidad de rotura accidental a pesar de su aparente fragilidad (abanicos o instrumentos musicales, por ejemplo)."),
  style("arrojar-armas", "Arrojar Armas", "Cualquier arma cuerpo a cuerpo empleada en este Estilo también puede arrojarse sin penalización a la Habilidad, aunque al usarla de este modo su daño se reduce a la mitad."),
  style("asesinato", "Asesinato", "Le da al usuario acceso al Efecto de Combate «Muerte Silenciosa», normalmente restringido."),
  style("bestia-amaestrada", "Bestia Amaestrada", "Permite al usuario usar cualquiera de sus Puntos de Acción para defenderse contra ataques lanzados contra su bestia. Está diseñado para aquellos Estilos que hagan hincapié en el combate coordinado con un compañero animal (como aves de presa entrenadas, compañeros lobos, etc.)."),
  style("combate-acuatico", "Combate Acuático", "Este Estilo permite ignorar los límites a las tiradas de combate impuestos por la Habilidad de Nadar."),
  style("combate-en-cuadriga", "Combate en Cuadriga", "Este Estilo permite a los pasajeros de un carro de guerra ignorar el límite a sus habilidades de combate impuesto por la Habilidad de Conducir del conductor."),
  style("combate-en-formacion", "Combate en Formación", "Permite que un grupo de tres o más guerreros se sitúen en formación cerrada, dejando a los oponentes más abiertos o desorganizados en desventaja (siempre que la unidad no sea flanqueada) y reduciendo en uno los Puntos de Acción de cada enemigo al Trabarse en combate.", { requiresAllGroupMembers: true }),
  style("combate-montado", "Combate Montado", "Permite al personaje ignorar el límite de Habilidad impuesto a las tiradas de combate por la Habilidad de Montar."),
  style("espadachin", "Espadachín", "Permite al usuario iniciar ataques y evasiones mientras salta o se columpia para Trabarse en combate (o Destrabarse), ignorando cualquier límite impuesto por la Habilidad de Atletismo."),
  style("grito-intimidante", "Grito Intimidante", "Anima a proferir gritos y alaridos frecuentes en combate para intimidar a los enemigos, haciendo que cualquier tirada de resistencia psicológica aumente su dificultad en un Grado."),
  style("guerra-de-asedio", "Guerra de Asedio", "Permite a su usuario ignorar el límite a sus Habilidades de combate impuesto por Atletismo al escalar muros o reptar por túneles."),
  style("hostigador", "Hostigador", "Permite efectuar ataques a distancia al Caminar o Correr (pero no al Esprintar)."),
  style("juego-de-pies-excelente", "Juego de Pies Excelente", "Al luchar en superficies resbaladizas o poco firmes, el usuario puede ignorar el límite a sus Habilidades de combate impuesto por la Habilidad de Acrobacias."),
  style("lancero-montado", "Lancero Montado", "Realizar una carga de caballería con este Estilo de Combate no recibe la penalización de un Grado a la tirada de ataque."),
  style("lucha-a-ciegas", "Lucha a Ciegas", "Permite al usuario ignorar toda penalización impuesta por mala iluminación o ceguera temporal."),
  style("luchador-precavido", "Luchador Precavido", "Puede usar la acción Cambiar de Alcance para Destrabarse automáticamente sin necesidad de tirar."),
  style("maestria-sin-armas", "Maestría sin Armas", "Permite al usuario tratar sus bloqueos y paradas sin armas como si fueran de tamaño «Medio», lo que le permite defenderse mejor de los oponentes armados."),
  style("matar-o-morir", "Matar o Morir", "Permite que las combinaciones de dos armas tengan acceso al Efecto de Combate Ráfaga, siempre que se alterne de arma en cada ataque."),
  style("mentalidad-defensiva", "Mentalidad Defensiva", "Aumenta el Tamaño de tu arma en una categoría al parar, siempre que durante ese Asalto no se haya realizado ninguna acción ofensiva."),
  style("muro-de-escudos", "Muro de Escudos", "Permite que un grupo de tres o más usuarios de escudo solapen su protección, añadiendo uno al número de localizaciones que pueden proteger con el Bloqueo Pasivo, además de resistir Empujones, Ataques en salto y Golpetazos como si se estuviera usando la acción Afianzarse.", { requiresAllGroupMembers: true }),
  style("noquear", "Noquear", "Al atacar por sorpresa, la duración del efecto Aturdir Localización dura minutos en lugar de Turnos."),
  style("partir-escudos", "Partir Escudos", "Al usar clavas y hachas, permite tirar dos veces el daño del arma y elegir el mejor resultado, pero solo al usar el Efecto de Combate Dañar Arma contra escudos."),
  style("punteria-de-tirador", "Puntería de Tirador", "Al usar un arma a distancia, permite cambiar el resultado de una tirada de Localización de Impacto a una Localización adyacente."),
  style("temerario", "Temerario", "Se puede usar la Habilidad de Evadir para esquivar golpes en combate cuerpo a cuerpo sin acabar derribado.")
]);

const weapon = (key, name, description, ruleKey = "") => trait(key, name, description,
  "weapon", { ruleKey });

export const WEAPON_TRAIT_SOURCES = Object.freeze([
  weapon("arrojadiza", "Arrojadiza", "El arma dispone de un modo apropiado para ser arrojada."),
  weapon("atrapadora", "Atrapadora", "La forma del arma facilita atrapar o controlar al oponente."),
  weapon("barbada", "Barbada", "El arma posee púas o garfios que dificultan su extracción."),
  weapon("bloqueo-pasivo", "Bloqueo Pasivo", "Protege pasivamente el número de localizaciones indicado al asignar el rasgo.", "weapon.passiveBlock"),
  weapon("defensiva", "Defensiva", "El arma está diseñada para favorecer la defensa de su usuario."),
  weapon("doble", "Doble", "El arma puede emplear ambos extremos como superficies de ataque."),
  weapon("flexible", "Flexible", "El arma transmite el ataque mediante una sección flexible."),
  weapon("montada", "Montada", "El arma está preparada para ser empleada desde una montura."),
  weapon("ofensiva", "Ofensiva", "El arma está diseñada para favorecer acciones ofensivas."),
  weapon("parar-proyectiles", "Parar Proyectiles", "El arma o escudo puede utilizarse para parar proyectiles."),
  weapon("recibir-carga", "Recibir Carga", "El arma puede prepararse para recibir una carga enemiga."),
  weapon("sigilo", "Sigilo", "El arma puede utilizarse de forma especialmente discreta.")
]);

export const TRAIT_SOURCES = Object.freeze([
  ...CREATURE_TRAIT_SOURCES,
  ...COMBAT_STYLE_TRAIT_SOURCES,
  ...WEAPON_TRAIT_SOURCES
]);

export function getTraitSource(key) {
  return TRAIT_SOURCES.find((source) => source.buildKey === key) ?? null;
}
