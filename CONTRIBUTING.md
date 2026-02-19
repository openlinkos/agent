# Contributing to OpenLinkOS

Thank you for your interest in contributing to OpenLinkOS. This guide will help you get started.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **pnpm** 9 or later
- **Git**

### Setting Up the Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/agent.git
cd agent

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests to verify everything works
pnpm test
```

### Repository Structure

This is a pnpm monorepo. The main directories are:

- `packages/` — Core framework packages (ai, agent, subagent, team, mcp)
- `channels/` — Messaging platform adapters (Telegram, Feishu, Discord, Slack, DingTalk)
- `plugins/` — Extension plugins (memory, etc.)
- `cli/` — Command-line tooling
- `docs/` — Documentation site (VitePress)

Each package has its own `package.json`, `tsconfig.json`, `src/` directory, and `README.md`.

## How to Contribute

### Reporting Bugs

Open a [bug report](https://github.com/openlinkos/agent/issues/new?template=bug_report.yml) with:
- A clear title and description
- Steps to reproduce
- Expected vs. actual behavior
- Your environment details (OS, Node.js version, package versions)

### Suggesting Features

Open a [feature request](https://github.com/openlinkos/agent/issues/new?template=feature_request.yml) with:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Submitting Code Changes

1. **Fork** the repository and create a branch from `master`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes.** Follow the coding standards below.

3. **Write or update tests** for your changes.

4. **Ensure all checks pass:**
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

5. **Commit your changes** with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat(agent): add guardrail middleware support"
   ```

6. **Push** to your fork and open a **Pull Request** against `master`.

### Commit Message Format

We follow the Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — A new feature
- `fix` — A bug fix
- `docs` — Documentation changes
- `refactor` — Code restructuring without behavior changes
- `test` — Adding or updating tests
- `chore` — Build, tooling, or dependency changes

**Scopes:** Use the package name without the `@openlinkos/` prefix (e.g., `agent`, `ai`, `team`, `mcp`, `cli`).

## Coding Standards

### TypeScript

- Use strict TypeScript — all packages have `strict: true` enabled
- Prefer explicit types for public API surfaces (function parameters, return types, exported interfaces)
- Use `interface` for object shapes and `type` for unions and intersections
- Avoid `any` — use `unknown` and narrow with type guards when dealing with dynamic data

### Code Style

- The project uses ESLint and Prettier for consistent formatting
- Run `pnpm lint` before committing to catch style issues
- Keep functions focused and small — prefer composition over large monolithic functions
- Use descriptive variable and function names

### Testing

- Write tests for all public API surfaces
- Use Vitest as the test runner
- Place test files alongside source files with a `.test.ts` suffix
- Aim for meaningful test coverage — focus on behavior, not line counts

### Documentation

- Update relevant documentation when changing public APIs
- Add JSDoc comments to all exported functions, classes, and interfaces
- Include usage examples in JSDoc `@example` blocks for complex APIs

## Working on Specific Areas

### Core Packages (`packages/`)

These form the foundation of the framework. Changes here require thorough testing and backward-compatibility consideration. If your change modifies a public API, open an issue for discussion first.

### Channels (`channels/`)

Each channel adapter follows a common interface. When adding a new channel or modifying an existing one, ensure it conforms to the shared channel abstraction.

### Plugins (`plugins/`)

Plugins extend agent functionality. Follow the plugin interface contract and include integration tests showing the plugin working with a real agent instance.

### Documentation (`docs/`)

The documentation site uses VitePress. To preview changes locally:

```bash
pnpm docs:dev
```

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changes and why
- Reference related issues using `Fixes #123` or `Closes #123`
- Ensure CI passes before requesting review
- Be responsive to review feedback

## Questions?

If you have questions about contributing, feel free to open a [discussion](https://github.com/openlinkos/agent/discussions) or reach out via an issue.
