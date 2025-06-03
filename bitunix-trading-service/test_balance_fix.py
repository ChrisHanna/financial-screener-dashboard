#!/usr/bin/env python3
"""
Test Balance Fix for USD/USDT Issue
Verify that the trading system correctly reads USDT balance
"""
import asyncio
import os
import sys
from datetime import datetime

# Add the parent directory to sys.path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from bitunix_trader import BitunixTrader, BitunixConfig

async def test_balance_fix():
    """Test that the balance fix resolves the USD/USDT issue"""
    try:
        print("🧪 Testing Balance Fix")
        print("=" * 50)
        
        # Create trader with paper trading enabled
        config = BitunixConfig()
        trader = BitunixTrader(config)
        
        # Enable trading for test
        trader.enable_trading()
        
        print(f"📝 Paper Trading Mode: {trader.paper_trading}")
        print(f"🟢 Trading Enabled: {trader.trading_enabled}")
        print(f"💰 Initial Account Balance: ${trader.account_balance:.2f}")
        
        # Get account balance (this should update self.account_balance)
        balance_data = await trader.get_account_balance()
        
        print("\n🔍 Balance Response:")
        print(f"   API Response Code: {balance_data.get('code', 'Unknown')}")
        print(f"   USDT Available: {balance_data.get('data', {}).get('USDT', {}).get('available', '0')}")
        print(f"   USDT Frozen: {balance_data.get('data', {}).get('USDT', {}).get('frozen', '0')}")
        
        print(f"\n💰 Updated Account Balance: ${trader.account_balance:.2f}")
        
        # Test validation with a mock signal
        test_signal = {
            'type': 'Buy Signal',
            'strength': 'Strong',
            'system': 'Test System'
        }
        
        print("\n🎯 Testing Trade Validation:")
        is_valid, reason = await trader.validate_trade(test_signal, 'BTC-USD')
        
        print(f"   Valid: {is_valid}")
        print(f"   Reason: {reason}")
        
        # Test position size calculation
        position_size = trader.calculate_position_size('BTC-USD', 50000.0, 'Strong')
        print(f"   Position Size: ${position_size:.2f} USDT")
        
        print("\n" + "=" * 50)
        
        if trader.account_balance > 0 and is_valid:
            print("✅ SUCCESS: Balance fix is working!")
            print("💡 Trading system now correctly reads USDT balance")
            print(f"📊 Available for trading: ${trader.account_balance:.2f} USDT")
        else:
            print("❌ ISSUE: Balance fix may not be working")
            print(f"💰 Account balance: ${trader.account_balance:.2f}")
            print(f"🚫 Validation failed: {reason}")
        
        return trader.account_balance > 0 and is_valid
        
    except Exception as e:
        print(f"❌ Error testing balance fix: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_position_sizing():
    """Test that position sizing works with correct balance"""
    print("\n💡 Testing Position Sizing Logic")
    print("-" * 30)
    
    config = BitunixConfig()
    trader = BitunixTrader(config)
    
    # Get balance first
    await trader.get_account_balance()
    
    test_cases = [
        {'strength': 'Very Strong', 'expected_multiplier': 1.0},
        {'strength': 'Strong', 'expected_multiplier': 0.8},
        {'strength': 'Moderate', 'expected_multiplier': 0.5},
        {'strength': 'Weak', 'expected_multiplier': 0.3}
    ]
    
    for case in test_cases:
        position_size = trader.calculate_position_size('BTC-USD', 50000.0, case['strength'])
        expected_base = config.max_position_size_usdt * case['expected_multiplier']
        
        print(f"   {case['strength']}: ${position_size:.2f} USDT (expected ~${expected_base:.2f})")
    
    print(f"   Available Balance: ${trader.account_balance:.2f} USDT")
    print(f"   Min Trade Amount: ${config.min_trade_amount:.2f} USDT")

async def main():
    """Main test function"""
    print("🚀 Testing Bitunix USD/USDT Balance Fix")
    print()
    
    # Test 1: Balance fix
    test1_passed = await test_balance_fix()
    
    # Test 2: Position sizing
    await test_position_sizing()
    
    print("\n" + "=" * 50)
    if test1_passed:
        print("🎉 Balance fix is working correctly!")
        print("💰 USDT balance is now properly recognized")
        print("🚀 Trading validation should pass")
    else:
        print("⚠️ Balance fix needs more work")
    
    print("\n📝 Next Steps:")
    print("   1. Deploy this fix to your trading service")
    print("   2. Test with real signals")
    print("   3. Monitor trading logs for balance issues")

if __name__ == "__main__":
    asyncio.run(main()) 