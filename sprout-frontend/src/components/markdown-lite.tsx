import type { ReactNode } from "react";

function makeKey(prefix: string, value: string, offset: number) {
  return `${prefix}-${offset}-${value.length}-${value.slice(0, 12)}`;
}

type CodeTokenKind = "plain" | "keyword" | "string" | "number" | "comment";

type CodeToken = {
  kind: CodeTokenKind;
  value: string;
};

const LANG_ALIASES: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  java: "java",
  js: "javascript",
  jsx: "javascript",
  javascript: "javascript",
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  py: "python",
  python: "python",
};

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  c: [
    "auto",
    "break",
    "case",
    "char",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extern",
    "float",
    "for",
    "goto",
    "if",
    "int",
    "long",
    "register",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "struct",
    "switch",
    "typedef",
    "union",
    "unsigned",
    "void",
    "volatile",
    "while",
  ],
  cpp: [
    "auto",
    "bool",
    "break",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "do",
    "double",
    "else",
    "enum",
    "explicit",
    "false",
    "float",
    "for",
    "if",
    "int",
    "long",
    "namespace",
    "new",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "struct",
    "switch",
    "template",
    "this",
    "throw",
    "true",
    "try",
    "typedef",
    "typename",
    "union",
    "unsigned",
    "using",
    "virtual",
    "void",
    "while",
  ],
  java: [
    "abstract",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extends",
    "final",
    "finally",
    "float",
    "for",
    "if",
    "implements",
    "import",
    "int",
    "interface",
    "long",
    "native",
    "new",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "try",
    "void",
    "volatile",
    "while",
  ],
  javascript: [
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
  ],
  typescript: [
    "abstract",
    "as",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "declare",
    "default",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "infer",
    "instanceof",
    "interface",
    "is",
    "keyof",
    "let",
    "module",
    "namespace",
    "never",
    "new",
    "null",
    "readonly",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "typeof",
    "undefined",
    "var",
    "void",
    "while",
  ],
  python: [
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
    "yield",
  ],
};

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return LANG_ALIASES[normalized] ?? normalized;
}

function keywordSetForLanguage(language: string): Set<string> {
  const normalized = normalizeLanguage(language);
  return new Set(LANGUAGE_KEYWORDS[normalized] ?? []);
}

function commentPrefixForLanguage(language: string): "//" | "#" | null {
  const normalized = normalizeLanguage(language);
  if (normalized === "python") return "#";
  if (
    normalized === "c" ||
    normalized === "cpp" ||
    normalized === "java" ||
    normalized === "javascript" ||
    normalized === "typescript"
  ) {
    return "//";
  }
  return null;
}

function tokenizeCodeLine(line: string, language: string): CodeToken[] {
  const keywordSet = keywordSetForLanguage(language);
  const commentPrefix = commentPrefixForLanguage(language);
  const tokens: CodeToken[] = [];

  let i = 0;
  let plainStart = 0;

  const pushPlain = (end: number) => {
    if (end <= plainStart) return;
    tokens.push({ kind: "plain", value: line.slice(plainStart, end) });
  };

  while (i < line.length) {
    if (commentPrefix && line.startsWith(commentPrefix, i)) {
      pushPlain(i);
      tokens.push({ kind: "comment", value: line.slice(i) });
      plainStart = line.length;
      break;
    }

    const char = line[i];

    if (char === '"' || char === "'") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === char) {
          j += 1;
          break;
        }
        j += 1;
      }
      pushPlain(i);
      tokens.push({
        kind: "string",
        value: line.slice(i, Math.min(j, line.length)),
      });
      i = Math.min(j, line.length);
      plainStart = i;
      continue;
    }

    const numberMatch = line.slice(i).match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      pushPlain(i);
      tokens.push({ kind: "number", value: numberMatch[0] });
      i += numberMatch[0].length;
      plainStart = i;
      continue;
    }

    const wordMatch = line.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (keywordSet.has(word)) {
        pushPlain(i);
        tokens.push({ kind: "keyword", value: word });
        i += word.length;
        plainStart = i;
        continue;
      }
      i += word.length;
      continue;
    }

    i += 1;
  }

  pushPlain(line.length);
  return tokens;
}

