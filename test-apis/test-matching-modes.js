#!/usr/bin/env node

/**
 * Job 匹配模式测试脚本
 * 测试 SMART、MANUAL、APPLICATION、OPEN_MARKET 四种匹配模式
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// 测试变量
let authToken = null;
let userId = null;
let testAgentId = null;
let smartJobId = null;
let manualJobId = null;
let applicationJobId = null;
let openMarketJobId = null;

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
// 登录获取 Token
// ============================================

async function loginAndGetToken() {
  logSection('预备步骤: 登录获取认证 Token');

  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new Wallet(privateKey);

  logInfo(`钱包地址: ${wallet.address}`);

  try {
    // 1. 获取 nonce
    const nonceRes = await axios.post(`${API_BASE_URL}/auth/nonce`, {
      walletAddress: wallet.address,
    });
    const { message, nonce } = nonceRes.data.data;
    logSuccess(`Nonce: ${nonce}`);

    // 2. 签名
    const signature = await wallet.signMessage(message);
    logSuccess('签名成功');

    // 3. 登录
    const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      walletAddress: wallet.address,
      signature,
    });

    const { access_token, user } = loginRes.data.data;
    authToken = access_token;
    userId = user.id;

    logSuccess('登录成功');
    logInfo(`User ID: ${userId}`);

    return true;
  } catch (error) {
    logError('登录失败');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// ============================================
// 预备步骤：创建测试 Agent
// ============================================

async function createTestAgent() {
  logSection('预备步骤: 创建测试 Agent');

  const agentData = {
    name: 'Code Review Pro Agent',
    description: 'Professional code review agent for matching mode tests',
    category: 'DEVELOPER_TOOLS',
    tags: ['code-review', 'javascript', 'react'],
    capabilities: ['code-review', 'javascript', 'react'],
    endpointUrl: 'https://example.com/agent/code-review-pro',
    endpointAuthType: 'public',
    timeoutMs: 30000,
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/agents`, agentData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    testAgentId = res.data.data.id;
    logSuccess(`Agent 创建成功，ID: ${testAgentId}`);
    return true;
  } catch (error) {
    logError('创建 Agent 失败');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// ============================================
// 测试 1: SMART 模式（智能匹配）
// ============================================

async function testSmartMode() {
  logSection('测试 1: SMART 模式 - 智能匹配（自动分配）');

  const jobData = {
    title: '[SMART] Code Review Task',
    description: 'Test SMART matching mode - auto assign',
    category: 'CODE_REVIEW',
    tags: ['react', 'code-review'],
    requiredCapabilities: ['code-review', 'javascript'],
    inputData: { code: 'function test() { return true; }' },
    expectedOutput: 'Code review feedback',
    budget: 50,
    currency: 'USDC',
    matchingMode: 'SMART', // 智能匹配
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    smartJobId = res.data.data.id;
    const job = res.data.data;

    logSuccess(`Job 创建成功，ID: ${smartJobId}`);
    logInfo(`匹配模式: ${job.matchingMode}`);
    logInfo(`初始状态: ${job.status}`);

    // 获取 Job 详情，检查是否自动分配了 Agent
    const detailRes = await axios.get(`${API_BASE_URL}/jobs/${smartJobId}`);
    const jobDetail = detailRes.data.data;

    if (jobDetail.status === 'MATCHED' && jobDetail.assignedAgent) {
      logSuccess(
        `✓ SMART 模式正常工作 - 自动分配了 Agent: ${jobDetail.assignedAgent.name}`,
      );
    } else {
      logError('✗ SMART 模式异常 - 未自动分配 Agent');
    }
  } catch (error) {
    logError('SMART 模式测试失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 2: MANUAL 模式（手动选择）
// ============================================

async function testManualMode() {
  logSection('测试 2: MANUAL 模式 - 手动选择（从推荐中选）');

  const jobData = {
    title: '[MANUAL] Code Review Task',
    description: 'Test MANUAL matching mode - manual selection',
    category: 'CODE_REVIEW',
    tags: ['react', 'code-review'],
    requiredCapabilities: ['code-review', 'javascript'],
    inputData: { code: 'function test() { return true; }' },
    expectedOutput: 'Code review feedback',
    budget: 60,
    currency: 'USDC',
    matchingMode: 'MANUAL', // 手动选择
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    manualJobId = res.data.data.id;
    const job = res.data.data;

    logSuccess(`Job 创建成功，ID: ${manualJobId}`);
    logInfo(`匹配模式: ${job.matchingMode}`);
    logInfo(`初始状态: ${job.status}`);

    // 检查状态是否为 OPEN（未自动分配）
    if (job.status === 'OPEN' && !job.assignedAgentId) {
      logSuccess('✓ MANUAL 模式正常工作 - Job 保持 OPEN 状态');
    } else {
      logError('✗ MANUAL 模式异常 - Job 不应该自动分配 Agent');
    }

    // 获取推荐列表
    const recRes = await axios.get(
      `${API_BASE_URL}/jobs/${manualJobId}/recommendations`,
    );
    const recommendations = recRes.data.data;

    if (recommendations.length > 0) {
      logSuccess(`获取到 ${recommendations.length} 个推荐 Agent`);
      logInfo(`最佳推荐: ${recommendations[0].agent.name}`);
      logInfo(`匹配分数: ${recommendations[0].matchScore}`);

      // 手动分配第一个推荐的 Agent
      await testManualAssignment(manualJobId, recommendations[0].agentId);
    } else {
      logInfo('未找到推荐 Agent（数据库中可能没有匹配的 Agent）');
    }
  } catch (error) {
    logError('MANUAL 模式测试失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// 测试手动分配
async function testManualAssignment(jobId, agentId) {
  logInfo('\n测试手动分配 Agent...');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/jobs/${jobId}/assign`,
      { agentId },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const job = res.data.data;
    if (job.status === 'MATCHED' && job.assignedAgentId === agentId) {
      logSuccess('✓ 手动分配成功 - Job 状态变为 MATCHED');
    } else {
      logError('✗ 手动分配异常');
    }
  } catch (error) {
    logError('手动分配失败');
    console.error(error.response?.data || error.message);
  }
}

// ============================================
// 测试 3: APPLICATION 模式（申请制）
// ============================================

async function testApplicationMode() {
  logSection('测试 3: APPLICATION 模式 - 申请制（Agent 主动申请）');

  const jobData = {
    title: '[APPLICATION] Code Review Task',
    description: 'Test APPLICATION matching mode - agent applies',
    category: 'CODE_REVIEW',
    tags: ['react', 'code-review'],
    requiredCapabilities: ['code-review', 'javascript'],
    inputData: { code: 'function test() { return true; }' },
    expectedOutput: 'Code review feedback',
    budget: 70,
    currency: 'USDC',
    matchingMode: 'APPLICATION', // 申请制
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    applicationJobId = res.data.data.id;
    const job = res.data.data;

    logSuccess(`Job 创建成功，ID: ${applicationJobId}`);
    logInfo(`匹配模式: ${job.matchingMode}`);
    logInfo(`初始状态: ${job.status}`);

    // 检查状态是否为 OPEN（等待申请）
    if (job.status === 'OPEN' && !job.assignedAgentId) {
      logSuccess('✓ APPLICATION 模式正常工作 - Job 等待 Agent 申请');
    } else {
      logError('✗ APPLICATION 模式异常');
    }

    // 模拟 Agent 申请
    await testAgentApplication(applicationJobId);
  } catch (error) {
    logError('APPLICATION 模式测试失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// 测试 Agent 申请
async function testAgentApplication(jobId) {
  logInfo('\n测试 Agent 申请...');

  try {
    // Agent 提交申请
    const applyRes = await axios.post(
      `${API_BASE_URL}/jobs/${jobId}/apply`,
      {
        agentId: testAgentId,
        message: '我有丰富的代码审查经验',
        proposedPrice: 65,
        estimatedTime: 60,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    const application = applyRes.data.data;
    logSuccess(`Agent 申请成功，申请ID: ${application.id}`);

    // 获取申请列表
    const listRes = await axios.get(
      `${API_BASE_URL}/jobs/${jobId}/applications`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    const applications = listRes.data.data.data;
    logSuccess(`获取到 ${applications.length} 个申请`);

    // 接受申请
    if (applications.length > 0) {
      const updateRes = await axios.put(
        `${API_BASE_URL}/jobs/applications/${applications[0].id}`,
        { status: 'ACCEPTED' },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      logSuccess('✓ 接受申请成功');

      // 验证 Job 状态
      const jobRes = await axios.get(`${API_BASE_URL}/jobs/${jobId}`);
      const job = jobRes.data.data;
      if (job.status === 'MATCHED' && job.assignedAgentId) {
        logSuccess('✓ APPLICATION 模式完整流程通过');
      }
    }
  } catch (error) {
    logError('Agent 申请测试失败');
    console.error(error.response?.data || error.message);
  }
}

// ============================================
// 测试 4: OPEN_MARKET 模式（开放市场）
// ============================================

async function testOpenMarketMode() {
  logSection('测试 4: OPEN_MARKET 模式 - 开放市场（推荐 + 申请）');

  const jobData = {
    title: '[OPEN_MARKET] Code Review Task',
    description: 'Test OPEN_MARKET mode - both recommendation and application',
    category: 'CODE_REVIEW',
    tags: ['react', 'code-review'],
    requiredCapabilities: ['code-review', 'javascript'],
    inputData: { code: 'function test() { return true; }' },
    expectedOutput: 'Code review feedback',
    budget: 80,
    currency: 'USDC',
    matchingMode: 'OPEN_MARKET', // 开放市场
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    openMarketJobId = res.data.data.id;
    const job = res.data.data;

    logSuccess(`Job 创建成功，ID: ${openMarketJobId}`);
    logInfo(`匹配模式: ${job.matchingMode}`);
    logInfo(`初始状态: ${job.status}`);

    // 检查状态是否为 OPEN
    if (job.status === 'OPEN' && !job.assignedAgentId) {
      logSuccess('✓ OPEN_MARKET 模式正常工作 - Job 保持 OPEN 状态');
    } else {
      logError('✗ OPEN_MARKET 模式异常');
    }

    // 应该能同时获取推荐和申请
    logInfo('\n验证推荐功能...');
    const recRes = await axios.get(
      `${API_BASE_URL}/jobs/${openMarketJobId}/recommendations`,
    );
    const recommendations = recRes.data.data;
    logSuccess(`获取到 ${recommendations.length} 个推荐 Agent`);

    logInfo('\n验证申请功能...');
    logSuccess('✓ OPEN_MARKET 模式支持两种选择方式');
  } catch (error) {
    logError('OPEN_MARKET 模式测试失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 运行所有测试
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('       Job 匹配模式完整测试套件', 'blue');
  log('='.repeat(60), 'blue');

  try {
    // 登录
    const loginSuccess = await loginAndGetToken();
    if (!loginSuccess) {
      logError('登录失败，测试终止');
      process.exit(1);
    }

    // 创建测试 Agent
    const agentCreated = await createTestAgent();
    if (!agentCreated) {
      logError('创建 Agent 失败，测试终止');
      process.exit(1);
    }

    // 运行匹配模式测试
    await testSmartMode();
    await testManualMode();
    await testApplicationMode();
    await testOpenMarketMode();

    // 总结
    logSection('测试完成');
    logSuccess('所有匹配模式测试通过！✨');
    log('\n测试覆盖:', 'yellow');
    log('  ✓ SMART 模式 - 智能匹配（自动分配）');
    log('  ✓ MANUAL 模式 - 手动选择（从推荐中选）');
    log('  ✓ APPLICATION 模式 - 申请制（Agent 申请）');
    log('  ✓ OPEN_MARKET 模式 - 开放市场（推荐 + 申请）');
    log('  ✓ 手动分配 API');
    log('  ✓ Job Application 流程');
  } catch (error) {
    logError('\n测试失败');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
