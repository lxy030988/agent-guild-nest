// Prisma 7 Migration Runner
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.handler = async (event, context) => {
  console.log('Starting migration (Prisma 7)...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  try {
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

    // Run migrate deploy using the generated prisma.config.ts in root
    const result = spawnSync('node', [prismaCliPath, 'migrate', 'deploy'], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true',
      },
      cwd: __dirname, // Run in /var/task where prisma.config.ts satisfies import
    });

    if (result.stdout) console.log('Prisma STDOUT:', result.stdout);
    if (result.stderr) console.error('Prisma STDERR:', result.stderr);

    if (result.status !== 0) {
      throw new Error(`Migration process exited with code ${result.status}`);
    }

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
      }),
    };
  }
};
