import { defineConfig } from "wxt";

export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "YouTube Context Sidebar",
    description: "Surfaces term definitions while you watch — no tab-switching required",
    permissions: ["storage"],
    host_permissions: ["*://www.youtube.com/*", "https://api.anthropic.com/*"],
    web_accessible_resources: [
      { resources: ["page-world.js"], matches: ["*://www.youtube.com/*"] },
    ],
  },
});
