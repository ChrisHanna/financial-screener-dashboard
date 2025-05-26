#!/usr/bin/env python3
"""
Test script to verify that the dashboards are working properly
"""

import requests
import time

def test_dashboards():
    print("=== Testing Dashboard Access ===")
    
    base_url = "http://localhost:5000"
    
    # Test enhanced dashboard
    try:
        response = requests.get(f"{base_url}/enhanced-dashboard.html", timeout=10)
        if response.status_code == 200:
            print("✅ Enhanced Dashboard accessible")
            print(f"   Response size: {len(response.content)} bytes")
        else:
            print(f"❌ Enhanced Dashboard error: {response.status_code}")
    except Exception as e:
        print(f"❌ Enhanced Dashboard error: {e}")
    
    # Test standard dashboard
    try:
        response = requests.get(f"{base_url}/dashboard.html", timeout=10)
        if response.status_code == 200:
            print("✅ Standard Dashboard accessible")
            print(f"   Response size: {len(response.content)} bytes")
        else:
            print(f"❌ Standard Dashboard error: {response.status_code}")
    except Exception as e:
        print(f"❌ Standard Dashboard error: {e}")
    
    # Test JavaScript files
    js_files = [
        "enhanced-dashboard.js",
        "dashboard-core.js",
        "script.js"
    ]
    
    for js_file in js_files:
        try:
            response = requests.get(f"{base_url}/{js_file}", timeout=10)
            if response.status_code == 200:
                print(f"✅ {js_file} accessible ({len(response.content)} bytes)")
            else:
                print(f"❌ {js_file} error: {response.status_code}")
        except Exception as e:
            print(f"❌ {js_file} error: {e}")
    
    # Test CSS file
    try:
        response = requests.get(f"{base_url}/enhanced-dashboard.css", timeout=10)
        if response.status_code == 200:
            print(f"✅ enhanced-dashboard.css accessible ({len(response.content)} bytes)")
        else:
            print(f"❌ enhanced-dashboard.css error: {response.status_code}")
    except Exception as e:
        print(f"❌ enhanced-dashboard.css error: {e}")
    
    # Test API endpoints
    print("\n=== Testing API Endpoints ===")
    
    # Test single ticker
    try:
        response = requests.get(f"{base_url}/api/analyzer-b?ticker=AAPL", timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Single ticker API working")
                print(f"   Data points: {len(data.get('dates', []))}")
                rsi3m3_data = data.get('rsi3m3', {})
                if rsi3m3_data.get('rsi3m3'):
                    print("✅ RSI3M3+ data included")
                else:
                    print("⚠️  RSI3M3+ data missing")
            else:
                print(f"❌ Single ticker API error: {data}")
        else:
            print(f"❌ Single ticker API error: {response.status_code}")
    except Exception as e:
        print(f"❌ Single ticker API error: {e}")
    
    print("\n🎉 Dashboard tests completed!")
    print("\nNow try:")
    print("1. Open http://localhost:5000/enhanced-dashboard.html")
    print("2. Add some tickers like: AAPL, MSFT, BTC-USD")
    print("3. Check for the RSI3M3+ indicator with colored backgrounds!")

if __name__ == "__main__":
    test_dashboards() 