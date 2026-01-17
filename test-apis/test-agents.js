#!/usr/bin/env node

/**
 * Agent API 测试脚本
 * 测试所有 Agent 相关的端点
 *
 * 使用方法：
 * 1. 确保后端服务正在运行（pnpm run start:dev）
 * 2. 运行测试：node test-apis/test-agents.js
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// 测试用户的 token（通过登录自动获取）
let authToken = null;
let userId = null;
let createdAgentId = null;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logSection(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(message, 'blue');
  log('='.repeat(60), 'blue');
}

// ============================================
// 登录获取 Token（复用 test-all-apis.js 的逻辑）
// ============================================

async function loginAndGetToken() {
  logSection('预备步骤: 登录获取认证 Token');

  // 使用 Hardhat 的第一个测试账户
  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new Wallet(privateKey);

  logInfo(`钱包地址: ${wallet.address}`);

  try {
    // 1. 获取 nonce
    logInfo('步骤 1: 获取 nonce...');
    const nonceRes = await axios.post(`${API_BASE_URL}/auth/nonce`, {
      walletAddress: wallet.address,
    });
    const { message, nonce } = nonceRes.data.data;
    logSuccess(`Nonce: ${nonce}`);

    // 2. 签名
    logInfo('步骤 2: 签名消息...');
    const signature = await wallet.signMessage(message);
    logSuccess('签名成功');

    // 3. 登录
    logInfo('步骤 3: 登录...');
    const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      walletAddress: wallet.address,
      signature,
    });

    const { access_token, user } = loginRes.data.data;
    authToken = access_token;
    userId = user.id;

    logSuccess('登录成功');
    logInfo(`User ID: ${userId}`);
    logInfo(`Token: ${access_token.substring(0, 40)}...`);

    return true;
  } catch (error) {
    logError('登录失败');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

// ============================================
// HTTP 请求封装（使用 axios）
// ============================================

async function request(method, path, data = null, useAuth = false) {
  const url = `${API_BASE_URL}${path}`;
  const config = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (useAuth && authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return {
      status: response.status,
      ok: true,
      data: response.data,
    };
  } catch (error) {
    if (error.response) {
      return {
        status: error.response.status,
        ok: false,
        data: error.response.data,
      };
    }
    logError(`Request failed: ${error.message}`);
    throw error;
  }
}

// ============================================
// 测试用例
// ============================================

/**
 * 测试 1：获取 Agent 列表（公开接口）
 */
