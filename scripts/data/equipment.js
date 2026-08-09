import { MYTHRAS_REVISED_SOURCE } from "./sources.js";

const flags = { "mythras-foundry": { source: "mythras-basic-revised" } };
const slug = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const equipment = (name, { key = slug(name), category = "item", enc = 0, value = 0,
  currency = "silver", era = "", container = false, capacity = 0, occupants = 0,
  draftAnimals = 0, cheap = 0, reasonable = 0, superior = 0, description = "" } = {}) => ({
  buildKey: key, name, type: "equipment", img: category === "vehicle"
    ? "icons/svg/cart.svg" : category === "livestock" ? "icons/svg/cow.svg"
      : container || category === "property" ? "icons/svg/chest.svg" : "icons/svg/item-bag.svg",
  system: { source: MYTHRAS_REVISED_SOURCE, category, era, quantity: 1, quantityFormula: "",
    weight: enc, value: value || reasonable || cheap, currency, location: "",
    parentContainerId: "", isContainer: container || ["vehicle", "livestock", "property"].includes(category),
    collapsed: false, capacityEncumbrance: capacity, occupantCapacity: occupants,
    draftAnimals, cheapValue: cheap, reasonableValue: reasonable, superiorValue: superior,
    equipped: false, description }, flags
});

const qualityRows = (category, rows) => rows.map(([name, cheap, reasonable, superior, extra = {}]) =>
  equipment(name, { category, cheap, reasonable, superior, ...extra }));

export const ACCOMMODATION_SOURCES = qualityRows("service", [
  ["Suelo de la sala común o establos", 0.5, 0, 0],
  ["Habitación o dormitorio compartido", 1, 1.5, 0],
  ["Habitación privada", 2, 5, 10],
  ["Choza o chabola alquilada (semana)", 10, 0, 0],
  ["Cabaña o casa de campo alquilada (semana)", 15, 25, 50],
  ["Casa o apartamento alquilado (semana)", 30, 50, 75],
  ["Villa o mansión alquilada (semana)", 100, 250, 1000],
  ["Choza o chabola en propiedad", 100, 0, 0, { category: "property", container: true }],
  ["Cabaña o casa de campo en propiedad (habitación)", 750, 1250, 2500, { category: "property", container: true }],
  ["Casa o apartamento en propiedad (dos habitaciones)", 3000, 5000, 7500, { category: "property", container: true }],
  ["Villa o mansión en propiedad (cuatro habitaciones)", 20000, 50000, 200000, { category: "property", container: true }],
  ["Tienda (capacidad por persona)", 1, 3, 5, { category: "container", container: true, capacity: 20 }]
]);

export const CLOTHING_SOURCES = qualityRows("clothing", [
  ["Botas", 25, 50, 100], ["Camisa, camisola o jubón", 8, 16, 35],
  ["Capa o abrigo", 20, 45, 90], ["Capa o abrigo de invierno", 30, 75, 150],
  ["Chaleco o tabardo", 10, 20, 50], ["Gorro o sombrero", 3, 6, 18],
  ["Guantes, calcetines o ropa interior", 5, 10, 20],
  ["Pantalones, falda o kilt", 12, 25, 60], ["Sandalias", 4, 8, 20],
  ["Túnica o vestido", 15, 30, 75], ["Zapatos", 20, 45, 90]
]);

export const FOOD_SOURCES = qualityRows("food", [
  ["Comida en una taberna o posada", 1, 3, 8, { category: "service" }],
  ["Cerveza normal o negra para una noche", 1, 1.5, 3, { category: "service" }],
  ["Vino o licores para una noche", 2, 4, 6, { category: "service" }],
  ["Raciones de viaje (siete días)", 7, 9, 12]
]);

export const LIVESTOCK_SOURCES = qualityRows("livestock", [
  ["Ave de corral", 1, 2, 4], ["Buey", 150, 300, 800],
  ["Caballo (monta)", 1200, 2500, 7000],
  ["Caballo (caballería o guerra)", 3000, 6000, 10000],
  ["Caballo (pesado de tiro)", 1400, 2800, 8000], ["Cabra", 25, 50, 100],
  ["Camello", 1100, 2200, 6000], ["Cerdo", 25, 50, 150],
  ["Oveja", 25, 50, 150], ["Ternero", 30, 60, 180],
  ["Toro", 500, 1000, 3000], ["Vaca", 100, 200, 600]
]);

