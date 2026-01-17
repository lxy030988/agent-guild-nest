# DAO 争议解决 (Dispute Resolution) API 文档

本文档详细说明了 Agent Guild 平台中 DAO 争议解决模块的后端架构、数据库模型、API 接口以及业务逻辑。

## 1. 模块概述

DAO 争议解决模块允许任务发布者（Job Owner）或被分配的 Agent 在任务执行完成后，针对交付质量或执行过程发起争议。争议由平台其他用户（DAO 成员）通过投票决定最终结果。

**核心特性**:

- ✅ 区块链智能合约同步 (DisputeResolution.sol)
- ✅ 链上争议 ID 与数据库 ID 双轨追踪 (`chainDisputeId`)
- ✅ 动态投票截止时间 (从链上合约读取 `votingEndsAt`)
- ✅ 自动化状态同步与结算

## 2. 数据库模型 (Prisma)

### Dispute 模型

存储争议的核心信息及统计结果。

| 字段              | 类型      | 说明                                       |
| :---------------- | :-------- | :----------------------------------------- |
| `id`              | Int       | 自增主键 (数据库 ID)                       |
| `jobId`           | Int       | 关联的任务 ID                              |
| `creatorId`       | Int       | 发起者用户 ID                              |
| `title`           | String    | 争议简短标题                               |
| `reason`          | String    | 争议详细原因 (Text)                        |
| `evidence`        | String?   | 证据链接或 IPFS 哈希 (可选)                |
| `status`          | Enum      | `PENDING`, `VOTING`, `RESOLVED`, `EXPIRED` |
| `votingStartsAt`  | DateTime  | 投票开始时间                               |
| `votingEndsAt`    | DateTime  | 投票结束时间 (从链上合约动态读取)          |
| `approveVotes`    | Int       | 支持票数统计 (@default(0))                 |
| `rejectVotes`     | Int       | 反对票数统计 (@default(0))                 |
| `abstainVotes`    | Int       | 弃权票数统计 (@default(0))                 |
| `totalVoteWeight` | String?   | 总投票权重 (BigInt 字符串)                 |
| `resolution`      | String?   | 最终决议描述                               |
| `resolvedAt`      | DateTime? | 解决时间                                   |
| `chainDisputeId`  | String?   | 链上争议 ID (⭐ 核心字段，用于合约交互)    |
| `createdAt`       | DateTime  | 创建时间 (@default(now()))                 |
| `updatedAt`       | DateTime  | 更新时间 (@updatedAt)                      |

### Vote 模型

记录每个用户的投票行为。

| 字段          | 类型     | 说明                                                        |
| :------------ | :------- | :---------------------------------------------------------- |
| `id`          | Int      | 自增主键                                                    |
| `disputeId`   | Int      | 关联的争议 ID                                               |
| `voterId`     | Int      | 投票人用户 ID                                               |
| `choice`      | Enum     | `APPROVE` (支持工作), `REJECT` (成果无效), `ABSTAIN` (弃权) |
| `tokenWeight` | String   | 投票权重 (BigInt 字符串)                                    |
| `reason`      | String?  | 投票理由说明 (可选)                                         |
| `createdAt`   | DateTime | 投票时间 (@default(now()))                                  |

---

## 3. API 接口说明

### 3.1 发起争议

- **URL**: `POST /disputes`
- **认证**: 需要 (JWT)
- **请求体**:

```json
{
  "jobId": 123,
  "title": "工作质量争议",
  "reason": "Agent 交付的内容质量不佳，与需求严重不符",
  "evidence": "https://ipfs.io/ipfs/QmXxx...",
  "chainDisputeId": "1",
  "votingEndsAt": "2026-01-21T01:00:00.000Z"
}
```

**字段说明**:

- `jobId` (必填): 关联的任务 ID
- `title` (必填): 争议标题
- `reason` (必填): 争议详细原因
- `evidence` (可选): 证据链接 (IPFS 哈希或 URL)
- `chainDisputeId` (可选): 链上争议 ID，由前端从合约事件中解析
- `votingEndsAt` (可选): 投票截止时间，优先使用此值；若未提供则默认为当前时间 + 7 天

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": 5,
    "jobId": 123,
    "creatorId": 42,
    "title": "工作质量争议",
    "reason": "Agent 交付的内容质量不佳，与需求严重不符",
    "evidence": "https://ipfs.io/ipfs/QmXxx...",
    "status": "VOTING",
    "votingStartsAt": "2026-01-14T01:00:00.000Z",
    "votingEndsAt": "2026-01-21T01:00:00.000Z",
    "approveVotes": 0,
    "rejectVotes": 0,
    "abstainVotes": 0,
    "chainDisputeId": "1",
    "createdAt": "2026-01-14T01:00:00.000Z",
    "updatedAt": "2026-01-14T01:00:00.000Z"
  },
  "message": "Dispute created successfully"
}
```

**业务规则**:

- 任务状态必须为 `SUBMITTED` 或 `COMPLETED`
- 只有任务所属的 Owner 或被分配的 Agent 才有权发起
- 每个任务同时只能有一个活跃的争议 (状态为 `PENDING` 或 `VOTING`)

---

### 3.2 获取争议列表

- **URL**: `GET /disputes`
- **查询参数**:
  - `status` (可选): 过滤争议状态 (`PENDING` | `VOTING` | `RESOLVED` | `EXPIRED`)
  - `page` (可选): 页码 (默认 1)
  - `limit` (可选): 每页数量 (默认 10)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 5,
        "title": "工作质量争议",
        "status": "VOTING",
        "votingEndsAt": "2026-01-21T01:00:00.000Z",
        "approveVotes": 3,
        "rejectVotes": 1,
        "abstainVotes": 0,
        "job": {
          "id": 123,
          "title": "前端页面开发",
          "status": "SUBMITTED"
        },
        "creator": {
          "id": 42,
          "walletAddress": "0x1234...",
          "name": "Alice"
        }
      }
    ],
    "meta": {
      "total": 15,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  }
}
```

