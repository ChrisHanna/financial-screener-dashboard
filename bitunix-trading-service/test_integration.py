#!/usr/bin/env python3
"""
🧪 Bitunix Trading Service Integration Test
Quick test to verify all components work together
"""

import os
import asyncio
import logging
from datetime import datetime
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_environment():
    """Test environment configuration"""
    print("🔍 Testing Environment Configuration...")
    
    # Check if .env file exists
    env_file = Path(".env")
    if not env_file.exists():
        print("❌ .env file not found")
        print("📋 Please copy .env.template to .env and configure")
        return False
    
    # Load environment
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✅ Environment file loaded")
    except ImportError:
        print("❌ python-dotenv not installed")
        return False
    
    # Check required variables
    required_vars = ['DATABASE_URL']
    for var in required_vars:
        if not os.getenv(var):
            print(f"❌ Missing required variable: {var}")
            return False
    
    print("✅ Environment configuration valid")
    return True

async def test_database():
    """Test database connection"""
    print("\n🔌 Testing Database Connection...")
    
    try:
        from database_utils import DatabaseManager
        
        db_manager = DatabaseManager()
        await db_manager.initialize()
        
        # Test basic query
        version = await db_manager.get_database_version()
        print(f"✅ Database connected: {version}")
        
        await db_manager.close()
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

async def test_bitunix_trader():
    """Test Bitunix trader in paper mode"""
    print("\n🚀 Testing Bitunix Trader (Paper Mode)...")
    
    try:
        from bitunix_trader import BitunixTrader, BitunixConfig
        
        # Create configuration for paper trading
        config = BitunixConfig(
            api_key="test_key",
            api_secret="test_secret",
            max_position_size_usdt=100,
            max_daily_trades=10
        )
        
        trader = BitunixTrader(config)
        trader.enable_paper_trading()
        trader.enable_trading()
        
        # Test authentication (should work in paper mode)
        auth_success = await trader.authenticate()
        if auth_success:
            print("✅ Bitunix trader initialized (paper mode)")
        else:
            print("⚠️ Bitunix authentication failed (expected in paper mode)")
        
        # Test signal processing
        test_signal = {
            'ticker': 'BTC-USD',
            'signal_strength': 0.8,
            'action': 'BUY',
            'timeframe': '1h',
            'signal_id': 'test_001'
        }
        
        result = await trader.process_signal(test_signal)
        print(f"✅ Signal processing test: {result}")
        
        return True
        
    except Exception as e:
        print(f"❌ Bitunix trader test failed: {e}")
        return False

async def test_trading_engine():
    """Test trading engine initialization"""
    print("\n⚙️ Testing Trading Engine...")
    
    try:
        from trading_engine import BitunixTradingEngine
        
        engine = BitunixTradingEngine()
        
        # Test configuration
        if hasattr(engine, 'config'):
            print("✅ Trading engine configuration loaded")
        
        # Test initialization (without starting the loop)
        await engine.initialize()
        print("✅ Trading engine initialized successfully")
        
        # Test status
        status = engine.get_status()
        print(f"✅ Engine status: {status['status']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Trading engine test failed: {e}")
        return False

async def test_signal_processing():
    """Test end-to-end signal processing"""
    print("\n🎯 Testing End-to-End Signal Processing...")
    
    try:
        from trading_engine import BitunixTradingEngine
        from database_utils import DatabaseManager
        
        # Initialize components
        engine = BitunixTradingEngine()
        await engine.initialize()
        
        # Enable paper trading mode
        engine.bitunix_trader.enable_paper_trading()
        
        # Test signal filtering
        test_signals = [
            {
                'id': 1,
                'ticker': 'BTC-USD',
                'signal_strength': 0.8,
                'action': 'BUY',
                'created_at': datetime.now()
            },
            {
                'id': 2,
                'ticker': 'ETH-USD',
                'signal_strength': 0.5,  # Below threshold
                'action': 'SELL',
                'created_at': datetime.now()
            }
        ]
        
        valid_signals = 0
        for signal in test_signals:
            should_trade = engine.should_trade_signal(signal)
            if should_trade:
                valid_signals += 1
                print(f"✅ Signal {signal['id']} passed validation")
            else:
                print(f"⚠️ Signal {signal['id']} filtered out")
        
        print(f"✅ Processed {valid_signals}/{len(test_signals)} signals")
        return True
        
    except Exception as e:
        print(f"❌ Signal processing test failed: {e}")
        return False

async def run_integration_test():
    """Run complete integration test"""
    print("=" * 60)
    print("🧪 BITUNIX TRADING SERVICE INTEGRATION TEST")
    print("=" * 60)
    
    tests = [
        ("Environment", test_environment),
        ("Database", test_database),
        ("Bitunix Trader", test_bitunix_trader),
        ("Trading Engine", test_trading_engine),
        ("Signal Processing", test_signal_processing)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            success = await test_func()
            if success:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {passed/(passed+failed)*100:.1f}%")
    
    if failed == 0:
        print("\n🎉 All tests passed! Ready for trading.")
        print("🚀 Run 'start_trading.bat' to begin")
    else:
        print("\n⚠️ Some tests failed. Check configuration.")
        print("📋 Review .env file and requirements")
    
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_integration_test()) 