function codeTokenClass(kind: CodeTokenKind): string {
  if (kind === "keyword") return "text-sky-300";
  if (kind === "string") return "text-emerald-300";
  if (kind === "number") return "text-amber-300";
  if (kind === "comment") return "text-white/45 italic";
  return "text-white/90";
}

function renderHighlightedCode(
  code: string,
  language: string,
  keyPrefix: string,
): ReactNode[] {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];

  let lineOffset = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const tokens = tokenizeCodeLine(line, language);

    let tokenOffset = 0;
    for (const token of tokens) {
      nodes.push(
        <span
          key={makeKey(
            `${keyPrefix}-token-${token.kind}`,
            token.value,
            lineOffset + tokenOffset,
          )}
          className={codeTokenClass(token.kind)}
        >
          {token.value}
        </span>,
      );
      tokenOffset += token.value.length;
    }

    if (lineIndex < lines.length - 1) {
      nodes.push(
        <span
          key={makeKey(
            `${keyPrefix}-linebreak`,
            line,
            lineOffset + tokenOffset,
          )}
        >
          {"\n"}
        </span>,
      );
    }

    lineOffset += line.length + 1;
  }

  return nodes;
}

function renderInline(
  text: string,
  keyPrefix = "inline",
  baseOffset = 0,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let plainStart = 0;

  const pushPlain = (end: number) => {
    if (end <= plainStart) return;
    const plainText = text.slice(plainStart, end);
    nodes.push(
      <span
        key={makeKey(`${keyPrefix}-text`, plainText, baseOffset + plainStart)}
      >
        {plainText}
      </span>,
    );
  };

  while (cursor < text.length) {
    if (text[cursor] === "`") {
      const close = text.indexOf("`", cursor + 1);
      if (close !== -1) {
        pushPlain(cursor);
        const codeText = text.slice(cursor + 1, close);
        nodes.push(
          <code
            key={makeKey(`${keyPrefix}-code`, codeText, baseOffset + cursor)}
            className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]"
          >
            {codeText}
          </code>,
        );
        cursor = close + 1;
        plainStart = cursor;
        continue;
      }
    }

    if (text.startsWith("**", cursor)) {
      const close = text.indexOf("**", cursor + 2);
      if (close !== -1) {
        pushPlain(cursor);
        const boldText = text.slice(cursor + 2, close);
        nodes.push(
          <strong
            key={makeKey(`${keyPrefix}-strong`, boldText, baseOffset + cursor)}
          >
            {renderInline(
              boldText,
              `${keyPrefix}-strong-inner`,
              baseOffset + cursor + 2,
            )}
          </strong>,
        );
        cursor = close + 2;
        plainStart = cursor;
        continue;
      }
    }

    const char = text[cursor];
    if (char === "*" || char === "_") {
      const close = text.indexOf(char, cursor + 1);
      if (close !== -1 && close > cursor + 1) {
        pushPlain(cursor);
        const italicText = text.slice(cursor + 1, close);
        nodes.push(
          <em key={makeKey(`${keyPrefix}-em`, italicText, baseOffset + cursor)}>
            {renderInline(
              italicText,
              `${keyPrefix}-em-inner`,
              baseOffset + cursor + 1,
            )}
          </em>,
        );
        cursor = close + 1;
        plainStart = cursor;
        continue;
      }
    }

    cursor += 1;
  }

  if (plainStart < text.length) {
    const plainText = text.slice(plainStart);
    nodes.push(
      <span
        key={makeKey(`${keyPrefix}-text`, plainText, baseOffset + plainStart)}
      >
        {plainText}
      </span>,
    );
  }

  return nodes;
}

