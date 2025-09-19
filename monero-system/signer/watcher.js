// watcher.js - Transaction monitoring and confirmation system
require('dotenv').config();
const { EmpireWalletCreator } = require('./wallet-create');
const { SecureEncryption } = require('./encrypt');
const fs = require('fs').promises;
const path = require('path');

class EmpireTransactionWatcher {
    constructor() {
        this.walletCreator = new EmpireWalletCreator();
        this.encryption = new SecureEncryption(process.env.WALLET_MASTER_PASSPHRASE);
        this.ledgerFile = path.join(__dirname, '../ledger/empire-ledger.json');
        this.lastCheckFile = path.join(__dirname, '../ledger/last-check.json');
        this.activeWallet = null;
        this.isRunning = false;
        this.checkInterval = 60000; // Check every minute
        this.requiredConfirmations = 10;
    }

    async initialize() {
        try {
            console.log('🔍 Initializing transaction watcher...');
            
            // Ensure ledger directory exists
            await fs.mkdir(path.dirname(this.ledgerFile), { recursive: true });
            
            // Load wallet for monitoring
            const walletData = await this.walletCreator.loadWallet('empire-primary');
            
            const monerojs = require('monero-ts');
            this.activeWallet = await monerojs.createWalletFull({
                networkType: walletData.networkType,
                mnemonic: walletData.mnemonic,
                serverUri: walletData.networkType === 'stagenet' ? 
                    'http://stagenet.community.rino.io:38081' : 
                    'http://node.community.rino.io:18081'
            });

            console.log(`✅ Watcher initialized for ${walletData.networkType}`);
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize watcher:', error);
            throw error;
        }
    }

    async startWatching() {
        if (this.isRunning) {
            console.log('⚠️ Watcher already running');
            return;
        }

        await this.initialize();
        this.isRunning = true;
        
        console.log(`🔍 Starting transaction watcher (${this.checkInterval/1000}s intervals)`);
        console.log(`⏳ Required confirmations: ${this.requiredConfirmations}`);
        
        this.watchLoop();
    }

    async watchLoop() {
        while (this.isRunning) {
            try {
                await this.checkForNewTransactions();
                await this.sleep(this.checkInterval);
            } catch (error) {
                console.error('❌ Error in watch loop:', error);
                await this.sleep(this.checkInterval * 2); // Back off on error
            }
        }
    }

    async checkForNewTransactions() {
        try {
            console.log('🔍 Checking for new transactions...');
            
            if (!this.activeWallet) {
                throw new Error('Wallet not loaded');
            }

            // Get incoming transfers
            const transfers = await this.activeWallet.getIncomingTransfers();
            const lastCheck = await this.getLastCheckTime();
            
            let newTransactions = 0;
            let confirmedTransactions = 0;

            for (const transfer of transfers) {
                const tx = transfer.getTx();
                const txId = tx.getId();
                const amount = transfer.getAmount();
                const confirmations = tx.getNumConfirmations();
                const receivedTime = tx.getReceivedTimestamp() * 1000; // Convert to ms
                
                // Skip old transactions
                if (receivedTime <= lastCheck) {
                    continue;
                }

                console.log(`📨 Processing transaction: ${txId}`);
                console.log(`💰 Amount: ${amount} XMR`);
                console.log(`⏳ Confirmations: ${confirmations}/${this.requiredConfirmations}`);

                // Check if transaction is already in ledger
                const existingEntry = await this.findLedgerEntry(txId);
                
                if (!existingEntry) {
                    // New transaction - add to ledger as pending
                    await this.addToLedger({
                        txId,
                        amount: amount.toString(),
                        confirmations,
                        receivedTime,
                        status: confirmations >= this.requiredConfirmations ? 'confirmed' : 'pending',
                        source: 'auto_detected',
                        network: process.env.MONERO_NETWORK || 'stagenet'
                    });
                    
                    newTransactions++;
                    console.log(`📝 Added new transaction to ledger: ${txId}`);
                }
                
                // Update confirmation status if needed
                if (confirmations >= this.requiredConfirmations && (!existingEntry || existingEntry.status === 'pending')) {
                    await this.confirmTransaction(txId, confirmations);
                    confirmedTransactions++;
                    console.log(`✅ Confirmed transaction: ${txId} (${confirmations} confirmations)`);
                }
            }

            // Update last check time
            await this.updateLastCheckTime();

            console.log(`📊 Check complete: ${newTransactions} new, ${confirmedTransactions} confirmed`);

            // Trigger balance reconciliation if there were changes
            if (newTransactions > 0 || confirmedTransactions > 0) {
                await this.reconcileBalance();
                await this.notifyIncome(newTransactions, confirmedTransactions);
            }

        } catch (error) {
            console.error('❌ Failed to check transactions:', error);
        }
    }

