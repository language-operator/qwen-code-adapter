/**
 * Qwen Code emitter — provider wiring only.
 *
 * Writes the gateway into $QWEN_HOME/settings.json (runtime.json points
 * QWEN_HOME at ${STATE_DIR}/qwen-code) as Qwen Code's OpenAI-compatible auth.
 * This is the least that makes the TUI usable: without a selected auth type,
 * Qwen Code opens on a "Connect a Provider" picker that swallows keystrokes,
 * and a woken agent would need someone to click through it.
 *
 * Still to do, in issue #1: MCP servers as `mcpServers`, instructions and
 * persona as the QWEN.md context file, and a multi-model `modelProviders`
 * list.
 *
 * settings.json also holds the user's own state — `/model` writes `model.name`
 * here, and the TUI persists preferences — so ownership is per key, never the
 * whole `security` or `model` object. Every owned key is supplied on every run,
 * null included, so a withdrawn gateway or model does not linger.
 */

/**
 * The gateway credential, as Qwen Code should see it.
 *
 * Qwen Code expands `${NAME}` in settings strings, so a per-agent key is
 * written as a reference and the credential never lands on the workspace
 * volume. Without a key, or on a base too old to render references, fall back
 * to the shared placeholder.
 */
function gatewayKey(config, renderRef) {
  if (!config.gateway.apiKeyRef || !renderRef) return config.gateway.apiKey;
  return renderRef(config.gateway.apiKeyRef, {
    path: 'gateway.apiKey',
    rewrite: (name) => `\${${name}}`,
    clientSyntax: /\$(\w|\{)/,
  }) ?? config.gateway.apiKey;
}

export function emit(config, { renderRef = null } = {}) {
  const configDir = `${config.paths.stateDir}/qwen-code`;
  const gateway = config.gateway;

  return [
    {
      path: `${configDir}/settings.json`,
      owns: ['security.auth.selectedType', 'security.auth.baseUrl', 'security.auth.apiKey', 'model.name'],
      values: [
        ['security.auth.selectedType', gateway ? 'openai' : null],
        ['security.auth.baseUrl', gateway ? gateway.openaiBaseUrl : null],
        ['security.auth.apiKey', gateway ? gatewayKey(config, renderRef) : null],
        ['model.name', config.models.primary?.id ?? null],
      ],
    },
  ];
}

export default emit;
