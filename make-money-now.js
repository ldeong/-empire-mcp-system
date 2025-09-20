#!/usr/bin/env node
/**
 * INSTANT MONEY MAKER - SINA Empire Quick Launcher
 * 
 * One command to activate the entire money-making ecosystem
 * 
 * Usage: node make-money-now.js
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');

console.log('💰 SINA EMPIRE - INSTANT MONEY MAKER ACTIVATED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function activateMoneyMachine() {
  const steps = [
    { name: 'Starting Master Agent', action: () => startMasterAgent() },
    { name: 'Launching Hive Mind', action: () => startHiveMind() },
    { name: 'Activating Payment Monitor', action: () => startPaymentMonitor() },
    { name: 'Launching Escrow Services', action: () => startEscrowServices() },
    { name: 'Generating Micro Offers', action: () => generateOffers() },
    { name: 'Ready to Make Money', action: () => showReadyMessage() }
  ];

  for (const step of steps) {
    console.log(`⚡ ${step.name}...`);
    try {
      await step.action();
      console.log(`✅ ${step.name} - COMPLETE`);
    } catch (error) {
      console.log(`⚠️  ${step.name} - ${error.message}`);
    }
    await delay(1000);
  }
}

function startMasterAgent() {
  return new Promise((resolve) => {
    const master = spawn('node', ['master-agent.js', 'start'], { 
      detached: true,
      stdio: 'ignore'
    });
    master.unref();
    setTimeout(resolve, 2000);
  });
}

function startHiveMind() {
  return new Promise((resolve) => {
    const hive = spawn('node', ['sina-hive-mind.js', 'start'], {
      detached: true, 
      stdio: 'ignore'
    });
    hive.unref();
    setTimeout(resolve, 2000);
  });
}

function startPaymentMonitor() {
  return new Promise((resolve) => {
    const monitor = spawn('node', ['simple-payment-monitor.js'], {
      detached: true,
      stdio: 'ignore'
    });
    monitor.unref();
    setTimeout(resolve, 1000);
  });
}

function startEscrowServices() {
  return new Promise((resolve) => {
    // Start micro escrow
    const micro = spawn('node', ['instant-escrow-system.js'], {
      detached: true,
      stdio: 'ignore'
    });
    micro.unref();

    // Start enterprise escrow  
    const enterprise = spawn('node', ['enterprise-escrow-system.js'], {
      detached: true,
      stdio: 'ignore'
    });
    enterprise.unref();
    
    setTimeout(resolve, 1500);
  });
}

function generateOffers() {
  return new Promise((resolve) => {
    const offers = [
      { service: '15-min Security Audit', price: '$25', platform: 'Reddit r/forhire' },
      { service: 'Quick Bug Fix', price: '$50', platform: 'Discord freelance' },
      { service: 'API Integration', price: '$75', platform: 'Twitter DM' },
      { service: 'Code Review Express', price: '$35', platform: 'LinkedIn' },
      { service: 'Performance Optimization', price: '$100', platform: 'Upwork' }
    ];

    console.log('\n🎯 MICRO OFFERS GENERATED:');
    offers.forEach((offer, i) => {
      console.log(`   ${i+1}. ${offer.service} - ${offer.price} (${offer.platform})`);
    });

    // Save offers to file
    fs.writeFileSync('./active-offers.json', JSON.stringify(offers, null, 2));
    resolve();
  });
}

function showReadyMessage() {
  return new Promise((resolve) => {
    console.log('\n🚀 SINA EMPIRE MONEY MACHINE - OPERATIONAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💎 ACTIVE SERVICES:');
    console.log('   🏛️  Master Agent: http://localhost:3001');
    console.log('   🧠 Hive Mind: http://localhost:3007');
    console.log('   🔒 Micro Escrow: http://localhost:3500');
    console.log('   🏢 Enterprise Escrow: http://localhost:3600');
    console.log('   🔍 Payment Monitor: Background process');
    console.log('');
    console.log('🎯 READY TO MAKE MONEY:');
    console.log('   1. Post offers from active-offers.json');
    console.log('   2. Monitor payments via payment system');
    console.log('   3. Scale to enterprise when ready');
    console.log('');
    console.log('💰 NEXT: Start posting offers and watch the money flow!');
    resolve();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Self-destruct option to kill all processes
if (process.argv[2] === 'kill') {
  console.log('🛑 Stopping all money-making processes...');
  exec('pkill -f "master-agent\\|sina-hive\\|payment-monitor\\|escrow"', () => {
    console.log('✅ All processes stopped');
    process.exit(0);
  });
  return;
}

// Launch the money machine
activateMoneyMachine().then(() => {
  console.log('\n🎊 MONEY MACHINE ACTIVATED - LET\'S GET RICH! 🎊');
  console.log('');
  console.log('💡 TIP: Run "node make-money-now.js kill" to stop all services');
}).catch(error => {
  console.error('🚨 Money machine error:', error);
});