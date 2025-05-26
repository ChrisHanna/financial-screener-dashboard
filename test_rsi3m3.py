#!/usr/bin/env python3
"""
Test RSI3M3+ oscillator integration
"""

import requests

def test_rsi3m3():
    print("=== Testing RSI3M3+ Integration ===")
    
    url = "http://localhost:5000/api/analyzer-b"
    params = {
        'ticker': 'AAPL',
        'period': '1y',
        'interval': '1d'
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"✅ API Response successful for {data.get('ticker')}")
            
            # Check RSI3M3+ data
            rsi3m3_data = data.get('rsi3m3', {})
            
            if rsi3m3_data:
                print("✅ RSI3M3+ data found!")
                
                rsi3m3_values = rsi3m3_data.get('rsi3m3', [])
                state_values = rsi3m3_data.get('state', [])
                buy_signals = rsi3m3_data.get('signals', {}).get('buy', [])
                sell_signals = rsi3m3_data.get('signals', {}).get('sell', [])
                
                print(f"   Data points: {len(rsi3m3_values)}")
                print(f"   State points: {len(state_values)}")
                print(f"   Buy signals: {len(buy_signals)}")
                print(f"   Sell signals: {len(sell_signals)}")
                
                if rsi3m3_values:
                    latest_rsi3m3 = rsi3m3_values[-1]
                    latest_state = state_values[-1] if state_values else 0
                    
                    print(f"   Latest RSI3M3: {latest_rsi3m3:.2f}")
                    print(f"   Latest State: {latest_state}")
                    
                    # Interpret state
                    state_labels = {0: "Neutral", 1: "Bullish", 2: "Bearish", 3: "Transition"}
                    state_label = state_labels.get(latest_state, "Unknown")
                    print(f"   State meaning: {state_label}")
                    
                    print("🎉 RSI3M3+ Successfully Integrated!")
                    
                    # Test dashboard access
                    print("\n=== Dashboard Test ===")
                    print("Try opening:")
                    print("   Regular Dashboard: http://localhost:5000/dashboard.html")
                    print("   Enhanced Dashboard: http://localhost:5000/enhanced-dashboard.html")
                    print("\nLook for the new RSI3M3 indicator with colored background!")
                    
                else:
                    print("❌ No RSI3M3 values found")
            else:
                print("❌ No RSI3M3 data in response")
                
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Test Error: {e}")

if __name__ == "__main__":
    test_rsi3m3() 