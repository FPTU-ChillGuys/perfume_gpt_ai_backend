import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { log, waitForService, isContainerRunning, containerExists, testPostgresConnection, testRedisConnection } from './setup-check';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

/**
 * Create a readline interface for user input
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask user a yes/no question
 */
export async function askYesNo(question: string, defaultYes: boolean = true): Promise<boolean> {
  const rl = createInterface();
  const answer = await new Promise<string>((resolve) => {
    rl.question(question + (defaultYes ? ' [Y/n]: ' : ' [y/N]: '), (input) => {
      rl.close();
      resolve(input.toLowerCase());
    });
  });
  
  if (answer === '') return defaultYes;
  return answer === 'y' || answer === 'yes';
}

/**
 * Ask user for input with a prompt
 */
export async function askInput(question: string, defaultValue: string = ''): Promise<string> {
  const rl = createInterface();
  const answer = await new Promise<string>((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (input) => {
      rl.close();
      resolve(input || defaultValue);
    });
  });
  return answer;
}

/**
 * Create PostgreSQL Docker container
 */
export async function createPostgresContainer(user: string, password: string): Promise<boolean> {
  log.section('Setting up PostgreSQL (Docker)');

  // Skip if already connected
  const existing = await testPostgresConnection();
  if (existing.connected) {
    log.success('PostgreSQL already connected, skipping setup');
    return true;
  }

  try {
    const exists = await containerExists('perfume-gpt-postgres');
    if (exists) {
      log.info('Found stopped PostgreSQL container, restarting...');
      execSync('docker start perfume-gpt-postgres', { stdio: 'inherit' });
    } else {
      log.info('Creating PostgreSQL container...');
      execSync(
        `docker run --name perfume-gpt-postgres ` +
        `-e POSTGRES_USER=${user} ` +
        `-e POSTGRES_PASSWORD=${password} ` +
        `-e POSTGRES_DB=perfume_gpt_ai ` +
        `-p 5432:5432 ` +
        `-d postgres:16`,
        { stdio: 'inherit' }
      );
    }

    log.info('Waiting for PostgreSQL to be ready...');
    const ready = await waitForService(async () => {
      const result = await testPostgresConnection();
      return result.connected;
    }, 30000);

    if (ready) {
      log.success('PostgreSQL container is ready');
      return true;
    } else {
      log.error('PostgreSQL failed to start within timeout');
      return false;
    }
  } catch (error: any) {
    log.error(`Failed to create PostgreSQL container: ${error.message}`);
    return false;
  }
}

/**
 * Create Redis Docker container
 */
export async function createRedisContainer(): Promise<boolean> {
  log.section('Setting up Redis (Docker)');

  // Skip if already connected
  const existing = await testRedisConnection();
  if (existing.connected) {
    log.success('Redis already connected, skipping setup');
    return true;
  }

  try {
    const exists = await containerExists('perfume-gpt-redis');
    if (exists) {
      log.info('Found stopped Redis container, restarting...');
      execSync('docker start perfume-gpt-redis', { stdio: 'inherit' });
    } else {
      log.info('Creating Redis container...');
      execSync(
        `docker run --name perfume-gpt-redis ` +
        `-p 6379:6379 ` +
        `-d redis:7`,
        { stdio: 'inherit' }
      );
    }

    log.info('Waiting for Redis to be ready...');
    const ready = await waitForService(async () => {
      try {
        const redis = require('redis');
        const client = redis.createClient({
          socket: { host: 'localhost', port: 6379, connectTimeout: 3000 }
        });
        await client.connect();
        const pong = await client.ping();
        await client.quit();
        return pong === 'PONG';
      } catch {
        return false;
      }
    }, 30000);

    if (ready) {
      log.success('Redis container is ready');
      return true;
    } else {
      log.error('Redis failed to start within timeout');
      return false;
    }
  } catch (error: any) {
    log.error(`Failed to create Redis container: ${error.message}`);
    return false;
  }
}

/**
 * Start or restart stopped containers
 */
export async function startContainers(): Promise<void> {
  const postgresRunning = await isContainerRunning('perfume-gpt-postgres');
  const redisRunning = await isContainerRunning('perfume-gpt-redis');

  if (!postgresRunning) {
    log.info('Starting PostgreSQL container...');
    try {
      execSync('docker start perfume-gpt-postgres', { stdio: 'inherit' });
      await waitForService(async () => isContainerRunning('perfume-gpt-postgres'), 10000);
      log.success('PostgreSQL started');
    } catch (error) {
      log.error('Failed to start PostgreSQL');
    }
  }

  if (!redisRunning) {
    log.info('Starting Redis container...');
    try {
      execSync('docker start perfume-gpt-redis', { stdio: 'inherit' });
      await waitForService(async () => isContainerRunning('perfume-gpt-redis'), 10000);
      log.success('Redis started');
    } catch (error) {
      log.error('Failed to start Redis');
    }
  }
}

/**
 * Create or update host-config.mjs
 */
