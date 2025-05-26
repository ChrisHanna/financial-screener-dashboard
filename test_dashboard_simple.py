#!/usr/bin/env python3
"""
Simple test to verify the enhanced dashboard is working
"""

import requests
import webbrowser
import time

def test_dashboard():
    print("=== Testing Enhanced Dashboard ===")
    
    # Test if server is running
    try:
        response = requests.get("http://localhost:5000/", timeout=5)
        print("✅ Server is running")
    except requests.exceptions.RequestException:
        print("❌ Server is not running. Please start it with: python api.py")
        return
    
    # Test if dashboard HTML is accessible
    try:
        response = requests.get("http://localhost:5000/enhanced-dashboard.html", timeout=10)
        if response.status_code == 200:
            print("✅ Enhanced dashboard HTML accessible")
        else:
            print(f"❌ Dashboard HTML error: {response.status_code}")
            return
    except requests.exceptions.RequestException as e:
        print(f"❌ Dashboard HTML error: {e}")
        return
    
    # Test API endpoint
    try:
        response = requests.get("http://localhost:5000/api/multi-ticker?tickers=AAPL,MSFT&period=1y&interval=1d", timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('results'):
                print(f"✅ API working - returned {len(data['results'])} tickers")
                
                # Check for RSI3M3 data
                for ticker, ticker_data in data['results'].items():
                    if ticker_data.get('rsi3m3'):
                        print(f"✅ {ticker} has RSI3M3 data")
                    else:
                        print(f"⚠️  {ticker} missing RSI3M3 data")
            else:
                print(f"❌ API returned invalid data: {data}")
                return
        else:
            print(f"❌ API error: {response.status_code}")
            return
    except requests.exceptions.RequestException as e:
        print(f"❌ API error: {e}")
        return
    
    print("\n🎉 All tests passed!")
    print("\n📋 Next steps:")
    print("1. Open: http://localhost:5000/enhanced-dashboard.html")
    print("2. Open browser developer tools (F12)")
    print("3. Go to Console tab to see debug logs")
    print("4. Enter tickers like: AAPL, MSFT, BTC-USD")
    print("5. Click 'Add Tickers' and watch the console logs")
    print("6. Look for RSI3M3+ indicators with colored backgrounds!")
    
    # Optionally open the browser
    try:
        webbrowser.open('http://localhost:5000/enhanced-dashboard.html')
        print("🌐 Opened dashboard in default browser")
    except:
        print("⚠️  Could not auto-open browser")

if __name__ == "__main__":
    test_dashboard() 