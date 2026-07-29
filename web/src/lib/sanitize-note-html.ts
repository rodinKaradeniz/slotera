const ALLOWED_TAGS = new Set([
  "blockquote",
  "br",
  "em",
  "h3",
  "li",
  "ol",
  "p",
  "strong",
  "ul",
]);
const IGNORED_TAGS = new Set(["script", "style"]);

/**
 * Defense in depth for persisted note HTML. The API is the authority that
 * sanitises on write; this keeps rendering safe if a malformed historical
 * record or another transport ever reaches the browser.
 */
export function sanitizeNoteHtml(value: string): string {
  if (typeof DOMParser === "undefined") return "";
  const document = new DOMParser().parseFromString(value, "text/html");

  const clean = (node: Node): void => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const element = child as HTMLElement;
      const tag = element.tagName.toLowerCase();
      if (IGNORED_TAGS.has(tag)) {
        element.remove();
      } else if (!ALLOWED_TAGS.has(tag)) {
        const text = document.createTextNode(element.textContent ?? "");
        element.replaceWith(text);
      } else {
        for (const attribute of [...element.attributes]) {
          element.removeAttribute(attribute.name);
        }
        clean(element);
      }
    }
  };

  clean(document.body);
  return document.body.innerHTML;
}
