// balance-checker.js - Balance verification and reinvestment automation
require('dotenv').config();
const { EmpireWalletCreator } = require('../signer/wallet-create');
const { SecureEncryption } = require('../signer/encrypt');
const fs = require('fs').promises;
const path = require('path');

class EmpireBalanceManager {
    constructor() {
        this.walletCreator = new EmpireWalletCreator();
        this.encryption = new SecureEncryption(process.env.WALLET_MASTER_PASSPHRASE);
        this.ledgerFile = path.join(__dirname, 'empire-ledger.json');
        this.configFile = path.join(__dirname, 'reinvestment-config.json');
        this.activeWallet = null;
        
        // Default reinvestment allocation
        this.defaultAllocation = {
            scale: 0.60,      // 60% for scaling operations
            infrastructure: 0.30, // 30% for infrastructure
            reserve: 0.10     // 10% emergency reserve
        };
    }

    async initialize() {
        try {
            console.log('💰 Initializing balance manager...');
            
            // Load wallet for operations
            const walletData = await this.walletCreator.loadWallet('empire-primary');
            
            const monerojs = require('monero-ts');
            this.activeWallet = await monerojs.createWalletFull({
                networkType: walletData.networkType,
                mnemonic: walletData.mnemonic,
                serverUri: walletData.networkType === 'stagenet' ? 
                    'http://stagenet.community.rino.io:38081' : 
                    'http://node.community.rino.io:18081'
            });

            console.log(`✅ Balance manager initialized for ${walletData.networkType}`);
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize balance manager:', error);
            throw error;
        }
    }

