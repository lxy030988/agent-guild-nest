# DAO 治理模块 API 文档

## 概述

DAO 治理模块为平台提供链上治理后台能力，覆盖提案、投票、质押、国库、统计与事件监听等功能。

### 核心功能

- 📝 **提案管理**: 创建、查询、同步链上提案
- 🗳️ **投票系统**: 记录投票与投票历史
- 🧱 **质押管理**: 质押记录与投票权计算
- 💰 **国库管理**: 资产统计（原生币、ERC20/721/1155）
- 📊 **治理统计**: 用户与全局统计数据
- 🛰️ **事件监听**: 历史索引与实时监听

### 技术栈

- **框架**: NestJS
- **数据库**: PostgreSQL (Prisma ORM)
- **区块链**: Viem
- **认证**: JWT Bearer Token
- **文档**: Swagger/OpenAPI

---

## 数据模型

### Proposal 提案

```typescript
{
  id: string;                 // UUID
  proposalId: string;         // 链上提案 ID（BigInt 字符串）
  title: string;              // 标题
  description: string;        // 描述
  proposer: string;           // 提案者地址
  status: ProposalStatus;     // 状态
  startBlock: string;         // 开始区块
  endBlock: string;           // 结束区块
  votesFor: string;           // 赞成票
  votesAgainst: string;       // 反对票
  votesAbstain: string;       // 弃权票
  createdAt: Date;
  updatedAt: Date;
}
```

### Vote 投票

```typescript
{
  id: string;                 // UUID
  proposalId: string;         // 提案 ID（UUID）
  voter: string;              // 投票者地址
  support: VoteType;          // FOR | AGAINST | ABSTAIN
  weight: string;             // 投票权重（字符串）
  reason?: string;            // 原因
  createdAt: Date;
}
```

### Stake 质押

```typescript
{
  id: string;                 // UUID
  walletAddress: string;      // 质押者地址
  amount: string;             // 质押数量（字符串）
  lockPeriod: string;         // 锁定期
  multiplier: number;         // 权重倍率
  isActive: boolean;          // 是否有效
  createdAt: Date;
  updatedAt: Date;
}
```

### Treasury 国库

```typescript
{
  id: string;                 // UUID
  assetType: AssetType;       // NATIVE | ERC20 | ERC721 | ERC1155
  tokenAddress?: string;      // 资产合约地址
  symbol?: string;            // 代币符号
  balance: string;            // 余额
  updatedAt: Date;
}
```

### GovernanceStats 统计

```typescript
{
  id: string;                 // UUID
  walletAddress: string;      // 用户地址
  proposalsCreated: number;   // 创建提案数
  totalVotes: number;         // 投票次数
  votesFor: number;           // 赞成票数
  votesAgainst: number;       // 反对票数
  votesAbstain: number;       // 弃权票数
  currentStaked: string;      // 当前质押
  totalVotingPower: string;   // 投票权
}
```

---

## 枚举类型

### ProposalStatus

```typescript
enum ProposalStatus {
  PENDING,
  ACTIVE,
  CANCELED,
  DEFEATED,
  SUCCEEDED,
  QUEUED,
  EXPIRED,
  EXECUTED
}
```

### VoteType

```typescript
enum VoteType {
  FOR,
  AGAINST,
  ABSTAIN
}
```

### AssetType

```typescript
enum AssetType {
  NATIVE,
  ERC20,
  ERC721,
  ERC1155
}
```

---

## API 端点

### 基础信息

- **Base URL**: `http://localhost:3000`
- **认证方式**: Bearer Token (JWT)
- **请求格式**: `application/json`
- **响应格式**: 统一包装

```typescript
{
  success: boolean;
  data: any;
  timestamp: string;
  path: string;
}
```

---

### 1. 创建提案

**POST** `/api/dao/proposals`

#### 请求

```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

```json
{
  "title": "Upgrade DAO Treasury",
  "description": "Increase treasury allocation for grants",
  "targets": ["0x..."],
  "values": ["0"],
  "calldatas": ["0x..."],
  "signatures": [""],
  "proposer": "0xYourAddress"
}
```

#### 响应

**Status**: `201 Created`

---

### 2. 获取提案列表

**GET** `/api/dao/proposals`

#### 请求

```
GET /api/dao/proposals?status=ACTIVE&page=1&limit=10&sortBy=createdAt&order=desc
```

#### 响应

**Status**: `200 OK`

---

### 3. 记录投票

**POST** `/api/dao/votes`

#### 请求

```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

```json
{
  "proposalId": "1",
  "voter": "0xYourAddress",
  "support": "FOR",
  "weight": "1000000000000000000",
  "reason": "Looks good"
}
```

#### 响应

**Status**: `201 Created`

---

### 4. 获取投票权

**GET** `/api/dao/staking/power/:walletAddress`

#### 请求

```
GET /api/dao/staking/power/0xYourAddress
```

#### 响应

**Status**: `200 OK`

---

### 5. 国库资产概览

**GET** `/api/dao/treasury`

#### 请求

```
GET /api/dao/treasury
```

#### 响应

**Status**: `200 OK`

---

## 事件监听与索引

### 监听状态

**GET** `/dao/listener/status`

### 启动监听

**POST** `/dao/listener/start`

### 停止监听

**POST** `/dao/listener/stop`

### 重新索引

**POST** `/dao/indexer/reindex?fromBlock=<deploy_block>`

---

## 常见问题

### RPC 超时

- 现象：Viem 抛出 `TimeoutError`
- 解决：使用更稳定的 RPC（Alchemy/Infura/QuickNode/PublicNode）

### 端口占用

- 现象：`EADDRINUSE :::3000`
- 解决：结束占用进程或设置 `PORT=3001`
