#!/usr/bin/env node
// record-payment.js - Manually record a payment event (simulation or late logging)
// Usage:
//   node record-payment.js --network mainnet --xmr 0.12 --type micro-offer --note "SEC-AUDIT-a1b2c3"

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(flag, def=null){
  const idx = args.indexOf(flag);
  if (idx === -1) return def;
  return args[idx+1];
}

const network = getArg('--network','mainnet');
const amountXMR = parseFloat(getArg('--xmr','0'));
const type = getArg('--type','manual');
const note = getArg('--note',null);
const rate = parseFloat(getArg('--rate','150')); // USD/XMR fallback

if (!amountXMR || amountXMR <= 0) {
  console.error('❌ Invalid or missing --xmr amount');
  process.exit(1);
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const INCOME_LOG = path.join(LOG_DIR, 'income.json');
const MICRO_PROGRESS_FILE = path.join(process.cwd(), 'MICRO-PROGRESS.md');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(INCOME_LOG)) fs.writeFileSync(INCOME_LOG, '[]','utf8');

function loadIncome(){ try { return JSON.parse(fs.readFileSync(INCOME_LOG,'utf8')); } catch { return []; } }
function saveIncome(r){ fs.writeFileSync(INCOME_LOG, JSON.stringify(r,null,2)); }

function calcMicro(records){ return records.filter(r => r.usd_est <= 400).reduce((s,r)=>s+r.usd_est,0); }
function bar(cur, tgt, w=30){ const ratio=Math.min(cur/tgt,1); const f=Math.round(ratio*w); return '█'.repeat(f)+'░'.repeat(w-f);} 
function milestoneLine(cur, tgt=200, step=25){ const parts=[]; for(let m=0;m<=tgt;m+=step){ parts.push(cur>=m?`[${m}]`:`${m}`);} return parts.join(' ─ ');} 
function recentTable(records){ if(!records.length) return '_No payments yet._'; const rec=records.slice(-10).reverse(); return ['| Time (UTC) | Network | XMR | USD (est) | Type |','|------------|---------|-----|-----------|------|',...rec.map(r=>`| ${new Date(r.timestamp).toISOString().replace('T',' ').replace('Z','')} | ${r.network} | ${r.amount_xmr.toFixed(4)} | $${r.usd_est.toFixed(2)} | ${r.type} |`)].join('\n'); }
function microMarkdown(total, records, target=200){ const pct=Math.min((total/target)*100,100).toFixed(1); return `# 🚀 MICRO EARNINGS PROGRESS\n\n**Phase 1 Target:** $${target}  \n**Current Total:** $${total.toFixed(2)}  \n**Progress:** ${bar(total,target)} ${pct}%  \n\nMilestones:\n\n$${milestoneLine(total)}\n\n## Recent Payments (last ${Math.min(records.length,10)})\n\n${recentTable(records)}\n\n_Updated: ${new Date().toISOString()}_\n`; }

// Append entry
const records = loadIncome();
const usdValue = amountXMR * rate;
const entry = {
  id: `manual_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
  timestamp: new Date().toISOString(),
  network,
  amount_xmr: amountXMR,
  usd_est: usdValue,
  type,
  note
};
records.push(entry);
saveIncome(records);

// Update micro progress if exists
const microTotal = calcMicro(records);
fs.writeFileSync(MICRO_PROGRESS_FILE, microMarkdown(microTotal, records));

console.log('✅ Payment recorded');
console.log(`   Network: ${network}`);
console.log(`   Amount: ${amountXMR} XMR (~$${usdValue.toFixed(2)})`);
console.log(`   Type: ${type}`);
if (note) console.log(`   Note: ${note}`);
console.log(`   Micro Phase Total: $${microTotal.toFixed(2)} / $200`);
