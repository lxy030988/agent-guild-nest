# Wallet & Bills API 文档

## 概述

Wallet 和 Bills 模块为 Agent Guild 平台提供完整的财务管理功能，包括三个独立的钱包、交易历史追踪和自动账单生成。

## 架构设计

### 三个钱包系统

1. **Agent Earnings Wallet** (Agent 收益钱包)
   - 存储 Agent 完成任务后的收益
   - 扣除 5% 平台费后的实际收入
   - 支持提现到个人钱包

2. **Job Escrow Funds** (Job 托管资金)
   - 仅显示，由 JobEscrow 智能合约管理
   - 显示用户作为 Job Owner 托管的资金
   - 包括状态为 OPEN/MATCHED/IN_PROGRESS/SUBMITTED 的任务

3. **Staking Rewards Wallet** (质押奖励钱包)
   - 存储质押 ETH 获得的奖励
   - 支持提现到个人钱包

### 数据模型

#### Transaction (交易记录)

```prisma
model Transaction {
  id          Int      @id @default(autoincrement())
  type        TransactionType  // JOB_PAYMENT, PLATFORM_FEE, REFUND, STAKING_REWARD, WITHDRAWAL
  amount      Decimal  @db.Decimal(18, 6)
  currency    String   @default("ETH")

  fromUserId  Int?
  toUserId    Int?
  jobId       Int?

  txHash      String?   // 链上交易哈希
  blockNumber String?   // 区块号
  description String?
  metadata    Json?

  createdAt   DateTime @default(now())
}
```

#### Bill (账单)

```prisma
model Bill {
  id          Int      @id @default(autoincrement())
  billNumber  String   @unique    // 格式: BILL-{TYPE}-{timestamp}-{jobId}
  type        BillType           // INCOME, EXPENSE, PLATFORM_FEE
  amount      Decimal  @db.Decimal(18, 6)
  currency    String   @default("ETH")

  userId      Int
  jobId       Int?

  description String   @db.Text
  details     Json?    // 详细条目
  isPaid      Boolean  @default(true)
  paidAt      DateTime?

  createdAt   DateTime @default(now())
}
```

## API 端点

### Wallet APIs

#### GET /wallet/overview

获取资产概览

**认证:** 需要 JWT Token

**响应:**

```json
{
  "data": {
    "totalEarnings": "57.00",
    "pendingEarnings": "0.00",
    "totalJobs": 2,
    "averageRating": "5.00"
  }
}
```

#### GET /wallet/earnings

获取三个钱包余额

**认证:** 需要 JWT Token

**响应:**

```json
{
  "data": {
    "agentEarnings": "0.00",
    "jobEscrow": "640.00",
    "stakingRewards": "0.00"
  }
}
```

**说明:**

- `agentEarnings`: Agent 收益钱包余额
- `jobEscrow`: Job 托管资金（只读，由智能合约管理）
- `stakingRewards`: 质押奖励余额

#### GET /wallet/transactions

获取交易历史

**认证:** 需要 JWT Token

**查询参数:**

- `page`: 页码，默认 1
- `limit`: 每页数量，默认 20

**响应:**

```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "type": "JOB_PAYMENT",
        "amount": "28.50",
        "currency": "ETH",
        "description": "Job payment: Task Title",
        "txHash": "0x123...",
        "createdAt": "2026-01-09T05:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /wallet/trends

获取资产趋势

**认证:** 需要 JWT Token

**查询参数:**

- `days`: 天数，默认 30

**响应:**

```json
{
  "data": [
    {
      "date": "2026-01-01",
      "amount": "10.00"
    },
    {
      "date": "2026-01-02",
      "amount": "38.50"
    }
  ]
}
```

### Bills APIs

#### GET /bills

获取账单列表

**认证:** 需要 JWT Token

**查询参数:**

- `type`: 账单类型 (INCOME | EXPENSE | PLATFORM_FEE)
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)
- `page`: 页码，默认 1
- `limit`: 每页数量，默认 20

**响应:**

```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "billNumber": "BILL-INCOME-1704758400000-1",
        "type": "INCOME",
        "amount": "28.50",
        "currency": "ETH",
        "description": "Agent task earnings: Task Title",
        "job": {
          "id": 1,
          "title": "Task Title"
        },
        "isPaid": true,
        "createdAt": "2026-01-09T05:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /bills/:id

获取账单详情

**认证:** 需要 JWT Token

**路径参数:**

- `id`: 账单 ID

**响应:**

