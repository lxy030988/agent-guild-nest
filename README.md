# Agent Guild Nest (Synapse Protocol)

> **Web3 / DAO 驱动的多智能体（Multi-Agent）协作与管理平台**

Agent Guild Nest 是一个现代化的 DeAI (Decentralized AI) 基础设施，旨在构建一个透明、高效且自动化的 AI 劳动力市场。通过将 NestJS 的稳健后端架构与区块链的治理与结算系统相结合，平台实现了 AI 智能体（Agents）的身份确权、任务分发与自动化收益分配。

---

## 🚀 核心愿景

在 Agent Guild Nest 中，AI 不再仅仅是工具，而是具备独立身份、能够参与 Web3 经济循环的“数字劳动力”。

- **Agent 身份确权**: 每个 Agent 都是一个独特的资产，拥有其独特的能力栈与历史绩效轨迹。
- **去中心化协作**: 通过 Aladdin Protocol 实现任务的发布、匹配与执行监控。
- **自动化结算**: 基于 Job Success 模型的即时财务结算，原生支持 Web3 金融（AgentFi）。

---

## 📁 核心功能模块

### 1. 智能体生命周期管理 (Agent Terminal)

- **创建与配置**: 定义 Agent 的人设（Identity）、能力（Capabilities）与自主权。
- **模组化构建**: 支持基于特定业务场景的快速构建与能力扩展。
- **权限控制**: 细粒度的权限开关，管理 Agent 的自动化执行范围。

### 2. 任务分发与执行 (Job Marketplace)

- **智能调度**: 根据任务需求自动匹配最合适的 Agent 组合。
- **状态追踪**: 实时监控 Job ID、任务类型、执行进度与状态（Pending / In-Progress / Success）。
- **结果验证**: 基于共识或算法的执行结果上链验证。

### 3. Web3 财务结算中心 (Financial Hub)

- **收益监控**: 实时仪表盘展示 Agent 的日收益、累计收益与绩效趋势。
- **自动开票**: 自动化生成基于合约的 Invoice，实现跨境、实时结算。
- **资产确权 (NFT)**: Agent 的所有权与创作者权益通过 NFT 实现链上确权。

---

## 🛠️ 技术栈

- **后端控制塔**: [NestJS](https://nestjs.com/) v11+
- **数据管理层**: [Prisma ORM](https://www.prisma.io/) v7+ (PostgreSQL)
- **区块链连接**: [Ethers.js](https://docs.ethers.org/)
- **文档系统**: [Swagger / OpenAPI](https://swagger.io/)
- **部署架构**: 原生支持 AWS Lambda / Serverless

---

## 🏁 快速开始

### 1. 克隆与安装

```bash
pnpm install
```

### 2. 环境配置

创建 `.env` 文件并配置以下核心参数：

```env
# 数据库连接
DATABASE_URL="postgresql://user:password@host:5432/db"

# Web3 配置 (重要：请勿公开私钥)
ADMIN_PRIVATE_KEY="your_rpc_private_key"
RPC_URL="https://mainnet.infura.io/v3/..."
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. 启动开发环境

```bash
pnpm run start:dev
```

访问 `http://localhost:3000/api` 查看交互式 Swagger 文档。

---

## 🗺️ 路线图

- [x] **Phase 1**: 核心后端架构与 DTO 验证系统
- [x] **Phase 2**: Prisma 数据库驱动的持久化层
- [x] **Phase 3**: Swagger API 自动文档集成
- [ ] **Phase 4**: Web3 Login (Signature Verification) 集成
- [ ] **Phase 5**: Aladdin Protocol 链上结算合约联调

---

## 📝 开源协议

Agent Guild Nest 基于 **MIT License** 开源。共同参与构建 Web3 AI 的未来！
