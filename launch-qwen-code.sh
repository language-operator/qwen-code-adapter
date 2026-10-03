#!/bin/sh
# What tmux runs. The base already starts tmux in the working directory (the
# cloned repo when the agent sets spec.repository, else /workspace), so the TUI
# opens straight into the project.
#
# Config — gateway, model, MCP servers, approval mode — is read from
# $QWEN_HOME/settings.json, and persona and instructions from $QWEN_HOME/QWEN.md,
# both written by `coding-runtime seed`.
#
# Sessions live under $QWEN_HOME on the workspace PVC, which outlives the pod.
# Sleeping an agent destroys the pod and waking it makes a new one, and this
# exec is the only moment a resume decision can be made — tmux is started with
# `new-session -A`, so on a reconnect to a live pod the launcher is never re-run.
# Without --continue a woken agent always opens blank.
#
# --continue is passed unconditionally. Qwen Code resumes the most recent
# session for this project, and with none it opens an ordinary fresh prompt —
# no placeholder session and no error, so the guard opencode needed is not
# needed here.
set -eu

exec qwen --continue "$@"
