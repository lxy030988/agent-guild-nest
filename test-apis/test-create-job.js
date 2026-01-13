const { Wallet } = require('ethers');
const axios = require('axios');

async function testCreateJob() {
  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new Wallet(privateKey);

  console.log('=== 测试创建 Job API ===\n');
  console.log('Wallet:', wallet.address, '\n');

  try {
    // 1. 登录获取 token
    console.log('1️⃣  登录获取 Token');
    const nonceRes = await axios.post('http://localhost:3000/auth/nonce', {
      walletAddress: wallet.address,
    });
    const { message } = nonceRes.data.data;
    const signature = await wallet.signMessage(message);
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      walletAddress: wallet.address,
      signature,
    });
    const { access_token } = loginRes.data.data;
    console.log('✅ Token:', access_token.substring(0, 40) + '...\n');

    // 2. 创建 Job
    console.log('2️⃣  创建 Job');
    const jobData = {
      title: '测试任务 222',
      description: '代码审核测试',
      category: 'CODE_REVIEW',
      tags: [],
      requiredCapabilities: ['code-review'],
      inputData: {
        content: 'export const CONTRACT_ADDRESSES = {...}',
      },
      budget: 33,
      currency: 'ETH',
      estimatedDuration: 333,
      matchingMode: 'MANUAL',
    };

    const createRes = await axios.post('http://localhost:3000/jobs', jobData, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    console.log('✅ Job 创建成功！');
    console.log('   Job ID:', createRes.data.data.id);
    console.log('   Status:', createRes.data.data.status);
    console.log('   Title:', createRes.data.data.title);

    console.log('\n✅ 测试通过！');
    return true;
  } catch (error) {
    console.error('\n❌ 测试失败:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   ', error.message);
    }
    throw error;
  }
}

testCreateJob()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
