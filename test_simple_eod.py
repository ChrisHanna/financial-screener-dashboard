#!/usr/bin/env python3
"""
Simple test to verify EOD API integration with Flask server
"""

import requests
import time

def test_single_ticker():
    """Test single ticker with EOD API"""
    print("=== Testing Single Ticker with EOD API ===")
    
    url = "http://localhost:5000/api/analyzer-b"
    params = {
        'ticker': 'AAPL',
        'period': '1y',
        'interval': '1d'
    }
    
    try:
        start_time = time.time()
        response = requests.get(url, params=params, timeout=60)
        end_time = time.time()
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"✅ Request successful! ({end_time - start_time:.1f}s)")
            print(f"Success: {result.get('success')}")
            print(f"Ticker: {result.get('ticker')}")
            print(f"Company: {result.get('companyName')}")
            print(f"Data points: {len(result.get('dates', []))}")
            print(f"Price range: {result.get('summary', {}).get('currentPrice')}")
            
            # Check if we have proper indicator data
            summary = result.get('summary', {})
            print(f"Current WT1: {summary.get('currentWT1', 'N/A')}")
            print(f"Current WT2: {summary.get('currentWT2', 'N/A')}")
            print(f"Current MF: {summary.get('currentMF', 'N/A')}")
            
            if len(result.get('dates', [])) > 200:
                print("🎉 SUCCESS: Full year of data received for proper indicator calculation!")
            else:
                print(f"⚠️  Warning: Only {len(result.get('dates', []))} data points (expected ~250)")
                
        else:
            print(f"❌ Request failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def test_multi_ticker_small():
    """Test multi-ticker with fewer tickers"""
    print("\n=== Testing Multi-Ticker with 3 Tickers ===")
    
    url = "http://localhost:5000/api/multi-ticker"
    params = {
        'tickers': 'AAPL,MSFT,SPY',
        'period': '1y',
        'interval': '1d'
    }
    
    try:
        start_time = time.time()
        response = requests.get(url, params=params, timeout=120)
        end_time = time.time()
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"✅ Request successful! ({end_time - start_time:.1f}s)")
            print(f"Success: {result.get('success')}")
            print(f"Total results: {result.get('count', 0)}")
            
            results = result.get('results', {})
            for ticker, data in results.items():
                data_points = len(data.get('dates', []))
                company = data.get('companyName', 'N/A')
                print(f"  {ticker}: {data_points} data points - {company}")
                
            if all(len(data.get('dates', [])) > 200 for data in results.values()):
                print("🎉 SUCCESS: All tickers have full year of data!")
            else:
                print("⚠️  Some tickers have insufficient data")
                
        else:
            print(f"❌ Request failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_single_ticker()
    test_multi_ticker_small() 