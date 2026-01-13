const { Wallet } = require('ethers');
const axios = require('axios');

async function testSignature() {
  // 使用 Hardhat 的第一个测试账户
  const privateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new Wallet(privateKey);

  console.log('Wallet address:', wallet.address);
  console.log('');

  try {
    // 1. 获取 nonce
    console.log('Step 1: Getting nonce...');
    const nonceRes = await axios.post('http://localhost:3000/auth/nonce', {
      walletAddress: wallet.address,
    });

    const { message, nonce } = nonceRes.data.data;
    console.log('Nonce:', nonce);
    console.log('Message to sign:', message);
    console.log('');

    // 2. 签名消息
    console.log('Step 2: Signing message...');
    const signature = await wallet.signMessage(message);
    console.log('Signature:', signature);
    console.log('');

    // 3. 登录
    console.log('Step 3: Logging in...');
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      walletAddress: wallet.address,
      signature: signature,
    });

    console.log('Login successful!');
    console.log('Response:', JSON.stringify(loginRes.data, null, 2));

    return loginRes.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

testSignature()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed');
    process.exit(1);
  });
