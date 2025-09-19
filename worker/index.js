export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle SINA PWA Interface
    if (url.pathname.startsWith('/sina/interface')) {
      return new Response(await getSINAInterface(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // API Routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env);
    }
    
    // Default response
    return new Response(JSON.stringify({
      message: 'SINA Empire Worker Active',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'development'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function handleAPIRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  
  switch (path) {
    case '/revenue':
      return new Response(JSON.stringify({
        currentMonth: 12500,
        totalRevenue: 85750,
        monthlyGoal: 15000,
        premiumUsers: 247,
        growthRate: 0.15
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    case '/voice/command':
      return new Response(JSON.stringify({
        status: 'received',
        command: await request.text(),
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    default:
      return new Response('Not Found', { status: 404 });
  }
}

function getSINAInterface() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SINA Empire Interface</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white">
    <div class="container mx-auto p-8">
        <h1 class="text-4xl font-bold mb-8 text-center text-blue-400">SINA Empire Interface</h1>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-xl font-semibold mb-4 text-green-400">System Status</h2>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Worker:</span>
                        <span class="text-green-400">Running</span>
                    </div>
                    <div class="flex justify-between">
                        <span>PWA:</span>
                        <span class="text-green-400">Active</span>
                    </div>
                    <div class="flex justify-between">
                        <span>CLI:</span>
                        <span class="text-green-400">Ready</span>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-xl font-semibold mb-4 text-yellow-400">Revenue</h2>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Monthly:</span>
                        <span class="text-green-400">$12,500</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Total:</span>
                        <span class="text-green-400">$85,750</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Growth:</span>
                        <span class="text-green-400">+15%</span>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-800 p-6 rounded-lg">
                <h2 class="text-xl font-semibold mb-4 text-purple-400">Voice Commands</h2>
                <button class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded w-full mb-2">
                    🎤 Activate Voice
                </button>
                <button class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded w-full">
                    📊 Voice Analytics
                </button>
            </div>
        </div>
        
        <div class="mt-8 bg-gray-800 p-6 rounded-lg">
            <h2 class="text-xl font-semibold mb-4 text-blue-400">Command Center</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Deploy</button>
                <button class="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded">Analytics</button>
                <button class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded">Settings</button>
                <button class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Emergency</button>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}
