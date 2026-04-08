/**
 * DOM utility helpers for vanilla TypeScript UI building.
 */

/**
 * Create a DOM element with optional attributes and children.
 * @param tag - HTML tag name
 * @param attrs - Attributes object
 * @param children - Child nodes or strings
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      element.className = value;
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, value);
    } else {
      element.setAttribute(key, value);
    }
  }
  children.forEach((child) => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });
  return element;
}

/**
 * Query selector with type safety.
 */
export function qs<T extends Element>(selector: string, parent: ParentNode = document): T | null {
  return parent.querySelector<T>(selector);
}

/**
 * Query selector all with type safety.
 */
export function qsa<T extends Element>(selector: string, parent: ParentNode = document): T[] {
  return Array.from(parent.querySelectorAll<T>(selector));
}

/**
 * Add event listener and return cleanup function.
 */
export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
}

/**
 * Set inner HTML safely (no user content – only template strings).
 */
export function setHTML(element: HTMLElement, html: string): void {
  element.innerHTML = html;
}

/**
 * Show or hide an element using a CSS class.
 */
export function toggleVisible(element: HTMLElement, visible: boolean): void {
  element.classList.toggle('hidden', !visible);
}

/**
 * Empty a container element.
 */
export function empty(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
