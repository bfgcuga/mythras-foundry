import { createHash } from "node:crypto";

export function deterministicPackId(value) {
  return createHash("sha256")
    .update(`mythras-foundry.${value}`)
    .digest("hex")
    .slice(0, 16);
}