function renderHeading(level: number, text: string, key: string): ReactNode {
  const common = "mt-4 mb-2 font-semibold text-white";
  if (level === 1) {
    return (
      <h1 key={key} className={`${common} text-2xl`}>
        {renderInline(text)}
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2 key={key} className={`${common} text-xl`}>
        {renderInline(text)}
      </h2>
    );
  }
  if (level === 3) {
    return (
      <h3 key={key} className={`${common} text-lg`}>
        {renderInline(text)}
      </h3>
    );
  }
  if (level === 4) {
    return (
      <h4 key={key} className={`${common} text-base`}>
        {renderInline(text)}
      </h4>
    );
  }
  if (level === 5) {
    return (
      <h5 key={key} className={`${common} text-sm`}>
        {renderInline(text)}
      </h5>
    );
  }

  return (
    <h6 key={key} className={`${common} text-xs`}>
      {renderInline(text)}
    </h6>
  );
}

function isTableRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  if (trimmed.startsWith("|") || trimmed.endsWith("|")) return true;
  const parts = trimmed.split("|").map((part) => part.trim());
  return parts.length >= 2 && parts.every((part) => part.length > 0);
}

function splitTableCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

function isDelimiterCell(cell: string) {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function parseTableLines(
  lines: string[],
): { header: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  if (!isTableRow(lines[0]) || !isTableRow(lines[1])) return null;

  const header = splitTableCells(lines[0]);
  const delimiter = splitTableCells(lines[1]);
  if (!header.length || !delimiter.length) return null;
  if (delimiter.length < header.length) return null;
  if (!delimiter.slice(0, header.length).every(isDelimiterCell)) return null;

  const rows: string[][] = [];
  for (const line of lines.slice(2)) {
    if (!isTableRow(line)) return null;
    const cells = splitTableCells(line);
    if (!cells.length) return null;
    rows.push(cells);
  }

  return { header, rows };
}

function renderTextBlock(text: string, keyPrefix: string): ReactNode[] {
  const result: ReactNode[] = [];
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  let paragraphOffset = 0;
  for (
    let paragraphIndex = 0;
    paragraphIndex < paragraphs.length;
    paragraphIndex++
  ) {
    const paragraph = paragraphs[paragraphIndex];
    const paragraphKey = makeKey(
      `${keyPrefix}-paragraph`,
      paragraph,
      paragraphOffset,
    );
    const lines = paragraph.split("\n").map((line) => line.trim());

    const tableCandidateLines = [...lines];
    let consumedParagraphs = 1;
    if (lines.length === 1 && isTableRow(lines[0])) {
      for (
        let nextIndex = paragraphIndex + 1;
        nextIndex < paragraphs.length;
        nextIndex++
      ) {
        const nextLines = paragraphs[nextIndex]
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (nextLines.length !== 1 || !isTableRow(nextLines[0])) break;
        tableCandidateLines.push(nextLines[0]);
        consumedParagraphs++;
      }
    }

    const tableData = parseTableLines(tableCandidateLines);
    if (tableData) {
      const rowNodes: ReactNode[] = [];
      let rowOffset = 0;
      for (const row of tableData.rows) {
        const cellNodes: ReactNode[] = [];
        let cellOffset = 0;
        for (const cell of row) {
          cellNodes.push(
            <td
              key={makeKey(`${paragraphKey}-td`, cell, rowOffset + cellOffset)}
              className="border border-white/15 px-3 py-2 align-top"
            >
              {renderInline(cell)}
            </td>,
          );
          cellOffset += cell.length;
        }
        rowNodes.push(
          <tr key={makeKey(`${paragraphKey}-tr`, row.join("|"), rowOffset)}>
            {cellNodes}
          </tr>,
        );
        rowOffset += row.join("|").length;
      }

      let headerOffset = 0;
      result.push(
        <div
          key={makeKey(
            `${paragraphKey}-table-wrap`,
            paragraph,
            paragraphOffset,
          )}
          className="my-3 overflow-x-auto"
        >
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {tableData.header.map((headerCell) => {
                  const node = (
                    <th
                      key={makeKey(
                        `${paragraphKey}-th`,
                        headerCell,
                        headerOffset,
                      )}
                      className="border border-white/20 bg-white/6 px-3 py-2 font-semibold text-white"
                    >
                      {renderInline(headerCell)}
                    </th>
                  );
                  headerOffset += headerCell.length;
                  return node;
                })}
              </tr>
            </thead>
            <tbody>{rowNodes}</tbody>
          </table>
        </div>,
      );

      for (
        let consumedIndex = paragraphIndex;
        consumedIndex < paragraphIndex + consumedParagraphs;
        consumedIndex++
      ) {
        paragraphOffset += paragraphs[consumedIndex].length;
      }
      paragraphIndex += consumedParagraphs - 1;
      continue;
    }

    const singleLine = lines.length === 1 ? lines[0] : null;

    if (singleLine) {
      const compact = singleLine.replace(/\s+/g, "");
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(compact)) {
        result.push(
          <hr
            key={paragraphKey}
            className="my-4 border-0 border-t border-white/20"
          />,
        );
        paragraphOffset += paragraph.length;
        continue;
      }

      const headingMatch = singleLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        result.push(renderHeading(level, headingText, paragraphKey));
        paragraphOffset += paragraph.length;
        continue;
      }
    }

    const isList =
      lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));

    if (isList) {
      const listItems: ReactNode[] = [];
      let lineOffset = 0;
      for (const line of lines) {
        const itemText = line.replace(/^[-*]\s+/, "");
        listItems.push(
          <li key={makeKey(`${paragraphKey}-li`, line, lineOffset)}>
            {renderInline(itemText)}
          </li>,
        );
        lineOffset += line.length;
      }

      result.push(
        <ul key={paragraphKey} className="my-2 list-disc space-y-1 pl-5">
          {listItems}
        </ul>,
      );
      paragraphOffset += paragraph.length;
      continue;
    }

    const lineNodes: ReactNode[] = [];
    let lineOffset = 0;
    for (const line of lines) {
      lineNodes.push(
        <span key={makeKey(`${paragraphKey}-line`, line, lineOffset)}>
          {lineOffset > 0 && <br />}
          {renderInline(line)}
        </span>,
      );
      lineOffset += line.length;
    }

    result.push(
      <p key={paragraphKey} className="my-2">
        {lineNodes}
      </p>,
    );
    paragraphOffset += paragraph.length;
  }

  return result;
}