    async checkBalance() {
        try {
            console.log('🔍 Checking current balance...');
            
            if (!this.activeWallet) {
                await this.initialize();
            }

            const balance = await this.activeWallet.getBalance();
            const unlockedBalance = await this.activeWallet.getUnlockedBalance();
            
            console.log(`💰 Total balance: ${balance} XMR`);
            console.log(`🔓 Unlocked balance: ${unlockedBalance} XMR`);

            // Load ledger for comparison
            const ledger = await this.loadLedger();
            const ledgerTotal = this.calculateLedgerTotal(ledger);
            
            console.log(`📊 Ledger total: ${ledgerTotal} XMR`);
            
            const difference = parseFloat(balance.toString()) - ledgerTotal;
            const discrepancy = Math.abs(difference) > 0.001;
            
            if (discrepancy) {
                console.warn(`⚠️ Balance discrepancy detected: ${difference} XMR`);
            }

            return {
                walletBalance: parseFloat(balance.toString()),
                unlockedBalance: parseFloat(unlockedBalance.toString()),
                ledgerTotal,
                difference,
                discrepancy,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to check balance:', error);
            throw error;
        }
    }

    async processReinvestment() {
        try {
            console.log('🔄 Processing reinvestment allocation...');
            
            const balanceCheck = await this.checkBalance();
            const availableBalance = balanceCheck.unlockedBalance;
            
            // Only reinvest if we have significant balance
            const minReinvestAmount = 0.1; // 0.1 XMR minimum
            if (availableBalance < minReinvestAmount) {
                console.log(`💡 Balance too low for reinvestment: ${availableBalance} XMR < ${minReinvestAmount} XMR`);
                return { reinvested: false, reason: 'insufficient_balance' };
            }

            const allocation = await this.getAllocationConfig();
            const allocations = this.calculateAllocations(availableBalance, allocation);
            
            console.log('📊 Reinvestment allocations:');
            Object.entries(allocations).forEach(([category, amount]) => {
                console.log(`  ${category}: ${amount} XMR (${(amount/availableBalance*100).toFixed(1)}%)`);
            });

            // Execute reinvestment (mock for now - replace with real operations)
            const results = await this.executeReinvestment(allocations);
            
            // Log reinvestment to ledger
            await this.logReinvestment(allocations, results);
            
            return {
                reinvested: true,
                totalAmount: availableBalance,
                allocations,
                results,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to process reinvestment:', error);
            throw error;
        }
    }

    async executeReinvestment(allocations) {
        const results = {};
        
        for (const [category, amount] of Object.entries(allocations)) {
            try {
                console.log(`💸 Processing ${category}: ${amount} XMR`);
                
                switch (category) {
                    case 'scale':
                        results[category] = await this.reinvestInScaling(amount);
                        break;
                    case 'infrastructure':
                        results[category] = await this.reinvestInInfrastructure(amount);
                        break;
                    case 'reserve':
                        results[category] = await this.moveToReserve(amount);
                        break;
                    default:
                        results[category] = { status: 'skipped', reason: 'unknown_category' };
                }
                
            } catch (error) {
                console.error(`❌ Failed to reinvest in ${category}:`, error);
                results[category] = { status: 'failed', error: error.message };
            }
        }
        
        return results;
    }

    async reinvestInScaling(amount) {
        console.log(`📈 Scaling investment: ${amount} XMR`);
        
        // Example scaling investments:
        // - Additional server capacity
        // - New service deployment
        // - Marketing and acquisition
        
        // For now, simulate the investment
        return {
            status: 'simulated',
            category: 'scaling',
            amount,
            investments: [
                { type: 'server_upgrade', allocation: amount * 0.4 },
                { type: 'service_expansion', allocation: amount * 0.4 },
                { type: 'marketing', allocation: amount * 0.2 }
            ],
            notes: 'Scaling investments simulated - replace with real operations'
        };
    }

    async reinvestInInfrastructure(amount) {
        console.log(`🏗️ Infrastructure investment: ${amount} XMR`);
        
        // Example infrastructure investments:
        // - Backup systems
        // - Security improvements
        // - Monitoring tools
        
        return {
            status: 'simulated',
            category: 'infrastructure',
            amount,
            investments: [
                { type: 'backup_systems', allocation: amount * 0.5 },
                { type: 'security_tools', allocation: amount * 0.3 },
                { type: 'monitoring', allocation: amount * 0.2 }
            ],
            notes: 'Infrastructure investments simulated - replace with real operations'
        };
    }

    async moveToReserve(amount) {
        console.log(`🏦 Reserve allocation: ${amount} XMR`);
        
        // Move funds to reserve wallet or cold storage
        // For now, keep in main wallet but mark as reserved
        
        return {
            status: 'reserved',
            category: 'reserve',
            amount,
            location: 'main_wallet_reserved',
            notes: 'Funds marked as emergency reserve'
        };
    }

    calculateAllocations(totalAmount, allocation) {
        return {
            scale: totalAmount * allocation.scale,
            infrastructure: totalAmount * allocation.infrastructure,
            reserve: totalAmount * allocation.reserve
        };
    }

    calculateLedgerTotal(ledger) {
        return ledger.transactions
            .filter(t => t.status === 'confirmed')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    }

    async loadLedger() {
        try {
            const data = await fs.readFile(this.ledgerFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                    transactions: []
                };
            }
            throw error;
        }
    }

    async getAllocationConfig() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            const config = JSON.parse(data);
            return { ...this.defaultAllocation, ...config.allocation };
        } catch (error) {
            console.log('📝 Using default allocation config');
            return this.defaultAllocation;
        }
    }

    async logReinvestment(allocations, results) {
        try {
            const ledger = await this.loadLedger();
            
            const reinvestmentEntry = {
                id: `reinvest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                type: 'reinvestment',
                totalAmount: Object.values(allocations).reduce((sum, amt) => sum + amt, 0),
                allocations,
                results,
                status: 'completed'
            };

            if (!ledger.reinvestments) {
                ledger.reinvestments = [];
            }
            
            ledger.reinvestments.push(reinvestmentEntry);
            ledger.lastUpdated = new Date().toISOString();

            await fs.writeFile(this.ledgerFile, JSON.stringify(ledger, null, 2));
            console.log('💾 Reinvestment logged to ledger');

        } catch (error) {
            console.error('❌ Failed to log reinvestment:', error);
        }
    }

    async generateReport() {
        try {
            console.log('📊 Generating balance report...');
            
            const balanceCheck = await this.checkBalance();
            const ledger = await this.loadLedger();
            
            const report = {
                timestamp: new Date().toISOString(),
                balance: balanceCheck,
                totalTransactions: ledger.transactions?.length || 0,
                confirmedTransactions: ledger.transactions?.filter(t => t.status === 'confirmed').length || 0,
                totalReinvestments: ledger.reinvestments?.length || 0,
                lastReinvestment: ledger.reinvestments?.slice(-1)[0] || null,
                health: {
                    balanceMatch: !balanceCheck.discrepancy,
                    hasBalance: balanceCheck.walletBalance > 0,
                    recentActivity: ledger.transactions?.some(t => {
                        const age = Date.now() - new Date(t.timestamp).getTime();
                        return age < 24 * 60 * 60 * 1000; // Last 24 hours
                    }) || false
                }
            };

            console.log('📈 Balance Report:');
            console.log(`  Wallet Balance: ${balanceCheck.walletBalance} XMR`);
            console.log(`  Ledger Total: ${balanceCheck.ledgerTotal} XMR`);
            console.log(`  Total Transactions: ${report.totalTransactions}`);
            console.log(`  Confirmed: ${report.confirmedTransactions}`);
            console.log(`  Reinvestments: ${report.totalReinvestments}`);
            console.log(`  Health: ${report.health.balanceMatch ? '✅' : '⚠️'} Balance Match`);

            return report;

        } catch (error) {
            console.error('❌ Failed to generate report:', error);
            throw error;
        }
    }

    async shutdown() {
        try {
            if (this.activeWallet) {
                await this.activeWallet.close(true);
                this.activeWallet = null;
                console.log('💾 Wallet closed safely');
            }
        } catch (error) {
            console.error('❌ Shutdown error:', error);
        }
    }
}

// CLI usage
async function main() {
    if (!process.env.WALLET_MASTER_PASSPHRASE) {
        console.error('❌ WALLET_MASTER_PASSPHRASE not set');
        process.exit(1);
    }

    const manager = new EmpireBalanceManager();
    const command = process.argv[2] || 'check';

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down balance manager...');
        await manager.shutdown();
        process.exit(0);
    });

    try {
        switch (command) {
            case 'check':
                const balance = await manager.checkBalance();
                console.log('✅ Balance check complete:', balance);
                break;
            case 'reinvest':
                const reinvestment = await manager.processReinvestment();
                console.log('✅ Reinvestment complete:', reinvestment);
                break;
            case 'report':
                const report = await manager.generateReport();
                console.log('✅ Report generated:', report);
                break;
            default:
                console.log('Usage: node balance-checker.js [check|reinvest|report]');
        }

        await manager.shutdown();

    } catch (error) {
        console.error('❌ Failed to execute command:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { EmpireBalanceManager };