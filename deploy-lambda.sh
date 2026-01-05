#!/bin/bash
set -e

echo "🚀 开始部署..."

# 读取 .env
source .env

# 使用生产环境数据库URL
DATABASE_URL="${DATABASE_URL_PROD}"

echo "📦 构建..."
pnpm build

# 生成 Prisma Client
echo "🔧 生成 Prisma Client..."
pnpm prisma generate

# 应用数据库迁移到生产环境
echo "🗄️ 应用数据库迁移..."
pnpm prisma migrate deploy

# SAM 构建
sam build

# 手动复制 dist 和 .prisma 到 SAM 构建输出
echo "📁 复制 dist 和 Prisma 客户端..."
cp -r dist .aws-sam/build/NestJSFunction/

# 查找并复制 Prisma 客户端
PRISMA_PATH=$(find node_modules -name ".prisma" -type d | head -1)
if [ -n "$PRISMA_PATH" ]; then
    mkdir -p .aws-sam/build/NestJSFunction/node_modules
    cp -r "$PRISMA_PATH" .aws-sam/build/NestJSFunction/node_modules/
    echo "✅ Prisma 客户端已复制"
fi

echo "🚢 部署..."
sam deploy \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides "Environment=production DatabaseUrl=\"${DATABASE_URL}\""

echo "✅ 完成！"
