const { Wallet } = require('ethers');
const axios = require('axios');

async function testAllApis() {
  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new Wallet(privateKey);

  console.log('=== 测试所有认证 API ===\n');
  console.log('Wallet:', wallet.address, '\n');

  try {
    // 1. 测试 Nonce 接口
    console.log('1️⃣  测试 POST /auth/nonce');
    const nonceRes = await axios.post('http://localhost:3000/auth/nonce', {
      walletAddress: wallet.address,
    });
    console.log('✅ Nonce:', nonceRes.data.data.nonce);
    console.log('');

    // 2. 测试登录接口
    console.log('2️⃣  测试 POST /auth/login');
    const { message } = nonceRes.data.data;
    const signature = await wallet.signMessage(message);
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      walletAddress: wallet.address,
      signature,
    });
    const { access_token, user } = loginRes.data.data;
    console.log('✅ Login成功');
    console.log('   User ID:', user.id);
    console.log('   Token:', access_token.substring(0, 40) + '...');
    console.log('');

    // 3. 测试 Profile 接口
    console.log('3️⃣  测试 GET /auth/profile');
    const profileRes = await axios.get('http://localhost:3000/auth/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    console.log('✅ Profile获取成功');
    console.log('   Profile:', JSON.stringify(profileRes.data.data, null, 2));

    console.log('\n✅ 所有 API 测试通过！');
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

testAllApis()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
