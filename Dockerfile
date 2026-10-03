# -----------------------------------------------------------------------------
# Qwen Code adapter.
#
# The OS layer, the web terminal, tini, and the /etc/agent/config.yaml ETL all
# live in coding-runtime. What is left here is the Qwen Code CLI plus the three
# files that describe it to the base: a manifest, an emitter, and a launcher.
#
# The base is pinned by tag *and* digest. Never :latest, and never a `main`
# build — metadata-action stamps those with the version literal `main`, which no
# `requires.codingRuntime` range can satisfy, so every boot would warn about a
# version mismatch that is not real.
# -----------------------------------------------------------------------------
ARG BASE=ghcr.io/language-operator/coding-runtime:0.1.6@sha256:318a540d9d062689d3ed6c0de34fb353ff076bb16c5770bcf296398c6e5a5412
ARG QWEN_CODE_VERSION=0.24.7

FROM ${BASE}
ARG QWEN_CODE_VERSION

# Qwen Code CLI (TUI), installed as `qwen`. Needs Node 22+; the base ships 24.
# Pinned — do not track `latest`, so runtime behaviour is reproducible.
USER root
RUN npm install -g --no-audit --no-fund "@qwen-code/qwen-code@${QWEN_CODE_VERSION}" \
    && npm cache clean --force

# runtime.json           — what this adapter is: config dir, serving surface,
#                          tmux launch, task command.
# emit.mjs               — normalized operator config -> Qwen Code settings,
#                          QWEN.md and the task prompt.
# launch-qwen-code       — what tmux runs inside the terminal.
# launch-qwen-code-task  — the one-shot run for a task-mode agent.
COPY runtime.json /etc/coding-runtime/runtime.json
COPY emit.mjs /opt/adapter/emit.mjs
COPY --chmod=755 launch-qwen-code.sh /usr/local/bin/launch-qwen-code
COPY --chmod=755 launch-qwen-code-task.sh /usr/local/bin/launch-qwen-code-task

# The operator pins the agent container to uid 1000 with no override, and the
# base already has a matching passwd entry. Do not create a user here.
USER node
