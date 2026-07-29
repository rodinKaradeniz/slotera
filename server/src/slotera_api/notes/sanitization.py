from html import escape
from html.parser import HTMLParser

ALLOWED_TAGS = frozenset(
    {
        "blockquote",
        "br",
        "em",
        "h3",
        "li",
        "ol",
        "p",
        "strong",
        "ul",
    }
)
VOID_TAGS = frozenset({"br"})
IGNORED_TAGS = frozenset({"script", "style"})


class _NoteHtmlSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        del attrs
        tag = tag.lower()
        if tag in IGNORED_TAGS:
            self.ignored_depth += 1
        elif self.ignored_depth == 0 and tag in ALLOWED_TAGS:
            self.parts.append(f"<{tag}>")

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in IGNORED_TAGS and self.ignored_depth:
            self.ignored_depth -= 1
        elif self.ignored_depth == 0 and tag in ALLOWED_TAGS - VOID_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self.ignored_depth == 0:
            self.parts.append(escape(data))


def sanitize_note_html(value: str) -> str:
    """Keep the limited Tiptap document markup and discard all attributes."""
    sanitizer = _NoteHtmlSanitizer()
    sanitizer.feed(value)
    sanitizer.close()
    return "".join(sanitizer.parts)


class _VisibleTextFinder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.has_visible_text = False

    def handle_data(self, data: str) -> None:
        self.has_visible_text = self.has_visible_text or bool(data.strip())


def has_visible_note_content(value: str) -> bool:
    finder = _VisibleTextFinder()
    finder.feed(value)
    finder.close()
    return finder.has_visible_text