async function testGetAgents() {
  logSection('测试 1: 获取 Agent 列表 (GET /agents)');

  const response = await request('GET', '/agents');

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data; // 适配嵌套格式
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`返回数据结构: data[], meta{}`);
    logInfo(`总数: ${actualData.meta?.total || 0}`);
    logInfo(`当前页: ${actualData.meta?.page || 1}`);
    console.log(JSON.stringify(actualData, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 2：获取精选 Agents（公开接口）
 */
async function testGetFeaturedAgents() {
  logSection('测试 2: 获取精选 Agents (GET /agents/featured)');

  const response = await request('GET', '/agents/featured');

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data;
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`返回数据: 按分类分组`);
    const categories = Object.keys(actualData).filter((k) =>
      Array.isArray(actualData[k]),
    );
    logInfo(`分类数: ${categories.length}`);
    categories.forEach((cat) => {
      logInfo(`  ${cat}: ${actualData[cat].length} agents`);
    });
    console.log(JSON.stringify(actualData, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 3：获取热门 Agents（公开接口）
 */
async function testGetPopularAgents() {
  logSection('测试 3: 获取热门 Agents (GET /agents/popular)');

  const response = await request('GET', '/agents/popular?limit=5');

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data;
    const agents = Array.isArray(actualData) ? actualData : [];
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`返回 ${agents.length} 个热门 Agents`);
    console.log(JSON.stringify(agents, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 4：获取分类统计（公开接口）
 */
async function testGetCategoryStats() {
  logSection('测试 4: 获取分类统计 (GET /agents/categories/stats)');

  const response = await request('GET', '/agents/categories/stats');

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data;
    logSuccess(`状态码: ${response.status}`);
    console.log(JSON.stringify(actualData, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 5：获取所有标签（公开接口）
 */
async function testGetAllTags() {
  logSection('测试 5: 获取所有标签 (GET /agents/tags)');

  const response = await request('GET', '/agents/tags');

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data;
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`共 ${actualData.total} 个标签`);
    logInfo(`标签列表: ${actualData.tags.join(', ')}`);
    console.log(JSON.stringify(actualData, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 5：创建 Agent（需认证）
 */
async function testCreateAgent() {
  logSection('测试 5: 创建 Agent (POST /agents)');

  // 测试用户的两个真实 Agent
  const agentData = {
    name: 'Code Review Agent (Test)',
    description:
      'AI-powered code review assistant for JavaScript/TypeScript projects. ' +
      'Analyzes code quality, detects bugs, and provides security recommendations.',
    shortDesc: 'Automated code review',
    category: 'DEVELOPER_TOOLS',
    tags: ['code-review', 'javascript', 'typescript', 'ai'],
    capabilities: ['code-review', 'bug-detection', 'security-scan'],
    endpointUrl: 'https://code-review-agent.vercel.app/api/v1/execute',
    endpointAuthType: 'public',
    healthCheckUrl: 'https://code-review-agent.vercel.app/api/health',
    timeoutMs: 60000,
  };

  if (!authToken) {
    logError('未提供认证 Token，跳过此测试');
    logInfo('请先运行登录获取 Token，或手动设置 authToken 变量');
    return;
  }

  const response = await request('POST', '/agents', agentData, true);

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data;
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`Agent 创建成功`);
    createdAgentId = actualData.id;
    logInfo(`Agent ID: ${createdAgentId}`);

    // 如果是 public 类型，不会有 secretKey
    if (actualData.secretKey) {
      logInfo(`Secret Key: ${actualData.secretKey}`);
      log('⚠️  请妥善保存 Secret Key，仅显示一次！', 'yellow');
    }

    console.log(JSON.stringify(actualData, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 6：获取单个 Agent（公开接口）
 */
async function testGetAgent() {
  logSection('测试 6: 获取单个 Agent (GET /agents/:id)');

  if (!createdAgentId) {
    logInfo('没有创建的 Agent ID，使用默认 ID: 1');
    createdAgentId = 1;
  }

  const response = await request('GET', `/agents/${createdAgentId}`);

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data;
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`获取 Agent 成功`);
    logInfo(`浏览量: ${actualData.viewCount}`);
    console.log(JSON.stringify(actualData, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 7：更新 Agent（需认证 + 权限）
 */
async function testUpdateAgent() {
  logSection('测试 7: 更新 Agent (PUT /agents/:id)');

  if (!authToken) {
    logError('未提供认证 Token，跳过此测试');
    return;
  }

  if (!createdAgentId) {
    logError('没有创建的 Agent ID，跳过此测试');
    return;
  }

  const updateData = {
    description:
      'Updated description: AI-powered code review with enhanced features.',
    status: 'ACTIVE',
  };

  const response = await request(
    'PUT',
    `/agents/${createdAgentId}`,
    updateData,
    true,
  );

  if (response.ok && response.data) {
    const actualData = response.data.data || response.data;
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`Agent 更新成功`);
    console.log(JSON.stringify(actualData, null, 2));
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data);
  }
}

/**
 * 测试 8：查询筛选（公开接口）
 */
async function testFilterAgents() {
  logSection('测试 8: 查询筛选 (GET /agents?category=...&tags=...)');

  const queries = [
    { desc: '按分类筛选', query: 'category=DEVELOPER_TOOLS' },
    { desc: '按标签筛选', query: 'tags=code-review' },
    { desc: '搜索关键词', query: 'search=review' },
    { desc: '排序（按浏览量）', query: 'sortBy=viewCount&order=desc' },
  ];

  for (const { desc, query } of queries) {
    logInfo(`\n${desc}: /agents?${query}`);
    const response = await request('GET', `/agents?${query}`);
    if (response.ok && response.data) {
      const actualData = response.data.data || response.data;
      logSuccess(`  返回 ${actualData.meta?.total || 0} 条结果`);
    } else {
      logError(`  失败: ${response.status}`);
    }
  }
}

/**
 * 测试 9：删除 Agent（需认证 + 权限）
 */
async function testDeleteAgent() {
  logSection('测试 9: 删除 Agent (DELETE /agents/:id)');

  if (!authToken) {
    logError('未提供认证 Token，跳过此测试');
    return;
  }

  if (!createdAgentId) {
    logError('没有创建的 Agent ID，跳过此测试');
    return;
  }

  log('⚠️  此操作将删除刚创建的测试 Agent', 'yellow');
  log('如果不想删除，请注释掉此测试', 'yellow');

  // 取消注释下面的代码以执行删除
  /*
  const response = await request('DELETE', `/agents/${createdAgentId}`, null, true);

  if (response.ok && response.data) {
    logSuccess(`状态码: ${response.status}`);
    logSuccess(`Agent 删除成功`);
    console.log(response.data);
  } else {
    logError(`状态码: ${response.status}`);
    console.log(response.data || response.text);
  }
  */

  logInfo('删除测试已跳过（需手动取消注释）');
}

// ============================================
// 主函数
// ============================================

async function main() {
  log('\n🚀 Agent API 测试开始\n', 'cyan');
  log(`API 地址: ${API_BASE_URL}`, 'cyan');

  try {
    // 预备步骤：登录获取 Token
    const loginSuccess = await loginAndGetToken();
    if (!loginSuccess) {
      log('\n⚠️  登录失败，部分需要认证的测试将跳过', 'yellow');
    }

    // 公开接口测试（无需认证）
    await testGetAgents();
    await testGetFeaturedAgents();
    await testGetPopularAgents();
    await testGetCategoryStats();
    await testGetAllTags();

    // 需要认证的测试
    if (authToken) {
      await testCreateAgent();
      await testGetAgent();
      await testUpdateAgent();
    }

    await testFilterAgents();

    if (authToken) {
      await testDeleteAgent();
    }

    log('\n✅ 所有测试完成\n', 'green');
  } catch (error) {
    logError(`\n测试失败: ${error.message}`);
    console.error(error);
  }
}

// ============================================
// 运行测试
// ============================================

// 如果需要测试认证接口，请设置你的 JWT Token
// authToken = 'your_jwt_token_here';

main();
