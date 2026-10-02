#!/bin/sh
# What tmux runs. The base already starts tmux in the working directory (the
# cloned repo when the agent sets spec.repository, else /workspace), so the TUI
# opens straight into the project.
#
# Not yet handled, and left to issue #1: resuming a slept agent's conversation.
# A woken agent is a new pod and a new tmux server, and this exec is the only
# moment a resume decision can be made — but which flag Qwen Code takes and
# where it keeps its sessions are still to be verified, and passing a resume
# flag with nothing to resume can misbehave on a brand-new agent's first boot.
set -eu

exec qwen "$@"
