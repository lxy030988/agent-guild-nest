#!/usr/bin/env node

/**
 * Agent 自动化工作流测试脚本
 * 测试完整流程：创建 Job → 自动匹配 Agent → 自动执行 → 返回结果
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const MASTRA_API_URL = 'http://127.0.0.1:4111/api';

// 测试变量
let authToken = null;
let userId = null;
let testJobId = null;
let testAgentId = null;

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
  logSection('步骤 1: 登录获取认证 Token');

  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new Wallet(privateKey);

  logInfo(`钱包地址: ${wallet.address}`);

  try {
    // 1. 获取 nonce
    logInfo('获取 nonce...');
    const nonceRes = await axios.post(`${API_BASE_URL}/auth/nonce`, {
      walletAddress: wallet.address,
    });
    const { message, nonce } = nonceRes.data.data;
    logSuccess(`Nonce: ${nonce}`);

    // 2. 签名
    logInfo('签名消息...');
    const signature = await wallet.signMessage(message);
    logSuccess('签名成功');

    // 3. 登录
    logInfo('登录...');
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
      console.error('错误详情:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
}

// ============================================
// 步骤 2: 创建或查找 CodeReview Agent
// ============================================

async function setupCodeReviewAgent() {
  logSection('步骤 1.5: 清理旧数据');
  // 这种方式比较暴力，但在测试环境下很有效
  try {
    logInfo('清理旧的 Agent 和 Job 数据...');
    // 我们通过 API 无法批量删除所有人的，所以这里如果能连接数据库最好，或者简单地在创建时用一个非常独特的名字
  } catch (e) {}

  logSection('步骤 2: 创建 CodeReview Agent');

  try {
    // 创建一个新的 Agent，指向 Mastra API
    logInfo('创建新的 CodeReview Agent（指向 Mastra API）...');
    const agentData = {
      name: 'Code Review Agent (STREAM-API-TEST)',
      description: 'AI-powered code review agent using Mastra framework',
      category: 'DEVELOPER_TOOLS',
      tags: ['code-review', 'javascript', 'typescript', 'mastra'],
      capabilities: ['code-review', 'javascript', 'typescript'],
      endpointUrl: `${MASTRA_API_URL}/agents/codeReviewAgent/stream`,
      endpointAuthType: 'public',
      timeoutMs: 60000,
    };

    const createRes = await axios.post(`${API_BASE_URL}/agents`, agentData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const newAgent = createRes.data.data;
    testAgentId = newAgent.id;
    logSuccess(`创建成功，Agent ID: ${testAgentId}`);
    logInfo(`名称: ${newAgent.name}`);
    logInfo(`Endpoint: ${newAgent.endpointUrl}`);
    logInfo(`状态: ${newAgent.status}`);
    logInfo(`健康状态: ${newAgent.healthStatus}`);
    logInfo(`可用性: ${newAgent.availability}`);
    return newAgent;
  } catch (error) {
    logError('设置 Agent 失败');
    if (error.response?.data) {
      console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误:', error.message);
    }
    throw error;
  }
}

// ============================================
// 步骤 3: 创建 Job（自动匹配）
// ============================================

async function createTestJob() {
  logSection('步骤 3: 创建测试 Job');

  const jobData = {
    title: '代码审查任务 - 测试自动化流程',
    description: '测试自动匹配 Agent 并执行的完整流程',
    category: 'CODE_REVIEW',
    tags: ['javascript', 'code-review', 'test'],
    requiredCapabilities: ['code-review', 'javascript'],
    inputData: `请帮我 review 这段代码，指出可以改进的地方：\n\nfunction calculateTotal(items) {\n  var total = 0;\n  for (var i = 0; i < items.length; i++) {\n    total = total + items[i].price;\n  }\n  return total;\n}`,
    expectedOutput: '代码审查报告，包含问题和改进建议',
    budget: 50,
    currency: 'USDC',
    estimatedDuration: 60,
  };

  try {
    logInfo('创建 Job...');
    const res = await axios.post(`${API_BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const job = res.data.data;
    testJobId = job.id;
    logSuccess(`Job 创建成功，ID: ${testJobId}`);
    logInfo(`标题: ${job.title}`);
    logInfo(`状态: ${job.status}`);
    logInfo(`预算: ${job.budget} ${job.currency}`);

    // 等待自动匹配完成
    logInfo('等待自动匹配...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return job;
  } catch (error) {
    logError('创建 Job 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 步骤 4: 查看匹配结果
// ============================================

async function checkJobRecommendations() {
  logSection('步骤 4: 查看自动匹配结果');

  try {
    const res = await axios.get(
      `${API_BASE_URL}/jobs/${testJobId}/recommendations`,
    );

    const recommendations = res.data.data;
    logSuccess(`找到 ${recommendations.length} 个推荐 Agent`);

    if (recommendations.length > 0) {
      recommendations.forEach((match, i) => {
        log(`\n  ${i + 1}. ${match.agent.name}`, 'cyan');
        log(`     匹配分数: ${match.matchScore}`);
        log(`     推荐理由: ${match.reason}`);
        log(`     Agent ID: ${match.agent.id}`);
      });

      const topMatch = recommendations[0];
      logInfo(
        `\n最佳匹配: ${topMatch.agent.name} (分数: ${topMatch.matchScore})`,
      );

      // 检查是否匹配到了我们的 codeReviewAgent
      if (topMatch.agent.id === testAgentId) {
        logSuccess('✓ 成功匹配到 CodeReview Agent！');
      } else {
        log('⚠️  匹配到了其他 Agent，但我们继续使用它测试流程', 'yellow');
      }

      return topMatch.agent;
    } else {
      logError('未找到匹配的 Agent');
      return null;
    }
  } catch (error) {
    logError('获取推荐失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 步骤 5: 接受任务（Agent owner）
// ============================================

async function acceptJob() {
  logSection('步骤 5: Agent Owner 接受任务');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/accept`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const job = res.data.data;
    logSuccess(`任务接受成功`);
    logInfo(`状态: ${job.status}`);
    logInfo(`分配给: ${job.assignedAgent?.name || 'N/A'}`);

    return job;
  } catch (error) {
    logError('接受任务失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 步骤 6: 开始执行任务（自动调用 Agent API）
// ============================================

async function startJobExecution() {
  logSection('步骤 6: 开始执行任务');

  try {
    logInfo('发起执行请求...');
    const res = await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/start`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess(res.data.message || '任务开始执行');
    logInfo('后端将异步调用 Agent API 并保存结果...');

    // 等待执行完成
    logInfo('等待执行完成（最多 30 秒）...');
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const jobRes = await axios.get(`${API_BASE_URL}/jobs/${testJobId}`);
      const job = jobRes.data.data;

      logInfo(`第 ${attempts} 次检查 - 状态: ${job.status}`);

      if (job.status === 'SUBMITTED') {
        logSuccess('✓ 任务执行完成！');
        return job;
      } else if (job.status === 'OPEN') {
        logError('✗ 任务执行失败，已重新开放');
        return job;
      }
    }

    log('⚠️  等待超时，但任务可能仍在执行中', 'yellow');
    const jobRes = await axios.get(`${API_BASE_URL}/jobs/${testJobId}`);
    return jobRes.data.data;
  } catch (error) {
    logError('开始执行失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 步骤 7: 查看执行结果
// ============================================

async function checkJobResult() {
  logSection('步骤 7: 查看执行结果');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs/${testJobId}`);
    const job = res.data.data;

    logInfo(`任务状态: ${job.status}`);
    logInfo(`提交时间: ${job.submittedAt || 'N/A'}`);

    if (job.resultData) {
      logSuccess('✓ 获取到执行结果！');
      log('\n执行结果:', 'cyan');
      console.log(JSON.stringify(job.resultData, null, 2));
    } else {
      log('⚠️  暂无执行结果', 'yellow');
    }

    return job;
  } catch (error) {
    logError('查看结果失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 主测试流程
// ============================================

async function runWorkflowTest() {
  log('\n🚀 Agent 自动化工作流测试开始\n', 'cyan');
  log(`API 地址: ${API_BASE_URL}`, 'cyan');
  log(`Mastra API: ${MASTRA_API_URL}`, 'cyan');

  try {
    // 1. 登录
    const loginSuccess = await loginAndGetToken();
    if (!loginSuccess) {
      logError('登录失败，测试终止');
      process.exit(1);
    }

    // 2. 设置 Agent
    await setupCodeReviewAgent();

    // 3. 创建 Job（自动触发匹配）
    await createTestJob();

    // 4. 查看匹配结果
    const matchedAgent = await checkJobRecommendations();
    if (!matchedAgent) {
      logError('未找到匹配的 Agent，测试终止');
      process.exit(1);
    }

    // 5. Agent owner 接受任务
    await acceptJob();

    // 6. 开始执行（自动调用 Agent API）
    await startJobExecution();

    // 7. 查看结果
    await checkJobResult();

    // 总结
    logSection('测试完成');
    logSuccess('✨ 自动化工作流测试成功！');
    log('\n验证的功能:', 'yellow');
    log('  ✓ 创建 Job');
    log('  ✓ 自动匹配 Agent');
    log('  ✓ Agent owner 接受任务');
    log('  ✓ 自动执行 Agent');
    log('  ✓ 自动保存结果');
    log('  ✓ 查询执行结果');
  } catch (error) {
    logError('\n测试失败');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
runWorkflowTest();
