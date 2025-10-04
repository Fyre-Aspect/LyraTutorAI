import { execSync } from 'child_process';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

console.log('🔍 Checking Lyra Bot Setup...\n');

let allGood = true;

// Check Node.js version
console.log('1️⃣ Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 18) {
  console.log(`   ✅ Node.js ${nodeVersion} (OK)\n`);
} else {
  console.log(`   ❌ Node.js ${nodeVersion} (Need 18+)\n`);
  allGood = false;
}

// Check FFmpeg installation
console.log('2️⃣ Checking FFmpeg installation...');
try {
  const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const versionLine = ffmpegVersion.split('\n')[0];
  console.log(`   ✅ ${versionLine}\n`);
} catch (error) {
  console.log('   ❌ FFmpeg not found!');
  console.log('   Install with: winget install FFmpeg\n');
  allGood = false;
}

// Check .env file exists
console.log('3️⃣ Checking .env file...');
if (existsSync('.env')) {
  console.log('   ✅ .env file exists\n');
  
  // Load and check environment variables
  dotenv.config();
  
  console.log('4️⃣ Checking environment variables...');
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  
  if (token && token !== '' && token !== 'your_bot_token_here') {
    console.log('   ✅ DISCORD_TOKEN is set');
  } else {
    console.log('   ❌ DISCORD_TOKEN is missing or not configured');
    allGood = false;
  }
  
  if (clientId && clientId !== '' && clientId !== 'your_client_id_here') {
    console.log('   ✅ DISCORD_CLIENT_ID is set\n');
  } else {
    console.log('   ❌ DISCORD_CLIENT_ID is missing or not configured\n');
    allGood = false;
  }
} else {
  console.log('   ❌ .env file not found!\n');
  allGood = false;
}

// Check dependencies
console.log('5️⃣ Checking dependencies...');
if (existsSync('node_modules')) {
  console.log('   ✅ node_modules exists\n');
} else {
  console.log('   ❌ node_modules not found!');
  console.log('   Run: npm install\n');
  allGood = false;
}

// Final verdict
console.log('═══════════════════════════════════════');
if (allGood) {
  console.log('🎉 All checks passed! You\'re ready to run the bot.');
  console.log('\nRun: npm start\n');
} else {
  console.log('❌ Some issues need to be fixed.');
  console.log('\nSee QUICKSTART.md for detailed setup instructions.\n');
}
console.log('═══════════════════════════════════════');
