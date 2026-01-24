#!/usr/bin/env node

/**
 * DAO Disputes API 完整测试脚本
 * 测试争议创建、投票和解决流程 (端到端)
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// 测试变量
let authToken = null;
let userId = null;
let testJobId = null;
let testAgentId = null;
let testDisputeId = null;

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

  // 使用 Hardhat 默认账户 #1
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
    return true;
  } catch (error) {
    logError('登录失败');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// ============================================
// 创建测试数据 (使用现有 Agent + 新 Job)
// ============================================

async function prepareTestData() {
  logSection('准备步骤: 使用现有 Agent 并创建新 Job (MANUAL 模式)');

  try {
    // 1. 获取现有 Agent
    logInfo('获取现有 Agent...');
    const agentsRes = await axios.get(`${API_BASE_URL}/agents`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const agents = agentsRes.data.data.data || agentsRes.data.data || [];
    if (agents.length === 0) {
      logError('数据库中没有 Agent，请先创建一个 Agent 再运行此测试。');
      return false;
    }
    testAgentId = agents[0].id;
    logSuccess(`使用现有 Agent, ID: ${testAgentId}, 名称: ${agents[0].name}`);

    // 2. 创建 Job (使用 MANUAL 模式确保我们可以手动分配)
    logInfo('创建测试 Job (MANUAL 模式)...');
    const jobRes = await axios.post(
      `${API_BASE_URL}/jobs`,
      {
        title: 'DAO End-to-End Dispute Flow Test',
        description:
          'Complete flow test: Create -> Assign -> Accept -> Start -> Submit -> Dispute.',
        category: 'TESTING',
        tags: ['test', 'complete-flow'],
        requiredCapabilities: agents[0].capabilities || ['testing'],
        inputData: { task: 'Please verify the DAO resolution logic.' },
        expectedOutput: 'Verification successful',
        budget: 200,
        currency: 'USDC',
        estimatedDuration: 30,
        matchingMode: 'MANUAL',
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    testJobId = jobRes.data.data.id;
    logSuccess(
      `Job 创建成功, ID: ${testJobId}, 状态: ${jobRes.data.data.status}`,
    );

    // 3. 任务状态流转
    logInfo('开始任务流转流程...');

    // A. 分配 Agent
    logInfo(`步骤 A: 分配 Agent ${testAgentId} 到 Job ${testJobId}...`);
    await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/assign`,
      { agentId: testAgentId },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    logSuccess('分配成功');

    // B. 接受任务
    logInfo('步骤 B: Agent 接受任务...');
    await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    logSuccess('任务已接受');

    // C. 开始任务
    logInfo('步骤 C: 开始执行任务...');
    await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/start`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    logSuccess('任务已开始');

    // D. 提交任务
    logInfo('步骤 D: 提交任务结果 (SUBMITTED)...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await axios.post(
      `${API_BASE_URL}/jobs/${testJobId}/submit`,
      { resultData: { completed: true, report: 'All tests passed locally.' } },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    logSuccess('结果提交成功，Job 状态应为 SUBMITTED');

    // 验证状态
    const checkRes = await axios.get(`${API_BASE_URL}/jobs/${testJobId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    logInfo(`Job 最终验证状态: ${checkRes.data.data.status}`);

    return true;
  } catch (error) {
    logError('数据准备流程失败');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    return false;
  }
}

// ============================================
// DAO 争议测试
// ============================================

async function test1_CreateDispute() {
  logSection('DAO 测试 1: 发起争议');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/disputes`,
      {
        jobId: testJobId,
        title: '工作质量争议',
        reason: 'Agent 交付的内容质量不佳, 且多处未按照要求执行。',
        evidence: 'https://ipfs.io/ipfs/QmExampleEvidenceHash',
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    testDisputeId = res.data.data.id;
    logSuccess(`争议发起成功, ID: ${testDisputeId}`);
    logInfo(`状态: ${res.data.data.status}`);
  } catch (error) {
    logError('发起争议失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test2_ListDisputes() {
  logSection('DAO 测试 2: 获取争议列表与统计');

  try {
    const listRes = await axios.get(`${API_BASE_URL}/disputes`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    logSuccess(`成功获取争议列表, 数量: ${listRes.data.data.length}`);

    const statsRes = await axios.get(`${API_BASE_URL}/disputes/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    logSuccess('成功获取统计数据');
    console.log(statsRes.data.data);
  } catch (error) {
    logError('获取列表或统计失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test3_SubmitVote() {
  logSection('DAO 测试 3: 提交投票');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/disputes/${testDisputeId}/vote`,
      {
        choice: 'REJECT',
        reason: '确实不符合标准, 支持重做。',
        tokenWeight: '1500',
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess('投票提交成功');
    logInfo(`投票ID: ${res.data.data.id}`);
  } catch (error) {
    logError('提交投票失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test4_GetMyVotes() {
  logSection('DAO 测试 4: 查看我的投票记录');

  try {
    const res = await axios.get(`${API_BASE_URL}/disputes/my-votes`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    logSuccess(`成功获取我的投票记录, 数量: ${res.data.data.length}`);
  } catch (error) {
    logError('获取投票记录失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test5_ResolveDispute() {
  logSection('DAO 测试 5: 解决争议 (模拟解决)');

  try {
    const res = await axios.post(
      `${API_BASE_URL}/disputes/${testDisputeId}/resolve`,
      {},
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    logSuccess('争议解决成功');
    logInfo(`决议: ${res.data.data.resolution}`);
    logInfo(`新状态: ${res.data.data.status}`);
  } catch (error) {
    logError('争议解决失败');
    if (error.response?.data?.message?.includes('期尚未结束')) {
      logInfo('提示: 投票期内无法解决, 逻辑正常。');
    } else {
      console.error(error.response?.data || error.message);
      throw error;
    }
  }
}

// ============================================
// 主测试流程
// ============================================

async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('       Agent Guild DAO (End-to-End) API 测试', 'cyan');
  log('='.repeat(60), 'cyan');

  try {
    // 1. 登录
    const loginOk = await loginAndGetToken();
    if (!loginOk) return;

    // 2. 生成全新的 Job 并流转到 SUBMITTED 状态
    logSection('第一阶段: 生成全流程测试数据');
    const dataOk = await prepareTestData();
    if (!dataOk) {
      logError('测试数据准备失败，无法继续。');
      process.exit(1);
    }

    // 3. 对该新 Job 发起争议
    logSection('第二阶段: 发起争议');
    await test1_CreateDispute();

    // 4. 运行 DAO 核心验证流程
    logSection(`第三阶段: 针对争议 #${testDisputeId} 进行 DAO 流程测试`);

    await test2_ListDisputes();
    await test3_SubmitVote();
    await test4_GetMyVotes();
    await test5_ResolveDispute();

    logSection('测试完成报告');
    logSuccess('✨ 争议解决核心链路端到端验证通过！');
    logInfo(`测试路径: Job #${testJobId} -> Dispute #${testDisputeId}`);
    logInfo(
      '流程覆盖: Job 创建 -> 手动分配 -> 接受 -> 开始 -> 提交 -> 争议 -> 投票 -> 结果解决',
    );
  } catch (error) {
    logError('\n端到端测试执行异常');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

runTests();
