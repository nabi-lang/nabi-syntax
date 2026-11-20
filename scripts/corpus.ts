// The corpus format and grammars/classes.nabion, shared by the runners.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A grammars/classes.nabion row, keyed by its scope prefix.
export interface ClassRow {
  kind: string;
  capture: string;
  lsp: string;
}

// An assertion: the asserted columns, the scopes they must have and the
// scopes after `-` they must not.
export interface Assertion {
  cols: number[];
  scopes: string[];
  not: string[];
}

// An assertion with the 0-based source line it checks and its own
// 1-based line in the corpus file.
export interface Check extends Assertion {
  line: number;
  at: number;
}

export interface Corpus {
  scope: string;
  lines: string[];
  checks: Check[];
}

// A grammars/keywords.nabion row.
export interface KeywordList {
  lang: string;
  scope: string;
  words: string[];
}

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Scope prefix -> class row, from grammars/classes.nabion (one tuple a line).
export const classes = new Map<string, ClassRow>();
for (const line of fs.readFileSync(path.join(root, "grammars/classes.nabion"), "utf8").split("\n")) {
  const m = line.match(/^\s*\(\s*"([^"]+)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\s*\),/);
  if (m) classes.set(m[1]!, { kind: m[2]!, capture: m[3]!, lsp: m[4]! });
}

// The longest classes.nabion prefix of a scope, language suffix dropped.
export function classOf(scope: string): string | null {
  let s = scope.replace(/\.(nabi|nabion)$/, "");
  for (;;) {
    if (classes.has(s)) return s;
    const dot = s.lastIndexOf(".");
    if (dot < 0) return null;
    s = s.slice(0, dot);
  }
}

// Parses an assertion line `// ^^ a b - c` or `// <~~-- a`; null if
// the line is not one.
function parseAssertion(line: string, token: string): Assertion | null {
  const at = line.indexOf(token);
  if (at < 0 || line.slice(0, at).trim() !== "") return null;
  const rest = line.slice(at + token.length);
  const lead = rest.match(/^\s*/)![0].length;
  const body = rest.slice(lead);
  const cols: number[] = [];
  let tail: string;
  if (body.startsWith("<")) {
    const m = body.match(/^<(~*)(-+)/);
    if (!m) return null;
    for (let i = 0; i < m[2]!.length; i++) cols.push(m[1]!.length + i);
    tail = body.slice(m[0].length);
  } else if (body.startsWith("^")) {
    const m = body.match(/^[\^\s]*\^/)![0];
    const base = at + token.length + lead;
    for (let i = 0; i < m.length; i++) if (m[i] === "^") cols.push(base + i);
    tail = body.slice(m.length);
  } else {
    return null;
  }
  const [pos = "", neg = ""] = tail.split(/\s-\s|^-\s/);
  const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
  return { cols, scopes: words(pos), not: words(neg) };
}

// Source lines with their assertions, from vscode-tmgrammar-test syntax.
export function parseCorpus(text: string): Corpus {
  const lines = text.split(/\r?\n/);
  const head = lines[0]!.match(/^(\S+)\s+SYNTAX TEST\s+"([^"]+)"/);
  if (!head) throw new Error('first line must be `// SYNTAX TEST "source.nabi"`');
  const token = head[1]!;
  const scope = head[2]!;
  const checks: Check[] = [];
  let src = 0;
  lines.forEach((line, i) => {
    if (i === 0) return;
    const a = parseAssertion(line, token);
    if (a) checks.push({ ...a, line: src, at: i + 1 });
    else src = i;
  });
  return { scope, lines, checks };
}

// Corpus files: the arguments, or every file in corpus/.
export function corpusFiles(args: string[]): string[] {
  if (args.length) return args;
  const dir = path.join(root, "corpus");
  return fs.readdirSync(dir).filter((f) => /\.(nabi|nabion)$/.test(f)).sort().map((f) => path.join(dir, f));
}

// Keyword lists, from grammars/keywords.nabion (one tuple a line).
export const keywords: KeywordList[] = [];
for (const line of fs.readFileSync(path.join(root, "grammars/keywords.nabion"), "utf8").split("\n")) {
  const m = line.match(/^\s*\(\s*"([^"]+)",\s*"([^"]+)",\s*\[([^\]]*)\]\s*\),/);
  if (m) keywords.push({ lang: m[1]!, scope: m[2]!, words: [...m[3]!.matchAll(/"([^"]+)"/g)].map((w) => w[1]!) });
}
