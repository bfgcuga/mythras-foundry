import { canManageActor } from "./actor-visibility.js";

export class GallerySheetController {
  constructor(sheet) { this.sheet = sheet; }
  get actor() { return this.sheet.actor; }
  get editable() { return canManageActor(this.actor) && this.sheet.isEditable; }
  bind() {
    for (const [action, method] of [["add", "add"], ["view", "view"], ["remove", "remove"]]) {
      this.sheet.element.querySelectorAll(`[data-action='${action}-gallery-image']`).forEach(button =>
        button.addEventListener("click", event => this[method](event)));
    }
  }
  async add() {
    if (!this.editable) return;
    const directory = `worlds/${game.world.id}`;
    const picker = new foundry.applications.apps.FilePicker({ type: "image", current: directory,
      callback: async src => {
        if (!src || !this.editable) return;
        const title = decodeURIComponent(src.split("/").pop() ?? "")
          .replace(/\.[^.]+$/, "").replaceAll(/[-_]+/g, " ").trim();
        const gallery = Array.from(this.actor.system.gallery ?? [], image => ({ src: image.src, title: image.title }));
        gallery.push({ src, title: title || game.i18n.localize("MYTHRASF.Gallery.Image") });
        await this.actor.update({ "system.gallery": gallery });
      } });
    await picker.browse(directory);
  }
  view(event) {
    const image = this.actor.system.gallery?.[Number(event.currentTarget.closest("[data-gallery-index]")?.dataset.galleryIndex)];
    if (!image?.src) return;
    new foundry.applications.apps.ImagePopout({ src: image.src, uuid: this.actor.uuid,
      window: { title: image.title || this.actor.name } }).render(true);
  }
  async remove(event) {
    if (!this.editable) return;
    const index = Number(event.currentTarget.closest("[data-gallery-index]")?.dataset.galleryIndex);
    const gallery = Array.from(this.actor.system.gallery ?? [], image => ({ src: image.src, title: image.title }));
    if (!Number.isInteger(index) || index < 0 || index >= gallery.length) return;
    gallery.splice(index, 1);
    await this.actor.update({ "system.gallery": gallery });
  }
}