---

### 3.3 获取争议详情

- **URL**: `GET /disputes/:id`
- **认证**: 可选 (登录后可查看完整投票记录)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": 5,
    "jobId": 123,
    "creatorId": 42,
    "title": "工作质量争议",
    "reason": "Agent 交付的内容质量不佳，与需求严重不符",
    "evidence": "https://ipfs.io/ipfs/QmXxx...",
    "status": "VOTING",
    "votingStartsAt": "2026-01-14T01:00:00.000Z",
    "votingEndsAt": "2026-01-21T01:00:00.000Z",
    "approveVotes": 3,
    "rejectVotes": 1,
    "abstainVotes": 0,
    "chainDisputeId": "1",
    "job": {
      "id": 123,
      "title": "前端页面开发",
      "status": "SUBMITTED",
      "budget": 1000,
      "owner": {
        "id": 42,
        "walletAddress": "0x1234...",
        "name": "Alice"
      }
    },
    "creator": {
      "id": 42,
      "walletAddress": "0x1234...",
      "name": "Alice"
    },
    "votes": [
      {
        "id": 10,
        "choice": "APPROVE",
        "tokenWeight": "100",
        "reason": "工作质量达标",
        "voter": {
          "id": 50,
          "walletAddress": "0x5678...",
          "name": "Bob"
        },
        "createdAt": "2026-01-14T02:00:00.000Z"
      }
    ]
  }
}
```

---

### 3.4 提交 DAO 投票

- **URL**: `POST /disputes/:id/vote`
- **认证**: 需要 (JWT)
- **请求体**:

```json
{
  "choice": "REJECT",
  "reason": "确实不符合标准，建议退款",
  "tokenWeight": "100"
}
```

**字段说明**:

- `choice` (必填): `APPROVE` | `REJECT` | `ABSTAIN`
- `reason` (可选): 投票理由
- `tokenWeight` (必填): 投票权重 (字符串, 如 "100")

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": 11,
    "disputeId": 5,
    "voterId": 60,
    "choice": "REJECT",
    "tokenWeight": "100",
    "reason": "确实不符合标准，建议退款",
    "createdAt": "2026-01-14T03:00:00.000Z"
  },
  "message": "Vote submitted successfully"
}
```

**业务规则**:

- 一个用户对一个争议只能投票一次
- 只能在投票期内进行 (当前时间 < `votingEndsAt`)
- 投票后自动更新争议的票数统计 (`approveVotes`, `rejectVotes`, `abstainVotes`)

---

### 3.5 解决争议 (计算结果)

- **URL**: `POST /disputes/:id/resolve`
- **认证**: 可选 (任何人均可触发，通常由前端在链上解决后调用)
- **请求体**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": 5,
    "status": "RESOLVED",
    "resolution": "Approved by majority vote (3 approve vs 1 reject)",
    "resolvedAt": "2026-01-21T01:05:00.000Z",
    "job": {
      "id": 123,
      "status": "RESOLVED_COMPLETED"
    }
  },
  "message": "Dispute resolved successfully"
}
```

**业务规则**:

- 投票期结束后方可调用 (当前时间 >= `votingEndsAt`)
- 采用**简单多数制**: 若 `approveVotes > rejectVotes` 则认定任务有效，Job 状态更新为 `RESOLVED_COMPLETED`; 否则更新为 `RESOLVED_CANCELLED`
- 若票数相等或总票数为 0，则默认视为 `RESOLVED_CANCELLED`
- 解决后同步更新 Job 状态:
  - `RESOLVED_COMPLETED`: 争议解决，认定工作有效
  - `RESOLVED_CANCELLED`: 争议解决，认定工作无效

---

### 3.6 统计数据

- **URL**: `GET /disputes/stats`
- **认证**: 可选

**响应示例**:

```json
{
  "success": true,
  "data": {
    "totalDisputes": 15,
    "activeVoting": 3,
    "resolvedDisputes": 12
  }
}
```

**字段说明**:

- `totalDisputes`: 所有争议总数
- `activeVoting`: 当前处于 `VOTING` 状态的争议数
- `resolvedDisputes`: 已解决的争议数 (状态为 `RESOLVED`)

---

### 3.7 获取我的投票记录

- **URL**: `GET /disputes/my-votes`
- **认证**: 需要 (JWT)

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "disputeId": 5,
      "choice": "APPROVE",
      "tokenWeight": "100",
      "reason": "工作质量达标",
      "createdAt": "2026-01-14T02:00:00.000Z",
      "dispute": {
        "id": 5,
        "title": "工作质量争议",
        "status": "VOTING"
      }
    }
  ]
}
```

