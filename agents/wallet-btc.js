// 🔐 Real Bitcoin (Testnet/Mainnet) Wallet Generator (BIP39 + BIP32 + bitcoinjs-lib)
// Provides deterministic mnemonic-based key derivation. Default network: testnet.
// Exports createWallet (generic) and createBTCWallet (alias) returning a unified shape.

const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
bitcoin.initEccLib(ecc);
// bip32 v5 uses a factory requiring an ECC library
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);
const bip39 = require('bip39');

/**
 * Derive a wallet using BIP44 path. For testnet we use coin type 1', for mainnet 0'.
 * @param {string} networkName 'testnet' | 'mainnet'
 */
function createWallet(networkName = 'testnet') {
  const isMainnet = networkName === 'mainnet';
  const network = isMainnet ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  // 128 bits entropy -> 12 word mnemonic (sufficient for test usage). Can raise to 256 later if desired.
  const mnemonic = bip39.generateMnemonic(128);
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, network);
  // BIP44 path: m / 44' / coin_type' / account' / change / address_index
  const coinType = isMainnet ? 0 : 1; // 0 for BTC mainnet, 1 for testnet in BIP44 registry
  const account = root.derivePath(`m/44'/${coinType}'/0'/0/0`);
  const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(account.publicKey), network });

  return {
    type: isMainnet ? 'BTC_MAINNET' : 'BTC_TESTNET',
    network: networkName,
    address,
    mnemonic,
    wif: account.toWIF(),
    created_at: new Date().toISOString()
  };
}

// Backwards compatible alias used by crypto-ledger (first implementation)
function createBTCWallet(networkName = 'testnet') {
  return createWallet(networkName);
}

module.exports = { createWallet, createBTCWallet };