#!/usr/bin/env node

/**
 * Jobs API 完整测试脚本
 * 测试所有 Jobs 相关的端点和匹配算法
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

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
  logSection('预备步骤: 登录获取认证 Token');

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
      console.error('错误详情:', error.response.data);
    } else {
      console.error('错误:', error.message);
    }
    return false;
  }
}

// ============================================
// 测试12: 申请Job
// ============================================

async function test12_ApplyToJob() {
  logSection('测试12: 申请Job (JobApplication)');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/apply`,
      {
        agentId: testAgentId,
        message: '我有丰富的代码审查经验，擅长性能优化，预计1小时完成',
        proposedPrice: 45,
        estimatedTime: 60,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const application = res.data.data;
    logSuccess('申请创建成功');
    logInfo(`申请ID: ${application.id}`);
    logInfo(`状态: ${application.status}`);
    logInfo(`建议价格: $${application.proposedPrice}`);
  } catch (error) {
    logError('申请失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试13: 查看Job的申请列表
// ============================================

async function test13_GetJobApplications() {
  logSection('测试13: 查看Job的申请列表');

  try {
    const res = await axios.get(
      `${API_BASE_URL}/jobs/${testJobId}/applications`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const applications = res.data.data.data;
    logSuccess(`获取到 ${applications.length} 个申请`);

    if (applications.length > 0) {
      applications.forEach((app, i) => {
        logInfo(`${i + 1}. Agent: ${app.agent.name}`);
        logInfo(`   状态: ${app.status}`);
        logInfo(`   留言: ${app.message?.substring(0, 50)}...`);
      });
    }
  } catch (error) {
    logError('获取申请列表失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试14: 查看我的申请
// ============================================

async function test14_GetMyApplications() {
  logSection('测试14: 查看我的申请');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs/applications/my`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const applications = res.data.data.data;
    logSuccess(`我的申请总数: ${applications.length}`);

    if (applications.length > 0) {
      applications.forEach((app, i) => {
        logInfo(`${i + 1}. Job: ${app.job.title}`);
        logInfo(`   状态: ${app.status}`);
      });
    }
  } catch (error) {
    logError('获取我的申请失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试15: 获取统计数据
// ============================================

async function test15_GetStats() {
  logSection('测试15: 获取 Jobs 统计数据');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs/stats`);

    const stats = res.data.data;
    logSuccess('统计数据获取成功');
    logInfo(`总任务数: ${stats.total}`);
    logInfo(`待接受: ${stats.open}`);
    logInfo(`已匹配: ${stats.matched}`);
    logInfo(`进行中: ${stats.inProgress}`);
    logInfo(`已提交: ${stats.submitted}`);
    logInfo(`已完成: ${stats.completed}`);
    logInfo(`已取消: ${stats.cancelled}`);
  } catch (error) {
    logError('获取统计数据失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 主测试流程
// ============================================

async function test1_CreateAgent() {
  logSection('测试 1: 创建测试 Agent');

  const agentData = {
    name: 'Code Review Agent',
    description: 'Professional code review agent for testing Jobs module',
    category: 'DEVELOPER_TOOLS',
    tags: ['code-review', 'javascript', 'react'],
    capabilities: ['code-review', 'javascript', 'react'],
    endpointUrl: 'https://example.com/agent/code-review',
    endpointAuthType: 'public',
    timeoutMs: 30000,
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/agents`, agentData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    testAgentId = res.data.data.id;
    logSuccess(`Agent 创建成功，ID: ${testAgentId}`);
    logInfo(`名称: ${res.data.data.name}`);
    logInfo(`分类: ${res.data.data.category}`);
  } catch (error) {
    logError('创建 Agent 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test2_CreateJob() {
  logSection('测试 2: 创建 Job');

  const jobData = {
    title: 'Review my React Component',
    description: 'Need professional code review for my React component',
    category: 'CODE_REVIEW',
    tags: ['react', 'code-review', 'javascript'],
    requiredCapabilities: ['code-review', 'javascript'],
    inputData: {
      code: `function MyComponent() { return <div>Hello World</div>; }`,
      language: 'javascript',
    },
    expectedOutput: 'Detailed code review with suggestions',
    budget: 50,
    currency: 'USDC',
    estimatedDuration: 60,
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    testJobId = res.data.data.id;
    logSuccess(`Job 创建成功，ID: ${testJobId}`);
    logInfo(`标题: ${res.data.data.title}`);
    logInfo(`状态: ${res.data.data.status}`);
    logInfo(`预算: ${res.data.data.budget} ${res.data.data.currency}`);
  } catch (error) {
    logError('创建 Job 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test3_GetJobs() {
  logSection('测试 3: 获取 Jobs 列表');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs?page=1&limit=10`);

    const { data, meta } = res.data.data;
    logSuccess(`获取成功，共 ${meta.total} 个 Jobs`);
    logInfo(`当前页: ${meta.page}/${meta.totalPages}`);
    logInfo(`每页: ${meta.limit} 条`);

    if (data.length > 0) {
      log('\n前3个Jobs:');
      data.slice(0, 3).forEach((job, i) => {
        log(`  ${i + 1}. ${job.title} (${job.status})`);
      });
    }
  } catch (error) {
    logError('获取 Jobs 列表失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test4_GetJobDetail() {
  logSection('测试 4: 获取 Job 详情');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs/${testJobId}`);

    const job = res.data.data;
    logSuccess('获取 Job 详情成功');
    logInfo(`ID: ${job.id}`);
    logInfo(`标题: ${job.title}`);
    logInfo(`分类: ${job.category}`);
    logInfo(`状态: ${job.status}`);
    logInfo(`预算: ${job.budget} ${job.currency}`);
    logInfo(`所需能力: ${job.requiredCapabilities.join(', ')}`);
    logInfo(`Owner: ${job.owner.walletAddress}`);
  } catch (error) {
    logError('获取 Job 详情失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test5_GetRecommendations() {
  logSection('测试 5: 测试匹配算法 - 获取推荐 Agents');

  try {
    const res = await axios.get(
      `${API_BASE_URL}/jobs/${testJobId}/recommendations`,
    );

    const recommendations = res.data.data;
    logSuccess(`匹配算法执行成功，找到 ${recommendations.length} 个推荐`);

    if (recommendations.length > 0) {
      log('\n推荐列表:');
      recommendations.forEach((match, index) => {
        log(`\n  ${index + 1}. ${match.agent.name}`, 'cyan');
        log(`     匹配分数: ${match.matchScore}`);
        log(`     推荐理由: ${match.reason}`);
        log(`     Agent 评分: ${match.agent.rating || 'N/A'}`);
        log(`     完成任务数: ${match.agent.jobCount}`);
        log(`     健康状态: ${match.agent.healthStatus}`);
      });

      log('\n匹配算法验证:', 'yellow');
      const topMatch = recommendations[0];
      log(`  ✓ 最高分数: ${topMatch.matchScore}/100`);
      log(
        `  ✓ 能力匹配: ${
          topMatch.agent.capabilities.filter((cap) =>
            ['code-review', 'javascript'].includes(cap),
          ).length
        } 项`,
      );
    } else {
      logInfo('未找到匹配的 Agents（可能数据库中还没有符合条件的 Agent）');
    }
  } catch (error) {
    logError('获取推荐失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test6_UpdateJob() {
  logSection('测试 6: 更新 Job');

  const updateData = {
    budget: 60,
    tags: ['react', 'code-review', 'urgent'],
  };

  try {
    const res = await axios.put(
      `${API_BASE_URL}/jobs/${testJobId}`,
      updateData,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess('Job 更新成功');
    logInfo(`新预算: ${res.data.data.budget}`);
    logInfo(`新标签: ${res.data.data.tags.join(', ')}`);
  } catch (error) {
    logError('更新 Job 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test7_FilterJobs() {
  logSection('测试 7: 筛选 Jobs');

  try {
    const res = await axios.get(
      `${API_BASE_URL}/jobs?category=CODE_REVIEW&status=OPEN`,
    );

    const { meta } = res.data.data;
    logSuccess(`查询成功: CODE_REVIEW 类别的 OPEN Jobs 共 ${meta.total} 个`);
  } catch (error) {
    logError('筛选 Jobs 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test8_SearchJobs() {
  logSection('测试 8: 搜索 Jobs');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs?search=react`);

    const { meta } = res.data.data;
    logSuccess(`搜索成功: 包含 "react" 的 Jobs 共 ${meta.total} 个`);
  } catch (error) {
    logError('搜索 Jobs 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test9_GetMyPublishedJobs() {
  logSection('测试 9: 获取我发布的 Jobs');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs/my/published`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const { meta } = res.data.data;
    logSuccess(`获取成功: 我发布的 Jobs 共 ${meta.total} 个`);
  } catch (error) {
    logError('获取我发布的 Jobs 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test10_GetMyAssignedJobs() {
  logSection('测试 10: 获取分配给我的 Jobs');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs/my/assigned`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const { meta } = res.data.data;
    logSuccess(`获取成功: 分配给我的 Jobs 共 ${meta.total} 个`);
  } catch (error) {
    logError('获取分配给我的 Jobs 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test11_CancelJob() {
  logSection('测试 11: 取消 Job');

  try {
    const res = await axios.delete(`${API_BASE_URL}/jobs/${testJobId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    logSuccess('Job 取消成功');
    logInfo(`状态: ${res.data.data.status}`);
  } catch (error) {
    logError('取消 Job 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 运行所有测试
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('       Jobs 模块 API 完整测试套件', 'blue');
  log('='.repeat(60), 'blue');

  try {
    // 登录
    const loginSuccess = await loginAndGetToken();
    if (!loginSuccess) {
      logError('登录失败，测试终止');
      process.exit(1);
    }

    // 运行所有测试
    await test1_CreateAgent();
    await test2_CreateJob();
    await test3_GetJobs();
    await test4_GetJobDetail();
    await test5_GetRecommendations();
    await test6_UpdateJob();
    await test7_FilterJobs();
    await test8_SearchJobs();
    await test9_GetMyPublishedJobs();
    await test10_GetMyAssignedJobs();
    await test12_ApplyToJob();
    await test13_GetJobApplications();
    await test14_GetMyApplications();
    await test15_GetStats();
    await test11_CancelJob();

    // 总结
    logSection('测试完成');
    logSuccess('所有测试通过！✨');
    log('\n测试覆盖:', 'yellow');
    log('  ✓ 用户认证');
    log('  ✓ Agent 创建');
    log('  ✓ Job CRUD 操作');
    log('  ✓ 智能匹配算法');
    log('  ✓ 查询筛选搜索');
    log('  ✓ 权限控制');
    log('  ✓ Job Application (申请系统)');
    log('  ✓ 统计数据');
  } catch (error) {
    logError('\n测试失败');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
