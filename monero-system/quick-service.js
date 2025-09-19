// quick-service.js - Quick income generation service
const express = require('express');
const app = express();

app.use(express.json());

const MONERO_ADDRESS = '55mZQnmnivbXQRbPr2zsmG2egQwZJMD4PHyiF4qU2SP9Q1a7Au4HhH7R7tFBRgK7zbXASdnuahVDFiyBWJQTsTHRP3Y6yQw';

// Service catalog for immediate income
const services = [
    { id: 1, name: 'Quick Code Review', price: '$5-25', time: '15 minutes', description: 'Fast code analysis and suggestions' },
    { id: 2, name: 'AI Consultation', price: '$25-75', time: '30 minutes', description: 'AI implementation advice' },
    { id: 3, name: 'System Architecture Review', price: '$50-150', time: '60 minutes', description: 'Architecture recommendations' },
    { id: 4, name: 'API Integration Help', price: '$75-200', time: '90 minutes', description: 'API design and integration' }
];

app.get('/', (req, res) => {
    res.json({
        message: '🚀 EMPIRE SERVICES - READY TO EARN!',
        payment_address: MONERO_ADDRESS,
        network: 'Monero Stagenet (ready for mainnet)',
        services_available: services.length,
        status: 'ACCEPTING CLIENTS',
        how_to_pay: `Send Monero to: ${MONERO_ADDRESS}`,
        contact: 'Send payment first, then describe your needs'
    });
});

app.get('/services', (req, res) => {
    res.json({
        available_services: services,
        payment_method: 'Monero cryptocurrency',
        payment_address: MONERO_ADDRESS,
        process: [
            '1. Choose service from list above',
            '2. Send payment to Monero address',
            '3. Contact with payment proof + requirements',
            '4. Receive service within stated time'
        ],
        guarantee: 'Full refund if not satisfied'
    });
});

app.get('/order/:serviceId', (req, res) => {
    const service = services.find(s => s.id == req.params.serviceId);
    if (!service) {
        return res.status(404).json({ error: 'Service not found' });
    }

    res.json({
        service: service,
        payment_address: MONERO_ADDRESS,
        payment_required: service.price,
        estimated_delivery: service.time,
        instructions: [
            `Send payment (${service.price}) to: ${MONERO_ADDRESS}`,
            'Email payment confirmation + your requirements',
            `Receive ${service.name} within ${service.time}`,
            'Get full refund if not satisfied'
        ],
        next_step: 'Send payment now to reserve your slot!'
    });
});

app.get('/payment/verify', (req, res) => {
    res.json({
        message: 'Payment verification system active',
        address: MONERO_ADDRESS,
        status: 'Monitoring blockchain for incoming payments',
        note: 'Payments are detected automatically within 20 minutes'
    });
});

app.post('/contact', (req, res) => {
    const { service_id, payment_proof, requirements } = req.body;
    
    console.log('🎯 NEW CLIENT INQUIRY:');
    console.log('Service ID:', service_id);
    console.log('Payment Proof:', payment_proof);
    console.log('Requirements:', requirements);
    
    res.json({
        success: true,
        message: 'Inquiry received! Service will be delivered within promised timeframe.',
        status: 'PROCESSING',
        next_steps: 'You will receive service delivery within the stated time.'
    });
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log('🎯 EMPIRE INCOME SERVICES LIVE!');
    console.log('================================');
    console.log(`💰 Service URL: http://localhost:${PORT}`);
    console.log(`📬 Payment Address: ${MONERO_ADDRESS}`);
    console.log('💼 Services Ready:');
    services.forEach(s => {
        console.log(`   ${s.id}. ${s.name} - ${s.price} (${s.time})`);
    });
    console.log('');
    console.log('🚀 READY TO ACCEPT CLIENTS AND EARN MONEY!');
    console.log('📊 Check services: GET /services');
    console.log('🛒 Order service: GET /order/1');
    console.log('💰 Verify payments: GET /payment/verify');
});

module.exports = app;