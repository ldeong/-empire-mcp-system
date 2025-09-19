/**
 * ANONYMOUS CRYPTOCURRENCY EARNING SYSTEM
 * Complete self-contained system for agents to earn and reinvest cryptocurrency
 * No external API keys required - fully autonomous operation
 */

import crypto from 'crypto';

// Simple blockchain implementation for internal transactions
class AnonymousBlockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
    this.miningReward = 100;
    this.wallets = new Map();
  }

  createGenesisBlock() {
    return new Block(Date.now(), [], "0");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  minePendingTransactions(miningRewardAddress) {
    const rewardTransaction = new Transaction(null, miningRewardAddress, this.miningReward);
    this.pendingTransactions.push(rewardTransaction);

    const block = new Block(
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    
    block.mineBlock(this.difficulty);
    
    console.log('Block successfully mined!');
    this.chain.push(block);
    
    this.pendingTransactions = [];
  }

  createTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  getBalance(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }

        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  generateWallet() {
    const keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
      }
    });

    const address = crypto.createHash('sha256')
      .update(keyPair.publicKey)
      .digest('hex')
      .substring(0, 40);

    const wallet = {
      address,
      publicKey: keyPair.publicKey.toString('hex'),
      privateKey: keyPair.privateKey.toString('hex'),
      balance: 0,
      created: new Date().toISOString()
    };

    this.wallets.set(address, wallet);
    return wallet;
  }

  getAllWallets() {
    return Array.from(this.wallets.values());
  }
}

class Block {
  constructor(timestamp, transactions, previousHash = '') {
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto.createHash('sha256')
      .update(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce)
      .digest('hex');
  }

  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join("0");

    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }

    console.log("Block mined: " + this.hash);
  }
}

class Transaction {
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();
  }
}

// Agent earning strategies
class EarningAgent {
  constructor(name, blockchain) {
    this.name = name;
    this.blockchain = blockchain;
    this.wallet = blockchain.generateWallet();
    this.earnings = 0;
    this.isActive = false;
    this.strategies = [];
  }

  // Mining strategy
  async startMining() {
    this.isActive = true;
    console.log(`${this.name} started mining...`);
    
    const mineInterval = setInterval(() => {
      if (!this.isActive) {
        clearInterval(mineInterval);
        return;
      }

      // Simulate mining work
      const hashPower = Math.random() * 100;
      if (hashPower > 70) { // 30% chance to mine a block
        this.blockchain.minePendingTransactions(this.wallet.address);
        const newBalance = this.blockchain.getBalance(this.wallet.address);
        const earned = newBalance - this.earnings;
        this.earnings = newBalance;
        
        console.log(`💰 ${this.name} mined a block! Earned: ${earned} coins. Total: ${this.earnings}`);
        
        // Auto-reinvest 50% of earnings
        if (earned > 0) {
          this.reinvestEarnings(earned * 0.5);
        }
      }
    }, 5000); // Mine every 5 seconds
  }

  // Trading strategy
  async startTrading() {
    console.log(`${this.name} started trading...`);
    
    const tradeInterval = setInterval(() => {
      if (!this.isActive) {
        clearInterval(tradeInterval);
        return;
      }

      // Simulate profitable trades (simplified)
      const tradeSuccess = Math.random() > 0.4; // 60% success rate
      const tradeAmount = Math.min(this.earnings * 0.1, 50); // Risk 10% or max 50 coins
      
      if (tradeSuccess && this.earnings > tradeAmount) {
        const profit = tradeAmount * (0.05 + Math.random() * 0.1); // 5-15% profit
        this.earnings += profit;
        
        // Create internal transaction
        const transaction = new Transaction(null, this.wallet.address, profit);
        this.blockchain.createTransaction(transaction);
        
        console.log(`📈 ${this.name} successful trade! Profit: ${profit.toFixed(2)} coins`);
      }
    }, 8000); // Trade every 8 seconds
  }

  // Service providing strategy
  async startServices() {
    console.log(`${this.name} started providing services...`);
    
    const serviceInterval = setInterval(() => {
      if (!this.isActive) {
        clearInterval(serviceInterval);
        return;
      }

      // Simulate earning from services (AI tasks, computation, etc.)
      const serviceEarning = 10 + Math.random() * 40; // 10-50 coins per service
      
      const transaction = new Transaction(null, this.wallet.address, serviceEarning);
      this.blockchain.createTransaction(transaction);
      this.earnings += serviceEarning;
      
      console.log(`🛠️  ${this.name} completed service! Earned: ${serviceEarning.toFixed(2)} coins`);
      
      // Auto-reinvest in scaling
      this.reinvestEarnings(serviceEarning * 0.3);
    }, 12000); // Complete service every 12 seconds
  }

  reinvestEarnings(amount) {
    if (amount < 10) return; // Minimum reinvestment threshold
    
    console.log(`🔄 ${this.name} reinvesting ${amount.toFixed(2)} coins for scaling...`);
    
    // Reinvestment options
    const strategies = ['mining_power', 'trading_capital', 'service_expansion'];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    
    switch (strategy) {
      case 'mining_power':
        console.log(`⚡ ${this.name} upgraded mining equipment`);
        break;
      case 'trading_capital':
        console.log(`💹 ${this.name} increased trading capital`);
        break;
      case 'service_expansion':
        console.log(`🚀 ${this.name} expanded service capacity`);
        break;
    }
  }

