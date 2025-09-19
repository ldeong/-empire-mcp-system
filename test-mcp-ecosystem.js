#!/usr/bin/env node

/**
 * MCP Ecosystem Test Script
 * Tests the core functionality of the MCP ecosystem
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class MCPTester {
  constructor() {
    this.sessionId = uuidv4();
    this.testResults = [];
  }

  async testEndpoint(endpoint, method = 'GET', data = null, description = '') {
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const startTime = Date.now();
      const response = await axios(config);
      const duration = Date.now() - startTime;

      this.testResults.push({
        endpoint,
        method,
        status: 'PASS',
        statusCode: response.status,
        duration: `${duration}ms`,
        description
      });

      console.log(`✅ ${method} ${endpoint} - ${response.status} (${duration}ms)`);
      return response.data;
    } catch (error) {
      this.testResults.push({
        endpoint,
        method,
        status: 'FAIL',
        statusCode: error.response?.status || 'N/A',
        error: error.message,
        description
      });

      console.log(`❌ ${method} ${endpoint} - ${error.response?.status || 'ERROR'} (${error.message})`);
      return null;
    }
  }

  async runTests() {
    console.log('🚀 Starting MCP Ecosystem Tests...\n');

    // Test 1: System Status
    await this.testEndpoint('/mcp/status', 'GET', null, 'Check system status');

    // Test 2: Available Workflows
    await this.testEndpoint('/mcp/workflows', 'GET', null, 'Get available workflows');

    // Test 3: Voice Command Processing
    await this.testEndpoint('/mcp/execute', 'POST', {
      command: 'show system status',
      sessionId: this.sessionId
    }, 'Test voice command processing');

    // Test 4: MCP Operation
    await this.testEndpoint('/mcp/execute', 'POST', {
      command: 'create test project',
      sessionId: this.sessionId
    }, 'Test MCP operation execution');

    // Test 5: Workflow Execution
    await this.testEndpoint('/mcp/workflow', 'POST', {
      workflowName: 'dev-setup',
      sessionId: this.sessionId,
      parameters: {
        projectName: 'test-app',
        template: 'node'
      }
    }, 'Test workflow execution');

    // Test 6: Analytics
    await this.testEndpoint('/mcp/analytics?timeframe=1h', 'GET', null, 'Get analytics data');

    // Test 7: Webhook Registration
    await this.testEndpoint('/mcp/webhook/register', 'POST', {
      operationType: 'mcp-operation',
      url: 'https://httpbin.org/post',
      filters: { status: 'success' }
    }, 'Test webhook registration');

    // Test 8: Auto-commit (dry run)
    await this.testEndpoint('/mcp/auto-commit', 'POST', {
      dryRun: true,
      skipPush: true
    }, 'Test auto-commit functionality');

    // Test 9: Coding Agent
    await this.testEndpoint('/mcp/coding-agent', 'POST', {
      taskType: 'feature',
      title: 'Test Feature',
      description: 'Testing the coding agent functionality',
      files: ['test.js']
    }, 'Test coding agent trigger');

    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Test Summary:');
    console.log('================');

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`  - ${result.method} ${result.endpoint}: ${result.error}`);
        });
    }

    console.log('\n🎉 MCP Ecosystem test completed!');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new MCPTester();
  tester.runTests().catch(console.error);
}

module.exports = MCPTester;