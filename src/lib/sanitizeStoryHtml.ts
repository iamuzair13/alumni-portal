import sanitizeHtml from "sanitize-html";

const STORY_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "a", "div"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
};

export function sanitizeStoryHtml(html: string): string {
  return sanitizeHtml(html ?? "", STORY_HTML_OPTIONS);
}

export function storyHtmlTextContent(html: string): string {
  return sanitizeStoryHtml(html).replace(/<[^>]+>/g, "").trim();
}
