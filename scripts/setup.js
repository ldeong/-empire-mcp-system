const fs = require('fs');
if (!fs.existsSync('.env')) {
  fs.copyFileSync('.env.example', '.env');
  console.log('.env file created from .env.example');
} else {
  console.log('.env already exists');
}
