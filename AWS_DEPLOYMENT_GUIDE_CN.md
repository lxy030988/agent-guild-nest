# AWS Lambda 部署操作手册 (NestJS + Prisma 7)

本文档是针对本项目 (`agent-guild-nest`) 的完整部署实操指南。项目采用 **Prisma 7 多文件模式**，通过 AWS SAM 部署到 Lambda + RDS Aurora Serverless v2。

---

## 📋 目录

- [环境准备](#环境准备)
- [项目架构](#项目架构)
- [部署流程](#部署流程)
- [验证与监控](#验证与监控)
- [故障排查](#故障排查)

---

## 1. 环境准备

### 必需工具

在开始部署前，请确保本地终端安装了以下工具：

| 工具            | 版本要求 | 用途                | 验证命令         |
| --------------- | -------- | ------------------- | ---------------- |
| **AWS CLI**     | 最新版   | AWS 资源管理        | `aws --version`  |
| **AWS SAM CLI** | 最新版   | Serverless 应用部署 | `sam --version`  |
| **Node.js**     | v20+     | 本地开发环境        | `node --version` |
| **pnpm**        | 最新版   | 包管理器            | `pnpm --version` |
| **Make**        | 系统自带 | 执行构建脚本        | `make --version` |

### AWS 凭证配置

确保已配置 AWS 凭证：

```bash
# 检查凭证配置
cat ~/.aws/credentials

# 应该包含：
[default]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
```

**权限要求**：需要以下权限

- Lambda 完全访问权限
- API Gateway 完全访问权限
- RDS 完全访问权限
- VPC 管理权限
- CloudFormation 完全访问权限
- S3 访问权限（用于存储部署包）

### 环境变量检查

确保本地 `.env` 文件配置正确（用于本地开发）：

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://..."
```

> **注意**：生产环境的 `DATABASE_URL` 在 `template.yaml` 中通过 `!Sub` 动态生成

---

## 2. 项目架构

### SAM 模板结构

项目使用 [`template.yaml`](file:///Users/lxy/Desktop/lxy030988/agent-guild-nest/template.yaml) 定义完整的 AWS 基础设施：

```
template.yaml
├── VPC (10.0.0.0/16)
│   ├── 公网子网 (10.0.1.0/24) - NAT Gateway
│   └── 私网子网 (10.0.11-13.0/24) - Lambda & RDS
├── 2个 Lambda 函数
│   ├── NestJSFunction - 主应用 (30s timeout)
│   └── MigrationFunction - 数据库迁移 (300s timeout)
└── RDS Aurora Serverless v2
    └── PostgreSQL 17.4 (0.5-2 ACU)
```

### Makefile 构建逻辑

项目使用两个不同的构建目标：

#### `build-NestJSFunction`

构建主应用 Lambda 函数：

```makefile
# 1. 复制构建产物
cp -r dist $(ARTIFACTS_DIR)/
cp package.json $(ARTIFACTS_DIR)/

# 2. 复制 Prisma 配置（Prisma 7 多文件模式）
cp prisma.config.ts $(ARTIFACTS_DIR)/
cp -r prisma $(ARTIFACTS_DIR)/    # 包含 schema/ 和 migrations/

# 3. 安装依赖 + 生成 Prisma Client
npm install
npx prisma generate

# 4. 精简体积（移除 dev 依赖 + 清理）
npm prune --production
# ... 删除大文件、引擎、文档等
```

#### `build-MigrationFunction`

构建迁移 Lambda 函数（**已简化**）：

```makefile
# 1. 复制迁移脚本
cp migration/index.js migration/package.json $(ARTIFACTS_DIR)/

# 2. 复制 Prisma 配置（直接复制，不再手动拼接）
cp prisma.config.ts $(ARTIFACTS_DIR)/
cp -r prisma $(ARTIFACTS_DIR)/

# 3. 安装依赖（保留 Prisma CLI）
npm install --production --no-optional

# 4. 手动下载 RHEL schema-engine
curl -L https://binaries.prisma.sh/.../rhel-openssl-3.0.x/schema-engine.gz -o schema-engine.gz
gunzip schema-engine.gz
mv schema-engine node_modules/@prisma/engines/schema-engine-rhel-openssl-3.0.x

# 5. 生成 Prisma Client
npx prisma generate
```

> **重要变更**：之前 MigrationFunction 通过 `echo` 和 `cat` 手动拼接 `schema.prisma`，现在统一使用 Prisma 7 的多文件模式，直接复制 `prisma/` 文件夹。

### Prisma 7 多文件模式

项目使用 Prisma 7 的多文件 schema 配置：

```
prisma/
├── schema/
│   ├── user.prisma         # User 模型
│   ├── agent.prisma        # Agent 模型
│   ├── job.prisma          # Job 模型
│   ├── execution.prisma    # JobExecution 模型
│   ├── transaction.prisma  # Transaction 模型
│   ├── bill.prisma         # Bill 模型
│   └── dispute.prisma      # Dispute 模型
└── migrations/             # Prisma 迁移历史
    └── 20260128112500_remove_secretkey_unique_constraint/
        └── migration.sql

prisma.config.ts            # Prisma 7 配置文件
```

**`prisma.config.ts` 配置**：

```typescript
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema', // 指向多文件 schema 目录
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL, // 从环境变量读取
  },
});
```

---

## 3. 部署流程

完整的部署包含三个核心步骤：**构建** → **部署** → **执行迁移**

### 第一步：构建 (Build)

执行 SAM 构建命令。此命令会自动调用 `Makefile`，执行依赖安装、Prisma Client 生成、引擎下载及体积清理。

```bash
# 运行构建
sam build
```

**构建过程中的关键日志** ✅：

```
Building NestJSFunction...
✅ NestJSFunction built and surgically optimized

Building MigrationFunction...
# Copy prisma config and schema directory (Prisma 7 multi-file, same as NestJSFunction)
cp prisma.config.ts /path/to/MigrationFunction/
cp -r prisma /path/to/MigrationFunction/
...
✅ Migration built and surgically optimized (Prisma 7)

Build Succeeded
```

**关键点**：

- ✅ 确认看到 `prisma.config.ts` 和 `prisma/` 被复制
- ✅ 确认 `schema-engine-rhel-openssl-3.0.x` 下载成功
- ✅ `Build Succeeded` 表示构建成功

**常见构建错误**：

- ❌ `ENOENT: no such file or directory 'prisma.config.ts'`
  - **原因**：主目录缺少 `prisma.config.ts`
  - **解决**：检查项目根目录是否有此文件

### 第二步：部署 (Deploy) 🚨 **核心步骤**

**严禁**直接运行 `sam deploy` 而不指定模板文件，否则 SAM 可能会打包当前目录未清理的 `node_modules`。
**必须**指向 `.aws-sam/build` 目录下的模板文件，以确保上传的是经过优化的小体积 Artifact。

```bash
# 部署命令（完整版）
sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name agent-guild-nest1 \
    --region us-east-1 \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset
```

**参数说明**：

- `--template-file .aws-sam/build/template.yaml` - **关键参数**，强制使用构建后的模板和产物
- `--stack-name` - CloudFormation 堆栈名称（可自定义）
- `--region` - AWS 区域
- `--capabilities CAPABILITY_IAM` - 允许创建 IAM 角色
- `--resolve-s3` - 自动管理 S3 Bucket 存储部署包
- `--no-confirm-changeset` - 跳过变更确认
- `--no-fail-on-empty-changeset` - 无变更时不报错

**部署过程** 📊：

```
1. 上传文件到 S3
   Uploading to 1b73af68719c383465809f310412af3d  43094725 / 43094725 (100.00%)

2. CloudFormation 创建/更新资源
   UPDATE_IN_PROGRESS    AWS::Lambda::Function    NestJSFunction
   UPDATE_IN_PROGRESS    AWS::Lambda::Function    MigrationFunction
   UPDATE_COMPLETE       AWS::Lambda::Function    NestJSFunction
   UPDATE_COMPLETE       AWS::Lambda::Function    MigrationFunction

3. 成功输出
   Successfully created/updated stack - agent-guild-nest1 in us-east-1

   Outputs:
   - ApiUrl: https://xxx.execute-api.us-east-1.amazonaws.com/
   - FunctionArn: arn:aws:lambda:us-east-1:xxx:function:agent-guild-nest1-nestjs-api
```

**等待部署完成**：终端会显示 CloudFormation 的进度条。出现 `Successfully created/updated stack` 即表示代码已更新至 Lambda。

### 第三步：数据库迁移 (Database Migration)

部署代码后，**必须手动调用** `MigrationFunction` 来执行数据库更新 (`prisma migrate deploy`)。

```bash
# 调用迁移函数
aws lambda invoke \
    --function-name agent-guild-nest1-migration \
    --payload '{}' \
    response.json

# 查看执行结果
cat response.json
```

**成功标志** ✅：

```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Migration successful\",\"output\":\"...13 migrations found in prisma/migrations\\n\\nNo pending migrations to apply.\\n\"}"
}
```

或者有新迁移时：

```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Migration successful\",\"output\":\"...Applying migration `20260128112500_remove_secretkey_unique_constraint`\\n\\nAll migrations have been successfully applied.\\n\"}"
}
```

**失败排查**：

- ❌ `Could not find schema-engine binary`
  - **原因**：RHEL 引擎下载失败
  - **解决**：检查 Makefile 中 `curl` 命令和 hash 是否正确

---

## 4. 验证与监控

### API 测试

使用 `curl` 测试 API 是否正常响应：

```bash
# 从部署输出获取 API URL
export API_URL="https://dk0okpeq1b.execute-api.us-east-1.amazonaws.com"

