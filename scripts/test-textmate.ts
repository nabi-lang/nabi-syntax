// Checks the TextMate grammars against the corpus assertions.
//
//   node scripts/test-textmate.ts              run every corpus file
//   node scripts/test-textmate.ts FILE..       run some files
//   node scripts/test-textmate.ts --dump FILE  print each line's tokens
//
// Assertion syntax is vscode-tmgrammar-test's.
// Every scope a grammar names, and every scope the corpus asserts, must
// have a row in grammars/classes.nabion.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vsctm from "vscode-textmate";
import type { IToken } from "vscode-textmate";
import onig from "vscode-oniguruma";
import { root, classOf, parseCorpus, corpusFiles, keywords } from "./corpus.ts";

// The parts of a tmLanguage.json the checks read.
interface GrammarJson {
  patterns?: unknown;
  repository?: unknown;
}

// A rule with a `match`: the scopes from its `name` and `captures`, and
// the regex.
type Rule = [names: unknown[], match: string];

// A shebang case: the source lines, the 0-based line to check, and the
// scope its first token must have (null: no comment scope).
type ShebangCase = [lines: string[], line: number, want: string | null];

const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object";

const require = createRequire(import.meta.url);

const grammarFiles: Record<string, string> = {
  "source.nabi": path.join(root, "grammars/nabi.tmLanguage.json"),
  "source.nabion": path.join(root, "grammars/nabion.tmLanguage.json"),
};

const wasm = fs.readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
const registry = new vsctm.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (p: string[]) => new onig.OnigScanner(p),
    createOnigString: (s: string) => new onig.OnigString(s),
  }),
  loadGrammar: async (scope: string) => {
    const f = grammarFiles[scope];
    return f ? vsctm.parseRawGrammar(fs.readFileSync(f, "utf8"), f) : null;
  },
});

function grammarScopes(g: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(g)) g.forEach((x: unknown) => grammarScopes(x, acc));
  else if (isObject(g)) {
    for (const [k, v] of Object.entries(g)) {
      if ((k === "name" || k === "contentName") && typeof v === "string") acc.add(v);
      else grammarScopes(v, acc);
    }
  }
  return acc;
}

// [names, match] of every rule with a `match`, names from `name` and
// `captures`.
function grammarRules(g: unknown, acc: Rule[] = []): Rule[] {
  if (Array.isArray(g)) g.forEach((x: unknown) => grammarRules(x, acc));
  else if (isObject(g)) {
    if (typeof g.match === "string") {
      const caps = isObject(g.captures) ? Object.values(g.captures) : [];
      const names = [g.name, ...caps.map((c) => (isObject(c) ? c.name : undefined))].filter(Boolean);
      acc.push([names, g.match]);
    }
    for (const v of Object.values(g)) grammarRules(v, acc);
  }
  return acc;
}

// The grammars give each word of grammars/keywords.nabion its scope, and
// every word of a keyword rule is listed.
function checkKeywords(lang: string, g: GrammarJson): string[] {
  const fails: string[] = [];
  const rules = grammarRules([g.patterns, g.repository]);
  const lists = keywords.filter((k) => k.lang === lang);
  for (const { scope, words } of lists) {
    const named = rules.filter(([names]) => names.includes(`${scope}.${lang}`));
    for (const w of words) {
      const re = new RegExp(`(?:^|[(|:)])${w}(?:[|)(]|$)`);
      if (!named.some(([, m]) => re.test(m))) fails.push(`keywords.nabion: ${lang} ${w}: no ${scope}.${lang} rule matches it`);
    }
    for (const [, m] of named) {
      const alt = m.match(/^\(\?<!\[[^\]]*\]\)\(\?:([\w|]+)\)/);
      for (const w of alt ? alt[1]!.split("|") : []) {
        if (!words.includes(w)) fails.push(`grammars/${lang}.tmLanguage.json: ${w} (${scope}) is not in keywords.nabion`);
      }
    }
  }
  return fails;
}

async function tokenize(scope: string, lines: string[]): Promise<IToken[][]> {
  const g = await registry.loadGrammar(scope);
  if (!g) throw new Error(`no grammar for ${scope}`);
  let stack = vsctm.INITIAL;
  return lines.map((line) => {
    const r = g.tokenizeLine(line, stack);
    stack = r.ruleStack;
    return r.tokens;
  });
}

