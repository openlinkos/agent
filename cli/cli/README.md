# @openlinkos/cli

Command-line interface — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/cli` provides command-line tooling for the full agent development lifecycle: scaffolding new projects, running agents locally with hot reload, building for production, and deploying to supported platforms.

## Installation

```bash
pnpm add -g @openlinkos/cli
```

Or use directly with npx:

```bash
npx @openlinkos/cli init my-agent
```

## Commands

### `openlinkos init [name]`

Scaffold a new agent project with sensible defaults and your choice of template.

```bash
openlinkos init my-agent
```

### `openlinkos dev`

Start a local development server with hot reload. Changes to your agent code are reflected immediately.

```bash
openlinkos dev
```

### `openlinkos build`

Build the agent project for production deployment.

```bash
openlinkos build
```

### `openlinkos deploy`

Deploy the built agent to a supported platform.

```bash
openlinkos deploy
```

## Features

- **Project scaffolding** — Generate a complete agent project from templates
- **Hot reload** — Instant feedback during local development
- **Production builds** — Optimized builds with tree-shaking
- **Interactive playground** — Test agents directly in the terminal
- **Multi-platform deploy** — Deploy to cloud providers and messaging platforms

## License

[MIT](../../LICENSE)