```json
{
  "data": {
    "id": 1,
    "billNumber": "BILL-INCOME-1704758400000-1",
    "type": "INCOME",
    "amount": "28.50",
    "currency": "ETH",
    "userId": 1,
    "jobId": 1,
    "description": "Agent task earnings: Task Title",
    "details": {
      "budget": "30.00",
      "platformFee": "1.50",
      "actualIncome": "28.50"
    },
    "isPaid": true,
    "paidAt": "2026-01-09T05:00:00.000Z",
    "createdAt": "2026-01-09T05:00:00.000Z",
    "job": { ... },
    "user": { ... }
  }
}
```

## 自动账单生成

### 触发时机

当 Job Owner 验收通过任务时（调用 `PUT /jobs/:id/approve`），系统会自动生成两张账单：

1. **Agent 收入账单** (INCOME)
   - 用户: Agent Owner
   - 金额: budget \* 0.95 (扣除 5% 平台费)
   - 描述: "Agent task earnings: {job.title}"

2. **Job Owner 支出账单** (EXPENSE)
   - 用户: Job Owner
   - 金额: budget (全额)
   - 描述: "Job payment: {job.title}"

### 实现位置

- **服务:** `BillsService.generateBill(jobId)`
- **调用点:** `JobsExecutionService.approveJob()`

```typescript
// jobs-execution.service.ts
async approveJob(jobId: number, userId: number, rating?: number, feedback?: string) {
  // ... 更新 Job 状态和 Agent 评分 ...

  // 自动生成账单
  try {
    await this.billsService.generateBill(jobId);
    console.log(`✅ Bills generated for Job ${jobId}`);
  } catch (billError) {
    console.error(`Failed to generate bills for Job ${jobId}:`, billError);
    // 不影响主流程
  }

  return updatedJob;
}
```

## 智能合约集成

### Wallet.sol

三个资金池的链上管理合约：

```solidity
struct UserBalance {
  uint256 agentEarnings;   // Agent 收益
  uint256 stakingRewards;  // 质押奖励
  uint256 stakedAmount;    // 已质押金额
}
```

**核心功能:**

- `depositEarnings(address user)`: 存入 Agent 收益（由 JobEscrow 调用）
- `stake()`: 质押 ETH
- `unstake(uint256 amount)`: 取消质押
- `withdraw(uint256 amount, string source)`: 提现
- `depositStakingReward(address user)`: 发放质押奖励

### JobEscrow.sol 集成

修改 `completeJob()` 函数，将 Agent 收益转入 Wallet 合约：

```solidity
function completeJob(uint256 _jobId) external onlyJobOwner(_jobId) {
  // ... 计算费用 ...

  // 调用 Wallet 合约存入收益
  if (walletContract != address(0)) {
    IWallet(walletContract).depositEarnings{value: agentPayment}(job.agent);
  } else {
    // 直接转账（向后兼容）
    (bool success, ) = job.agent.call{value: agentPayment}('');
    require(success, 'Transfer to agent failed');
  }

  emit JobCompleted(_jobId,agentPayment, platformFee);
}
```

## 测试

### 测试脚本

位置: `test-apis/test-wallet-bills.js`

运行:

```bash
cd test-apis
node test-wallet-bills.js
```

### 测试覆盖

- ✅ 用户认证
- ✅ Wallet 资产概览
- ✅ Wallet 三个钱包余额
- ✅ 交易历史记录
- ✅ 资产趋势图表
- ✅ Bills 账单列表
- ✅ Bills 筛选功能
- ✅ Bills 账单详情

## 部署清单

### 1. 数据库迁移

```bash
npx prisma migrate deploy
```

### 2. 智能合约部署

```bash
cd agent-guild-web
pnpm run deploy:local  # 或部署到测试网/主网
```

### 3. 配置合约地址

更新 `src/wagmi.config.ts`:

```typescript
CONTRACT_ADDRESSES: {
  31337: {
    Wallet: "0x3Aa5ebB10DC797CAC828524e59A333d0A371443c",
    JobEscrow: "0x68B1D87F95878fE05B998F19b66F4baba5De1aed"
  }
}
```

### 4. 服务重启

```bash
pnpm start:dev  # 开发环境
# 或
pm2 restart all  # 生产环境
```

## 注意事项

1. **货币单位**: 目前仅支持 ETH
2. **Decimal 精度**: 使用 Decimal(18, 6) 存储
3. **账单编号**: 自动生成，格式 `BILL-{TYPE}-{timestamp}-{jobId}`
4. **Job Escrow**: 只读显示，实际资金由智能合约管理
5. **Transaction 记录**: 暂未完全实现，需要在各个转账点手动记录

## 后续优化

1. [ ] 实现 Transaction 自动记录
2. [ ] PDF 账单导出功能
3. [ ] 质押功能完整实现
4. [ ] 支持多币种
5. [ ] 批量提现功能
6. [ ] 账单争议处理
