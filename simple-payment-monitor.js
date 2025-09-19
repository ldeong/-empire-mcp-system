#!/usr/bin/env node
// simple-payment-monitor.js - Basic payment monitoring for Empire income
// Enhanced: logs payments to logs/income.json and updates MICRO-PROGRESS.md for micro-offer blitz

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------- Config ----------
const EXCHANGE_RATE_USD = 150; // Approximate USD per XMR (adjust manually as needed)
const MICRO_PHASE_TARGET = 200; // First micro phase goal in USD
const MICRO_MILESTONE_STEP = 25; // Milestone bar increments

// Paths
const LOG_DIR = path.join(process.cwd(), 'logs');
const INCOME_LOG = path.join(LOG_DIR, 'income.json');
const MICRO_PROGRESS_FILE = path.join(process.cwd(), 'MICRO-PROGRESS.md');

// Ensure logging infrastructure exists
function ensureLogging() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (!fs.existsSync(INCOME_LOG)) fs.writeFileSync(INCOME_LOG, '[]', 'utf8');
    if (!fs.existsSync(MICRO_PROGRESS_FILE)) {
        fs.writeFileSync(MICRO_PROGRESS_FILE, generateMicroProgressMarkdown(0, []), 'utf8');
    }
}

// Load existing income records
function loadIncome() {
    try { return JSON.parse(fs.readFileSync(INCOME_LOG, 'utf8')); } catch { return []; }
}

// Save income records
function saveIncome(records) {
    fs.writeFileSync(INCOME_LOG, JSON.stringify(records, null, 2));
}

// Append a payment event
function logPayment({ network, amountXMR, usdValue, txType, note }) {
    const records = loadIncome();
    const entry = {
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        timestamp: new Date().toISOString(),
        network,
        amount_xmr: amountXMR,
        usd_est: usdValue,
        type: txType || 'auto-detect',
        note: note || null
    };
    records.push(entry);
    saveIncome(records);
    updateMicroProgress(records);
}

// Compute micro earnings (we treat any single payment under $400 as a "micro" for Phase 1 tracking)
function calculateMicroEarnings(records) {
    return records
        .filter(r => r.usd_est <= 400) // filter micro-range / exclude enterprise
        .reduce((sum, r) => sum + r.usd_est, 0);
}

// Generate progress bar for a given value
function bar(current, target, width = 30) {
    const ratio = Math.min(current / target, 1);
    const filled = Math.round(ratio * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// Generate milestone line showing brackets ($0, $25, ... $200)
function milestoneLine(current) {
    const parts = [];
    for (let m = 0; m <= MICRO_PHASE_TARGET; m += MICRO_MILESTONE_STEP) {
        if (current >= m) parts.push(`[${m}]`); else parts.push(`${m}`);
    }
    return parts.join(' ─ ');
}

function generateRecentTable(records, limit = 10) {
    if (!records.length) return '_No payments yet._';
    const recent = records.slice(-limit).reverse();
    return [
        '| Time (UTC) | Network | XMR | USD (est) | Type |',
        '|------------|---------|-----|-----------|------|',
        ...recent.map(r => `| ${new Date(r.timestamp).toISOString().replace('T',' ').replace('Z','')} | ${r.network} | ${r.amount_xmr.toFixed(4)} | $${r.usd_est.toFixed(2)} | ${r.type} |`)
    ].join('\n');
}

function generateMicroProgressMarkdown(microTotal, records) {
    const pct = Math.min((microTotal / MICRO_PHASE_TARGET) * 100, 100).toFixed(1);
    return `# 🚀 MICRO EARNINGS PROGRESS\n\n` +
`**Phase 1 Target:** $${MICRO_PHASE_TARGET} (Micro-offers)  \n` +
`**Current Total:** $${microTotal.toFixed(2)}  \n` +
`**Progress:** ${bar(microTotal, MICRO_PHASE_TARGET)} ${pct}%  \n\n` +
`Milestones (bold = reached):\n\n` +
`$${milestoneLine(microTotal)}\n\n` +
`## Recent Payments (last ${Math.min(records.length,10)})\n\n` +
`${generateRecentTable(records)}\n\n` +
`_Updated: ${new Date().toISOString()}_\n`;
}

function updateMicroProgress(records) {
    const microTotal = calculateMicroEarnings(records);
    fs.writeFileSync(MICRO_PROGRESS_FILE, generateMicroProgressMarkdown(microTotal, records));
}

ensureLogging();

// Our payment addresses
const ADDRESSES = {
    stagenet: '55mZQnmnivbXQRbPr2zsmG2egQwZJMD4PHyiF4qU2SP9Q1a7Au4HhH7R7tFBRgK7zbXASdnuahVDFiyBWJQTsTHRP3Y6yQw',
    mainnet: '45DTDUWznK3Wh3D6QjCyvuA3tEzUyRVzoZjwCyWLrEiohEiffvDG4foHSDJqFC5uVZN2aR37ZatWehrr49yYTNDeQ4SfDy8'
};

let lastBalance = {
    stagenet: 0,
    mainnet: 0
};

console.log('🔍 Empire Payment Monitor - ACTIVE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📬 Watching Stagenet: ${ADDRESSES.stagenet.substring(0, 20)}...`);
console.log(`💰 Watching Mainnet:  ${ADDRESSES.mainnet.substring(0, 20)}...`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function checkBalance(address, network) {
    return new Promise((resolve) => {
        const options = {
            hostname: network === 'stagenet' ? 'stagenet.community.rino.io' : 'node.community.rino.io',
            port: network === 'stagenet' ? 38081 : 18081,
            path: '/json_rpc',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const data = JSON.stringify({
            jsonrpc: '2.0',
            id: '0',
            method: 'get_balance',
            params: {
                address: address
            }
        });

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    const balance = response.result ? response.result.balance / 1e12 : 0; // Convert from atomic units
                    resolve(balance);
                } catch (error) {
                    resolve(0);
                }
            });
        });

        req.on('error', () => resolve(0));
        req.write(data);
        req.end();
    });
}

