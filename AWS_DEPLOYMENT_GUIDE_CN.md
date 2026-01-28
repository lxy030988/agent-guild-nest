# AWS Lambda 部署操作手册 (NestJS + Prisma)

本文档是针对本项目 (`agent-guild-nest`) 的完整部署实操指南。请严格按照以下步骤执行，以确保应用能在 AWS Lambda 环境下稳定运行。

## 1. 环境准备 (Prerequisites)

在开始部署前，请确保本地终端安装了以下工具：

- **AWS CLI**: 配置好 `~/.aws/credentials`，拥有足够的部署权限。
- **AWS SAM CLI**: 用于构建和部署 Serverless 应用。
- **Node.js (v20+)**: 本地开发环境。
- **Make**: macOS/Linux 自带，用于执行构建脚本。

### 关键配置说明

- **环境变量 (`DATABASE_URL` 等)**: 生产环境的数据库连接串**必须**在 `template.yaml` 中的 `Environment.Variables` 部分配置，或者在部署后的 Lambda 控制台设置。
- **构建逻辑**: 通过 `Makefile` 生成精简的产物。
  - **Prisma 7 适配**: 采用了 `prisma.config.ts` 进行配置。`MigrationFunction` 的 `schema.prisma` 是在构建时通过拼接 `prisma/schema/*` 动态生成的。
  - **引擎管理**: 我们在 `Makefile` 中手动下载了 Prisma 7.3.0 的 RHEL `schema-engine` 以确保迁移功能可用。

## 2. 部署流程 (Deployment Workflow)

完整的部署包含三个核心步骤：**构建** -> **部署** -> **执行迁移**。

### 第一步：构建 (Build)

执行 SAM 构建命令。此命令会自动调用 `Makefile`，执行依赖安装、Prisma Client 生成、引擎下载及体积清理。

```bash
# 运行构建
sam build
```

**构建过程中的关键日志**:

- `Building NestJSFunction...`: 开始构建主应用。
- `Surgical cleanup of node_modules...`: 执行体积清理，移除 `@prisma/studio` 等大文件。
- `Building MigrationFunction...`: 开始构建迁移函数。
- `MANUAL FIX: Download missing schema-engine...`: **关键步骤**，确认看到正在通过 `curl` 下载 RHEL 版本的引擎。
- `Build Succeeded`: 构建成功。

### 第二步：部署 (Deploy) 🚨 **核心步骤**

**严禁**直接运行 `sam deploy` 而不指定模板文件，否则 SAM 可能会打包当前目录未清理的 `node_modules`。
**必须**指向 `.aws-sam/build` 目录下的模板文件，以确保上传的是经过优化的小体积 Artifact。

```bash
# 部署命令 (指定构建后的模板)
sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name agent-guild-nest1 \
    --region us-east-1 \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset
```

- `--template-file .aws-sam/build/template.yaml`: **关键参数**，强制使用构建后的模板和产物。
- `--stack-name`: 指定堆栈名称。
- `--resolve-s3`: 自动管理 S3 Bucket。

**等待部署完成**: 终端会显示 CloudFormation 的进度条。出现 `Successfully created/updated stack` 即表示代码已更新至 Lambda。

### 第三步：数据库迁移 (Database Migration)

部署代码后，必须手动调用 `MigrationFunction` 来执行数据库更新 (`prisma migrate deploy`)。

```bash
# 调用迁移函数
aws lambda invoke \
    --function-name agent-guild-nest1-migration \
    --payload '{}' \
    response.json

# 查看执行结果
cat response.json
```

**成功标志**: `body` 字段显示 `"message": "Migration successful"`。

## 3. 验证与监控 (Verification)

### API 测试

可以使用 `curl` 测试 API 是否正常响应：

```bash
# 获取 API Gateway URL (在 sam deploy 输出中可以找到 Output: ApiUrl)
export API_URL="https://your-api-d.execute-api.us-east-1.amazonaws.com"

# 测试 Job 列表 (验证数据库读取)
curl -v "$API_URL/jobs?page=1&limit=5"
```

预期返回: `200 OK` 和 JSON 数据。

### 查看日志 (CloudWatch)

```bash
# 查看 NestJS 主函数日志
sam logs -n NestJSFunction --stack-name agent-guild-nest1 --tail
```

## 4. 常见故障排查 (Troubleshooting)

### Q1: 部署时提示 "Unzipped size must be smaller than 256MB"

- **原因**: 很有可能你在执行 `sam deploy` 时忘记加上 `--template-file .aws-sam/build/template.yaml`。如果不加此参数，SAM 可能会尝试打包根目录下包含完整 `node_modules` 的源代码。
- **解决**: 严格按照第二步的完整命令执行部署。

### Q2: 迁移函数报错 "Could not find schema-engine binary" 或 "MODULE_NOT_FOUND"

- **原因**: Lambda 环境缺少 Prisma 7 引擎文件，或者过度精简导致 Prisma CLI 核心依赖（如 `effect`, `fast-check`）被删除。
- **解决**:
  - 确保 `Makefile` 中包含了手动下载 `schema-engine-rhel-openssl-3.0.x` 的 `curl` 命令（Prisma 7.3.0 在 macOS build 环境下需要手动补救）。
  - 确认 `Makefile` 的清理脚本保留了 `@prisma/studio-core`、`effect`、`fast-check` 等库。

### Q3: API 返回 500 "The column ... does not exist"

- **原因**: 数据库 Schema 漂移。代码里有新字段，但数据库没更新。
- **解决**:
  1.  本地运行 `npx prisma migrate dev` 生成 SQL 文件并提交 Git。
  2.  重新构建并部署 `MigrationFunction`。
  3.  务必执行 **第三步：数据库迁移**。
