// wallet-create.js - Secure Monero wallet creation for Empire system
require('dotenv').config();
const monerojs = require('monero-ts');
const { SecureEncryption } = require('./encrypt');
const fs = require('fs').promises;
const path = require('path');

class EmpireWalletCreator {
    constructor() {
        this.encryption = new SecureEncryption(process.env.WALLET_MASTER_PASSPHRASE);
        this.walletDir = process.env.WALLET_DATA_DIR || './secure-wallets';
        this.networkType = process.env.MONERO_NETWORK || 'stagenet';
    }

    async ensureWalletDirectory() {
        try {
            await fs.mkdir(this.walletDir, { recursive: true });
            await fs.chmod(this.walletDir, 0o700); // Owner read/write/execute only
        } catch (error) {
            console.error('Failed to create wallet directory:', error);
            throw error;
        }
    }

    async createWallet(walletName = 'empire-primary') {
        console.log(`🔐 Creating secure ${this.networkType} wallet: ${walletName}`);
        
        try {
            await this.ensureWalletDirectory();

            // Create wallet with monero-ts
            const wallet = await monerojs.createWalletFull({
                networkType: this.networkType,
                password: this.encryption.generateToken(16), // Random wallet password
                serverUri: this.networkType === 'stagenet' ? 
                    'http://stagenet.community.rino.io:38081' : 
                    'http://node.community.rino.io:18081'
            });

            // Get wallet details
            const mnemonic = await wallet.getSeed();
            const primaryAddress = await wallet.getPrimaryAddress();
            const privateViewKey = await wallet.getPrivateViewKey();
            const privateSpendKey = await wallet.getPrivateSpendKey();

            console.log(`✅ Wallet created successfully!`);
            console.log(`📬 Primary Address: ${primaryAddress}`);
            console.log(`🔑 Mnemonic: ${mnemonic}`);

            // Create secure wallet data structure
            const walletData = {
                name: walletName,
                networkType: this.networkType,
                primaryAddress,
                mnemonic,
                privateViewKey,
                privateSpendKey,
                createdAt: new Date().toISOString(),
                version: '1.0.0'
            };

            // Encrypt wallet data
            const encryptedWallet = this.encryption.encrypt(JSON.stringify(walletData));
            
            // Save encrypted wallet
            const walletFile = path.join(this.walletDir, `${walletName}.encrypted`);
            await fs.writeFile(walletFile, JSON.stringify(encryptedWallet, null, 2));
            await fs.chmod(walletFile, 0o600); // Owner read/write only

            console.log(`💾 Encrypted wallet saved to: ${walletFile}`);

            // Save address for quick access (not encrypted - public info)
            const addressFile = path.join(this.walletDir, `${walletName}.address`);
            await fs.writeFile(addressFile, primaryAddress);

            // Close wallet (don't save as we handle persistence ourselves)
            await wallet.close(false); // false = don't save

            return {
                success: true,
                walletName,
                primaryAddress,
                walletFile,
                networkType: this.networkType,
                mnemonic: mnemonic // Return for backup purposes
            };

        } catch (error) {
            console.error('❌ Wallet creation failed:', error);
            throw error;
        }
    }

    async loadWallet(walletName = 'empire-primary') {
        try {
            const walletFile = path.join(this.walletDir, `${walletName}.encrypted`);
            const encryptedData = JSON.parse(await fs.readFile(walletFile, 'utf8'));
            const decryptedData = this.encryption.decrypt(encryptedData);
            return JSON.parse(decryptedData);
        } catch (error) {
            throw new Error(`Failed to load wallet ${walletName}: ${error.message}`);
        }
    }

    async getAddress(walletName = 'empire-primary') {
        try {
            const addressFile = path.join(this.walletDir, `${walletName}.address`);
            return await fs.readFile(addressFile, 'utf8');
        } catch (error) {
            // Fallback to loading from encrypted wallet
            const walletData = await this.loadWallet(walletName);
            return walletData.primaryAddress;
        }
    }

    async listWallets() {
        try {
            const files = await fs.readdir(this.walletDir);
            return files
                .filter(f => f.endsWith('.encrypted'))
                .map(f => f.replace('.encrypted', ''));
        } catch (error) {
            return [];
        }
    }
}

// CLI usage
async function main() {
    if (!process.env.WALLET_MASTER_PASSPHRASE) {
        console.error('❌ WALLET_MASTER_PASSPHRASE not set in environment');
        process.exit(1);
    }

    const creator = new EmpireWalletCreator();
    const walletName = process.argv[2] || 'empire-primary';

    try {
        const result = await creator.createWallet(walletName);
        
        console.log('\n🎯 WALLET CREATION COMPLETE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Wallet Name: ${result.walletName}`);
        console.log(`Network: ${result.networkType}`);
        console.log(`Address: ${result.primaryAddress}`);
        console.log(`File: ${result.walletFile}`);
        console.log('\n⚠️  CRITICAL SECURITY NOTES:');
        console.log('1. BACKUP YOUR MNEMONIC OFFLINE IMMEDIATELY');
        console.log('2. Store master passphrase separately from wallet file');
        console.log('3. Test with small amounts on stagenet first');
        console.log('4. Never share private keys or mnemonic');
        console.log('\n💰 Ready for real income generation!');

    } catch (error) {
        console.error('❌ Failed to create wallet:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { EmpireWalletCreator };