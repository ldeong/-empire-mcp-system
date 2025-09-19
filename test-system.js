#!/usr/bin/env node

// Sina Empire - System Integration Test
// Test all MCP components and verify connectivity

import axios from 'axios';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001/mcp';

async function testHealth() {
    console.log('🏥 Testing Health Endpoint...');
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health Check Passed');
        console.log('📊 Status:', response.data.status);
        console.log('🔧 Services:', response.data.services.join(', '));
        console.log('📋 Protocol:', response.data.protocol_version);
        return true;
    } catch (error) {
        console.log('❌ Health Check Failed:', error.message);
        return false;
    }
}

async function testWebSocket() {
    console.log('\n🔗 Testing WebSocket Connection...');
    
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
            console.log('✅ WebSocket Connected');
            
            // Send MCP initialization
            const initMessage = {
                jsonrpc: '2.0',
                id: 'test-1',
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: {
                        name: 'Sina Empire Test Client',
                        version: '1.0.0'
                    }
                }
            };
            
            ws.send(JSON.stringify(initMessage));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('📨 MCP Response:', message.result ? 'Init Success' : 'Init Failed');
                console.log('🔧 Server Capabilities:', Object.keys(message.result?.capabilities || {}));
                ws.close();
                resolve(true);
            } catch (error) {
                console.log('❌ Invalid WebSocket Message:', error.message);
                ws.close();
                resolve(false);
            }
        });
        
        ws.on('error', (error) => {
            console.log('❌ WebSocket Error:', error.message);
            resolve(false);
        });
        
        setTimeout(() => {
            console.log('⏰ WebSocket Test Timeout');
            ws.close();
            resolve(false);
        }, 5000);
    });
}

async function testMCPTools() {
    console.log('\n🛠️ Testing MCP Tools...');
    
    try {
        const response = await axios.get(`${BASE_URL}/tools`);
        console.log('✅ Tools Endpoint Accessible');
        
        if (response.data?.tools) {
            console.log('🔧 Available Tools:');
            response.data.tools.forEach(tool => {
                console.log(`  • ${tool.name}: ${tool.description}`);
            });
        }
        
        return true;
    } catch (error) {
        console.log('❌ Tools Test Failed:', error.message);
        return false;
    }
}

async function testCrypto() {
    console.log('\n💰 Testing Crypto Wallet Management...');
    
    try {
        const response = await axios.get(`${BASE_URL}/crypto/status`);
        console.log('✅ Crypto Endpoint Accessible');
        
        if (response.data?.wallets) {
            console.log('💳 Configured Wallets:');
            Object.entries(response.data.wallets).forEach(([coin, status]) => {
                console.log(`  • ${coin.toUpperCase()}: ${status ? '✅' : '❌'}`);
            });
        }
        
        return true;
    } catch (error) {
        console.log('❌ Crypto Test Failed:', error.message);
        return false;
    }
}

async function runFullTest() {
    console.log('🚀 SINA EMPIRE MCP SYSTEM TEST');
    console.log('=================================\n');
    
    const results = {
        health: await testHealth(),
        websocket: await testWebSocket(),
        tools: await testMCPTools(),
        crypto: await testCrypto()
    };
    
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=======================');
    console.log(`Health Check: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`WebSocket: ${results.websocket ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`MCP Tools: ${results.tools ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Crypto Management: ${results.crypto ? '✅ PASS' : '❌ FAIL'}`);
    
    const passCount = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n🎯 Overall Score: ${passCount}/${totalTests} tests passed`);
    
    if (passCount === totalTests) {
        console.log('🎉 ALL SYSTEMS OPERATIONAL!');
        console.log('🏆 Sina Empire MCP System is ready for deployment!');
    } else {
        console.log('⚠️  Some systems need attention before deployment');
    }
}

// Run the test
runFullTest().catch(console.error);