---

## 4. 区块链同步机制

### 4.1 创建争议流程

**前端调用顺序**:

1. 用户点击"发起争议"
2. 前端调用 `DisputeResolution.createDispute(jobId, evidenceHash)`
3. 等待交易确认，解析 `DisputeCreated` 事件获取 `disputeId` (链上 ID)
4. 从合约读取 `disputes(disputeId)` 获取 `votingEndsAt` (Unix 时间戳)
5. 调用后端 `POST /disputes`，传入 `chainDisputeId` 和 `votingEndsAt`

**后端处理**:

```typescript
// disputes.service.ts
async createDispute(createDisputeDto: CreateDisputeDto) {
  const votingEndsAt = createDisputeDto.votingEndsAt
    ? new Date(createDisputeDto.votingEndsAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 默认 7 天

  return this.prisma.dispute.create({
    data: {
      ...createDisputeDto,
      votingEndsAt,
      votingStartsAt: new Date(),
      status: DisputeStatus.VOTING,
    },
  });
}
```

### 4.2 投票同步流程

**前端调用顺序**:

1. 用户选择投票选项 (APPROVE/REJECT/ABSTAIN)
2. 前端调用 `DisputeResolution.vote(chainDisputeId, choiceIndex)`
3. 等待交易确认
4. 调用后端 `POST /disputes/:id/vote` 同步投票记录

**后端处理**:

- 自动更新 `approveVotes`, `rejectVotes`, `abstainVotes` 字段
- 确保每个用户只能投票一次

### 4.3 解决争议流程

**前端调用顺序**:

1. 投票期结束后，用户点击"解决争议"
2. 前端调用 `DisputeResolution.resolveDispute(chainDisputeId)`
3. 等待交易确认
4. 调用后端 `POST /disputes/:id/resolve` 同步最终状态

**后端处理**:

```typescript
// disputes.service.ts
async resolveDispute(id: number) {
  const dispute = await this.prisma.dispute.findUnique({ where: { id } });

  // 计算结果
  const approved = dispute.approveVotes > dispute.rejectVotes;
  const resolution = approved
    ? `Approved by majority vote (${dispute.approveVotes} approve vs ${dispute.rejectVotes} reject)`
    : `Rejected by majority vote (${dispute.rejectVotes} reject vs ${dispute.approveVotes} approve)`;

  // 更新争议状态
  await this.prisma.dispute.update({
    where: { id },
    data: {
      status: DisputeStatus.RESOLVED,
      resolution,
      resolvedAt: new Date(),
    },
  });

  // 更新关联 Job 状态
  await this.prisma.job.update({
    where: { id: dispute.jobId },
    data: {
      status: approved ? JobStatus.RESOLVED_COMPLETED : JobStatus.RESOLVED_CANCELLED,
    },
  });
}
```

---

## 5. 自动化测试

项目提供了一个完整的端到端测试脚本，用于验证上述所有流程。

- **脚本路径**: `test-apis/test-disputes.js`
- **运行命令**:

```bash
node test-apis/test-disputes.js
```

**覆盖流程**:

1. 创建 Job 并分配 Agent
2. 流转状态至 SUBMITTED
3. 创建争议并进行投票
4. 验证统计数据
5. 解决争议并验证 Job 状态更新

---

## 6. 常见问题

### Q1: 为什么需要 `chainDisputeId` 字段？

**A**: 前端与智能合约交互时，必须使用链上 ID (`chainDisputeId`)，而后端数据库使用自增 ID (`id`)。两者需要同步映射。

### Q2: 投票截止时间如何确定？

**A**: 优先使用前端从合约读取的 `votingEndsAt`，确保与链上一致。若未提供，后端默认设置为创建时间 + 7 天。

### Q3: 争议解决后 Job 状态如何变化？

**A**:

- 支持票数 > 反对票数 → `RESOLVED_COMPLETED` (认定工作有效)
- 支持票数 ≤ 反对票数 → `RESOLVED_CANCELLED` (认定工作无效)

### Q4: 能否在投票期内修改投票？

**A**: 当前版本不支持修改投票，每个用户只能投票一次。

---

_文档版本: v2.0.0 | 最后更新: 2026-01-14_
