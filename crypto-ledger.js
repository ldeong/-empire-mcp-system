#!/usr/bin/env node
/**
 * 🏦 SINA Empire Crypto Ledger & Wallet System
 * Bankless internal financial layer: local wallets, encrypted keys, JSON/D1 ledger, reinvestment engine.
 * Purely local (or KV/D1 adaptable) – no external banking dependencies.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let btcSupport = null;
try {
  btcSupport = require('./agents/wallet-btc');
} catch (e) {
  // Optional dependency not installed yet
}

// ========= Configuration =========
const LEDGER_FILE = process.env.LOCAL_LEDGER_FILE || './data/empire-ledger.json';
const WALLETS_DIR = './data/wallets';
const MASTER_PASSPHRASE = process.env.WALLET_MASTER_PASSPHRASE || 'CHANGE_ME';
const ALLOWED_CURRENCIES = (process.env.LEDGER_ALLOWED_CURRENCIES || 'USDT,BTC,MONERO,STABLE_CREDITS').split(',');
const REINVEST = {
  SCALE: parseInt(process.env.REINVEST_SCALE_PERCENT || '60'),
  INFRA: parseInt(process.env.REINVEST_INFRA_PERCENT || '30'),
  RESERVE: parseInt(process.env.REINVEST_RESERVE_PERCENT || '10'),
  THRESHOLD: parseInt(process.env.REINVEST_MIN_THRESHOLD || '25')
};

ensureDir(path.dirname(LEDGER_FILE));
ensureDir(WALLETS_DIR);
initializeLedger();

// ========= Core Functions =========
function ensureDir(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); }

function initializeLedger(){
  if(!fs.existsSync(LEDGER_FILE)){
    fs.writeFileSync(LEDGER_FILE, JSON.stringify({
      version: 1,
      created_at: new Date().toISOString(),
      wallets: {},
      transactions: [],
      balances: {},
      reinvestment_history: [],
      audit: []
    },null,2));
  }
}

function readLedger(){ return JSON.parse(fs.readFileSync(LEDGER_FILE,'utf8')); }
function writeLedger(data){ fs.writeFileSync(LEDGER_FILE, JSON.stringify(data,null,2)); }

// ========= Wallet Management =========
function generateWallet(currency='USDT', label='generic_agent', options={}){
  if(!ALLOWED_CURRENCIES.includes(currency)) throw new Error(`Currency not allowed: ${currency}`);
  const ledger = readLedger();
  const id = `${currency.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

  let walletCore;
  let exportPayload = {};

  if(currency === 'BTC') {
    try {
      const { createBTCWallet } = require('./agents/wallet-btc');
      walletCore = createBTCWallet(process.env.BTC_NETWORK || 'testnet');
      exportPayload = {
        mnemonic: encryptPrivateKey(walletCore.mnemonic),
        wif: encryptPrivateKey(walletCore.wif)
      };
    } catch (e) {
      walletCore = simulatedKeypair();
    }
  } else if (currency === 'MONERO') {
    try {
      const { createMoneroWallet } = require('./agents/wallet-monero');
      walletCore = createMoneroWallet();
      exportPayload = { private_blob: encryptPrivateKey(walletCore.private_blob) };
    } catch (e) {
      walletCore = simulatedKeypair();
    }
  } else {
    walletCore = simulatedKeypair();
  }

  const encrypted = encryptPrivateKey(walletCore.private || walletCore.seed || walletCore.mnemonic || walletCore.address);

  const walletMeta = {
    id,
    label,
    currency,
    public_address: walletCore.address || walletCore.public || walletCore.public_address,
    encrypted_key: encrypted.data,
    iv: encrypted.iv,
    provider: walletCore.type || 'SIM',
    created_at: new Date().toISOString(),
    balance: 0,
    extra: exportPayload
  };

  ledger.wallets[id] = walletMeta;
  ledger.balances[currency] = ledger.balances[currency] || 0;
  audit(ledger, `Wallet created: ${id} (${currency}) provider=${walletMeta.provider}`);
  writeLedger(ledger);

  fs.writeFileSync(path.join(WALLETS_DIR, `${id}.wallet.json`), JSON.stringify(walletMeta,null,2));
  return walletMeta;
}

function simulatedKeypair(){
  const privateKey = crypto.randomBytes(32).toString('hex');
  const publicKey = crypto.createHash('sha256').update(privateKey).digest('hex').slice(0,42);
  return { type:'SIM', private: privateKey, address: publicKey };
}

function encryptPrivateKey(pk){
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(MASTER_PASSPHRASE).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(pk,'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), data: Buffer.concat([enc, tag]).toString('hex') };
}

function decryptPrivateKey(ivHex, dataHex){
  const iv = Buffer.from(ivHex,'hex');
  const raw = Buffer.from(dataHex,'hex');
  const tag = raw.slice(raw.length-16);
  const enc = raw.slice(0, raw.length-16);
  const key = crypto.createHash('sha256').update(MASTER_PASSPHRASE).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

// ========= Transaction Logging =========
function logTransaction({agent, amount, currency, status='earned', wallet_id, meta={}}){
  if(amount <= 0) throw new Error('Amount must be > 0');
  const ledger = readLedger();
  if(!ledger.wallets[wallet_id]) throw new Error('Wallet not found');
  if(!ALLOWED_CURRENCIES.includes(currency)) throw new Error('Unsupported currency');

  const tx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    agent,
    wallet_id,
    currency,
    amount,
    status,
    meta,
    timestamp: new Date().toISOString()
  };

  ledger.transactions.push(tx);
  ledger.wallets[wallet_id].balance += amount;
  ledger.balances[currency] = (ledger.balances[currency] || 0) + amount;

  audit(ledger, `Transaction logged: ${tx.id} +${amount} ${currency} (${agent})`);
  writeLedger(ledger);
  return tx;
}

// ========= Reinvestment Engine =========
function evaluateReinvestment(){
  const ledger = readLedger();
  // Aggregate stable credits equivalent – map all currencies naïvely 1:1 for simulation
  const total = Object.values(ledger.balances).reduce((a,b)=>a+b,0);
  if(total < REINVEST.THRESHOLD){
    return { executed:false, reason:'threshold_not_met', total };
  }

  const allocation = {
    scale: +(total * (REINVEST.SCALE/100)).toFixed(2),
    infra: +(total * (REINVEST.INFRA/100)).toFixed(2),
    reserve: +(total * (REINVEST.RESERVE/100)).toFixed(2)
  };
  const reinvestRecord = {
    id: `reinv_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    total,
    allocation,
    policy: { ...REINVEST },
    timestamp: new Date().toISOString(),
    actions: [
      { type:'spawn_agents', budget: allocation.scale, status:'planned' },
      { type:'infra_resources', budget: allocation.infra, status:'planned' },
      { type:'reserve_treasury', budget: allocation.reserve, status:'scheduled' }
    ]
  };

  ledger.reinvestment_history.push(reinvestRecord);
  audit(ledger, `Reinvestment cycle created: ${reinvestRecord.id}`);
  writeLedger(ledger);
  return { executed:true, reinvestRecord };
}

// ========= Reporting =========
function summary(){
  const ledger = readLedger();
  return {
    created_at: ledger.created_at,
    wallet_count: Object.keys(ledger.wallets).length,
    total_transactions: ledger.transactions.length,
    balances: ledger.balances,
    last_reinvestment: ledger.reinvestment_history.slice(-1)[0] || null
  };
}

function audit(ledger, message){
  ledger.audit.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
    message,
    timestamp: new Date().toISOString()
  });
  // Trim
  if(ledger.audit.length > 1000){
    ledger.audit = ledger.audit.slice(-800);
  }
}

// ========= CLI Interface =========
async function main(){
  const [,, cmd, ...args] = process.argv;
  try {
    switch(cmd){
      case 'wallet:create': {
        const currency = args[0] || 'USDT';
        const label = args[1] || 'agent_wallet';
        if(currency.toUpperCase() === 'BTC' && btcSupport){
          const real = btcSupport.createWallet('testnet');
          // Wrap into existing wallet record format
          const ledger = readLedger();
          const id = `btc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
          const encrypted = encryptPrivateKey(real.wif);
          const walletMeta = {
            id,
            label,
            currency: 'BTC',
            public_address: real.address,
            encrypted_key: encrypted.data,
            iv: encrypted.iv,
            mnemonic_encrypted: encryptPrivateKey(real.mnemonic).data,
            network: real.network,
            created_at: new Date().toISOString(),
            balance: 0,
            real_chain: true
          };
          ledger.wallets[id] = walletMeta;
          ledger.balances['BTC'] = ledger.balances['BTC'] || 0;
          audit(ledger, `Real BTC testnet wallet created: ${id}`);
          writeLedger(ledger);
          fs.writeFileSync(path.join(WALLETS_DIR, `${id}.wallet.json`), JSON.stringify(walletMeta,null,2));
          console.log('✅ BTC Testnet Wallet created:', walletMeta);
        } else {
          const w = generateWallet(currency, label);
          console.log('✅ Wallet created:', w);
        }
        break;
      }
      case 'wallet:show': {
        const id = args[0];
        if(!id) throw new Error('Provide wallet id');
        const ledger = readLedger();
        console.log(ledger.wallets[id] || 'Not found');
        break;
      }
      case 'tx:add': {
        const [wallet_id, amountStr, currency='USDT', agent='generic_agent'] = args;
        const amount = parseFloat(amountStr);
        const tx = logTransaction({agent, amount, currency, wallet_id});
        console.log('✅ Transaction logged:', tx);
        break;
      }
      case 'reinvest:evaluate': {
        const result = evaluateReinvestment();
        console.log('🔁 Reinvestment evaluation:', result);
        break;
      }
      case 'summary': {
        console.log('📊 Ledger Summary:', summary());
        break;
      }
      case 'decrypt:key': {
        const id = args[0];
        const ledger = readLedger();
        if(!ledger.wallets[id]) throw new Error('Wallet not found');
        const { iv, encrypted_key } = ledger.wallets[id];
        const pk = decryptPrivateKey(iv, encrypted_key);
        console.log(`🔐 Private Key (DO NOT SHARE): ${pk}`);
        break;
      }
      default:
        console.log(`
🏦 SINA Empire Crypto Ledger CLI
Commands:
  wallet:create [currency] [label]   Create new wallet (supports: USDT, BTC, MONERO, STABLE_CREDITS)
  wallet:show <wallet_id>            Show wallet metadata
  tx:add <wallet_id> <amount> [currency] [agent]  Log earning transaction
  reinvest:evaluate                  Run reinvestment policy cycle
  summary                            Show ledger summary
  decrypt:key <wallet_id>            Decrypt a wallet's private key (development only)

Env Vars:
  WALLET_MASTER_PASSPHRASE, LEDGER_ALLOWED_CURRENCIES, REINVEST_* percentages, LOCAL_LEDGER_FILE
`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

if(require.main === module){
  main();
}

module.exports = { generateWallet, logTransaction, evaluateReinvestment, summary };
