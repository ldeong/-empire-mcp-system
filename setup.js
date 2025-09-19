import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

async function setup() {
    console.log(chalk.cyan('🚀 Setting up SINA Empire environment...'));
    
    try {
        // Check if .env exists, if not copy from .env.example
        try {
            await fs.access('.env');
            console.log(chalk.green('✅ .env file exists'));
        } catch {
            await fs.copyFile('.env.example', '.env');
            console.log(chalk.yellow('📄 Created .env file from .env.example'));
            console.log(chalk.yellow('⚠️  Please update .env with your actual API keys'));
        }
        
        // Make CLI executable
        await fs.chmod('./bulletproof-cli.js', 0o755);
        console.log(chalk.green('✅ Made bulletproof-cli.js executable'));
        
        // Create placeholder icon files
        await createPlaceholderIcons();
        
        console.log(chalk.green('✅ SINA Empire setup complete!'));
        console.log(chalk.cyan('\n🚀 Next steps:'));
        console.log(chalk.yellow('1. Update .env with your API keys'));
        console.log(chalk.yellow('2. Run: npm run dev'));
        console.log(chalk.yellow('3. Open: http://localhost:8787/sina/interface'));
        
    } catch (error) {
        console.error(chalk.red('❌ Setup failed:'), error.message);
        process.exit(1);
    }
}

async function createPlaceholderIcons() {
    const iconSizes = [192, 512];
    
    for (const size of iconSizes) {
        const iconPath = `public/sina/icon-${size}.png`;
        try {
            await fs.access(iconPath);
        } catch {
            // Create a simple SVG placeholder and note about icon generation
            const svgPlaceholder = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1a202c"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#60a5fa" font-size="${size/8}">SINA</text>
</svg>`;
            await fs.writeFile(iconPath.replace('.png', '.svg'), svgPlaceholder);
            console.log(chalk.yellow(`📄 Created placeholder icon: ${iconPath.replace('.png', '.svg')}`));
        }
    }
}

setup();
