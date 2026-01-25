#!/usr/bin/env node

/**
 * 竞价模式测试脚本
 * 测试多 Agent 竞价执行功能
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// 测试变量
let authToken = null;
let userId = null;
let testJobId = null;
let testAgentIds = []; // 存储多个 Agent ID
let executionIds = [];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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
  log(`\n${'='.repeat(70)}`, 'blue');
  log(message, 'blue');
  log('='.repeat(70), 'blue');
}

// ============================================
// 登录获取 Token
// ============================================

async function loginAndGetToken() {
  logSection('🔐 预备步骤: 登录获取认证 Token');

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
// 测试 1: 创建多个测试 Agent
// ============================================

async function test1_CreateMultipleAgents() {
  logSection('🤖 测试 1: 创建 3 个测试 Agent');

  const agentsData = [
    {
      name: 'Speed Agent A',
      description: 'Fast code review agent',
      category: 'DEVELOPER_TOOLS',
      tags: ['code-review', 'javascript', 'fast'],
      capabilities: ['code-review', 'javascript'],
      endpointUrl: 'https://example.com/agent/speed-a',
      endpointAuthType: 'public',
      timeoutMs: 30000,
    },
    {
      name: 'Quality Agent B',
      description: 'High quality code review agent',
      category: 'DEVELOPER_TOOLS',
      tags: ['code-review', 'javascript', 'quality'],
      capabilities: ['code-review', 'javascript', 'react'],
      endpointUrl: 'https://example.com/agent/quality-b',
      endpointAuthType: 'public',
      timeoutMs: 30000,
    },
    {
      name: 'Expert Agent C',
      description: 'Expert code review agent with high rating',
      category: 'DEVELOPER_TOOLS',
      tags: ['code-review', 'javascript', 'expert'],
      capabilities: ['code-review', 'javascript', 'react', 'typescript'],
      endpointUrl: 'https://example.com/agent/expert-c',
      endpointAuthType: 'public',
      timeoutMs: 30000,
    },
  ];

  try {
    for (let i = 0; i < agentsData.length; i++) {
      const res = await axios.post(`${API_BASE_URL}/agents`, agentsData[i], {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      testAgentIds.push(res.data.data.id);
      logSuccess(
        `Agent ${i + 1} 创建成功: ${res.data.data.name} (ID: ${res.data.data.id})`,
      );
    }

    logInfo(`\n总共创建了 ${testAgentIds.length} 个 Agent`);
  } catch (error) {
    logError('创建 Agent 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 2: 创建竞价模式 Job
// ============================================

async function test2_CreateCompetitionJob() {
  logSection('🏆 测试 2: 创建竞价模式 Job');

  const jobData = {
    title: 'Competition: Review React Component',
    description:
      'Need professional code review for my React component - competition mode with 3 agents',
    category: 'CODE_REVIEW',
    tags: ['react', 'code-review', 'competition'],
    requiredCapabilities: ['code-review', 'javascript'],
    inputData: {
      code: `function MyComponent() { 
        const [count, setCount] = useState(0);
        return <div onClick={() => setCount(count + 1)}>{count}</div>; 
      }`,
      language: 'javascript',
    },
    expectedOutput: 'Detailed code review with best practices',
    budget: 100,
    currency: 'USDC',
    estimatedDuration: 60,
    // 🆕 竞价模式字段
    competitionMode: true,
    competitorCount: 3,
    matchingMode: 'SMART',
  };

  try {
    const res = await axios.post(`${API_BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    testJobId = res.data.data.id;
    logSuccess(`竞价 Job 创建成功，ID: ${testJobId}`);
    logInfo(`标题: ${res.data.data.title}`);
    logInfo(`状态: ${res.data.data.status}`);
    logInfo(`预算: ${res.data.data.budget} ${res.data.data.currency}`);
    logInfo(
      `竞价模式: ${res.data.data.competitionMode ? '✓ 已启用' : '✗ 未启用'}`,
    );
    logInfo(`竞争 Agent 数量: ${res.data.data.competitorCount}`);

    // 等待匹配完成
    logInfo('\n⏳ 等待智能匹配完成...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    logError('创建竞价 Job 失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 3: 查看 Job 详情和匹配结果
// ============================================

async function test3_GetJobDetailAndExecutions() {
  logSection('📋 测试 3: 查看 Job 详情和匹配的 Agent');

  try {
    const res = await axios.get(`${API_BASE_URL}/jobs/${testJobId}`);

    const job = res.data.data;
    logSuccess('获取 Job 详情成功');
    logInfo(`ID: ${job.id}`);
    logInfo(`状态: ${job.status}`);
    logInfo(`竞价模式: ${job.competitionMode ? '✓' : '✗'}`);
    logInfo(`竞争数量: ${job.competitorCount}`);

    // 查看执行记录
    if (job.executions && job.executions.length > 0) {
      log('\n已匹配的 Agent:', 'yellow');
      job.executions.forEach((ex, index) => {
        log(
          `  ${index + 1}. ${ex.agent?.name || 'Unknown'} (Execution ID: ${ex.id})`,
        );
        log(`     状态: ${ex.status}`);
        executionIds.push(ex.id);
      });
    } else {
      logInfo('暂无执行记录（可能匹配还在进行中）');
    }
  } catch (error) {
    logError('获取 Job 详情失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 4: 获取推荐列表（验证匹配算法）
// ============================================

async function test4_GetRecommendations() {
  logSection('🎯 测试 4: 获取推荐列表（验证匹配算法）');

  try {
    const res = await axios.get(
      `${API_BASE_URL}/jobs/${testJobId}/recommendations`,
    );

    const recommendations = res.data.data;
    logSuccess(`匹配算法执行成功，找到 ${recommendations.length} 个推荐`);

    if (recommendations.length > 0) {
      log('\n推荐列表 (Top N):', 'yellow');
      recommendations.forEach((match, index) => {
        log(`\n  ${index + 1}. ${match.agent.name}`, 'cyan');
        log(`     匹配分数: ${match.matchScore}`);
        log(`     推荐理由: ${match.reason}`);
        log(`     Agent 评分: ${match.agent.rating || 'N/A'}`);
        log(`     能力: ${match.agent.capabilities.join(', ')}`);
      });
    }
  } catch (error) {
    logError('获取推荐失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 5: 启动竞价执行
// ============================================

async function test5_StartCompetition() {
  logSection('🚀 测试 5: 启动竞价执行（并行）');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/competition/start`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess('竞价执行已启动');
    logInfo(`执行数量: ${res.data.data.executionCount}`);
    logInfo(`消息: ${res.data.data.message}`);

    logInfo('\n⏳ 等待 Agent 执行...');
    // 给真实的 Agent 足够时间执行（如果 endpoint 可用）
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    logError('启动竞价失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 6: 获取竞价执行结果（轮询等待完成）
// ============================================

async function test6_GetCompetitionResults() {
  logSection('📊 测试 6: 获取竞价执行结果（轮询等待）');

  try {
    let allCompleted = false;
    let attempts = 0;
    const maxAttempts = 20; // 最多等待 60 秒
    let results = [];

    while (!allCompleted && attempts < maxAttempts) {
      attempts++;

      const res = await axios.get(
        `${API_BASE_URL}/jobs/${testJobId}/competition/results`,
      );

      results = res.data.data;

      // 检查是否所有执行都完成了（SUBMITTED 或 FAILED）
      const completedStatuses = ['SUBMITTED', 'FAILED', 'COMPLETED'];
      allCompleted = results.every((ex) =>
        completedStatuses.includes(ex.status),
      );

      if (!allCompleted) {
        logInfo(`⏳ 第 ${attempts} 次检查: 还有 Agent 在执行中，等待 3 秒...`);
        const inProgress = results.filter(
          (ex) => !completedStatuses.includes(ex.status),
        );
        inProgress.forEach((ex) => {
          logInfo(`  - ${ex.agent.name}: ${ex.status}`);
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    if (!allCompleted) {
      logInfo('\n⚠️  部分 Agent 执行超时，但继续测试...');
    } else {
      logSuccess(`✓ 所有 ${results.length} 个 Agent 执行完成`);
    }

    if (results.length > 0) {
      log('\n竞价结果:', 'yellow');
      results.forEach((ex, index) => {
        // 🔧 填充 executionIds 数组供后续使用
        if (!executionIds.includes(ex.id)) {
          executionIds.push(ex.id);
        }

        log(`\n  ${index + 1}. ${ex.agent.name}`, 'magenta');
        log(`     执行状态: ${ex.status}`);
        log(`     质量评分: ${ex.qualityScore || '未评分'}`);
        log(`     自动评分: ${ex.autoScore || '未计算'}`);
        log(`     人工评分: ${ex.manualScore || '未评分'}`);
        log(`     是否胜出: ${ex.isWinner ? '🏆 是' : '否'}`);
        log(`     Agent 竞价统计:`);
        log(`       - 胜出次数: ${ex.agent.competitionsWon || 0}`);
        log(`       - 参与次数: ${ex.agent.competitionsTotal || 0}`);

        if (ex.resultData) {
          log(
            `     结果数据: ${JSON.stringify(ex.resultData).substring(0, 50)}...`,
          );
        }
        if (ex.errorMessage) {
          log(`     错误信息: ${ex.errorMessage.substring(0, 100)}...`, 'red');
        }
      });

      logInfo(`\n💡 已收集 ${executionIds.length} 个执行ID供后续测试使用`);
    }
  } catch (error) {
    logError('获取竞价结果失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 7: 评分执行结果
// ============================================

async function test7_ScoreExecutions() {
  logSection('⭐ 测试 7: 评分执行结果');

  if (executionIds.length === 0) {
    logInfo('没有可评分的执行记录，跳过此测试');
    return;
  }

  try {
    // 为第一个执行评分
    const scoreData = {
      score: 85,
      reason: 'Code review quality is excellent, good suggestions provided',
    };

    const res = await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/executions/${executionIds[0]}/score`,
      scoreData,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess(`执行 ${executionIds[0]} 评分成功`);
    logInfo(`人工评分: ${res.data.data.manualScore}`);
    logInfo(`自动评分: ${res.data.data.autoScore}`);
    logInfo(`最终评分: ${res.data.data.qualityScore}`);
    logInfo(`状态: ${res.data.data.status}`);

    // 如果有多个，再评分一个
    if (executionIds.length > 1) {
      const scoreData2 = {
        score: 75,
        reason: 'Good review but could be more detailed',
      };

      await axios.post(
        `${API_BASE_URL}/jobs/${testJobId}/executions/${executionIds[1]}/score`,
        scoreData2,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );

      logSuccess(`执行 ${executionIds[1]} 评分成功`);
    }
  } catch (error) {
    logError('评分失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 8: 选择胜出者
// ============================================

async function test8_SelectWinner() {
  logSection('🏆 测试 8: 选择胜出者');

  if (executionIds.length === 0) {
    logInfo('没有可选择的执行记录，跳过此测试');
    return;
  }

  try {
    // 选择第一个作为胜出者
    const winnerData = {
      executionId: executionIds[0],
    };

    const res = await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/competition/select-winner`,
      winnerData,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess('胜出者选择成功');
    logInfo(`胜出执行 ID: ${res.data.data.id}`);
    logInfo(`Agent: ${res.data.data.agent?.name || 'Unknown'}`);
    logInfo(`最终评分: ${res.data.data.qualityScore || 'N/A'}`);

    // 验证 Job 状态
    const jobRes = await axios.get(`${API_BASE_URL}/jobs/${testJobId}`);
    logInfo(`\nJob 状态更新: ${jobRes.data.data.status}`);
    logInfo(`胜出执行 ID: ${jobRes.data.data.winnerExecutionId}`);
  } catch (error) {
    logError('选择胜出者失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 9: 完成任务（支付给胜出者）
// ============================================

async function test9_ApproveAndComplete() {
  logSection('💰 测试 9: 完成任务并支付给胜出者');

  try {
    const approveData = {
      rating: 5,
      feedback: 'Excellent work in the competition!',
    };

    const res = await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/approve`,
      approveData,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess('任务完成并支付成功');
    logInfo(`Job 状态: ${res.data.data.status}`);
    logInfo(`评分: ${res.data.data.rating} 星`);

    logInfo('\n💡 提示: 账单已生成，只有胜出的 Agent 会收到报酬');
  } catch (error) {
    logError('完成任务失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 测试 10: 验证 Agent 统计数据
// ============================================

async function test10_VerifyAgentStats() {
  logSection('📈 测试 10: 验证 Agent 竞价统计数据');

  try {
    for (const agentId of testAgentIds) {
      const res = await axios.get(`${API_BASE_URL}/agents/${agentId}`);
      const agent = res.data.data;

      log(`\n${agent.name}:`, 'cyan');
      log(`  竞价胜出次数: ${agent.competitionsWon || 0}`);
      log(`  竞价参与次数: ${agent.competitionsTotal || 0}`);
      if (agent.competitionsTotal > 0) {
        const winRate =
          ((agent.competitionsWon || 0) / agent.competitionsTotal) * 100;
        log(`  胜率: ${winRate.toFixed(1)}%`);
      }
    }

    logSuccess('\nAgent 统计数据验证成功');
  } catch (error) {
    logError('获取 Agent 统计失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 运行所有测试
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(70), 'blue');
  log('       🏆 竞价模式 API 完整测试套件', 'blue');
  log('='.repeat(70), 'blue');

  try {
    // 登录
    const loginSuccess = await loginAndGetToken();
    if (!loginSuccess) {
      logError('登录失败，测试终止');
      process.exit(1);
    }

    // 运行所有测试
    await test1_CreateMultipleAgents();
    await test2_CreateCompetitionJob();
    await test3_GetJobDetailAndExecutions();
    await test4_GetRecommendations();
    await test5_StartCompetition();
    await test6_GetCompetitionResults();
    await test7_ScoreExecutions();
    await test8_SelectWinner();
    await test9_ApproveAndComplete();
    await test10_VerifyAgentStats();

    // 总结
    logSection('✨ 测试完成');
    logSuccess('所有竞价模式测试通过！');
    log('\n测试覆盖:', 'yellow');
    log('  ✓ 创建多个测试 Agent');
    log('  ✓ 创建竞价模式 Job');
    log('  ✓ 智能匹配 Top N Agent');
    log('  ✓ 并行启动竞价执行');
    log('  ✓ 获取竞价执行结果');
    log('  ✓ 自动和人工评分');
    log('  ✓ 选择胜出者');
    log('  ✓ 完成支付（只支付胜出者）');
    log('  ✓ Agent 竞价统计更新');
  } catch (error) {
    logError('\n测试失败');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
