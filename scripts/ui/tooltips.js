const TOOLTIP_DELAY_MS = 1100;
let activeTooltip = null;

function rootElement(root) {
  if (root instanceof HTMLElement) return root;
  if (root?.element instanceof HTMLElement) return root.element;
  return root?.[0] instanceof HTMLElement ? root[0] : null;
}

function tooltipLabel(button) {
  return String(
    button.dataset.mythrasTooltip
    || button.getAttribute("title")
    || button.getAttribute("aria-label")
    || button.textContent
    || ""
  ).replace(/\s+/g, " ").trim();
}

function hideTooltip(button) {
  clearTimeout(button._mythrasTooltipTimer);
  button._mythrasTooltipTimer = null;
  if (activeTooltip?.button !== button) return;
  activeTooltip.element.remove();
  activeTooltip = null;
}

function showTooltip(button, label) {
  if (!button.isConnected || activeTooltip?.button === button) return;
  activeTooltip?.element.remove();
  const element = document.createElement("div");
  element.className = "mythras-delayed-tooltip";
  element.setAttribute("role", "tooltip");
  element.textContent = label;
  document.body.append(element);
  const buttonRect = button.getBoundingClientRect();
  const tooltipRect = element.getBoundingClientRect();
  const top = buttonRect.top - tooltipRect.height - 8 >= 4
    ? buttonRect.top - tooltipRect.height - 8
    : buttonRect.bottom + 8;
  const left = Math.min(
    window.innerWidth - tooltipRect.width - 4,
    Math.max(4, buttonRect.left + (buttonRect.width - tooltipRect.width) / 2)
  );
  element.style.top = `${top}px`;
  element.style.left = `${left}px`;
  activeTooltip = { button, element };
}

export function activateDelayedTooltips(root) {
  const element = rootElement(root);
  if (!element) return;
  element.querySelectorAll("button").forEach((button) => {
    if (button.dataset.mythrasTooltipReady) return;
    const label = tooltipLabel(button);
    if (!label) return;
    button.dataset.mythrasTooltipReady = "true";
    button.dataset.mythrasTooltip = label;
    button.removeAttribute("title");
    button.addEventListener("mouseenter", () => {
      clearTimeout(button._mythrasTooltipTimer);
      button._mythrasTooltipTimer = setTimeout(
        () => showTooltip(button, label), TOOLTIP_DELAY_MS
      );
    });
    button.addEventListener("mouseleave", () => hideTooltip(button));
    button.addEventListener("mousedown", () => hideTooltip(button));
  });
}