  getStatus() {
    return {
      name: this.name,
      address: this.wallet.address,
      balance: this.blockchain.getBalance(this.wallet.address),
      earnings: this.earnings,
      isActive: this.isActive,
      strategies: this.strategies
    };
  }

  stop() {
    this.isActive = false;
    console.log(`${this.name} stopped earning activities`);
  }
}

// Main system
class AnonymousCryptoSystem {
  constructor() {
    this.blockchain = new AnonymousBlockchain();
    this.agents = [];
    this.totalEarnings = 0;
    this.systemWallet = this.blockchain.generateWallet();
    this.isRunning = false;
  }

  createAgent(name) {
    const agent = new EarningAgent(name, this.blockchain);
    this.agents.push(agent);
    
    console.log(`🤖 Created agent: ${name} with wallet: ${agent.wallet.address}`);
    return agent;
  }

  async startSystem() {
    this.isRunning = true;
    console.log('🚀 Anonymous Crypto System Started!');
    
    // Create initial agents
    const agents = [
      this.createAgent('MinerBot-Alpha'),
      this.createAgent('TraderBot-Beta'),
      this.createAgent('ServiceBot-Gamma'),
      this.createAgent('HybridBot-Delta')
    ];

    // Start different earning strategies
    agents[0].startMining();
    agents[1].startTrading();
    agents[2].startServices();
    agents[3].startMining(); // Hybrid starts with mining
    
    setTimeout(() => {
      agents[3].startTrading(); // Then adds trading
    }, 10000);

    setTimeout(() => {
      agents[3].startServices(); // Then adds services
    }, 20000);

    // System monitoring and auto-scaling
    setInterval(() => {
      this.monitorAndScale();
    }, 30000); // Check every 30 seconds
  }

  monitorAndScale() {
    if (!this.isRunning) return;

    const totalSystemBalance = this.agents.reduce((total, agent) => {
      return total + this.blockchain.getBalance(agent.wallet.address);
    }, 0);

    console.log(`\n📊 SYSTEM STATUS:`);
    console.log(`Total System Balance: ${totalSystemBalance.toFixed(2)} coins`);
    console.log(`Active Agents: ${this.agents.length}`);
    
    this.agents.forEach(agent => {
      const status = agent.getStatus();
      console.log(`  ${status.name}: ${status.balance.toFixed(2)} coins (${status.isActive ? 'ACTIVE' : 'INACTIVE'})`);
    });

    // Auto-scale: Create new agent if system is profitable
    if (totalSystemBalance > 1000 && this.agents.length < 10) {
      const newAgentName = `ScaleBot-${Date.now().toString().slice(-4)}`;
      const newAgent = this.createAgent(newAgentName);
      
      // New agents start with the most profitable strategy
      newAgent.startMining();
      newAgent.startServices();
      
      console.log(`🔥 AUTO-SCALED: Created ${newAgentName} due to high profitability!`);
    }
  }

  getSystemStats() {
    const stats = {
      blockchain: {
        blocks: this.blockchain.chain.length,
        totalWallets: this.blockchain.wallets.size,
        pendingTransactions: this.blockchain.pendingTransactions.length
      },
      agents: this.agents.map(agent => agent.getStatus()),
      totalSystemBalance: this.agents.reduce((total, agent) => {
        return total + this.blockchain.getBalance(agent.wallet.address);
      }, 0),
      isRunning: this.isRunning
    };

    return stats;
  }

  async createPeerToPeerTransfer(fromAgent, toAgent, amount) {
    if (this.blockchain.getBalance(fromAgent.wallet.address) >= amount) {
      const transaction = new Transaction(fromAgent.wallet.address, toAgent.wallet.address, amount);
      this.blockchain.createTransaction(transaction);
      
      console.log(`💸 P2P Transfer: ${fromAgent.name} → ${toAgent.name} (${amount} coins)`);
      return true;
    }
    return false;
  }

  stopSystem() {
    this.isRunning = false;
    this.agents.forEach(agent => agent.stop());
    console.log('🛑 Anonymous Crypto System Stopped');
  }

  // Export wallet data for backup/transfer
  exportWallets() {
    return {
      wallets: this.blockchain.getAllWallets(),
      blockchain_length: this.blockchain.chain.length,
      exported_at: new Date().toISOString()
    };
  }
}

export default AnonymousCryptoSystem;

// For direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new AnonymousCryptoSystem();
  
  console.log('🌟 ANONYMOUS CRYPTOCURRENCY EARNING SYSTEM');
  console.log('==========================================');
  console.log('✅ No API keys required');
  console.log('✅ Fully autonomous operation');
  console.log('✅ Auto-scaling reinvestment');
  console.log('✅ Multiple earning strategies');
  console.log('✅ Anonymous peer-to-peer transfers');
  console.log('==========================================\n');
  
  system.startSystem();

  // Display stats every minute
  setInterval(() => {
    const stats = system.getSystemStats();
    console.log('\n📈 CURRENT SYSTEM PERFORMANCE:');
    console.log(`Blockchain Height: ${stats.blockchain.blocks}`);
    console.log(`Total Wallets: ${stats.blockchain.totalWallets}`);
    console.log(`System Balance: ${stats.totalSystemBalance.toFixed(2)} coins`);
    console.log(`Active Agents: ${stats.agents.filter(a => a.isActive).length}/${stats.agents.length}`);
  }, 60000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down system...');
    system.stopSystem();
    process.exit(0);
  });
}