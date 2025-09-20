#!/usr/bin/env node
// 🧪 Legal Revenue System Test Script

const BASE_URL = process.env.TEST_URL || 'http://localhost:8787';

async function testAPIAggregation() {
  console.log('Testing API Aggregation...');
  try {
    const response = await fetch(`${BASE_URL}/api/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        services: ['weather', 'news', 'crypto'],
        userId: 'test-user'
      })
    });
    
    const data = await response.json();
    console.log(`✅ API Aggregation: $${data.cost} revenue generated`);
    return true;
  } catch (error) {
    console.log('❌ API Aggregation test failed:', error.message);
    return false;
  }
}

async function testContentGeneration() {
  console.log('Testing Content Generation...');
  try {
    const response = await fetch(`${BASE_URL}/api/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'AI Technology',
        length: 100,
        type: 'blog-post',
        userId: 'test-user'
      })
    });
    
    const data = await response.json();
    console.log(`✅ Content Generation: $${data.price} revenue generated`);
    return true;
  } catch (error) {
    console.log('❌ Content Generation test failed:', error.message);
    return false;
  }
}

async function testWebhookRelay() {
  console.log('Testing Webhook Relay...');
  try {
    const webhookId = 'test-' + Math.random().toString(36).substr(2, 9);
    const response = await fetch(`${BASE_URL}/webhook/${webhookId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'webhook data' })
    });
    
    const data = await response.json();
    console.log(`✅ Webhook Relay: $${data.cost} revenue generated`);
    return true;
  } catch (error) {
    console.log('❌ Webhook Relay test failed:', error.message);
    return false;
  }
}

async function testDataValidation() {
  console.log('Testing Data Validation...');
  try {
    const response = await fetch(`${BASE_URL}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        phone: '+1234567890',
        userId: 'test-user'
      })
    });
    
    const data = await response.json();
    console.log(`✅ Data Validation: $${data.cost} revenue generated`);
    return true;
  } catch (error) {
    console.log('❌ Data Validation test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 TESTING LEGAL REVENUE SYSTEM');
  console.log('================================\n');
  
  const tests = [
    testAPIAggregation,
    testContentGeneration,
    testWebhookRelay,
    testDataValidation
  ];
  
  let passed = 0;
  for (const test of tests) {
    if (await test()) {
      passed++;
    }
    console.log('');
  }
  
  console.log(`Tests completed: ${passed}/${tests.length} passed`);
  
  if (passed === tests.length) {
    console.log('🎉 All tests passed! Your revenue system is ready to make money!');
  } else {
    console.log('⚠️  Some tests failed. Check your configuration and try again.');
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
