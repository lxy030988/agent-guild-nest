# DAO 后台开发文档

本文档说明本仓库 DAO 后台模块的本地开发、配置、架构与常用流程。

## 1) 概览

DAO 后台提供以下能力：
- 提案管理（创建/查询/同步）
- 投票与投票记录
- 质押与投票权计算
- 国库资产概览（原生币 + ERC20/721/1155）
- 治理统计与活动
- 区块链事件索引与实时监听（Viem）

核心模块：
- `src/modules/dao/*`
- `src/modules/web3/*`

## 2) 前置条件

- Node.js 18+（当前项目使用 Node 22 也可）
- 本地 PostgreSQL
- 以太坊 RPC 端点（Sepolia 或 Mainnet）

## 3) 环境变量

编辑 `.env`，确保至少包含以下配置：

```env
NODE_ENV=development
PORT=3000

# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agent_guild?schema=public"

# 区块链
CHAIN_ID=11155111
RPC_URL=https://rpc.sepolia.org
BLOCKCHAIN_RPC_URL=https://rpc.sepolia.org

# 合约地址
GOVERNOR_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STAKING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
TREASURY_ADDRESS=0x0000000000000000000000000000000000000000
GOVERNANCE_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000

# 索引起始区块
START_BLOCK=0

# 认证
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

说明：
- 公共 Sepolia RPC 容易超时，建议使用更稳定的付费/专用 RPC。
- 目前代码里使用的是 `RPC_URL`；`BLOCKCHAIN_RPC_URL` 仅文档说明，尚未接入代码。

## 4) 安装与运行

```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm start:dev
```

访问地址：
- API 基础地址：`http://localhost:3000/api`
- DAO 路由：`http://localhost:3000/api/dao`

如果 3000 端口被占用：
```bash
PORT=3001 pnpm start:dev
```

## 5) 架构说明

### Web3 Provider
`src/modules/web3/web3.provider.ts`
- 基于 Viem 创建 `publicClient` 和可选的 `walletClient`
- 通过 `RPC_URL` 与 `CHAIN_ID` 选择链与 RPC

### DAO 业务服务
`src/modules/dao/*`
- `proposals.service.ts`：提案 CRUD 与链上同步
- `voting.service.ts`：投票记录与查询
- `staking.service.ts`：质押与投票权
- `treasury.service.ts`：国库资产
- `governance-stats.service.ts`：统计与活动

### 事件索引与监听
`src/modules/dao/indexer.service.ts`
- 历史事件分批索引
- 由 `START_BLOCK` 与代码内参数控制

`src/modules/dao/event-listener.service.ts`
- 模块初始化时先历史索引，再启动实时监听
- 使用 Viem 的 `watchEvent`

## 6) DAO 接口列表

基路径：`/api/dao`

### 提案
- `GET /proposals`
- `GET /proposals/:id`
- `POST /proposals`（需要认证）
- `POST /proposals/sync/:id`（需要认证）
- `GET /proposals/:id/votes`
- `GET /proposals/:id/stats`

### 投票
- `GET /votes/:walletAddress`
- `POST /votes`（需要认证）
- `GET /votes/:walletAddress/history`

### 质押
- `GET /staking/:walletAddress`
- `GET /staking/:walletAddress/active`
- `GET /staking/power/:walletAddress`
- `GET /staking/:walletAddress/summary`

### 国库
- `GET /treasury`
- `GET /treasury/assets`
- `GET /treasury/assets/:assetType`
- `GET /treasury/native`
- `GET /treasury/erc20/:tokenAddress`

### 统计与活动
- `GET /stats`
- `GET /stats/:walletAddress`
- `GET /stats/:walletAddress/participation`
- `GET /activity`
- `GET /activity/:walletAddress`

## 7) 事件监听控制

基路径：`/dao`（注意：当前路由不带 `/api`）

```bash
curl http://localhost:3000/dao/listener/status
curl -X POST http://localhost:3000/dao/listener/start
curl -X POST http://localhost:3000/dao/listener/stop
curl -X POST "http://localhost:3000/dao/indexer/reindex?fromBlock=18500000"
```

## 8) 索引参数调优

`src/modules/dao/indexer.service.ts`：
- `BATCH_SIZE`：每批区块数
- `MAX_RETRIES`：重试次数
- `RETRY_DELAY`：重试间隔
- `delay(500)`：批次间冷却

建议：
- RPC 慢/限流：减小 `BATCH_SIZE`，增大延迟
- 专用 RPC：增大 `BATCH_SIZE`，减少延迟

## 9) 常见问题

### RPC 超时
- 表现：Viem 抛出 `TimeoutError`
- 处理：更换更稳定的 RPC（Alchemy/Infura/QuickNode/PublicNode）

### 端口被占用
- 表现：`EADDRINUSE :::3000`
- 处理：结束占用进程，或设置 `PORT=3001`

### 事件缺失
- 处理：从部署区块重新索引
  `POST /dao/indexer/reindex?fromBlock=<deploy_block>`

## 10) 主要文件结构

```
src/modules/web3/
  web3.module.ts
  web3.provider.ts
  contracts.service.ts

src/modules/dao/
  dao.module.ts
  dao.controller.ts
  proposals.service.ts
  voting.service.ts
  staking.service.ts
  treasury.service.ts
  governance-stats.service.ts
  indexer.service.ts
  event-listener.service.ts
```