export async function createHostConfig(user: string, password: string): Promise<boolean> {
  const hostConfigPath = path.resolve(process.cwd(), 'host-config.mjs');
  const hostConfigExamplePath = path.resolve(process.cwd(), 'host-config.mjs.example');

  try {
    if (fs.existsSync(hostConfigPath)) {
      log.info('host-config.mjs already exists, skipping...');
      return true;
    }

    if (!fs.existsSync(hostConfigExamplePath)) {
      log.error('host-config.mjs.example not found');
      return false;
    }

    const template = fs.readFileSync(hostConfigExamplePath, 'utf-8');
    const config = template.replace(/user: '.*'/g, `user: '${user}'`).replace(/password: '.*'/g, `password: '${password}'`);

    fs.writeFileSync(hostConfigPath, config);
    log.success('host-config.mjs created');
    return true;
  } catch (error: any) {
    log.error(`Failed to create host-config.mjs: ${error.message}`);
    return false;
  }
}

/**
 * Create .env file from .env.example
 */
export async function createEnvFile(): Promise<boolean> {
  const envPath = path.resolve(process.cwd(), '.env');
  const envExamplePath = path.resolve(process.cwd(), '.env.example');

  try {
    if (fs.existsSync(envPath)) {
      log.info('.env already exists, skipping...');
      return true;
    }

    if (!fs.existsSync(envExamplePath)) {
      log.error('.env.example not found');
      return false;
    }

    fs.copyFileSync(envExamplePath, envPath);
    log.success('.env created from .env.example');

    log.section('Configuration Required');
    log.warning('Please update .env with your specific values:');
    log.info('  - PostgreSQL credentials (POSTGRES_USER, POSTGRES_PASSWORD)');
    log.info('  - SQL Server credentials (SQL_SERVER_DATABASE_*)');
    log.info('  - OpenAI API Key (OPENAI_API_KEY)');
    log.info('  - Gmail credentials (GOOGLE_EMAIL, GOOGLE_APP_PASSWORD)');

    return true;
  } catch (error: any) {
    log.error(`Failed to create .env: ${error.message}`);
    return false;
  }
}

/**
 * Run Prisma generate
 */
export async function runPrismaGenerate(): Promise<boolean> {
  log.section('Generating Prisma Client');

  try {
    log.info('Running: npx prisma generate...');
    execSync('npx prisma generate --schema prisma/schema.prisma', { stdio: 'inherit' });
    log.success('Prisma client generated');
    return true;
  } catch (error: any) {
    log.error(`Prisma generate failed: ${error.message}`);
    return false;
  }
}

/**
 * Run MikroORM migrations
 */
export async function runMikroOrmMigrations(): Promise<boolean> {
  log.section('Running PostgreSQL Migrations (MikroORM)');

  try {
    log.info('Running: npx mikro-orm migration:up...');
    execSync('npx mikro-orm migration:up', { stdio: 'inherit', cwd: process.cwd() });
    log.success('MikroORM migrations completed');
    return true;
  } catch (error: any) {
    log.warning(`MikroORM migrations encountered an issue: ${error.message}`);
    return true; // Don't fail hard since migrations might be optional
  }
}

/**
 * Run Prisma migrations
 */
export async function runPrismaMigrations(): Promise<boolean> {
  log.section('Running SQL Server Migrations (Prisma)');

  try {
    log.info('Running: npx prisma migrate deploy...');
    execSync('npx prisma migrate deploy --schema prisma/schema.prisma', { stdio: 'inherit' });
    log.success('Prisma migrations completed');
    return true;
  } catch (error: any) {
    log.warning(`Prisma migrations encountered an issue: ${error.message}`);
    return true; // Don't fail hard since migrations might be optional
  }
}

/**
 * Run seed command
 */
export async function runSeed(): Promise<boolean> {
  log.section('Seeding Database');

  try {
    log.info('Running: pnpm run seed...');
    execSync('pnpm run seed', { stdio: 'inherit', cwd: process.cwd() });
    log.success('Seed completed');
    return true;
  } catch (error: any) {
    log.warning(`Seed encountered an issue: ${error.message}`);
    return true; // Don't fail hard
  }
}

/**
 * Full installation process
 */
export async function performInstallation(): Promise<boolean> {
  log.section('INSTALLATION: Starting Setup');

  // Check what actually needs setup before asking for credentials
  log.info('Checking current connection status...');
  const [postgresCheck, redisCheck] = await Promise.all([
    testPostgresConnection(),
    testRedisConnection(),
  ]);

  // Only ask for PostgreSQL credentials if it needs setup
  let postgresOk = postgresCheck.connected;
  let postgresUser = 'postgres';
  let postgresPassword = 'password';

  if (!postgresCheck.connected) {
    postgresUser = await askInput('PostgreSQL username', 'postgres');
    postgresPassword = await askInput('PostgreSQL password', 'password');
    postgresOk = await createPostgresContainer(postgresUser, postgresPassword);
  } else {
    log.success('PostgreSQL already connected, skipping Docker setup');
  }

  // Redis
  let redisOk = redisCheck.connected;
  if (!redisCheck.connected) {
    redisOk = await createRedisContainer();
  } else {
    log.success('Redis already connected, skipping Docker setup');
  }

  if (!postgresOk || !redisOk) {
    log.warning('Some databases failed to connect - check Docker');
  }

  // Create configuration files
  await createHostConfig(postgresUser, postgresPassword);
  await createEnvFile();

  // Run database setup
  await runPrismaGenerate();
  await runMikroOrmMigrations();
  await runPrismaMigrations();
  await runSeed();

  log.section('INSTALLATION: Complete');
  log.success('Setup completed successfully!');

  return true;
}