const toolRows = [
  ["Ábaco",1,8],["Aguijada",1,25],["Alforjas",2,20,"silver",40],["Antorcha (1 hora)",0,4,"copper"],
  ["Antorcha (6 horas)",1,8,"copper"],["Anzuelos (20)",0,1],["Aparejo de poleas",1,15],
  ["Astrolabio",1,200,"silver",0,"A-E"],["Botella (cristal o arcilla)",0,2],
  ["Botiquín (diez aplicaciones de Primeros Auxilios)",0,25],["Brida y bocado",1,15],
  ["Brújula de navío",1,70,"silver",0,"M-E"],["Cadena (2 m)",2,40],
  ["Caja fuerte",4,250,"silver",100],["Carcaj",0,2,"silver",20],["Cera (bloque)",1,2,"copper"],
  ["Clavos o tachuelas (50)",0,2,"copper"],["Cofre grande",5,80,"silver",100],
  ["Cofre pequeño",3,50,"silver",50],["Copa de vino elegante",0,8],
  ["Cuchillo (herramienta, no arma)",0,5],["Cuerda de cáñamo (10 m)",2,10],
  ["Equipo de pesca",1,15],["Escala de cuerda (3 m)",4,2],["Espejo de mano",1,12],
  ["Frasco de aceite",1,1],["Fusta de montar",0,15],["Ganzúas",0,75],["Garfio de escalada",0,5],
  ["Guadaña/hoz",2,30],["Herraduras",1,10],["Herramientas de artesano",2,75],
  ["Instrumento musical",2,70],["Jamba de puerta",2,5],["Jarra/pichel/plato/bandeja",0,5,"copper"],
  ["Látigo de conductor",0,25],["Linterna básica",1,10],["Martillo/sierra/mazo/cincel",1,1],
  ["Mochila/zurrón",1,5,"silver",20],["Mortero",2,8],["Navaja plegable",0,3],
  ["Odre o cantimplora",1,5,"copper",2],["Pala/azada/horca",1,25],["Palanca",1,25],
  ["Papiro u hoja de papel",0,5,"copper"],["Pértiga (3 m)",1,1],["Pico",1,35],
  ["Piedra imantada",0,5],["Pienso/raciones para monturas (día)",1,5,"copper"],
  ["Plumas y tinta para escribir",1,30],["Puchero de cocina (viaje)",2,3],["Red de pesca",4,10],
  ["Reloj de arena",1,20,"silver",0,"A-E"],["Saco de dormir",1,1],
  ["Saco grande",1,5,"copper",60],["Saco pequeño",0,2,"copper",30],
  ["Sextante",1,25,"silver",0,"R-E"],["Sierra de mano",1,1],["Silla de montar",3,60],
  ["Silla de montar militar",4,90],["Trampas y lazos para animales",1,1],
  ["Útiles de cetrería",1,30],["Útiles de medicina (diez aplicaciones de Curación)",1,150],
  ["Vela (6 horas)",1,1],["Yesca y pedernal",0,1]
];
export const TOOL_SOURCES = toolRows.map(([name, enc, value, currency = "silver", capacity = 0,
  era = ""]) => equipment(name, { enc, value, currency, era, container: capacity > 0,
  capacity, category: capacity > 0 ? "container" : "item" }));

export const VEHICLE_SOURCES = [
  ["Carro de dos ruedas",6,60,1,"A-E",60],["Carromato de dos ruedas",10,100,1,"A-E",175],
  ["Carromato de cuatro ruedas",10,200,2,"A-E",500],["Carruaje pesado",12,400,8,"R-E",15000],
  ["Cuadriga de guerra",2,20,2,"A-E",1200],["Diligencia",8,200,4,"R-E",8000],
  ["Litera abierta",1,10,2,"A-E",400],["Palanquín",4,40,8,"A-E",2000]
].map(([name, occupants, capacity, draftAnimals, era, value]) => equipment(name,
  { category: "vehicle", occupants, capacity, draftAnimals, era, value, container: true }));

export const AMMUNITION_SOURCES = [
  ["Flechas (fajo de doce)",4],["Virotes (fajo de doce)",3],
  ["Balas de plomo para honda (bolsa de veinte)",1],
  ["Dardos de cerbatana (media docena)",2],["Dardos arrojadizos (fajo de doce)",2]
].map(([name, value]) => equipment(name, { category: "ammunition", value }));

export const EQUIPMENT_SOURCES = Object.freeze([
  ...ACCOMMODATION_SOURCES, ...CLOTHING_SOURCES, ...FOOD_SOURCES,
  ...LIVESTOCK_SOURCES, ...TOOL_SOURCES, ...VEHICLE_SOURCES, ...AMMUNITION_SOURCES
]);

export const DEFAULT_HOME_DATA = equipment("Casa", {
  key: "default-home", category: "property", container: true,
  description: "Propiedad predeterminada del personaje para guardar sus pertenencias."
});