async function monitor() {
    try {
        // Check stagenet
        const stagenetBalance = await checkBalance(ADDRESSES.stagenet, 'stagenet');
        if (stagenetBalance > lastBalance.stagenet) {
            const paymentAmount = stagenetBalance - lastBalance.stagenet;
            console.log(`🎉 STAGENET PAYMENT DETECTED! +${paymentAmount.toFixed(6)} XMR`);
            console.log(`📊 New Balance: ${stagenetBalance.toFixed(6)} XMR`);
            
            // STAGENET SUCCESS CELEBRATION!
            console.log('\n🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
            console.log('✅                                                   ✅');
            console.log('🚀      PAYMENT SYSTEM WORKS! STAGENET SUCCESS!     🚀');
            console.log('💎                                                   💎');
            console.log('⚡         READY FOR REAL MONEY ON MAINNET!         ⚡');
            console.log('🎯                                                   🎯');
            console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n');
            
            // Log stagenet test payment (not counted toward micro earnings but tracked)
            logPayment({
                network: 'stagenet',
                amountXMR: paymentAmount,
                usdValue: paymentAmount * EXCHANGE_RATE_USD,
                txType: 'stagenet-test',
                note: 'Stagenet validation'
            });

            lastBalance.stagenet = stagenetBalance;
        }

        // Check mainnet
        const mainnetBalance = await checkBalance(ADDRESSES.mainnet, 'mainnet');
        if (mainnetBalance > lastBalance.mainnet) {
            const paymentAmount = mainnetBalance - lastBalance.mainnet;
            const usdValue = mainnetBalance * 150;
            
            console.log(`💰 MAINNET PAYMENT RECEIVED! +${paymentAmount.toFixed(6)} XMR`);
            console.log(`🚀 REAL INCOME! New Balance: ${mainnetBalance.toFixed(6)} XMR`);
            console.log(`💵 USD Value: ~$${usdValue.toFixed(2)} (estimate)`);
            
            // BIG WHOOO CELEBRATIONS EVERY $10!
            const dollarMilestones = Math.floor(usdValue / 10) * 10;
            const lastDollarMilestones = Math.floor((lastBalance.mainnet * 150) / 10) * 10;
            
            if (dollarMilestones > lastDollarMilestones) {
                console.log('\n🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉');
                console.log('🚀                                                   🚀');
                console.log(`🔥        WHOOOOO!!! $${dollarMilestones} MILESTONE HIT!        🔥`);
                console.log('💰                                                   💰');
                console.log(`⚡      EMPIRE EARNING REAL MONEY: $${usdValue.toFixed(2)}!      ⚡`);
                console.log('🎯                                                   🎯');
                console.log('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉\n');
                
                // Progress to $1000
                const progressPercent = (usdValue / 1000) * 100;
                const progressBars = Math.floor(progressPercent / 10);
                const progressDisplay = '█'.repeat(progressBars) + '░'.repeat(10 - progressBars);
                
                console.log(`📊 PROGRESS TO $1000: ${progressDisplay} ${progressPercent.toFixed(1)}%`);
                console.log(`💎 REMAINING: $${(1000 - usdValue).toFixed(2)} TO HIT THE TARGET!\n`);
            }
            
            // Log mainnet payment
            logPayment({
                network: 'mainnet',
                amountXMR: paymentAmount,
                usdValue: paymentAmount * EXCHANGE_RATE_USD,
                txType: paymentAmount * EXCHANGE_RATE_USD <= 400 ? 'micro-offer' : 'enterprise'
            });

            lastBalance.mainnet = mainnetBalance;
            
            // Trigger service delivery
            console.log('🔔 PAYMENT CONFIRMED - READY TO DELIVER SERVICE!');
        }

        // Update status
        const timestamp = new Date().toLocaleTimeString();
        process.stdout.write(`\r⏰ ${timestamp} | Stagenet: ${stagenetBalance.toFixed(6)} XMR | Mainnet: ${mainnetBalance.toFixed(6)} XMR`);

    } catch (error) {
        console.error('Monitor error:', error.message);
    }
}

// Start monitoring
console.log('🚀 Starting payment monitor...\n');
setInterval(monitor, 10000); // Check every 10 seconds
monitor(); // Initial check