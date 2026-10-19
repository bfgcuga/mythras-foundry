/** Display stored HTML in the NPC's plain-text note controls without exposing tags. */
export function npcNoteText(value) {
  const text = String(value ?? "");
  if (!/<\/?[a-z][^>]*>/i.test(text)) return text;
  const template = document.createElement("template");
  template.innerHTML = text;
  template.content.querySelectorAll("script, style").forEach((node) => node.remove());
  template.content.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  template.content.querySelectorAll("li").forEach((node) => node.prepend("• "));
  template.content.querySelectorAll("p, div, li, h1, h2, h3, h4, blockquote, tr")
    .forEach((node) => node.append("\n"));
  return template.content.textContent.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function npcNoteChanges(system, changes) {
  const result = { ...changes };
  for (const field of ["magicNotes", "description"]) {
    const key = `system.${field}`;
    // Submitting another field must not replace the original rich text with its display value.
    if (Object.hasOwn(result, key) && result[key] === npcNoteText(system?.[field])) delete result[key];
  }
  return result;
}
