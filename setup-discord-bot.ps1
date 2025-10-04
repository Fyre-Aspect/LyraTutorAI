#!/usr/bin/env pwsh
# Setup script for Discord bot dependencies

Write-Host "🚀 Setting up Gemini Discord Bot..." -ForegroundColor Cyan
Write-Host ""

# Check Node.js version
Write-Host "📦 Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18 or higher." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
Write-Host ""

# Check for FFmpeg
Write-Host "🎵 Checking for FFmpeg..." -ForegroundColor Yellow
$ffmpegCheck = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($null -eq $ffmpegCheck) {
    Write-Host "⚠️  FFmpeg not found. Installing via chocolatey..." -ForegroundColor Yellow
    $chocoCheck = Get-Command choco -ErrorAction SilentlyContinue
    if ($null -eq $chocoCheck) {
        Write-Host "❌ Chocolatey is not installed. Please install FFmpeg manually:" -ForegroundColor Red
        Write-Host "   Download from: https://ffmpeg.org/download.html" -ForegroundColor Red
        Write-Host "   Or install Chocolatey first: https://chocolatey.org/install" -ForegroundColor Red
    } else {
        choco install ffmpeg -y
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ FFmpeg installed successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ FFmpeg installation failed" -ForegroundColor Red
        }
    }
} else {
    Write-Host "✅ FFmpeg is already installed" -ForegroundColor Green
}
Write-Host ""

# Install npm dependencies
Write-Host "📚 Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Check for .env.local file
Write-Host "🔐 Checking for environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  .env.local not found. Creating from template..." -ForegroundColor Yellow
    Copy-Item ".env.local.example" ".env.local"
    Write-Host "✅ Created .env.local - Please edit this file with your API keys!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: You need to add the following to .env.local:" -ForegroundColor Yellow
    Write-Host "   1. DISCORD_BOT_TOKEN - Get from https://discord.com/developers/applications" -ForegroundColor Cyan
    Write-Host "   2. GEMINI_API_KEY - Get from https://aistudio.google.com/apikey" -ForegroundColor Cyan
} else {
    Write-Host "✅ .env.local already exists" -ForegroundColor Green
}
Write-Host ""

Write-Host "✨ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env.local with your Discord bot token and Gemini API key" -ForegroundColor White
Write-Host "2. Run 'npm run bot' to start the Discord bot" -ForegroundColor White
Write-Host "3. Or run 'npm run bot:dev' for development mode with auto-restart" -ForegroundColor White
Write-Host ""
Write-Host "For detailed setup instructions, see README.discord.md" -ForegroundColor Gray
