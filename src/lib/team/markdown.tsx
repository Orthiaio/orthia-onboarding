import React from "react";

/**
 * Tiny safe markdown renderer. Supports: paragraphs, line breaks,
 * **bold**, *italic*, `code`, links, and @mentions (highlighted).
 * No raw HTML — every token is rendered as a React node.
 */
export function renderMarkdown(text: string): React.ReactNode {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks.map((block, i) => (
    <p key={i} className="whitespace-pre-wrap break-words leading-relaxed">
      {renderInline(block)}
    </p>
  ));
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Order matters: code first (so ** inside backticks is ignored), then bold, italic, link, mention, plain.
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s)]+)|(@"[^"]+"|@[A-Za-z0-9_.-]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code
          key={`c${key++}`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(
        <strong key={`b${key++}`}>{tok.slice(2, -2)}</strong>,
      );
    } else if (tok.startsWith("*")) {
      out.push(<em key={`i${key++}`}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("[")) {
      const match = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(tok);
      if (match) {
        out.push(
          <a
            key={`l${key++}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {match[1]}
          </a>,
        );
      } else out.push(tok);
    } else if (tok.startsWith("http")) {
      out.push(
        <a
          key={`u${key++}`}
          href={tok}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          {tok}
        </a>,
      );
    } else if (tok.startsWith("@")) {
      out.push(
        <span
          key={`m${key++}`}
          className="rounded bg-blue-50 px-1 font-medium text-blue-700"
        >
          {tok}
        </span>,
      );
    } else {
      out.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
