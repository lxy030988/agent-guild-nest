#!/usr/bin/env node

/**
 * Dashboard API 测试脚本
 */

const { Wallet } = require('ethers');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
let authToken = null;
let userId = null;

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

async function loginAndGetToken() {
  log('\n预备步骤: 登录获取认证 Token', 'blue');
  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new Wallet(privateKey);

  try {
    const nonceRes = await axios.post(`${API_BASE_URL}/auth/nonce`, {
      walletAddress: wallet.address,
    });
    const { message, nonce } = nonceRes.data.data;

    const signature = await wallet.signMessage(message);
    const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      walletAddress: wallet.address,
      signature,
    });

    authToken = loginRes.data.data.access_token;
    userId = loginRes.data.data.user.id;

    log('✓ 登录成功', 'green');
    return true;
  } catch (error) {
    log('✗ 登录失败', 'red');
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function test1_GetDashboardStats() {
  log('\n=== 测试 1: GET /dashboard/stats ===', 'blue');
  try {
    const res = await axios.get(`${API_BASE_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const stats = res.data.data || res.data;
    log('✓ 获取Dashboard统计成功', 'green');
    console.log(JSON.stringify(stats, null, 2));
    log(`已发布Agent: ${stats.publishedAgents}`, 'cyan');
    log(`活跃任务: ${stats.activeJobs}`, 'cyan');
    log(`已完成任务: ${stats.completedJobs}`, 'cyan');
    log(`总收益: ${stats.totalEarnings} ETH`, 'cyan');
    log(`进行中任务: ${stats.inProgressJobs}`, 'cyan');
    log(`争议数: ${stats.disputes}`, 'cyan');
  } catch (error) {
    log('✗ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test2_GetRevenueChart() {
  log('\n=== 测试 2: GET /dashboard/charts/revenue ===', 'blue');
  try {
    const res = await axios.get(
      `${API_BASE_URL}/dashboard/charts/revenue?days=30`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const data = res.data.data || res.data;
    log(`✓ 获取收益图表成功，共 ${data.length} 个数据点`, 'green');
    if (data.length > 0) {
      console.log('示例数据点:', JSON.stringify(data[0], null, 2));
    } else {
      log('ℹ 暂无收益数据', 'yellow');
    }
  } catch (error) {
    log('✗ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test3_GetJobsBreakdown() {
  log('\n=== 测试 3: GET /dashboard/charts/jobs-breakdown ===', 'blue');
  try {
    const res = await axios.get(
      `${API_BASE_URL}/dashboard/charts/jobs-breakdown`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const data = res.data.data || res.data;
    log('✓ 获取任务分布成功', 'green');
    console.log(JSON.stringify(data, null, 2));

    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    log(`总任务数: ${total}`, 'cyan');
  } catch (error) {
    log('✗ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function test4_GetActivity() {
  log('\n=== 测试 4: GET /dashboard/activity ===', 'blue');
  try {
    const res = await axios.get(
      `${API_BASE_URL}/dashboard/activity?page=1&limit=10`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    const data = res.data.data || res.data;
    log(`✓ 获取活动动态成功，共 ${data.total} 条`, 'green');
    if (data.items && data.items.length > 0) {
      console.log('示例活动:', JSON.stringify(data.items[0], null, 2));
    } else {
      log('ℹ 暂无活动记录', 'yellow');
    }
  } catch (error) {
    log('✗ 测试失败', 'red');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('       Dashboard 模块 API 测试套件', 'blue');
  log('='.repeat(60), 'blue');

  try {
    const loginSuccess = await loginAndGetToken();
    if (!loginSuccess) {
      log('登录失败，测试终止', 'red');
      process.exit(1);
    }

    await test1_GetDashboardStats();
    await test2_GetRevenueChart();
    await test3_GetJobsBreakdown();
    await test4_GetActivity();

    log('\n' + '='.repeat(60), 'blue');
    log('✓ 所有测试通过！✨', 'green');
    log('='.repeat(60), 'blue');
    log('\n测试覆盖:', 'yellow');
    log('  ✓ 用户认证');
    log('  ✓ Dashboard 统计数据');
    log('  ✓ 收益趋势图表');
    log('  ✓ 任务状态分布');
    log('  ✓ 活动动态列表');
  } catch (error) {
    log('\n✗ 测试失败', 'red');
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
