# Web3 认证系统 - 后端文档

## 数据库初始化

### 首次启动项目

#### 1. 安装依赖

```bash
pnpm install
```

#### 2. 配置环境变量

创建 `.env` 文件：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/agent_guild?schema=public"
JWT_SECRET="your-secret-key-please-change-in-production"
PORT=3000
```

#### 3. 初始化数据库

**选项 A - 首次初始化**（推荐）

```bash
# 1. 生成 Prisma Client
npx prisma generate

# 2. 运行所有迁移
npx prisma migrate deploy
```

**选项 B - 开发环境**

```bash
# 会创建数据库、运行迁移、生成 Client
npx prisma migrate dev
```

**选项 C - 重置数据库**（⚠️ 会删除所有数据）

```bash
npx prisma migrate reset --force
```

#### 4. 启动服务

```bash
pnpm run start:dev
```

---

## 数据库迁移指南

### 场景 1：拉取他人代码后（团队协作）

```bash
# 1. 拉取代码
git pull

# 2. 应用新迁移
npx prisma migrate deploy

# 3. 重新生成 Prisma Client
npx prisma generate

# 4. 重启服务
pnpm run start:dev
```

### 场景 2：修改了 Schema（开发环境）

```bash
# 1. 修改 prisma/schema.prisma

# 2. 创建并应用迁移
npx prisma migrate dev --name add_user_avatar

# 3. 提交代码（包含 prisma/migrations/ 目录）
git add prisma/migrations
git commit -m "feat: add user avatar field"
```

### 场景 3：生产环境部署

```bash
# ⚠️ 生产环境只用 deploy，不要用 dev
npx prisma migrate deploy
```

### 查看迁移状态

```bash
npx prisma migrate status
```

### 可视化查看数据库

```bash
npx prisma studio
# 访问 http://localhost:5555
```

---

## API 端点

### 认证 API

| 端点            | 方法 | 描述         | 认证        |
| --------------- | ---- | ------------ | ----------- |
| `/auth/nonce`   | POST | 获取签名消息 | 🔓 公开     |
| `/auth/login`   | POST | 验证签名登录 | 🔓 公开     |
| `/auth/profile` | GET  | 获取用户信息 | 🔒 需要 JWT |

#### POST /auth/nonce

**请求**:

```json
{
  "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "nonce": "356152",
    "message": "Welcome to Agent Guild!\n\nSign this message..."
  }
}
```

#### POST /auth/login

**请求**:

```json
{
  "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "signature": "0x386ac9ab64e0c3964181453a..."
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "walletAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      "name": null,
      "createdAt": "2026-01-05T13:05:27.490Z"
    }
  }
}
```

#### GET /auth/profile

**请求头**:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应**:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "walletAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "name": null,
    "email": null,
    "createdAt": "2026-01-05T13:05:27.490Z",
    "updatedAt": "2026-01-05T13:32:49.047Z"
  }
}
```

---

## 核心实现

### 签名验证

使用 **ethers.js** 验证 EIP-191 签名：

```typescript
import { verifyMessage } from 'ethers';

const message = this.getSignMessage(walletAddress, nonce);
const recoveredAddress = verifyMessage(message, signature);

if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
  throw new UnauthorizedException('Invalid signature');
}
```

### JWT 配置

- **有效期**: 7天
- **Payload**: `{ sub: userId, walletAddress }`
- **Secret**: 从环境变量读取

### 安全机制

1. **Nonce 防重放**: 每次登录生成新 nonce，验证后清除
2. **地址规范化**: 统一小写存储
3. **JWT Guard**: 全局保护所有路由
4. **@Public()**: 标记公开端点

---

## 常见问题

### Q: 数据库连接失败？

**A**:

- 检查 PostgreSQL 是否运行：`pg_isready`
- 验证 `.env` 中的 `DATABASE_URL`
- 确保数据库已创建

### Q: 迁移失败怎么办？

**A**:

- 开发环境：`npx prisma migrate reset`
- 生产环境：手动回滚或修复迁移

### Q: Prisma Client 找不到？

**A**: 运行 `npx prisma generate`

### Q: 如何回滚迁移？

**A**: Prisma 不支持自动回滚，需要手动创建反向迁移

---

## 项目结构

```
src/
├── modules/auth/
│   ├── auth.controller.ts      # API 端点
│   ├── auth.service.ts         # 签名验证逻辑
│   ├── auth.module.ts
│   ├── dto/
│   │   └── auth.dto.ts         # DTO 定义
│   └── strategies/
│       └── jwt.strategy.ts     # JWT 策略
├── common/
│   └── decorators/
│       ├── public.decorator.ts
│       └── current-user.decorator.ts
└── prisma/
    └── prisma.service.ts

prisma/
├── schema.prisma               # 数据库 Schema
└── migrations/                 # 迁移历史
    ├── 20260105_init/
    └── 20260105_add_web3_auth_fields/
```

---

## 技术栈

- **NestJS**: 后端框架
- **Prisma**: ORM
- **PostgreSQL**: 数据库
- **ethers.js**: 签名验证
- **Passport + JWT**: 认证

---

## 开发建议

✅ **DO**:

- 修改 Schema 后立即运行迁移
- 提交代码时包含 `prisma/migrations/`
- 使用环境变量存储敏感信息
- 定期备份生产数据库

❌ **DON'T**:

- 不要手动修改迁移文件
- 生产环境不要用 `migrate dev`
- 不要在代码中硬编码数据库凭证
- 不要忽略迁移错误
