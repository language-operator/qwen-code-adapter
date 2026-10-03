#!/bin/sh
# What coding-runtime runs for a `spec.execution.mode: task` agent, instead of
# the TUI: one non-interactive Qwen Code run whose exit code becomes the run's
# phase — 0 is Succeeded, anything else Failed. It runs after seeding, in the
# working directory, and its output is the pod log, which is the only record a
# task run leaves.
#
# The prompt is the agent's instructions, written to $QWEN_HOME/task.md by
# `coding-runtime seed`. Persona and instructions also reach the model as
# standing context through $QWEN_HOME/QWEN.md.
#
# yolo because nobody is there to approve a tool call, and anything less stalls
# or fails the run on its first edit. The boundary is the pod the operator
# imposes — read-only root, uid 1000, no capabilities, writes confined to the
# workspace volume — so the warning Qwen prints about it is silenced.
set -eu

task="${QWEN_HOME:?QWEN_HOME is not set; is this running under coding-runtime?}/task.md"

if [ ! -s "$task" ]; then
    echo "launch-qwen-code-task: no instructions in $task; set spec.instructions on the LanguageAgent" >&2
    exit 2
fi

export QWEN_CODE_SUPPRESS_YOLO_WARNING=1
exec qwen "$(cat "$task")" --approval-mode yolo --output-format text "$@"
