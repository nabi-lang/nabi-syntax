# Releasing

A release of this package is a `v<version>` tag on `main` matching `version` in `nabi.nabion`; `publish.yml` then publishes it to packages.nabi-lang.org. The editors (nabi.vscode, nabi.zed, nabi.vim) take the grammars at a commit of their own (`nabi-syntax.rev`) and follow with their own releases.

## GitHub Linguist

Not submitted yet. GitHub highlights `.nabi` and `.nabion` files and counts them in a repository's language bar only once [github-linguist/linguist](https://github.com/github-linguist/linguist) knows the language. Its [CONTRIBUTING.md](https://github.com/github-linguist/linguist/blob/main/CONTRIBUTING.md) (checked 2026-11-21) asks for:

- **Usage first.** A new extension is added only with enough use on GitHub: at least 2000 files with that extension indexed in the last year, forks excluded, spread over many users and repositories, shown with a GitHub code search link in the PR (`path:*.nabi`). This is the blocker: open the PR once the count is there, not at 0.1.0. Check that `.nabi` is not already claimed by another language in `lib/linguist/languages.yml`; if it is, the PR also needs a heuristic.
- **A TextMate grammar** under a license in Linguist's `vendor/licenses/config.yml` (MIT is). Ours: `grammars/nabi.tmLanguage.json` (`source.nabi`) and `grammars/nabion.tmLanguage.json` (`source.nabion`), MIT OR Apache-2.0. Linguist runs them with PCRE, not Oniguruma: `script/add-grammar` reports any pattern it cannot compile. Tree-sitter grammars are not used.
- **Samples:** real-world code, a few files per language, with their license stated in the PR.

### The PR, when usage allows

In a fork of github-linguist/linguist:

```sh
script/add-grammar https://github.com/nabi-lang/nabi-syntax
```

`lib/linguist/languages.yml`, in alphabetical order, without `language_id`:

```yaml
Nabi:
  type: programming
  color: "#C9518A"
  extensions:
  - ".nabi"
  tm_scope: source.nabi
  ace_mode: text
NABION:
  type: data
  extensions:
  - ".nabion"
  tm_scope: source.nabion
  ace_mode: text
```

Samples: `samples/Nabi/` with two or three real programs from a code repository under MIT OR Apache-2.0 (a package's `src/`; not the docs, which are CC BY 4.0), and `samples/NABION/` with a `nabi.nabion` manifest and a data file. Then `script/update-ids` to add the `language_id`s, run the tests (`bundle exec rake test`), and open the PR with the search links and the samples' license. `color` is the logo's pink; GitHub may ask for a less common one.
