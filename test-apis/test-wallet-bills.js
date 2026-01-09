#!/usr/bin/env node

/**
 * Wallet + Bills API 测试脚本
 * 测试所有 Wallet 和 Bills 相关的端点
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// 测试变量
let authToken = null;
let userId = null;

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
// Wallet API 测试
// ============================================

async function test1_GetWalletOverview() {
  logSection('测试 1: GET /wallet/overview - 获取资产概览');

  try {
    const res = await axios.get(`${API_BASE_URL}/wallet/overview`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const overview = res.data.data;
    logSuccess('获取资产概览成功');
    logInfo(`总收益: ${overview.totalEarnings} ETH`);
    logInfo(`待结算: ${overview.pendingEarnings} ETH`);
    logInfo(`完成任务数: ${overview.totalJobs}`);
    logInfo(`平均评分: ${overview.averageRating}`);
  } catch (error) {
    logError('获取资产概览失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test2_GetEarnings() {
  logSection('测试 2: GET /wallet/earnings - 获取收益统计');

  try {
    const res = await axios.get(`${API_BASE_URL}/wallet/earnings`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const earnings = res.data.data;
    logSuccess('获取收益统计成功');
    logInfo(`Agent 收益: ${earnings.agentEarnings} ETH`);
    logInfo(`Job 托管: ${earnings.jobEscrow} ETH`);
    logInfo(`质押奖励: ${earnings.stakingRewards} ETH`);

    log('\n三个钱包余额:', 'yellow');
    log(`  💰 Agent Earnings Wallet: ${earnings.agentEarnings} ETH`);
    log(`  🔒 Job Escrow Funds: ${earnings.jobEscrow} ETH`);
    log(`  🎁 Staking Rewards Wallet: ${earnings.stakingRewards} ETH`);
  } catch (error) {
    logError('获取收益统计失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test3_GetTransactionHistory() {
  logSection('测试 3: GET /wallet/transactions - 获取交易历史');

  try {
    const res = await axios.get(
      `${API_BASE_URL}/wallet/transactions?page=1&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const { items, total, page, limit } = res.data.data;
    logSuccess(`获取交易历史成功，共 ${total} 条记录`);
    logInfo(`当前页: ${page}, 每页 ${limit} 条`);

    if (items.length > 0) {
      log('\n最近的交易:', 'yellow');
      items.slice(0, 5).forEach((tx, i) => {
        log(`  ${i + 1}. ${tx.type}: ${tx.amount} ${tx.currency}`);
        log(`     描述: ${tx.description}`);
        log(`     时间: ${new Date(tx.createdAt).toLocaleString('zh-CN')}`);
        if (tx.txHash) {
          log(`     交易哈希: ${tx.txHash.substring(0, 20)}...`);
        }
      });
    } else {
      logInfo('暂无交易记录');
    }
  } catch (error) {
    logError('获取交易历史失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test4_GetAssetTrends() {
  logSection('测试 4: GET /wallet/trends - 获取资产趋势');

  try {
    const res = await axios.get(`${API_BASE_URL}/wallet/trends?days=30`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const trends = res.data.data;
    logSuccess(`获取资产趋势成功，共 ${trends.length} 个数据点`);

    if (trends.length > 0) {
      log('\n资产趋势（最近 30 天）:', 'yellow');
      trends.slice(-5).forEach((point) => {
        log(`  ${point.date}: ${point.amount} ETH`);
      });
    } else {
      logInfo('暂无趋势数据');
    }
  } catch (error) {
    logError('获取资产趋势失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// Bills API 测试
// ============================================

async function test5_GetBills() {
  logSection('测试 5: GET /bills - 获取账单列表');

  try {
    const res = await axios.get(`${API_BASE_URL}/bills?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const { items, total, page, limit } = res.data.data;
    logSuccess(`获取账单列表成功，共 ${total} 条账单`);
    logInfo(`当前页: ${page}, 每页 ${limit} 条`);

    if (items.length > 0) {
      log('\n最近的账单:', 'yellow');
      items.slice(0, 5).forEach((bill, i) => {
        log(`  ${i + 1}. ${bill.billNumber}`);
        log(`     类型: ${bill.type}`);
        log(`     金额: ${bill.amount} ${bill.currency}`);
        log(`     描述: ${bill.description}`);
        log(
          `     创建时间: ${new Date(bill.createdAt).toLocaleString('zh-CN')}`,
        );
      });
    } else {
      logInfo('暂无账单记录');
    }
  } catch (error) {
    logError('获取账单列表失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test6_FilterBills() {
  logSection('测试 6: GET /bills?type=INCOME - 筛选账单');

  try {
    const res = await axios.get(`${API_BASE_URL}/bills?type=INCOME`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const { total } = res.data.data;
    logSuccess(`筛选成功: 收入账单共 ${total} 条`);
  } catch (error) {
    logError('筛选账单失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test7_GetBillDetail() {
  logSection('测试 7: GET /bills/:id - 获取账单详情');

  try {
    // 先获取账单列表
    const listRes = await axios.get(`${API_BASE_URL}/bills?limit=1`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const { items } = listRes.data.data;

    if (items.length === 0) {
      logInfo('暂无账单，跳过详情测试');
      return;
    }

    const billId = items[0].id;

    // 获取账单详情
    const res = await axios.get(`${API_BASE_URL}/bills/${billId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const bill = res.data.data;
    logSuccess('获取账单详情成功');
    logInfo(`账单编号: ${bill.billNumber}`);
    logInfo(`类型: ${bill.type}`);
    logInfo(`金额: ${bill.amount} ${bill.currency}`);
    logInfo(`描述: ${bill.description}`);
    logInfo(`支付状态: ${bill.isPaid ? '已支付' : '未支付'}`);

    if (bill.job) {
      logInfo(`关联任务: ${bill.job.title}`);
    }

    if (bill.details) {
      log('\n账单明细:', 'yellow');
      log(`  ${JSON.stringify(bill.details, null, 2)}`);
    }
  } catch (error) {
    logError('获取账单详情失败');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// 运行所有测试
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('       Wallet + Bills 模块 API 测试套件', 'blue');
  log('='.repeat(60), 'blue');

  try {
    // 登录
    const loginSuccess = await loginAndGetToken();
    if (!loginSuccess) {
      logError('登录失败，测试终止');
      process.exit(1);
    }

    // Wallet API 测试
    await test1_GetWalletOverview();
    await test2_GetEarnings();
    await test3_GetTransactionHistory();
    await test4_GetAssetTrends();

    // Bills API 测试
    await test5_GetBills();
    await test6_FilterBills();
    await test7_GetBillDetail();

    // 总结
    logSection('测试完成');
    logSuccess('所有测试通过！✨');
    log('\n测试覆盖:', 'yellow');
    log('  ✓ 用户认证');
    log('  ✓ Wallet 资产概览');
    log('  ✓ Wallet 三个钱包余额');
    log('  ✓ 交易历史记录');
    log('  ✓ 资产趋势图表');
    log('  ✓ Bills 账单列表');
    log('  ✓ Bills 筛选功能');
    log('  ✓ Bills 账单详情');
  } catch (error) {
    logError('\n测试失败');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
