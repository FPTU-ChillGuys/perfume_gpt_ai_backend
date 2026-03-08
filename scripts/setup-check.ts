import { createClient } from '@keyv/redis';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

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

const symbols = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ'
};

/**
 * Colored console output utilities
 */
export const log = {
  success: (msg: string) => console.log(`${colors.green}${symbols.success}${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}${symbols.error}${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}${symbols.warning}${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.cyan}${symbols.info}${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.bright}${colors.blue}═ ${msg} ═${colors.reset}`),
  debug: (msg: string) => console.log(`${colors.dim}${msg}${colors.reset}`)
};

/**
 * Check if a command exists and is available
 */
export function commandExists(cmd: string): boolean {
  const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
  try {
    execSync(checkCmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a command version
 */
export function getCommandVersion(cmd: string): string | null {
  try {
    const output = execSync(`${cmd} --version`, { encoding: 'utf-8' }).trim();
    return output;
  } catch {
    return null;
  }
}

/**
 * Compare semantic versions (e.g., "18.0.0" >= "18")
 */
export function compareVersions(installed: string, required: string): boolean {
  const parseVersion = (v: string) => {
    const match = v.match(/\d+/g);
    return match ? parseInt(match[0]) : 0;
  };
  return parseVersion(installed) >= parseVersion(required);
}

/**
 * Check if Docker is running
 */
export async function isDockerRunning(): Promise<boolean> {
  try {
    execSync('docker ps', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker container is running
 */
export async function isContainerRunning(containerName: string): Promise<boolean> {
  try {
    const output = execSync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, {
      encoding: 'utf-8'
    }).trim();
    return output.includes(containerName);
  } catch {
    return false;
  }
}

/**
 * Check if Docker container exists (not necessarily running)
 */
export async function containerExists(containerName: string): Promise<boolean> {
  try {
    const output = execSync(`docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`, {
      encoding: 'utf-8'
    }).trim();
    return output.includes(containerName);
  } catch {
    return false;
  }
}

/**
 * Wait for service to be healthy
 */
export async function waitForService(
  check: () => Promise<boolean>,
  timeout: number = 30000,
  interval: number = 1000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      if (await check()) {
        return true;
      }
    } catch {
      // Keep trying
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

/**
 * Parse host-config.mjs as plain text to avoid ESM/CJS module issues
 */
function parseHostConfig(filePath: string): { host: string; port: number; user: string; password: string } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const get = (key: string, fallback: string) => {
    const match = content.match(new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]?([^'",\\s}]+)['"]?`));
    return match ? match[1] : fallback;
  };
  return {
    host: get('host', 'localhost'),
    port: parseInt(get('port', '5432')),
    user: get('user', 'postgres'),
    password: get('password', 'password'),
  };
}

/**
 * Test PostgreSQL connection using host-config values
 */
export async function testPostgresConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const hostConfigPath = path.resolve(process.cwd(), 'host-config.mjs');

    if (!fs.existsSync(hostConfigPath)) {
      return { connected: false, error: 'host-config.mjs not found' };
    }

    const { host, port, user, password } = parseHostConfig(hostConfigPath);

    const client = new Client({
      host: host || 'localhost',
      port: port || 5432,
      user: user || 'postgres',
      password: password || 'password',
      database: 'perfume_gpt_ai'
    });

    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    
    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    const client = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
        connectTimeout: 3000
      }
    });

    await client.connect();
    const pong = await client.ping();
    await client.quit();

    return { connected: pong === 'PONG' };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

/**
 * Test SQL Server connection using Prisma
 */
export async function testSqlServerConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const databaseUrl = process.env.SQL_SERVER_DATABASE_URL;
    
    if (!databaseUrl) {
      return { connected: false, error: 'SQL_SERVER_DATABASE_URL not configured in .env' };
    }

    const prismaBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma');
    const result = spawnSync(prismaBin, ['db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'], {
      input: 'SELECT 1',
      encoding: 'utf-8'
    });

    if (result.error || result.status !== 0) {
      return { connected: false, error: result.stderr || 'Query failed' };
    }

    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

/**
 * Full pre-check: verify all prerequisites before setup
 */
export async function performPreCheck(): Promise<{
  passed: boolean;
  checks: Record<string, { status: boolean; message: string }>;
  summary: string;
  needsPostgres: boolean;
  needsRedis: boolean;
}> {
  const checks: Record<string, { status: boolean; message: string }> = {};

  log.section('PRE-CHECK: System Requirements');

  // 1. Node.js
  const nodeVersion = process.version.substring(1);
  const nodeOK = compareVersions(nodeVersion, '18');
  checks['Node.js'] = { status: nodeOK, message: `Node ${nodeVersion}` };
  nodeOK ? log.success(`Node.js >= 18 (${nodeVersion})`) : log.error(`Node.js >= 18 required (found ${nodeVersion})`);

  // 2. pnpm
  const pnpmOK = commandExists('pnpm');
  checks['pnpm'] = { status: pnpmOK, message: pnpmOK ? `pnpm found` : 'pnpm not found' };
  if (pnpmOK) {
    const pnpmVersion = getCommandVersion('pnpm');
    log.success(`pnpm found (${pnpmVersion})`);
  } else {
    log.error('pnpm not found - install via: npm install -g pnpm');
  }

  // 3. Docker
  const dockerOK = commandExists('docker');
  checks['Docker'] = { status: dockerOK, message: dockerOK ? 'Docker found' : 'Docker not found' };
  dockerOK ? log.success('Docker is installed') : log.error('Docker not found - install from https://www.docker.com/products/docker-desktop');

  // 4. Docker daemon
  let dockerRunning = false;
  if (dockerOK) {
    dockerRunning = await isDockerRunning();
    checks['Docker Daemon'] = { status: dockerRunning, message: dockerRunning ? 'Running' : 'Not running' };
    dockerRunning ? log.success('Docker daemon is running') : log.warning('Docker daemon is not running - start Docker desktop');
  }

  // 5. Prisma CLI
  const prismaOK = commandExists('prisma');
  checks['Prisma CLI'] = { status: prismaOK, message: prismaOK ? 'Found' : 'Not found' };
  prismaOK ? log.success('Prisma CLI is installed') : log.warning('Prisma CLI not found - will try to use npx');

  log.section('PRE-CHECK: Database Services');

  // 6. PostgreSQL — test actual connection
  log.info('Testing PostgreSQL connection...');
  const postgresConnResult = await testPostgresConnection();
  checks['PostgreSQL'] = {
    status: postgresConnResult.connected,
    message: postgresConnResult.connected
      ? 'Connected'
      : `Not connected (${postgresConnResult.error ?? 'unknown error'})`
  };
  postgresConnResult.connected
    ? log.success('PostgreSQL: Connected')
    : log.warning(`PostgreSQL: Not connected — will set up during installation`);

  // 7. Redis — test actual connection
  log.info('Testing Redis connection...');
  const redisConnResult = await testRedisConnection();
  checks['Redis'] = {
    status: redisConnResult.connected,
    message: redisConnResult.connected
      ? 'Connected'
      : `Not connected (${redisConnResult.error ?? 'unknown error'})`
  };
  redisConnResult.connected
    ? log.success('Redis: Connected')
    : log.warning(`Redis: Not connected — will set up during installation`);

  log.section('PRE-CHECK: Configuration Files');

  // 8. host-config.mjs
  const hostConfigPath = path.resolve(process.cwd(), 'host-config.mjs');
  const hostConfigExists = fs.existsSync(hostConfigPath);
  checks['host-config.mjs'] = { status: hostConfigExists, message: hostConfigExists ? 'Found' : 'Not found' };
  hostConfigExists ? log.success('host-config.mjs exists') : log.warning('host-config.mjs not found - will create from example');

  // 9. .env
  const envPath = path.resolve(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);
  checks['.env'] = { status: envExists, message: envExists ? 'Found' : 'Not found' };
  envExists ? log.success('.env exists') : log.info('.env not found - will create from .env.example');

  // 10. public_key.pem (optional warning)
  const publicKeyPath = path.resolve(process.cwd(), 'public_key.pem');
  const publicKeyExists = fs.existsSync(publicKeyPath);
  checks['public_key.pem'] = { status: publicKeyExists, message: publicKeyExists ? 'Found' : 'Not found' };
  publicKeyExists ? log.success('public_key.pem exists') : log.warning('public_key.pem not found - app may need it');

  log.section('PRE-CHECK: Summary');

  const passedCount = Object.values(checks).filter(c => c.status).length;
  const totalCount = Object.keys(checks).length;
  const passed = postgresConnResult.connected && redisConnResult.connected && envExists && hostConfigExists && nodeOK && pnpmOK;

  const summary = `${passedCount}/${totalCount} checks passed. ${
    passed 
      ? 'Ready to proceed with setup.' 
      : 'Some prerequisites missing - setup will attempt to fix.'
  }`;

  log.info(summary);

  return {
    passed,
    checks,
    summary,
    needsPostgres: !postgresConnResult.connected,
    needsRedis: !redisConnResult.connected,
  };
}

/**
 * Full health check: verify all database connections
 */
export async function performHealthCheck(): Promise<{
  healthy: boolean;
  connections: Record<string, { connected: boolean; message: string; error?: string }>;
  summary: string;
}> {
  const connections: Record<string, { connected: boolean; message: string; error?: string }> = {};

  log.section('HEALTH-CHECK: Database Connections');

  // 1. PostgreSQL
  log.info('Testing PostgreSQL connection...');
  const postgresResult = await testPostgresConnection();
  connections['PostgreSQL (MikroORM)'] = {
    connected: postgresResult.connected,
    message: postgresResult.connected ? 'Connected' : `Failed: ${postgresResult.error}`,
    error: postgresResult.error
  };
  postgresResult.connected 
    ? log.success('PostgreSQL: Connected') 
    : log.error(`PostgreSQL: ${postgresResult.error}`);

  // 2. Redis
  log.info('Testing Redis connection...');
  const redisResult = await testRedisConnection();
  connections['Redis'] = {
    connected: redisResult.connected,
    message: redisResult.connected ? 'Connected' : `Failed: ${redisResult.error}`,
    error: redisResult.error
  };
  redisResult.connected 
    ? log.success('Redis: Connected') 
    : log.error(`Redis: ${redisResult.error}`);

  // 3. SQL Server
  log.info('Testing SQL Server connection...');
  const sqlServerResult = await testSqlServerConnection();
  connections['SQL Server (Prisma)'] = {
    connected: sqlServerResult.connected,
    message: sqlServerResult.connected ? 'Connected' : `Failed: ${sqlServerResult.error}`,
    error: sqlServerResult.error
  };
  sqlServerResult.connected 
    ? log.success('SQL Server: Connected') 
    : log.error(`SQL Server: ${sqlServerResult.error}`);

  log.section('HEALTH-CHECK: Summary');

  const connectedCount = Object.values(connections).filter(c => c.connected).length;
  const totalCount = Object.keys(connections).length;
  const healthy = connectedCount === totalCount;

  const summary = `${connectedCount}/${totalCount} databases connected. ${
    healthy 
      ? 'Application is ready to start.' 
      : 'Some databases unavailable - check errors above.'
  }`;

  log.info(summary);

  return { healthy, connections, summary };
}