    async addToLedger(transaction) {
        try {
            const ledger = await this.loadLedger();
            
            const entry = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                ...transaction,
                addedAt: new Date().toISOString(),
                version: '1.0.0'
            };

            ledger.transactions.push(entry);
            ledger.lastUpdated = new Date().toISOString();
            ledger.totalTransactions = ledger.transactions.length;

            await this.saveLedger(ledger);
            console.log(`💾 Transaction added to ledger: ${transaction.txId}`);

        } catch (error) {
            console.error('❌ Failed to add to ledger:', error);
            throw error;
        }
    }

    async confirmTransaction(txId, confirmations) {
        try {
            const ledger = await this.loadLedger();
            const entry = ledger.transactions.find(t => t.txId === txId);
            
            if (entry) {
                entry.status = 'confirmed';
                entry.confirmations = confirmations;
                entry.confirmedAt = new Date().toISOString();
                
                await this.saveLedger(ledger);
                console.log(`✅ Transaction confirmed in ledger: ${txId}`);
            }

        } catch (error) {
            console.error('❌ Failed to confirm transaction:', error);
        }
    }

    async reconcileBalance() {
        try {
            console.log('🔄 Reconciling balance...');
            
            const walletBalance = await this.activeWallet.getBalance();
            const ledger = await this.loadLedger();
            
            const ledgerTotal = ledger.transactions
                .filter(t => t.status === 'confirmed')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);

            const difference = parseFloat(walletBalance.toString()) - ledgerTotal;
            
            console.log(`💰 Wallet balance: ${walletBalance} XMR`);
            console.log(`📊 Ledger total: ${ledgerTotal} XMR`);
            console.log(`📈 Difference: ${difference} XMR`);

            if (Math.abs(difference) > 0.001) { // Allow small rounding differences
                console.warn(`⚠️ Balance mismatch detected: ${difference} XMR`);
                // Could trigger alert or investigation here
            }

            // Update ledger with reconciliation info
            ledger.lastReconciliation = {
                timestamp: new Date().toISOString(),
                walletBalance: walletBalance.toString(),
                ledgerTotal: ledgerTotal.toString(),
                difference: difference.toString()
            };

            await this.saveLedger(ledger);

        } catch (error) {
            console.error('❌ Failed to reconcile balance:', error);
        }
    }

    async notifyIncome(newCount, confirmedCount) {
        try {
            console.log(`📧 Income notification: ${newCount} new, ${confirmedCount} confirmed`);
            
            // This could send notifications to dashboard, webhook, etc.
            // For now, just log the event
            
            const notification = {
                timestamp: new Date().toISOString(),
                type: 'income_update',
                newTransactions: newCount,
                confirmedTransactions: confirmedCount,
                wallet: 'empire-primary',
                network: process.env.MONERO_NETWORK || 'stagenet'
            };

            // Could store notifications or send to external systems
            console.log('📨 Notification prepared:', notification);

        } catch (error) {
            console.error('❌ Failed to send notification:', error);
        }
    }

    async loadLedger() {
        try {
            const data = await fs.readFile(this.ledgerFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Create new ledger
                const newLedger = {
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    network: process.env.MONERO_NETWORK || 'stagenet',
                    wallet: 'empire-primary',
                    transactions: [],
                    totalTransactions: 0
                };
                await this.saveLedger(newLedger);
                return newLedger;
            }
            throw error;
        }
    }

    async saveLedger(ledger) {
        await fs.writeFile(this.ledgerFile, JSON.stringify(ledger, null, 2));
        await fs.chmod(this.ledgerFile, 0o600); // Owner read/write only
    }

    async findLedgerEntry(txId) {
        const ledger = await this.loadLedger();
        return ledger.transactions.find(t => t.txId === txId);
    }

    async getLastCheckTime() {
        try {
            const data = await fs.readFile(this.lastCheckFile, 'utf8');
            const parsed = JSON.parse(data);
            return parsed.lastCheck || 0;
        } catch (error) {
            return 0; // Start from beginning if no previous check
        }
    }

    async updateLastCheckTime() {
        const data = {
            lastCheck: Date.now(),
            timestamp: new Date().toISOString()
        };
        await fs.writeFile(this.lastCheckFile, JSON.stringify(data, null, 2));
    }

    async stopWatching() {
        console.log('🛑 Stopping transaction watcher...');
        this.isRunning = false;
        
        if (this.activeWallet) {
            await this.activeWallet.close(true);
            this.activeWallet = null;
        }
        
        console.log('✅ Watcher stopped');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI usage
async function main() {
    if (!process.env.WALLET_MASTER_PASSPHRASE) {
        console.error('❌ WALLET_MASTER_PASSPHRASE not set');
        process.exit(1);
    }

    const watcher = new EmpireTransactionWatcher();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down watcher...');
        await watcher.stopWatching();
        process.exit(0);
    });

    try {
        await watcher.startWatching();
    } catch (error) {
        console.error('❌ Failed to start watcher:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { EmpireTransactionWatcher };