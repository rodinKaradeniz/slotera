import * as React from "react";
import Link from "next/link";

/**
 * Just enough Markdown for the legal pages: `#`–`###` headings, paragraphs, `- ` lists,
 * `> ` notes, `**bold**` and `[text](href)`. Content is ours, so no sanitising is needed.
 */
export function renderMarkdown(source: string): React.ReactNode[] {
  const blocks = source.trim().split(/\n\s*\n/);
  return blocks.map((block, index) => {
    const lines = block.split("\n");
    const first = lines[0];
    const heading = /^(#{1,3}) (.*)$/.exec(first);
    if (heading) {
      const level = heading[1].length;
      const Tag = (["h1", "h2", "h3"] as const)[level - 1];
      const style = ["text-h1 text-ink mb-2", "text-h3 text-ink mt-8 mb-2", "text-ink mt-6 mb-1"];
      return (
        <Tag key={index} className={style[level - 1]}>
          {inline(heading[2])}
        </Tag>
      );
    }
    if (first.startsWith("- ")) {
      return (
        <ul key={index} className="list-disc pl-6 flex flex-col gap-1.5 my-3 text-body">
          {lines.map((line, i) => (
            <li key={i}>{inline(line.replace(/^- /, ""))}</li>
          ))}
        </ul>
      );
    }
    if (first.startsWith("> ")) {
      return (
        <div
          key={index}
          className="rounded-md border border-line-soft bg-surface-warm px-4 py-3 my-4 text-small text-ink-2"
        >
          {inline(lines.map((line) => line.replace(/^> ?/, "")).join(" "))}
        </div>
      );
    }
    return (
      <p key={index} className="text-body my-3">
        {inline(lines.join(" "))}
      </p>
    );
  });
}

function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    const bold = /^\*\*(.+)\*\*$/.exec(part);
    if (bold) return <strong key={i} className="text-ink">{bold[1]}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <Link key={i} href={link[2]} className="text-accent underline underline-offset-2">
          {link[1]}
        </Link>
      );
    }
    return part;
  });
}
