#!/usr/bin/env node
// 📊 Revenue Analytics Script

async function getRevenueStats() {
  try {
    const response = await fetch('https://your-domain.com/api/stats');
    const stats = await response.json();
    
    console.log('💰 REVENUE ANALYTICS');
    console.log('====================');
    console.log(`Daily Revenue: $${stats.dailyRevenue.toFixed(2)}`);
    console.log(`Total Revenue: $${stats.totalRevenue.toFixed(2)}`);
    console.log(`Active Services: ${stats.serviceBreakdown.length}`);
    console.log('');
    
    console.log('📊 Service Breakdown:');
    stats.serviceBreakdown.forEach(service => {
      console.log(`  ${service.service}: $${service.total.toFixed(2)} (${service.requests} requests)`);
    });
    
  } catch (error) {
    console.log('❌ Error fetching revenue stats:', error.message);
    console.log('Make sure your revenue system is deployed and accessible.');
  }
}

if (require.main === module) {
  getRevenueStats();
}

module.exports = { getRevenueStats };
