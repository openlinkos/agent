import { defineConfig } from "vitepress";

export default defineConfig({
  title: "OpenLinkOS",
  description:
    "An open-source framework for building, orchestrating, and deploying AI agents",
  lang: "en-US",

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
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Concepts", link: "/concepts/plugins" },
      {
        text: "Packages",
        items: [
          { text: "@openlinkos/ai", link: "/packages/ai" },
          { text: "@openlinkos/agent", link: "/packages/agent" },
          { text: "@openlinkos/subagent", link: "/packages/subagent" },
          { text: "@openlinkos/team", link: "/packages/team" },
          { text: "@openlinkos/mcp", link: "/packages/mcp" },
        ],
      },
      {
        text: "GitHub",
        link: "https://github.com/openlinkos/agent",
      },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          {
            text: "Getting Started",
            link: "/guide/getting-started",
          },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Plugins", link: "/concepts/plugins" },
          { text: "Skills", link: "/concepts/skills" },
          { text: "Sub-agents", link: "/concepts/subagents" },
          { text: "Teams", link: "/concepts/teams" },
        ],
      },
    ],

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
