# AWS Lambda 部署指南 (NestJS + Prisma)

本文档基于项目历史部署记录与故障排查经验生成，详细记录了如何将基于 NestJS 和 Prisma 的应用稳定部署到 AWS Lambda，并重点说明了构建优化与常见问题的解决方案。

## 1. 架构概述

为了适应 AWS Lambda 的运行环境限制（如包体积限制、冷启动时间），本项目采用了**双函数架构**：

1.  **`NestJSFunction` (API 服务)**
    - **用途**: 处理 HTTP 请求。
    - **Prisma 版本**: `7.3.0` (使用 `prisma/config.ts` 和 HTTP Adapter)。
    - **优化**: 剔除 Prisma CLI、文档、以及所有非运行时依赖，仅保留 Query Engine。
2.  **`MigrationFunction` (数据库迁移)**
    - **用途**: 在部署后执行数据库结构更新 (`prisma migrate deploy`)。
    - **Prisma 版本**: `5.22.0` (为了兼容性及独立的迁移逻辑)。
    - **特殊处理**: 需要完整包含 `schema-engine` 二进制文件。

## 2. 核心配置与稳定性保障

本项目的稳定性依赖于 `Makefile` 中的特殊构建逻辑，以下是关键配置说明。

### 2.1 解决跨平台二进制缺失问题 (Critical)

在 macOS 环境下构建部署到 AWS Lambda (Amazon Linux/RHEL) 时，`npm install` 往往无法自动下载正确的 Prisma 引擎（特别是 `schema-engine`）。

**解决方案**: 在 `Makefile` 中手动下载指定版本的二进制文件。

```makefile
# Makefile (Lines 98-104)
# MANUAL FIX: Download missing schema-engine for RHEL (Prisma 5.22.0)
# Hash: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
curl -L https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/rhel-openssl-3.0.x/schema-engine.gz -o $(ARTIFACTS_DIR)/schema-engine.gz
gunzip $(ARTIFACTS_DIR)/schema-engine.gz
chmod +x $(ARTIFACTS_DIR)/schema-engine
# 移动到 node_modules 正确位置
mkdir -p $(ARTIFACTS_DIR)/node_modules/@prisma/engines
mv $(ARTIFACTS_DIR)/schema-engine $(ARTIFACTS_DIR)/node_modules/@prisma/engines/schema-engine-rhel-openssl-3.0.x
```

### 2.2 极致体积压缩 (Surgical Cleanup)

AWS Lambda 限制解压后代码体积必须小于 250MB。Prisma + NestJS 极易超标。

**解决方案**: 在 `Makefile` 中执行外科手术式清理：

```makefile
# NestJSFunction 清理逻辑
# 1. 移除 Prisma CLI 和 Studio (Web UI)
rm -rf $(ARTIFACTS_DIR)/node_modules/prisma
rm -rf $(ARTIFACTS_DIR)/node_modules/@prisma/studio*

# 2. 移除所有非 RHEL 平台的引擎
find $(ARTIFACTS_DIR)/node_modules -name "*darwin*" -delete
find $(ARTIFACTS_DIR)/node_modules -name "*windows*" -delete
find $(ARTIFACTS_DIR)/node_modules -name "*debian*" -delete

# 3. 移除开发依赖的大文件
rm -rf $(ARTIFACTS_DIR)/node_modules/typescript
find $(ARTIFACTS_DIR)/node_modules -name "*.d.ts" -delete
find $(ARTIFACTS_DIR)/node_modules -name "*.map" -delete
rm -rf $(ARTIFACTS_DIR)/node_modules/@nestjs/cli
```

## 3. 部署步骤 (Standard Procedure)

确保本地已安装 AWS SAM CLI, Docker (可选) 和 Node.js。

1.  **构建 (Build)**

    ```bash
    sam build
    ```

    _此步骤会自动调用 Makefile 及其中的下载/清理逻辑。_

2.  **验证构建产物 (Verify)**

    ```bash
    # 检查 MigrationFunction 是否包含 schema-engine (约 30-40MB)
    ls -lh .aws-sam/build/MigrationFunction/node_modules/@prisma/engines/
    ```

3.  **部署 (Deploy)**

    ```bash
    sam deploy --stack-name agent-guild-nest1 --resolve-s3 --capabilities CAPABILITY_IAM
    ```

4.  **执行数据库迁移 (Run Migration)**
    部署完成后，必须手动调用一次迁移函数：
    ```bash
    aws lambda invoke --function-name agent-guild-nest1-migration --payload '{}' response.json
    cat response.json
    ```
    _期望输出_: `"message": "Migration successful", "migrations": [...]`

## 4. 历史故障排查记录 (Troubleshooting Log)

以下记录了项目在演进过程中遇到的严重问题及最终解决方案。

### 问题一：部署失败 "Unzipped size must be smaller than 256MB"

- **现象**: `sam deploy` 报错，提示 Lambda 函数体积过大（通常 > 500MB）。
- **原因**: `node_modules` 中包含了 `@prisma/studio` (Prisma 的可视化界面)、`typescript` 编译器、以及多个平台的引擎文件 (darwin, windows 等)。
- **解决**: 实施了上述 **2.2 极致体积压缩** 策略，将终产物压缩至 ~140MB。

### 问题二：运行时错误 "Could not find schema-engine binary"

- **现象**: `MigrationFunction` 调用时报错，无法找到 `schema-engine-rhel-openssl-3.0.x`。
- **原因**: 本地开发环境为 macOS，`npm install` 默认下载 `darwin` 引擎。虽然设置了 `PRISMA_CLI_BINARY_TARGETS`，但在某些构建环境下自动下载仍不稳定或未触发。
- **解决**: 实施了上述 **2.1 手动下载** 策略，通过 `curl` 强制获取对应版本的二进制文件，确保文件 100% 存在。

### 问题三：API 500 错误 "The column ... does not exist"

- **现象**: 部署成功后，访问 `/jobs` 接口返回 500 错误。日志显示数据库缺少 `competitionMode` 等字段。
- **原因**: 本地修改了 `schema.prisma` 新增了字段，但开发过程中可能使用了 `prisma db push` 而未生成正式的迁移文件 (`migrations/xxx.sql`)。生产环境依赖 `migrate deploy`，因此并未应用这些变更。
- **解决**:
  1.  使用 `prisma migrate diff` 或手动根据 schema 差异编写 SQL 补丁。
  2.  创建新迁移文件 `prisma/migrations/20260128xxx_add_competition_mode/migration.sql`。
  3.  重新构建并部署 `MigrationFunction`，执行迁移。

---

**维护建议**:
每次修改 `schema.prisma` 后，请务必在本地运行 `npx prisma migrate dev --name <change_name>` 生成迁移文件并提交到 Git。AWS 生产环境完全依赖这些文件来同步数据库结构。
