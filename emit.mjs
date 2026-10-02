/**
 * Qwen Code emitter — placeholder.
 *
 * Modelled on coding-runtime's `examples/minimal`: one managed JSON file, one
 * owned key. It exists so the image seeds cleanly and passes the conformance
 * suite while the adapter is renamed. Qwen Code does not read this file yet.
 *
 * The real translation is issue #1: the gateway as an OpenAI-compatible
 * provider (`modelProviders` in ~/.qwen/settings.json, or OPENAI_BASE_URL /
 * OPENAI_API_KEY / OPENAI_MODEL), MCP servers as `mcpServers`, and the agent's
 * instructions and persona as the QWEN.md context file.
 */

export function emit(config) {
  const configDir = `${config.paths.stateDir}/qwen-code`;

  return [
    {
      path: `${configDir}/settings.json`,
      owns: ['model'],
      values: { model: config.models.primary?.id ?? null },
    },
  ];
}

export default emit;
