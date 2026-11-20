# Changelog

All notable changes to this package. Versions follow semver, independent of the Nabi toolchain.

## 0.1.0 (unreleased)

First release.

- TextMate grammars `source.nabi` and `source.nabion`, for any TextMate host
  (VS Code, Shiki, GitHub Linguist, Sublime Text, bat).
- tree-sitter grammars `nabi` and `nabion` with generated parsers checked
  in, and `highlights`, `locals`, `injections`, `folds` and `indents`
  queries in nvim-treesitter capture names.
- The Nabi library: `highlight_nabi`, `highlight_nabion`, `tokens`,
  `tokens_nabion` and `to_html`, with `Token` and `Kind`.
- One token-class table (`grammars/classes.nabion`) mapping TextMate scope,
  tree-sitter capture, LSP semantic token type and library `Kind`, and the
  keyword lists in `grammars/keywords.nabion`.
- A shared corpus that the TextMate grammars, the tree-sitter grammars and
  the library are all tested against.
- The library needs Nabi 0.1 or later.