export function MarkdownLite({ content }: { content: string }) {
  const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);
  const nodes: ReactNode[] = [];

  let blockOffset = 0;
  for (const block of blocks) {
    if (block.startsWith("```") && block.endsWith("```")) {
      const raw = block.slice(3, -3).replace(/^\n/, "");
      const lineBreakIndex = raw.indexOf("\n");
      const firstLine =
        lineBreakIndex === -1 ? raw : raw.slice(0, lineBreakIndex);
      const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine.trim());
      const language = hasLang ? firstLine.trim() : "";
      const code = hasLang ? raw.slice(lineBreakIndex + 1) : raw;
      const normalizedLanguage = normalizeLanguage(language);

      nodes.push(
        <div
          key={makeKey("block-code", block, blockOffset)}
          className="my-3 overflow-hidden rounded-lg border border-white/15 bg-black/35"
        >
          {language && (
            <div className="border-b border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-white/60">
              {language}
            </div>
          )}
          <pre className="overflow-x-auto p-3">
            <code className="block whitespace-pre font-mono text-[13px] leading-6">
              {renderHighlightedCode(
                code,
                normalizedLanguage,
                makeKey("code", block, blockOffset),
              )}
            </code>
          </pre>
        </div>,
      );
    } else {
      nodes.push(
        <div key={makeKey("block-text", block, blockOffset)}>
          {renderTextBlock(block, makeKey("text", block, blockOffset))}
        </div>,
      );
    }
    blockOffset += block.length;
  }

  return <>{nodes}</>;
}
