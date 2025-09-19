// SINA Empire PWA JavaScript
class SINAEmpire {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateStatus();
        this.registerServiceWorker();
        
        // Update data every 30 seconds
        setInterval(() => this.updateStatus(), 30000);
    }
    
    setupEventListeners() {
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => this.toggleVoice());
        }
    }
    
    async updateStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            this.updateStatusDisplay(data);
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    }
    
    updateStatusDisplay(data) {
        // Update status indicators based on API response
        console.log('Status updated:', data);
    }
    
    toggleVoice() {
        const status = document.getElementById('voice-status');
        const btn = document.getElementById('voice-btn');
        
        if ('webkitSpeechRecognition' in window) {
            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            recognition.onstart = () => {
                status.textContent = 'Listening...';
                btn.textContent = 'Stop Listening';
                btn.classList.add('bg-red-600');
                btn.classList.remove('bg-purple-600');
            };
            
            recognition.onresult = (event) => {
                const command = event.results[0][0].transcript;
                this.processVoiceCommand(command);
            };
            
            recognition.onend = () => {
                status.textContent = 'Ready to listen...';
                btn.textContent = 'Activate Voice';
                btn.classList.remove('bg-red-600');
                btn.classList.add('bg-purple-600');
            };
            
            recognition.start();
        } else {
            status.textContent = 'Voice recognition not supported';
        }
    }
    
    processVoiceCommand(command) {
        console.log('Voice command:', command);
        const status = document.getElementById('voice-status');
        status.textContent = `Command: "${command}"`;
        
        // Process specific commands
        if (command.toLowerCase().includes('status')) {
            this.updateStatus();
        } else if (command.toLowerCase().includes('revenue')) {
            this.showRevenue();
        }
    }
    
    showRevenue() {
        // Highlight revenue section
        const revenueCard = document.querySelector('#revenue-display').parentElement;
        revenueCard.classList.add('ring-2', 'ring-green-400');
        setTimeout(() => {
            revenueCard.classList.remove('ring-2', 'ring-green-400');
        }, 3000);
    }
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => console.log('SW registered:', registration))
                .catch(error => console.log('SW registration failed:', error));
        }
    }
}

// Initialize SINA Empire PWA
document.addEventListener('DOMContentLoaded', () => {
    new SINAEmpire();
});
