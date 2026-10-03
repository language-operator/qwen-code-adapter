# qwen-code-adapter

The **Qwen Code** runtime for the [Language Operator](https://github.com/language-operator/language-operator),
running as a native Kubernetes workload. Created from the `opencode-adapter` template.

It builds the runtime image and the Helm chart that registers the `qwen-code`
`LanguageAgentRuntime`. The [Qwen Code](https://github.com/QwenLM/qwen-code) TUI runs
inside tmux and is fronted by an xterm.js / WebSocket terminal in the browser, so
working with the agent feels like a real terminal session.

> **Status:** feature-complete, not yet released. Dev-cluster acceptance and the
> v0.1.0 release are tracked separately.

## Architecture

The image is [`coding-runtime`](https://github.com/language-operator/coding-runtime)
plus the Qwen Code CLI (`qwen`). The base owns the OS layer, the web terminal
(xterm.js over a node-pty WebSocket bridge, with a cross-origin guard and a 25s
keepalive), `tini`, and the ETL that turns the operator's `/etc/agent/config.yaml`
into a normalized config. What lives here is the files that describe Qwen Code to it:

- **`runtime.json`** — the manifest: where config goes (`QWEN_HOME`, set to
  `$STATE_DIR/qwen-code`), the serving surface, how tmux launches the TUI, and the
  command for a task-mode run.
- **`emit.mjs`** — the emitter. Into `$QWEN_HOME/settings.json`: the gateway as Qwen
  Code's OpenAI-compatible auth, the primary model, MCP servers (`httpUrl`, with any
  headers written as `${NAME}` references so tokens stay off disk), and the approval
  mode. Persona and instructions go to `$QWEN_HOME/QWEN.md`, which Qwen loads as
  standing context for every session.
- **`launch-qwen-code.sh`** — what tmux runs. The base has already set the working
  directory (the cloned repo when the agent sets `spec.repository`, else
  `/workspace`), so it opens that project directly, with `--continue` so an agent
  woken from sleep resumes its conversation.
- **`launch-qwen-code-task.sh`** — the task-mode run (`spec.execution.mode: task`):
  the agent's instructions as a one-shot prompt, with every tool call approved. Its
  exit code is the run's result.

**Approval.** In the browser terminal Qwen Code asks before file edits and shell
commands (`tools.approvalMode: default`; Shift+Tab cycles modes). Qwen's own default,
an LLM classifier, is not used: every check would be an extra model call through the
gateway. A task run approves everything, since nobody is there to answer — the pod's
posture (read-only root, uid 1000, no capabilities) is the boundary.

One container, running the base entrypoint: resolve the environment, seed config,
serve. Seeding runs in the agent container rather than an init container because
the operator mounts `/tmp` there only, so the two would share no writable path.
tmux keeps the session alive across browser reconnects.

The sibling [`claude-code-adapter`](https://github.com/language-operator/claude-code-adapter)
is the same shape on the same base, swapping the CLI and these files.

## Install

Prerequisite: the [`language-operator`](https://github.com/language-operator/language-operator)
chart must be installed first — it provides the `LanguageAgentRuntime` CRD.

```bash
helm install qwen-code oci://ghcr.io/language-operator/charts/qwen-code \
  --namespace language-operator
```

Then reference it from a `LanguageAgent`:

```yaml
apiVersion: langop.io/v1alpha1
kind: LanguageAgent
metadata:
  name: my-agent
spec:
  runtime: qwen-code
```

## Authentication

The runtime sets `auth.enabled: true`, so access is gated entirely by the cluster's
OIDC proxy: when the `LanguageCluster` has auth enabled the operator injects an
oauth2-proxy sidecar in front of the terminal. There is no built-in password — if
the cluster does not enable auth, the terminal is exposed unauthenticated on its
ingress. Qwen Code itself reaches the model gateway via the provider config the
emitter seeds; no interactive login is needed.

## Development

```bash
make build      # docker build -t ghcr.io/language-operator/qwen-code-adapter:latest .
make test       # build, then run the coding-runtime conformance suite
make publish    # build and push the image to ghcr.io
make dev        # build, import into k3s, and upgrade the runtime release (inner loop)

helm lint chart
helm template qwen-code chart
```

## CI

- `build-image.yaml` — builds and pushes the image to `ghcr.io` on push to `main` and `v*` tags.
- `release-chart.yaml` — packages `chart/` and pushes it to `oci://ghcr.io/language-operator/charts`.
- `test.yaml` — builds the image, runs the `coding-runtime` conformance suite against
  it under the operator's posture (read-only root, uid 1000, all capabilities dropped),
  and lints/templates the chart on every PR. The suite is taken out of the image rather
  than fetched, so the checks always match the runtime being checked, and no failures are
  tolerated.
