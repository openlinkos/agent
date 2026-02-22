# AGENTS.md — OpenLinkOS Agent Framework

This file contains working instructions for AI coding agents (CC) contributing to this repository.

## Project Overview

- **Repo:** https://github.com/openlinkos/agent
- **Tech stack:** TypeScript, pnpm monorepo, ESM
- **Test command:** `pnpm test` (run from repo root)

## Branch & PR 规范

### Branch 命名规范

| 前缀 | 用途 |
|------|------|
| `feature/xxx` | 新功能开发 |
| `fix/xxx` | Bug 修复 |
| `chore/xxx` | 工具链 / 配置 / 构建 |
| `docs/xxx` | 文档更新 |

示例：`feature/mcp-sse-transport`、`fix/agent-loop-hang`、`docs/readme-update`

### 开发流程

```
feature branch → PR → CI 通过 → merge to master
```

1. **从 master 创建 feature branch**
   ```bash
   git checkout master && git pull
   git checkout -b feature/your-feature-name
   ```

2. **开发 & 测试**（本地确认 `pnpm test` 通过）

3. **推送 branch 并开 PR**
   ```bash
   git push -u origin feature/your-feature-name
   gh pr create --title "feat: ..." --body "Closes #<issue>"
   ```

4. **CI 检查通过后合并**（所有 `CI / test` checks 必须为 ✅）

5. **merge 后删除 feature branch**
   ```bash
   git branch -d feature/your-feature-name
   ```

### 规则

- ❌ **禁止直接推送到 master**（已通过 branch protection 强制执行）
- ✅ 每个 issue 对应一个 feature branch + PR
- ✅ PR 描述中注明 `Closes #<issue-number>`，合并后自动关闭 issue
- ✅ 合并前必须通过 `CI / test` 状态检查
