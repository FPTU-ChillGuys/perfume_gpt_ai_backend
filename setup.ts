#!/usr/bin/env node
import 'dotenv/config';

/**
 * PerfumeGPT AI Backend - Automated Setup Script
 * 
 * This script automates the setup process:
 * 1. Pre-check: Verify all system requirements
 * 2. Installation: Create Docker containers, config files, run migrations
 * 3. Health-check: Verify all database connections
 * 4. Start: Optionally start the development server
 */

import { performPreCheck, performHealthCheck, log } from './scripts/setup-check';
import { performInstallation, askYesNo } from './scripts/setup-installer';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

async function main() {
  try {
    console.log(`
${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════╗
║     PerfumeGPT AI Backend - Automated Setup Script         ║
║                                                            ║
║     This script will set up your development environment   ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}
    `);

    // Step 0: Install dependencies first
    log.section('SETUP: Installing Dependencies');
    log.info('Running pnpm install...');
    try {
      execSync('pnpm install', { stdio: 'inherit', cwd: process.cwd() });
      log.success('Dependencies installed');
    } catch (error: any) {
      log.error(`pnpm install failed: ${error.message}`);
      process.exit(1);
    }

    // Step 1: Pre-check
    const preCheckResult = await performPreCheck();

    if (!preCheckResult.passed) {
      log.section('SETUP: Proceeding Despite Some Issues');
      const proceed = await askYesNo('Some checks failed. Proceed with installation?', true);
      if (!proceed) {
        log.info('Setup cancelled by user');
        process.exit(0);
      }
    }

    // Step 2: Installation
    const install = await askYesNo('\nProceed with installation?', true);
    if (install) {
      await performInstallation();
    } else {
      log.info('Skipped installation');
    }

    // Step 3: Health-check
    const healthCheckResult = await performHealthCheck();

    if (!healthCheckResult.healthy) {
      log.section('SETUP: Health Check Failed');
      log.warning('Some databases are not connected. Possible causes:');
      log.info('  1. PostgreSQL/Redis containers not running or not ready');
      log.info('  2. SQL Server instance not accessible');
      log.info('  3. Credentials in .env or host-config.mjs incorrect');
      log.info('\nYou can still try to start the app, but may encounter connection errors.');
    }

    // Step 4: Prompt to start dev server
    log.section('SETUP: Final Steps');
    const startApp = await askYesNo('Start development server now? (pnpm dev)', false);

    if (startApp) {
      log.info('Starting development server...');
      console.log(`\n${colors.bright}${colors.blue}Starting: pnpm dev${colors.reset}\n`);
      
      try {
        execSync('pnpm dev', { stdio: 'inherit', cwd: process.cwd() });
      } catch (error) {
        log.error('Development server exited with error');
        process.exit(1);
      }
    } else {
      console.log(`\n${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║                  Setup Complete!                          ║
║                                                            ║
║  To start the development server, run:                    ║
║  ${colors.bright}pnpm dev${colors.reset}${colors.cyan}                                           ║
║                                                            ║
║  Other useful commands:                                   ║
║  ${colors.bright}pnpm start${colors.reset}${colors.cyan}         - Start production server                    ║
║  ${colors.bright}pnpm migration:up${colors.reset}${colors.cyan}   - Run pending migrations                    ║
║  ${colors.bright}pnpm seed${colors.reset}${colors.cyan}           - Seed database                             ║
║  ${colors.bright}pnpm test${colors.reset}${colors.cyan}           - Run tests                                 ║
║                                                            ║
║  Documentation: See README.md for more information       ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
      `);
    }
  } catch (error: any) {
    log.error(`Setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
