import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

async function runTests() {
    console.log(chalk.cyan('🧪 Running SINA Empire tests...'));
    
    const tests = [
        {
            name: 'CLI Executable Check',
            test: async () => {
                const { stdout } = await execAsync('./bulletproof-cli.js --version');
                return stdout.includes('1.0.0');
            }
        },
        {
            name: 'Configuration Files',
            test: async () => {
                const { stdout } = await execAsync('ls -la .devcontainer/devcontainer.json .gitpod.yml wrangler.toml');
                return stdout.includes('devcontainer.json') && stdout.includes('.gitpod.yml') && stdout.includes('wrangler.toml');
            }
        },
        {
            name: 'PWA Files',
            test: async () => {
                const { stdout } = await execAsync('ls -la public/sina/index.html public/sina/manifest.json');
                return stdout.includes('index.html') && stdout.includes('manifest.json');
            }
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const result = await test.test();
            if (result) {
                console.log(chalk.green(`✅ ${test.name}`));
                passed++;
            } else {
                console.log(chalk.red(`❌ ${test.name}`));
                failed++;
            }
        } catch (error) {
            console.log(chalk.red(`❌ ${test.name}: ${error.message}`));
            failed++;
        }
    }
    
    console.log(chalk.cyan(`\n📊 Test Results: ${passed} passed, ${failed} failed`));
    
    if (failed === 0) {
        console.log(chalk.green('🎉 All tests passed!'));
        process.exit(0);
    } else {
        console.log(chalk.red('💥 Some tests failed!'));
        process.exit(1);
    }
}

runTests();
