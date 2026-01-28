// Force redeploy - Manual Download Correct Makefile
const { exec, spawnSync } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const dns = require('dns');
const net = require('net');

const execAsync = util.promisify(exec);

exports.handler = async (event, context) => {
  console.log('Starting migration...');
  console.log('Event:', JSON.stringify(event));

  // Debug: Test DNS resolution
  if (process.env.DATABASE_URL) {
    try {
      const dbHost = process.env.DATABASE_URL.split('@')[1].split(':')[0];
      console.log(`Resolving database host: ${dbHost}`);
      // Use basic dns.lookup which uses OS resolver
      const addresses = await util.promisify(require('dns').lookup)(dbHost);
      console.log(`Resolved IP: ${JSON.stringify(addresses)}`);
    } catch (err) {
      console.error('DNS Verification Failed:', err);
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  // In Lambda, the task root is /var/task
  // We expect schema.prisma to be in the root of this package (migration/)
  // When packaged, index.js and schema.prisma will be in the root.

  try {
    console.log('Running prisma migrate deploy...');

    // 直接调用 Prisma CLI 入口文件，避免 npx 的路径解析问题
    // Lambda 环境下 node_modules 是扁平的
    const prismaCliPath = path.join(
      __dirname,
      'node_modules',
      'prisma',
      'build',
      'index.js',
    );
    console.log(`Executing Prisma CLI from: ${prismaCliPath}`);

    if (!fs.existsSync(prismaCliPath)) {
      throw new Error(`Prisma CLI not found at ${prismaCliPath}`);
    }

    // Lambda 环境下 /var/task 是只读的，只有 /tmp 是可写的
    const tmpDir = '/tmp';
    const envPath = path.join(tmpDir, '.env');
    const schemaPath = path.join(tmpDir, 'schema.prisma');
    const migrationsDir = path.join(tmpDir, 'migrations');

    // 1. 写入临时 .env
    fs.writeFileSync(envPath, `DATABASE_URL="${process.env.DATABASE_URL}"`);
    console.log('Temporary .env file created in /tmp.');

    // 2. Clear existing links/files in /tmp to prevent EEXIST on warm starts
    try {
      fs.rmSync(schemaPath, { force: true, recursive: true });
      fs.rmSync(migrationsDir, { force: true, recursive: true });
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }

    // 2. 复制 schema.prisma 到 /tmp (使用 copy 而不是 symlink，避免权限问题)
    fs.copyFileSync(path.join(__dirname, 'schema.prisma'), schemaPath);

    // 3. 复制 migrations 目录到 /tmp (使用递归复制)
    // fs.cpSync required Node 16.7+ (Lambda nodejs20.x/22.x supports it)
    fs.cpSync(path.join(__dirname, 'migrations'), migrationsDir, {
      recursive: true,
    });

    // 4. Test TCP Connectivity
    console.log('Testing TCP connection to database port...');
    const dbUrl = new URL(process.env.DATABASE_URL);
    const host = dbUrl.hostname;
    const port = parseInt(dbUrl.port) || 5432;

    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(5000); // 5s timeout for TCP test
        socket.on('connect', () => {
          console.log('TCP Connection Successful!');
          socket.destroy();
          resolve();
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('TCP Connection Timed Out'));
        });
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
        socket.connect(port, host);
      });
    } catch (err) {
      console.error('TCP Connection Test Failed:', err.message);
    }

    // 5. Prepare DATABASE_URL with connection parameters
    let finalDbUrl = process.env.DATABASE_URL;
    const urlParams = new URLSearchParams(dbUrl.search);

    if (!urlParams.has('connection_limit')) {
      urlParams.set('connection_limit', '1');
    }
    if (!urlParams.has('connect_timeout')) {
      urlParams.set('connect_timeout', '30');
    }

    // Reconstruct the URL with updated parameters
    dbUrl.search = urlParams.toString();
    finalDbUrl = dbUrl.toString();
    console.log(
      `Using DATABASE_URL: ${finalDbUrl.substring(0, 15)}... content hidden`,
    );

    // 6. 写入临时 .env (跳过，直接通过 env 传递)
    // fs.writeFileSync(envPath, `DATABASE_URL="${finalDbUrl}"`);

    // 7. 使用 spawnSync 并捕获完整输出
    const result = spawnSync(
      'node',
      [prismaCliPath, 'migrate', 'deploy', '--schema', schemaPath],
      {
        encoding: 'utf-8',
        env: {
          ...process.env,
          DATABASE_URL: finalDbUrl, // Explicitly pass DATABASE_URL
          PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true',
          // Ensure no other envs interfere
        },
        cwd: __dirname, // Changed from tmpDir to __dirname (/var/task) so Prisma can find node_modules
      },
    );

    if (result.stdout) console.log('Prisma STDOUT:', result.stdout);
    if (result.stderr) console.error('Prisma STDERR:', result.stderr);

    if (result.status !== 0) {
      throw new Error(`Migration process exited with code ${result.status}`);
    }

    console.log('Migration completed successfully!');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Migration successful',
        output: result.stdout,
      }),
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Migration failed',
        error: error.message,
        stack: error.stack,
      }),
    };
  }
};
