#!/usr/bin/env python3
"""
🚀 Bitunix Trading Service Startup Script
Handles environment setup and runs the cryptocurrency trading engine
"""

import os
import sys
import subprocess
import asyncio
from pathlib import Path

def check_python_version():
    """Check Python version compatibility"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required")
        print(f"   Current version: {sys.version}")
        return False
    print(f"✅ Python version: {sys.version.split()[0]}")
    return True

def check_environment_file():
    """Check if .env file exists"""
    env_file = Path(".env")
    template_file = Path(".env.template")
    
    if not env_file.exists():
        if template_file.exists():
            print("⚠️ .env file not found")
            print("📋 Please copy .env.template to .env and configure your settings:")
            print(f"   cp {template_file} {env_file}")
            print("\n🔑 Required settings:")
            print("   - DATABASE_URL (same as Discord bot)")
            print("   - BITUNIX_API_KEY (from bitunix.com)")
            print("   - BITUNIX_API_SECRET (from bitunix.com)")
            return False
        else:
            print("❌ No .env or .env.template file found")
            return False
    
    print("✅ Environment file found")
    return True

def load_environment():
    """Load environment variables"""
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✅ Environment variables loaded")
        return True
    except ImportError:
        print("❌ python-dotenv not installed")
        print("   Run: pip install python-dotenv")
        return False

def check_database_url():
    """Check if DATABASE_URL is configured"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not configured")
        print("   Please set DATABASE_URL in your .env file")
        return False
    
    print("✅ Database URL configured")
    return True

def check_trading_config():
    """Check trading configuration"""
    paper_trading = os.getenv('PAPER_TRADING', 'true').lower()
    auto_trading = os.getenv('AUTO_TRADING', 'false').lower()
    
    print(f"📊 Trading Configuration:")
    print(f"   Paper Trading: {paper_trading}")
    print(f"   Auto Trading: {auto_trading}")
    print(f"   Max Position: ${os.getenv('MAX_POSITION_SIZE_USDT', '100')} USDT")
    print(f"   Check Interval: {os.getenv('SIGNAL_CHECK_INTERVAL', '15')} seconds")
    
    if paper_trading == 'true':
        print("📝 Starting in PAPER TRADING mode (safe for testing)")
    else:
        api_key = os.getenv('BITUNIX_API_KEY')
        api_secret = os.getenv('BITUNIX_API_SECRET')
        
        if not api_key or not api_secret:
            print("❌ Bitunix API credentials required for real trading")
            print("   Please set BITUNIX_API_KEY and BITUNIX_API_SECRET in .env")
            return False
        
        print("💰 Real trading mode enabled")
        if auto_trading == 'true':
            print("⚠️ AUTO TRADING is ENABLED - monitor carefully!")
    
    return True

def install_dependencies():
    """Install required dependencies"""
    try:
        print("📦 Checking dependencies...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("✅ Dependencies installed")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        print("   Try: pip install -r requirements.txt")
        return False

async def test_components():
    """Test core components"""
    print("🧪 Testing core components...")
    
    try:
        # Test database connection
        from database_utils import test_database_connection
        print("🔌 Testing database connection...")
        await test_database_connection()
        
        # Test Bitunix trader (paper mode)
        from bitunix_trader import test_bitunix_trader
        print("🚀 Testing Bitunix trader...")
        await test_bitunix_trader()
        
        print("✅ All components tested successfully")
        return True
        
    except Exception as e:
        print(f"❌ Component test failed: {e}")
        return False

def show_startup_banner():
    """Show startup banner"""
    print("=" * 60)
    print("🚀 BITUNIX CRYPTOCURRENCY TRADING SERVICE")
    print("=" * 60)
    print("🎯 Monitors Discord bot signals and executes crypto trades")
    print("💡 Supports BTC, ETH, ADA, DOGE, SOL, and more")
    print("🛡️ Built-in risk management and paper trading")
    print("=" * 60)

async def main():
    """Main startup function"""
    show_startup_banner()
    
    # Pre-flight checks
    print("\n🔍 Pre-flight checks...")
    
    if not check_python_version():
        return False
    
    if not check_environment_file():
        return False
    
    if not load_environment():
        return False
    
    if not check_database_url():
        return False
    
    if not check_trading_config():
        return False
    
    # Install dependencies
    if not install_dependencies():
        return False
    
    # Test components
    if not await test_components():
        print("⚠️ Component tests failed, but continuing...")
    
    print("\n✅ All checks passed!")
    print("\n🚀 Starting Bitunix Trading Engine...")
    print("📝 Press Ctrl+C to stop")
    print("-" * 60)
    
    # Start the trading engine
    try:
        from trading_engine import main as run_trading_engine
        await run_trading_engine()
    except KeyboardInterrupt:
        print("\n⏹️ Shutdown requested by user")
    except Exception as e:
        print(f"\n❌ Trading engine error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        if not success:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⏹️ Startup interrupted")
        sys.exit(0) 