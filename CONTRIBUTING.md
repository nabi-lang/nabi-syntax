# Contributing to nabi-syntax

This repository is the one source of Nabi's syntax highlighting: the
TextMate grammars (`grammars/`), the tree-sitter grammars and queries
(`tree-sitter/nabi`, `tree-sitter/nabion`), and the Nabi library in `src/`
(a tokenizer and HTML highlighter). The editor
repositories copy from here: nabi.vscode the TextMate grammars, nabi.vim and
nabi.zed the queries and keyword lists. A change here reaches an editor
when that repository syncs to the new commit.

## Where a change goes

- A keyword: `grammars/keywords.nabion`, which the grammar test runners
  check against, plus the grammars and `src/lib.nabi` that must know it.
- A token class (its TextMate scope, tree-sitter capture, LSP type and
  library `Kind`): `grammars/classes.nabion` and the table in
  [docs/token-classes.md](docs/token-classes.md), together.
- Syntax: the TextMate grammar, `tree-sitter/<lang>/grammar.js` and
  `src/lib.nabi` in the same change, so the three agree.
- Every change adds or extends a file in `corpus/`: small `.nabi` and
  `.nabion` sources with `// SYNTAX TEST` assertions of the scope each
  column must have. All three implementations are tested against it.

## Building and testing

Needs Node.js 24 (for the test runners and the tree-sitter CLI 0.27 from
`npm ci`) and a Nabi toolchain.

```sh
npm ci
npm test                 # TextMate and tree-sitter grammars against corpus/
npm run check            # tsc over the runners
nabi test                # the library against the same corpus
nabi fmt --check
```

After editing a `grammar.js`, regenerate its parser (the generated `src/`
is checked in and tested as committed) and run its own tests:

```sh
cd tree-sitter/nabi      # or tree-sitter/nabion
../../node_modules/.bin/tree-sitter generate
../../node_modules/.bin/tree-sitter test --config-path test/config.json
```

`node scripts/test-textmate.ts --dump FILE` (or `test-tree-sitter.ts`)
prints the scopes or captures of each line, which helps when writing corpus
assertions. With checkouts of nabi-lang/docs and nabi-lang/nabi beside this
repository, `tree-sitter/scripts/smoke.ts` parses every guide example and
test case (see the README).

## Submitting

Open a pull request against `main` with the checks above passing, and say
which editors the change affects. By contributing you agree that your work
is licensed under both MIT and Apache-2.0, the project's dual license.

## Sign your work

Nabi uses the [Developer Certificate of Origin 1.1](https://developercertificate.org/)
(DCO) instead of a CLA. By adding a `Signed-off-by` line to a commit you
certify that you wrote the change, or otherwise have the right to submit it
under this repository's license. `git commit -s` adds the line:

```text
Signed-off-by: Your Name <you@example.com>
```

Use your name and an email you can be reached at; the email must be the
commit's author email. The `DCO / Check sign-off` check fails a pull request with an
unsigned commit. To fix it, run `git commit --amend -s` (last commit) or
`git rebase --signoff main` (every commit), then push again. The full text
of the DCO is in the
[organization's CONTRIBUTING.md](https://github.com/nabi-lang/.github/blob/main/CONTRIBUTING.md#developer-certificate-of-origin).
