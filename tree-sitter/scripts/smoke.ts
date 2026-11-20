#!/usr/bin/env node
// Parse smoke test: counts files with ERROR or MISSING nodes among the
// ```nabi (or ```nabion) blocks of Markdown docs and a compiler test corpus.
//
//   node scripts/smoke.ts --grammar nabi --docs ../docs/learn \
//       --cases ../nabi/tests/cases [--nabic path/to/nabic] [-v]
//
// A case whose header has `// expect-error:` is skipped when nabic reports
// a lexical or parse error for it. Without --nabic every `expect-error`
// case is skipped.
// --skip-list FILE names the cases to skip instead (one file name a line);
// --write-skip-list FILE saves the list --nabic found.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A file to parse: where it came from, its path, and how a report names it.
interface Source {
  kind: 'docs' | 'cases';
  file: string;
  label: string;
}

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const grammar = opt('--grammar') ?? 'nabi';
const docs = opt('--docs');
const cases = opt('--cases');
const nabic = opt('--nabic');
const verbose = args.includes('-v');
const skipList = opt('--skip-list');
const writeSkip = opt('--write-skip-list');
const skipNames = skipList
  ? new Set(fs.readFileSync(skipList, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))
  : null;
const skippedNames: string[] = [];

const here = path.dirname(new URL(import.meta.url).pathname);
const gdir = path.join(here, '..', grammar);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `ts-${grammar}-`));
const fence = grammar === 'nabi' ? /^```nabi(\s+(norun|build))?\s*$/ : /^```nabion\s*$/;

const files: Source[] = [];

if (docs) {
  for (const md of fs.readdirSync(docs).filter((f) => f.endsWith('.md')).sort()) {
    const lines = fs.readFileSync(path.join(docs, md), 'utf8').split('\n');
    let block: string[] | null = null;
    let n = 0;
    for (const line of lines) {
      if (block === null && fence.test(line)) {
        block = [];
      } else if (block !== null && /^```\s*$/.test(line)) {
        n += 1;
        const out = path.join(tmp, `${md.replace(/\.md$/, '')}-${n}.${grammar}`);
        fs.writeFileSync(out, block.join('\n') + '\n');
        files.push({ kind: 'docs', file: out, label: `${md} block ${n}` });
        block = null;
      } else if (block !== null) {
        block.push(line);
      }
    }
  }
}

let skipped = 0;
if (cases) {
  for (const f of fs.readdirSync(cases).filter((f) => f.endsWith(`.${grammar}`)).sort()) {
    const full = path.join(cases, f);
    const src = fs.readFileSync(full, 'utf8');
    const head = src.split('\n').filter((l) => l.startsWith('//')).join('\n');
    const skip = skipNames
      ? skipNames.has(f)
      : /expect-error/.test(head) && parseFails(full);
    if (skip) {
      skipped += 1;
      skippedNames.push(f);
      continue;
    }
    files.push({ kind: 'cases', file: full, label: f });
  }
}

function parseFails(file: string): boolean {
  if (!nabic) {
    return true;
  }
  const dir = fs.mkdtempSync(path.join(tmp, 'nabic-'));
  fs.copyFileSync(file, path.join(dir, `x.${grammar}`));
  const r = spawnSync(nabic, ['emit', '--emit=source', '--message-format=json', `x.${grammar}`], {
    cwd: dir,
    encoding: 'utf8',
  });
  return /"type":"error","code":"E\d+","kind":"(lexical|parse)"/.test(r.stdout ?? '');
}

const bad = new Map<string, string>();
const cli = [
  path.join(gdir, 'node_modules', '.bin', 'tree-sitter'),
  path.join(here, '..', '..', 'node_modules', '.bin', 'tree-sitter'),
].find((f) => fs.existsSync(f)) ?? 'tree-sitter';
for (let i = 0; i < files.length; i += 200) {
  const batch = files.slice(i, i + 200);
  const r = spawnSync(cli, ['parse', '-q', ...batch.map((f) => f.file)], {
    cwd: gdir,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  for (const line of (r.stdout + r.stderr).split('\n')) {
    const m = line.match(/^(\S+)\s+Parse:.*\((ERROR|MISSING)/);
    if (m) {
      bad.set(m[1]!, line.trim());
    }
  }
}

for (const kind of ['docs', 'cases'] as const) {
  const all = files.filter((f) => f.kind === kind);
  if (all.length === 0) {
    continue;
  }
  const failed = all.filter((f) => bad.has(f.file));
  console.log(`${kind}: ${all.length} files, ${failed.length} with ERROR/MISSING`);
  if (verbose) {
    for (const f of failed) {
      console.log(`  ${f.label}: ${bad.get(f.file)!.replace(/^.*Parse:\s+[\d.]+ ms\s+\d+ bytes\/ms\s+/, '')}`);
    }
  }
}
if (writeSkip) {
  fs.writeFileSync(writeSkip, skippedNames.join('\n') + '\n');
}
if (cases) {
  console.log(`cases skipped (expected parse errors): ${skipped}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
