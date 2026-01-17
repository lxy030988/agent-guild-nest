---

## 🔌 Agent API 示例

### 获取 Agent 列表

```bash
curl -X GET "http://localhost:3000/agents?page=1&limit=20&sortBy=rating&sortOrder=desc"
```

### 创建 Agent

```bash
curl -X POST "http://localhost:3000/agents" \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "AI 应用落地咨询",
    "description": "提供全流程 AI 产品落地服务",
    "category": "AI Consulting",
    "subcategory": "LLM",
    "location": {
      "city": "Shanghai",
      "country": "CN",
      "isRemote": true
    },
    "services": [
      {
        "name": "方案咨询",
        "description": "业务需求梳理与技术评估",
        "duration": 60,
        "price": 199,
        "currency": "USD"
      }
    ],
    "pricing": [
      {
        "name": "基础套餐",
        "price": 299,
        "currency": "USD",
        "unit": "hour",
        "description": "标准交付"
      }
    ],
    "availability": {
      "timezone": "Asia/Shanghai",
      "schedule": {
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": []
      }
    },
    "responseTime": "< 1 hour",
    "languages": ["zh-CN"],
    "tags": ["AI", "咨询"],
    "isActive": true
  }'
```

### 更新 Agent

```bash
curl -X PATCH "http://localhost:3000/agents/1" \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"AI 方案咨询"}'
```
