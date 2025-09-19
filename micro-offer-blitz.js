#!/usr/bin/env node
// micro-offer-blitz.js - Rapid-fire micro-offer post generator

const crypto = require('crypto');

function code() { return crypto.randomBytes(3).toString('hex'); }

const PAYMENT_ADDRESS = '45DTDUWznK3Wh3D6QjCyvuA3tEzUyRVzoZjwCyWLrEiohEiffvDG4foHSDJqFC5uVZN2aR37ZatWehrr49yYTNDeQ4SfDy8';

const OFFERS = [
  { title: '15‑Minute Code Security Audit', price: '$15', xmr: '0.10', time: '15 min', deliver: 'Find 3–5 real improvements', tag: 'SEC-AUDIT' },
  { title: 'Rapid Performance Profiling', price: '$20', xmr: '0.14', time: '20 min', deliver: 'Spot 2 bottlenecks + fixes', tag: 'PERF-SCAN' },
  { title: 'Micro API Design Review', price: '$25', xmr: '0.17', time: '20 min', deliver: 'Return improved endpoint schema', tag: 'API-REV' },
  { title: 'Quick AI Prompt Refinement', price: '$18', xmr: '0.12', time: '15 min', deliver: '3 higher‑yield prompts', tag: 'PROMPT-TUNE' },
  { title: 'Database Index Optimization', price: '$30', xmr: '0.20', time: '25 min', deliver: 'Index & query improvement patch', tag: 'DB-INDEX' },
  { title: 'Landing Page Conversion Tweaks', price: '$40', xmr: '0.27', time: '30 min', deliver: '5 CRO actionable changes', tag: 'CRO-BOOST' },
  { title: 'Readme / Onboarding Hardening', price: '$22', xmr: '0.15', time: '20 min', deliver: 'Improve clarity + adoption', tag: 'DOC-BOOST' },
  { title: 'Log Noise Reduction Pass', price: '$28', xmr: '0.19', time: '25 min', deliver: 'Filter + signal boost plan', tag: 'LOG-SIGNAL' },
  { title: 'Quick Security Headers Setup', price: '$35', xmr: '0.23', time: '25 min', deliver: 'Deploy hardened headers', tag: 'HDR-HARDEN' },
  { title: 'Error Budget + SLO Draft', price: '$50', xmr: '0.33', time: '30 min', deliver: 'Initial SLO + error policy', tag: 'SLO-DRAFT' }
];

function generateReddit(offer){
  const id = code();
  return `**⚡ INSTANT MICRO DEV HELP (${offer.price}) – ${offer.title}**  \n\n`+
  `Time: ${offer.time} | Delivery: ${offer.deliver}  \n`+
  `What you get: ✅ Fast ✅ Actionable ✅ Real ROI  \n`+
  `How it works:  \n1. Send ${offer.xmr} XMR (${offer.price})  \n2. DM code snippet / repo link  \n3. Receive deliverable in ${offer.time}  \n\n`+
  `Payment (Monero):  \n







${PAYMENT_ADDRESS}  \n`+
  `Ref: ${offer.tag}-${id}  \n`+
  `I only take 1 slot at a time. Reply or DM. Fast turnaround. Serious only.`;
}

function generateDiscord(offer){
  const id = code();
  return `🔥 ${offer.title} (${offer.price})\nTime: ${offer.time} | Deliver: ${offer.deliver}\nPay ${offer.xmr} XMR → ${PAYMENT_ADDRESS}\nRef: ${offer.tag}-${id}\nDM snippet + objective. I deliver fast.`;
}

function generateTweet(offer){
  const id = code();
  return `${offer.title} – ${offer.price} | ${offer.time}\nPay ${offer.xmr} XMR, get: ${offer.deliver}.\n${PAYMENT_ADDRESS.slice(0,20)}... Ref ${offer.tag}-${id}\n#Monero #dev #freelance #build`; 
}

console.log('\n🚀 MICRO OFFER BLITZ – COPY & FIRE!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

OFFERS.forEach(o => {
  console.log(`\n========================================`);
  console.log(`OFFER: ${o.title} (${o.price})`);
  console.log('\n[REDDIT POST]\n'+generateReddit(o));
  console.log('\n[DISCORD BLURB]\n'+generateDiscord(o));
  console.log('\n[TWEET]\n'+generateTweet(o));
});

console.log('\n💰 Strategy: Post 3 now → wait 5 min → rotate. Don\'t spam same forum.');
console.log('Track refs (tag-id) for manual mapping to payment.');