# 测试根路径
curl -v "$API_URL/"

# 测试 Job 列表（验证数据库读取）
curl -v "$API_URL/jobs?page=1&limit=5"

# 预期返回
HTTP/2 200
{"data": [...], "meta": {...}}
```

### 查看日志 (CloudWatch)

```bash
# 查看 NestJS 主函数日志（实时）
sam logs -n NestJSFunction --stack-name agent-guild-nest1 --tail

# 查看迁移函数日志
sam logs -n MigrationFunction --stack-name agent-guild-nest1 --tail

# 查看最近 10 分钟的日志
sam logs -n NestJSFunction --stack-name agent-guild-nest1 --start-time '10min ago'
```

### Lambda 控制台检查

1. 登录 AWS 控制台 → Lambda
2. 找到函数 `agent-guild-nest1-nestjs-api`
3. **配置**选项卡：
   - 检查 VPC 配置（应该在私有子网）
   - 检查环境变量 `DATABASE_URL`
   - 检查超时时间（30秒）和内存（1024MB）
4. **监控**选项卡：
   - 查看调用次数、错误率、持续时间

---

## 5. 故障排查

### Q1: 部署时提示 "Unzipped size must be smaller than 256MB"

**原因**：很有可能你在执行 `sam deploy` 时忘记加上 `--template-file .aws-sam/build/template.yaml`。如果不加此参数，SAM 可能会尝试打包根目录下包含完整 `node_modules` 的源代码。

**解决**：严格按照第二步的完整命令执行部署。

### Q2: 迁移函数报错 "Could not find schema-engine binary"

**原因**：Lambda 环境缺少 Prisma 7 引擎文件。Prisma 7.3.0 在 macOS 构建环境下不会自动下载 RHEL 引擎。

**解决**：

1. 检查 `Makefile` 中关于下载 `schema-engine-rhel-openssl-3.0.x` 的部分
2. 确认 hash 值 `9d6ad21cbbceab97458517b147a6a09ff43aa735` 是否正确
3. 重新构建：`sam build`

### Q3: 迁移函数报错 "MODULE_NOT_FOUND"

**原因**：过度精简导致 Prisma CLI 核心依赖（如 `effect`, `fast-check`）被删除。

**解决**：确认 `Makefile` 的清理脚本保留了必要的依赖：

```makefile
# 确保这些行被注释掉（保留依赖）
# -rm -rf $(ARTIFACTS_DIR)/node_modules/effect
# -rm -rf $(ARTIFACTS_DIR)/node_modules/@electric-sql
# -rm -rf $(ARTIFACTS_DIR)/node_modules/fast-check
```

### Q4: API 返回 500 "The column ... does not exist"

**原因**：数据库 Schema 漂移。代码里有新字段，但数据库没更新。

**解决**：

1. 本地运行 `npx prisma migrate dev --name xxx` 生成 SQL 文件
2. 提交迁移到 Git
3. 重新构建并部署 `MigrationFunction`
4. **务必执行第三步：数据库迁移**

### Q5: Prisma 找不到 schema 文件

**原因**：Prisma 7 配置错误或 `prisma/` 文件夹未复制。

**解决**：

1. 检查 `prisma.config.ts` 的 `schema` 路径：`schema: 'prisma/schema'`
2. 确认构建日志中有 `cp -r prisma $(ARTIFACTS_DIR)/`
3. 检查 `.aws-sam/build/MigrationFunction/` 下是否有 `prisma/` 文件夹

---

## 6. 最佳实践

### 部署前检查清单

- [ ] 本地代码已构建：`pnpm build`
- [ ] 本地测试通过：`pnpm test`
- [ ] 已提交所有代码变更到 Git
- [ ] 如有 schema 变更，已创建迁移文件
- [ ] AWS 凭证配置正确
- [ ] `.env` 文件不包含生产数据库密码

### 部署后验证清单

- [ ] API Gateway URL 可访问
- [ ] 数据库迁移成功执行
- [ ] CloudWatch 日志无错误
- [ ] Lambda 冷启动时间 < 5秒
- [ ] 主要 API 端点测试通过

### 回滚策略

如果部署出现问题，可以快速回滚：

```bash
# 方法1：回滚到上一个版本（如果出问题）
aws cloudformation rollback-stack --stack-name agent-guild-nest1

# 方法2：删除并重新部署
aws cloudformation delete-stack --stack-name agent-guild-nest1
# 等待删除完成后重新部署
sam build && sam deploy ...
```

---

## 附录

### 相关文件

- [`template.yaml`](file:///Users/lxy/Desktop/lxy030988/agent-guild-nest/template.yaml) - SAM 模板
- [`Makefile`](file:///Users/lxy/Desktop/lxy030988/agent-guild-nest/Makefile) - 构建脚本
- [`prisma.config.ts`](file:///Users/lxy/Desktop/lxy030988/agent-guild-nest/prisma.config.ts) - Prisma 7 配置
- [`migration/index.js`](file:///Users/lxy/Desktop/lxy030988/agent-guild-nest/migration/index.js) - 迁移函数入口

### 有用的命令

```bash
# 查看 SAM 配置
sam --info

# 验证 template.yaml 语法
sam validate

# 本地测试 Lambda 函数
sam local invoke NestJSFunction

# 删除堆栈
sam delete --stack-name agent-guild-nest1

# 查看 CloudFormation 事件
aws cloudformation describe-stack-events --stack-name agent-guild-nest1
```
