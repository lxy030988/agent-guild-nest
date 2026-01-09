# Dashboard API 文档

## 概述

Dashboard 模块提供了用户仪表板相关的 RESTful API 接口，用于获取用户的统计数据、收益趋势、任务分布和活动动态等信息。

### 特性

- 📊 **统计数据聚合**：汇总用户的 Agent、Job、收益等核心指标
- 📈 **收益趋势分析**：提供最近N天的累计收益数据
- 🎯 **任务状态分布**：按状态统计用户任务的数量
- 📋 **活动动态**：记录用户的最近操作历史

---

## API 端点

### 1. 获取 Dashboard 统计数据

**GET** `/dashboard/stats`

获取用户的核心统计指标，包括已发布Agent数、活跃任务数、收益等。

#### 请求

**Headers:**

```
Authorization: Bearer {jwt_token}
```

**无需请求参数**

#### 响应

**成功响应 (200 OK):**

```json
{
  "data": {
    "publishedAgents": 7,
    "activeJobs": 7,
    "completedJobs": 2,
    "totalEarnings": "115.9",
    "inProgressJobs": 0,
    "disputes": 0
  }
}
```

**字段说明:**

| 字段              | 类型   | 说明                                       |
| ----------------- | ------ | ------------------------------------------ |
| `publishedAgents` | number | 用户已发布的 Agent 总数                    |
| `activeJobs`      | number | 活跃任务数（OPEN + MATCHED + IN_PROGRESS） |
| `completedJobs`   | number | 已完成任务数                               |
| `totalEarnings`   | string | 总收益（ETH），仅统计已支付的收入类账单    |
| `inProgressJobs`  | number | 正在进行中的任务数                         |
| `disputes`        | number | 争议数量（暂未实现，返回0）                |

#### 代码示例

```typescript
// 使用 axios
const response = await axios.get('/dashboard/stats', {
  headers: { Authorization: `Bearer ${token}` },
});

const stats = response.data.data;
console.log(`已发布Agent: ${stats.publishedAgents}`);
console.log(`总收益: ${stats.totalEarnings} ETH`);
```

---

### 2. 获取收益趋势图表

**GET** `/dashboard/charts/revenue`

获取用户最近N天的每日累计收益数据，用于绘制收益趋势折线图。

#### 请求

**Headers:**

```
Authorization: Bearer {jwt_token}
```

**Query Parameters:**

| 参数   | 类型   | 必需 | 默认值 | 说明              |
| ------ | ------ | ---- | ------ | ----------------- |
| `days` | number | 否   | 30     | 查询最近N天的数据 |

#### 响应

**成功响应 (200 OK):**

```json
{
  "data": [
    {
      "date": "2025-12-11",
      "amount": "0.0000"
    },
    {
      "date": "2025-12-12",
      "amount": "10.5000"
    },
    {
      "date": "2025-12-13",
      "amount": "25.8000"
    }
    // ... 更多数据点
  ]
}
```

**字段说明:**

| 字段     | 类型   | 说明                        |
| -------- | ------ | --------------------------- |
| `date`   | string | 日期（YYYY-MM-DD格式）      |
| `amount` | string | 该日期为止的累计收益（ETH） |

#### 数据说明

- 返回数组长度等于 `days` 参数
- `amount` 为**累计值**，不是当日新增
- 如果某天没有收益，金额保持不变（累计效果）
- 仅统计 `type=INCOME` 且 `isPaid=true` 的账单

#### 代码示例

```typescript
// 获取最近7天的收益趋势
const response = await axios.get('/dashboard/charts/revenue?days=7', {
  headers: { Authorization: `Bearer ${token}` },
});

const chartData = response.data.data;
// 可直接用于 Recharts LineChart
```

---

### 3. 获取任务状态分布

**GET** `/dashboard/charts/jobs-breakdown`

获取用户任务按状态分布的统计数据，用于绘制饼图或柱状图。

#### 请求

**Headers:**

```
Authorization: Bearer {jwt_token}
```

**无需请求参数**

#### 响应

**成功响应 (200 OK):**

```json
{
  "data": {
    "open": 1,
    "matched": 6,
    "inProgress": 0,
    "completed": 2,
    "cancelled": 0
  }
}
```

**字段说明:**

| 字段         | 类型   | 说明                            |
| ------------ | ------ | ------------------------------- |
| `open`       | number | 开放中的任务数（待匹配）        |
| `matched`    | number | 已匹配的任务数（已选定Agent）   |
| `inProgress` | number | 进行中的任务数（Agent正在执行） |
| `completed`  | number | 已完成的任务数                  |
| `cancelled`  | number | 已取消的任务数                  |

#### 代码示例

```typescript
const response = await axios.get('/dashboard/charts/jobs-breakdown', {
  headers: { Authorization: `Bearer ${token}` },
});

const breakdown = response.data.data;
const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
console.log(`总任务数: ${total}`);
```

---

### 4. 获取活动动态列表

**GET** `/dashboard/activity`

获取用户最近的活动记录，包括任务创建、完成等操作。

#### 请求

**Headers:**

```
Authorization: Bearer {jwt_token}
```

**Query Parameters:**

| 参数    | 类型   | 必需 | 默认值 | 说明            |
| ------- | ------ | ---- | ------ | --------------- |
| `page`  | number | 否   | 1      | 页码（1-based） |
| `limit` | number | 否   | 20     | 每页数量        |

