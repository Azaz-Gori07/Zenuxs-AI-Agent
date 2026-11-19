// Minimal Zenuxs plugin module for E2E custom-command verification.
export default {
  name: "zenuxs-e2e-fixture",
  manifest: { capabilities: ["commands"] },
  setup(api) {
    api.registerCommand({
      name: "e2e",
      description: "Fixture custom command from plugin",
      handler: async (input) => `e2e:${input}`,
    });
  },
};
