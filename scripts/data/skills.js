export { BASIC_SKILL_SOURCES } from "./basic-skills.js";
export { PROFESSIONAL_SKILL_SOURCES } from "./professional-skills.js";

import { BASIC_SKILL_SOURCES } from "./basic-skills.js";
import { PROFESSIONAL_SKILL_SOURCES } from "./professional-skills.js";

export const ALL_SKILL_SOURCES = [
  ...BASIC_SKILL_SOURCES.filter((skill) => skill.system.slug !== "estilo-de-combate"),
  ...PROFESSIONAL_SKILL_SOURCES
];
