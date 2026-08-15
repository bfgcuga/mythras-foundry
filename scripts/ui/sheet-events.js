/** Register declarative DOM event bindings for an application sheet. */
export function bindSheetEvents(root, bindings) {
  for (const [selector, eventName, listener] of bindings) {
    root.querySelectorAll(selector).forEach((element) => {
      element.addEventListener(eventName, listener);
    });
  }
}