async function run(file: string): Promise<{ checks: number; fails: string[] }> {
  const { scope, lines, checks } = parseCorpus(fs.readFileSync(file, "utf8"));
  const toks = await tokenize(scope, lines);
  const fails: string[] = [];
  for (const c of checks) {
    for (const s of [...c.scopes, ...c.not]) {
      if (!classOf(s)) fails.push(`${file}:${c.at}: scope ${s} has no row in grammars/classes.nabion`);
    }
    for (const col of c.cols) {
      const t = toks[c.line]!.find((t) => t.startIndex <= col && col < t.endIndex);
      const have = t ? t.scopes : [];
      const miss = c.scopes.filter((s) => !have.includes(s));
      const bad = c.not.filter((s) => have.includes(s));
      if (miss.length || bad.length) {
        const ch = lines[c.line]![col] ?? "";
        fails.push(`${path.relative(root, file)}:${c.at}: col ${col} ${JSON.stringify(ch)}: ` +
          (miss.length ? `missing ${miss.join(" ")}` : "") +
          (bad.length ? ` unexpected ${bad.join(" ")}` : "") + `\n    have ${have.join(" ")}`);
      }
    }
  }
  return { checks: checks.length, fails };
}

async function dump(file: string): Promise<void> {
  const { scope, lines } = parseCorpus(fs.readFileSync(file, "utf8"));
  const toks = await tokenize(scope, lines);
  lines.forEach((line, i) => {
    console.log(`${i + 1}: ${line}`);
    for (const t of toks[i]!) {
      const text = line.slice(t.startIndex, t.endIndex);
      if (text.trim()) console.log(`    ${t.startIndex} ${JSON.stringify(text)} ${t.scopes.slice(1).join(" ")}`);
    }
  });
}

const args = process.argv.slice(2);
if (args[0] === "--dump") {
  for (const f of args.slice(1)) await dump(f);
  process.exit(0);
}

let failed = 0;
// Every scope a grammar names maps to a class.
for (const f of Object.values(grammarFiles)) {
  const g = JSON.parse(fs.readFileSync(f, "utf8")) as GrammarJson;
  for (const s of grammarScopes([g.patterns, g.repository])) {
    if (!classOf(s)) {
      console.log(`${path.relative(root, f)}: scope ${s} has no row in grammars/classes.nabion`);
      failed++;
    }
  }
}

for (const [scope, f] of Object.entries(grammarFiles)) {
  for (const m of checkKeywords(scope.slice("source.".length), JSON.parse(fs.readFileSync(f, "utf8")) as GrammarJson)) {
    console.log(m);
    failed++;
  }
}

const files = corpusFiles(args);
let total = 0;

// The shebang is only on a file's first line, where the corpus has its
// header, so it is checked here.
const shebang: ShebangCase[] = [
  [["#!/usr/bin/env nabi", "let x = 1;"], 0, "comment.line.shebang.nabi"],
  [["#!/usr/bin/env nabi", "let x = 1;"], 1, "storage.type.nabi"],
  [["#![allow(unused)]"], 0, "meta.attribute.nabi"],
  [["let x = 1;", "#!/x"], 1, null],
];
for (const [lines, line, want] of shebang) {
  const t = (await tokenize("source.nabi", lines))[line]![0]!.scopes;
  const ok = want ? t.includes(want) : !t.some((s) => s.startsWith("comment"));
  total++;
  if (!ok) {
    console.log(`shebang: ${JSON.stringify(lines)} line ${line + 1}: want ${want ?? "no comment"}, have ${t.join(" ")}`);
    failed++;
  }
}

for (const f of files) {
  const r = await run(f);
  total += r.checks;
  for (const m of r.fails) console.log(m);
  failed += r.fails.length;
  console.log(`${r.fails.length ? "FAIL" : "ok  "} ${path.relative(root, f)} (${r.checks} assertions)`);
}
console.log(`\n${files.length} files, ${total} assertions, ${failed} failures`);
process.exit(failed ? 1 : 0);
