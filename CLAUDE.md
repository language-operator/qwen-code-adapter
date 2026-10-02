# CLAUDE.md

Guidance for working in the `qwen-code-adapter` repository. It was created from the
`opencode-adapter` template.

## What this is

A [Language Operator](https://github.com/language-operator) **runtime** that runs the
**Qwen Code** TUI as a Kubernetes workload. The TUI runs inside tmux and is fronted by an
xterm.js / WebSocket terminal, so working with the agent feels like a real terminal
session.

It is a **thin layer over
[`coding-runtime`](https://github.com/language-operator/coding-runtime)**. The base owns
the OS layer, the web terminal (node-pty over a WebSocket, with a cross-origin guard and
a keepalive), `tini`, and the ETL that turns the operator's `/etc/agent/config.yaml` into
a normalized config. This repo adds the Qwen Code CLI plus three files that describe it to
the base.

One container, running the base entrypoint: resolve the environment, seed config, serve.
There is **no init container** — seeding happens in the agent container, because the
operator mounts `/tmp` there only, so an init container would share no writable path with
it.

## Key files

- `Dockerfile` — `FROM ${BASE}` plus one `npm install -g @qwen-code/qwen-code`, which
  installs the `qwen` binary. `ARG BASE` pins the base by **tag and digest**, and is the
  only place the base version appears.
- `runtime.json` — the manifest: where config goes, the serving surface, how tmux
  launches the TUI. Owned here: `coding-runtime` has no Qwen Code example to copy.
- `emit.mjs` — the emitter: normalized config → `$QWEN_HOME/settings.json` (the manifest
  points `QWEN_HOME` at `${STATE_DIR}/qwen-code`). It writes the gateway as Qwen Code's
  OpenAI auth plus the primary model, owning those four keys only, since Qwen keeps its
  own state in the same file. Without a selected auth type the TUI opens on a provider
  picker that swallows keystrokes, and the conformance suite fails. MCP servers and
  `QWEN.md` instructions are issue #1.
- `launch-qwen-code.sh` — what tmux runs: `qwen` in the project directory. Resuming a
  slept agent's conversation is not handled yet (issue #1).
- `chart/` — the Helm chart registering the cluster-scoped `LanguageAgentRuntime` named
  `qwen-code`.
- `.github/workflows/` — `test.yaml`, `build-image.yaml`, `release-chart.yaml`.

## Testing

- `make test` — builds the image and runs coding-runtime's conformance suite in `adapter`
  mode. The suite is **extracted from the image under test**, so the checks always match
  the runtime being checked; it runs the container the way the operator does (read-only
  root, uid 1000, all capabilities dropped). Needs Docker.
- `make lint-chart` — `helm lint chart` plus `helm template qwen-code chart`.
- There is **no linter and no unit-test suite**. CI correctness is exactly the two
  `test.yaml` jobs: `image-test` and `chart-lint`.
- Changes to the terminal, the emitter or the manifest are mostly **not** covered by
  anything local — the conformance suite checks the runtime contract, not Qwen Code's
  behaviour. Say so plainly rather than implying a green build proves more than it does.
- The PR title must be a conventional commit (`feat:`, `fix:`, `chore:`, `docs:`).

## Build & dev deploy

- `make build` — build `ghcr.io/language-operator/qwen-code-adapter:<git-sha>` + `:latest`.
- `make dev` — build, import into local k3s, and `helm upgrade` the runtime (requires the
  `language-operator` chart / `LanguageAgentRuntime` CRD installed first).
- `make publish` — push image tags to ghcr.io. `make uninstall` — remove the release.

## Releases

Cut a release with `/release major|minor|patch` (`.claude/commands/release.md`). Version
is kept in **lockstep**: `chart/Chart.yaml` `version` + `appVersion`, `chart/values.yaml`
`image.tag`, and the git tag `vX.Y.Z` all become the same `X.Y.Z`. Pushing a `v*` tag
triggers `build-image.yaml` and `release-chart.yaml`.

Two rules the hard way:

- **Chart publishing is restricted to `v*` tags.** It once ran on every push to `main`,
  which republished an already-published chart version in place — pairing a new template
  with the old image it names. `release-chart.yaml` also refuses to push a version that
  already exists.
- **Never pin a `main` or `sha-` build of the base.** Those record their version literal
  as `main`, which no `requires.codingRuntime` range can satisfy, and which fails the
  conformance suite's own semver check. Released tags only.

Bumping the base, the Qwen Code CLI or the GitHub Actions is `/update-dependencies`, not
`/release` — they are separate decisions.

## Issue-driven workflow

`/iterate [#issue] [--auto]` handles **one** issue, from selection to a merged PR and a
closed issue, then stops. For continuous work, use `/loop /iterate`. Work happens inside a
git worktree under `.claude/worktrees/`.

It comes from the shared `langop` plugin in
[`language-operator/skills`](https://github.com/language-operator/skills), pinned to a tag
in `.claude/settings.json` — not from a copy in this repo, which is what it replaced.
`/iterate` and `/langop:iterate` both invoke it. There is nothing per-repo in the skill
itself: it reads `## Testing` above to learn how to test a change here, so keep that section
accurate.

Interactive sessions need no install step — the plugin loads at the pinned tag once the folder
is trusted. Non-interactive ones (`claude -p`, scheduled or in-cluster agents) have no trust
dialog, so they need this once, with the tag the repo pins:

```bash
claude plugin marketplace add 'language-operator/skills#v0.1.0'
claude plugin install langop@language-operator --scope project
```

Two things to avoid: a marketplace add without `#<tag>` follows `main` rather than the pin,
and `--scope project` on the *marketplace* add rewrites `.claude/settings.json` and drops
its `ref`. To take a newer release, change `ref` there.