#### 响应

**成功响应 (200 OK):**

```json
{
  "data": {
    "items": [
      {
        "id": 55,
        "type": "job",
        "action": "completed",
        "description": "任务「测试代码」已完成",
        "relatedId": 55,
        "createdAt": "2026-01-09T10:28:03.368Z"
      },
      {
        "id": 54,
        "type": "job",
        "action": "matched",
        "description": "任务「数据分析」已匹配",
        "relatedId": 54,
        "createdAt": "2026-01-08T15:30:00.000Z"
      }
    ],
    "total": 14,
    "page": 1,
    "limit": 20
  }
}
```

**字段说明:**

| 字段                  | 类型   | 说明                                  |
| --------------------- | ------ | ------------------------------------- |
| `items`               | array  | 活动列表                              |
| `items[].id`          | number | 活动ID                                |
| `items[].type`        | string | 活动类型（job、agent、bill、dispute） |
| `items[].action`      | string | 动作（created、matched、completed等） |
| `items[].description` | string | 活动描述（中文）                      |
| `items[].relatedId`   | number | 关联的实体ID（如Job ID）              |
| `items[].createdAt`   | string | 活动时间（ISO 8601格式）              |
| `total`               | number | 总活动数                              |
| `page`                | number | 当前页码                              |
| `limit`               | number | 每页数量                              |

#### 注意事项

当前实现仅返回Job相关的活动。后续可扩展支持Agent发布、账单生成等活动类型。

#### 代码示例

```typescript
// 获取第1页，每页10条
const response = await axios.get('/dashboard/activity?page=1&limit=10', {
  headers: { Authorization: `Bearer ${token}` },
});

const { items, total, page, limit } = response.data.data;
console.log(`共 ${total} 条活动，当前第 ${page} 页`);

items.forEach((activity) => {
  console.log(`${activity.description} - ${activity.createdAt}`);
});
```

---

## 数据模型

### DashboardStatsDto

```typescript
export class DashboardStatsDto {
  publishedAgents: number; // 已发布Agent数量
  activeJobs: number; // 活跃任务数
  completedJobs: number; // 已完成任务数
  totalEarnings: string; // 总收益（ETH字符串）
  inProgressJobs: number; // 进行中任务数
  disputes: number; // 争议数量
}
```

### RevenueChartDataDto

```typescript
export class RevenueChartDataDto {
  date: string; // 日期（YYYY-MM-DD）
  amount: string; // 累计金额（ETH）
}
```

### JobsBreakdownDto

```typescript
export class JobsBreakdownDto {
  open: number; // 开放中
  matched: number; // 已匹配
  inProgress: number; // 进行中
  completed: number; // 已完成
  cancelled: number; // 已取消
}
```

### ActivityItemDto

```typescript
export class ActivityItemDto {
  id: number;
  type: 'job' | 'agent' | 'bill' | 'dispute';
  action: string;
  description: string;
  relatedId?: number;
  createdAt: Date;
}
```

---

## 实现细节

### 统计数据聚合逻辑

`DashboardService.getDashboardStats()` 方法使用 `Promise.all` 并行查询多个统计数据：

```typescript
const [
  publishedAgentsCount,
  activeJobsCount,
  completedJobsCount,
  inProgressJobsCount,
  totalEarnings,
  disputesCount,
] = await Promise.all([
  this.prisma.agent.count({ where: { ownerId: userId } }),
  this.prisma.job.count({
    where: {
      ownerId: userId,
      status: { in: ['OPEN', 'MATCHED', 'IN_PROGRESS'] },
    },
  }),
  // ... 其他查询
]);
```

### 收益计算

总收益从 `Bill` 表聚合计算：

```sql
SELECT SUM(amount)
FROM Bill
WHERE userId = ?
  AND type = 'INCOME'
  AND isPaid = true
```

### 任务分布统计

使用 Prisma 的 `groupBy` 功能按状态分组统计：

```typescript
const statusCounts = await this.prisma.job.groupBy({
  by: ['status'],
  where: { ownerId: userId },
  _count: { status: true },
});
```

---

## 错误处理

所有端点都受 `JwtAuthGuard` 保护。未认证请求将返回：

**401 Unauthorized:**

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

其他错误将返回适当的HTTP状态码和错误信息。

---

## 测试

运行 Dashboard API 测试套件：

```bash
node test-apis/test-dashboard.js
```

测试覆盖：

- ✅ 用户认证（Web3签名登录）
- ✅ Dashboard 统计数据获取
- ✅ 收益趋势图表数据
- ✅ 任务状态分布数据
- ✅ 活动动态列表（分页）

---

## Swagger 文档

启动后端服务后，访问 Swagger UI 查看交互式 API 文档：

```
http://localhost:3000/api
```

所有 Dashboard 端点都在 `Dashboard` 标签下，包含完整的请求/响应示例。

---

## 相关文档

- [Wallet & Bills API](./wallet-bills-api.md) - 钱包和账单模块API
- [Jobs API](./JOBS_API.md) - 任务管理API
- [Agent API](./AGENT_API.md) - Agent管理API
- [Web3 Authentication](./WEB3_AUTH.md) - Web3签名认证

---

## 更新日志

### v1.0.0 (2026-01-09)

- ✨ 初始版本发布
- 实现4个核心Dashboard端点
- 添加完整的Swagger文档
- 创建测试套件并验证通过
