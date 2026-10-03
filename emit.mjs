/**
 * Qwen Code emitter.
 *
 * Everything lands in $QWEN_HOME, which runtime.json points at
 * ${STATE_DIR}/qwen-code:
 *
 *   settings.json  the gateway as OpenAI-compatible auth, the primary model,
 *                  MCP servers and the approval mode
 *   QWEN.md        persona and instructions, loaded as global context
 *   task.md        the instructions alone, the prompt for a task-mode run
 *
 * settings.json also holds the user's own state — `/model` writes `model.name`
 * here, and the TUI persists preferences and acknowledgements — so ownership is
 * per key, never the whole `security`, `model` or `tools` object. Every owned
 * key is supplied on every run, null included, so a withdrawn gateway, model or
 * tool does not linger.
 *
 * Without a selected auth type Qwen Code opens on a "Connect a Provider" picker
 * that swallows keystrokes, so the auth keys are what make the TUI usable at
 * all.
 */

/**
 * Qwen Code expands `$NAME` and `${NAME}` in settings strings. Used both to
 * write references and to spot a literal value it would expand by accident.
 */
const envRef = (name) => `\${${name}}`;
const CLIENT_SYNTAX = /\$(\w|\{)/;

/**
 * Service mode asks before file edits and shell commands. Qwen's own default
 * is `auto`, where an LLM classifier approves calls — each one an extra model
 * request through the gateway, and a decision nobody chose. Task mode passes
 * `--approval-mode yolo` instead, since nobody is there to approve.
 */
const APPROVAL_MODE = 'default';

/**
 * The gateway credential, as Qwen Code should see it.
 *
 * A per-agent key is written as a reference, so the credential never lands on
 * the workspace volume. Without a key, or on a base too old to render
 * references, fall back to the shared placeholder.
 */
function gatewayKey(config, renderRef) {
  if (!config.gateway.apiKeyRef || !renderRef) return config.gateway.apiKey;
  return renderRef(config.gateway.apiKeyRef, {
    path: 'gateway.apiKey',
    rewrite: envRef,
    clientSyntax: CLIENT_SYNTAX,
  }) ?? config.gateway.apiKey;
}

export function emit(config, { renderHeaders = null, renderRef = null } = {}) {
  const configDir = `${config.paths.stateDir}/qwen-code`;
  const gateway = config.gateway;

  // Every tool is Streamable HTTP by the time it reaches here — the operator
  // bridges stdio tools — so `httpUrl` is always the right transport. Headers
  // go in as `${NAME}` references, so a token is never written to disk.
  // Rendering is all-or-nothing: a server whose headers cannot all be rendered
  // is left out (the helper warns), never configured without auth to 401
  // unexplained. A base without the helper cannot honour headers at all;
  // failing the seed says so.
  const mcpServer = (tool) => {
    if (!tool.headers) return { httpUrl: tool.endpoint };
    if (!renderHeaders) {
      throw new Error(`tool '${tool.name}' has headers, which need coding-runtime's ctx.renderHeaders; rebuild on a base that provides it`);
    }
    const headers = renderHeaders(tool.headers, {
      path: `tools.${tool.name}`,
      rewrite: envRef,
      clientSyntax: CLIENT_SYNTAX,
    });
    return headers ? { httpUrl: tool.endpoint, headers } : null;
  };
  const mcpServers = config.tools.map((tool) => [tool.name, mcpServer(tool)]).filter(([, server]) => server);

  // Written in full every run, empty when there is nothing to say: the base
  // has no way to delete an owned file, so an empty one is how withdrawn
  // instructions stop applying.
  const standing = [config.systemPrompt, config.instructions].filter(Boolean).join('\n\n');
  const text = (s) => (s ? `${s}\n` : '');

  return [
    {
      path: `${configDir}/settings.json`,
      owns: [
        'security.auth.selectedType',
        'security.auth.baseUrl',
        'security.auth.apiKey',
        'model.name',
        'mcpServers',
        'tools.approvalMode',
      ],
      values: [
        ['security.auth.selectedType', gateway ? 'openai' : null],
        ['security.auth.baseUrl', gateway ? gateway.openaiBaseUrl : null],
        ['security.auth.apiKey', gateway ? gatewayKey(config, renderRef) : null],
        ['model.name', config.models.primary?.id ?? null],
        ['mcpServers', mcpServers.length > 0 ? Object.fromEntries(mcpServers) : null],
        ['tools.approvalMode', APPROVAL_MODE],
      ],
    },
    { path: `${configDir}/QWEN.md`, contents: text(standing) },
    { path: `${configDir}/task.md`, contents: text(config.instructions) },
  ];
}

export default emit;
