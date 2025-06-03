#!/usr/bin/env python3
"""
Test Bitunix API Connection
Verify that we can connect to the API and get real prices
"""
import asyncio
import requests
import json
from bitunix_trader import BitunixTrader, BitunixConfig

async def test_api_connection():
    """Test direct API connection to Bitunix"""
    print("🔗 Testing Bitunix API Connection")
    print("=" * 50)
    
    # Test direct API call
    try:
        url = "https://fapi.bitunix.com/api/v1/futures/market/tickers"
        params = {'symbols': 'BTCUSDT'}
        
        print(f"📡 Making request to: {url}")
        print(f"📊 Parameters: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        print(f"🌐 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📋 Response Data: {json.dumps(data, indent=2)}")
            
            if data.get('code') == 0 and 'data' in data and len(data['data']) > 0:
                ticker_data = data['data'][0]
                price = float(ticker_data.get('lastPrice', 0))
                print(f"✅ BTC Price: ${price:.2f}")
                return True
            else:
                print(f"❌ API returned error: {data}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"📄 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

async def test_trader_price_fetching():
    """Test price fetching through our trader"""
    print("\n🤖 Testing Trader Price Fetching")
    print("-" * 30)
    
    config = BitunixConfig()
    trader = BitunixTrader(config)
    
    # Test with paper trading disabled to use real API
    trader.disable_paper_trading()
    
    test_symbols = ['BTC-USD', 'ETH-USD', 'ADA-USD']
    
    for symbol in test_symbols:
        try:
            price = await trader.get_ticker_price(symbol)
            if price > 0:
                print(f"✅ {symbol}: ${price:.4f}")
            else:
                print(f"❌ {symbol}: Failed to get price")
        except Exception as e:
            print(f"❌ {symbol}: Error - {e}")

async def test_with_paper_trading():
    """Test that paper trading still works with mock prices"""
    print("\n📝 Testing Paper Trading Mode")
    print("-" * 30)
    
    config = BitunixConfig()
    trader = BitunixTrader(config)
    
    # Paper trading should be enabled by default
    trader.enable_paper_trading()
    
    test_symbols = ['BTC-USD', 'ETH-USD', 'ADA-USD']
    
    for symbol in test_symbols:
        try:
            price = await trader.get_ticker_price(symbol)
            print(f"📝 {symbol}: ${price:.4f} (mock price)")
        except Exception as e:
            print(f"❌ {symbol}: Error - {e}")

async def main():
    """Main test function"""
    print("🧪 Bitunix API Connection Test")
    print()
    
    # Test 1: Direct API connection
    api_works = await test_api_connection()
    
    # Test 2: Trader price fetching (real API)
    if api_works:
        await test_trader_price_fetching()
    else:
        print("⚠️ Skipping trader real API test due to connection issues")
    
    # Test 3: Paper trading (always works)
    await test_with_paper_trading()
    
    print("\n" + "=" * 50)
    if api_works:
        print("🎉 API connection is working!")
        print("💰 Ready for live trading")
    else:
        print("⚠️ API connection issues detected")
        print("📝 Paper trading mode still works")
    
    print("\n📝 Next Steps:")
    print("   1. If API works: You can enable live trading")
    print("   2. If API fails: Check network/firewall settings")
    print("   3. Paper trading always available for testing")

if __name__ == "__main__":
    asyncio.run(main()) 