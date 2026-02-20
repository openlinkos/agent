import { defineConfig } from "vitepress";

export default defineConfig({
  title: "OpenLinkOS",
  description:
    "An open-source framework for building, orchestrating, and deploying AI agents",
  lang: "en-US",
  base: "/agent/",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "OpenLinkOS" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "An open-source framework for building, orchestrating, and deploying AI agents",
      },
    ],
    ["meta", { property: "og:url", content: "https://openlinkos.com" }],
  ],

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "OpenLinkOS",

    nav: [
      { text: "Guide", link: "/guide/" },
      {
        text: "API Reference",
        items: [
          { text: "@openlinkos/ai", link: "/api/ai" },
          { text: "@openlinkos/agent", link: "/api/agent" },
          { text: "@openlinkos/team", link: "/api/team" },
          { text: "@openlinkos/subagent", link: "/api/subagent" },
          { text: "@openlinkos/mcp", link: "/api/mcp" },
          { text: "@openlinkos/eval", link: "/api/eval" },
          { text: "Channels", link: "/api/channels" },
          { text: "plugin-memory", link: "/api/memory" },
        ],
      },
      { text: "Examples", link: "/examples/chatbot" },
      {
        text: "GitHub",
        link: "https://github.com/openlinkos/agent",
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Overview", link: "/guide/" },
            { text: "Your First Agent", link: "/guide/first-agent" },
            { text: "Adding Tools", link: "/guide/tools" },
            { text: "Multi-Agent Teams", link: "/guide/teams" },
            { text: "CLI Usage", link: "/guide/cli" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Core",
          items: [
            { text: "@openlinkos/ai", link: "/api/ai" },
            { text: "@openlinkos/agent", link: "/api/agent" },
            { text: "@openlinkos/team", link: "/api/team" },
            { text: "@openlinkos/subagent", link: "/api/subagent" },
          ],
        },
        {
          text: "Integrations",
          items: [
            { text: "@openlinkos/mcp", link: "/api/mcp" },
            { text: "@openlinkos/eval", link: "/api/eval" },
            { text: "Channels", link: "/api/channels" },
            { text: "plugin-memory", link: "/api/memory" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "Examples",
          items: [
            { text: "Basic Chatbot", link: "/examples/chatbot" },
            { text: "Tool-Using Agent", link: "/examples/tool-agent" },
            { text: "Multi-Agent Debate", link: "/examples/debate" },
            { text: "Supervisor Pattern", link: "/examples/supervisor" },
            { text: "MCP Integration", link: "/examples/mcp" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/openlinkos/agent" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright 2026 OpenLinkOS",
    },

    search: {
      provider: "local",
    },
  },
});
