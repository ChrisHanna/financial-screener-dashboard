#!/usr/bin/env python3
"""
Test script for enhanced dashboard functionality
"""

import requests
import json
import time

def test_enhanced_dashboard():
    print("=== Testing Enhanced Dashboard ===")
    
    # Test with the default tickers that enhanced dashboard loads
    url = "http://localhost:5000/api/multi-ticker"
    params = {
        'tickers': 'AAPL,BTC-USD,SPY,EUR=X,XRP-USD,MSFT,CVS,SBUX,ADA-USD',
        'period': '1y',
        'interval': '1d'
    }
    
    print(f"Testing Enhanced Dashboard URL: {url}")
    print(f"Parameters: {params}")
    print()
    
    try:
        start_time = time.time()
        response = requests.get(url, params=params, timeout=60)
        end_time = time.time()
        
        if response.status_code == 200:
            result = response.json()
            
            print("✅ Enhanced Dashboard API successful!")
            print(f"⏱️ Request took: {end_time - start_time:.2f} seconds")
            print(f"Success: {result.get('success')}")
            print(f"Total results: {result.get('count')}")
            print(f"Mock fallback available: {result.get('mock_fallback_available')}")
            
            processing_info = result.get('processing_info', {})
            print(f"Processing info: {processing_info}")
            
            print("\n=== Individual Ticker Results ===")
            for ticker, data in result.get('results', {}).items():
                is_mock = data.get('is_mock_data', False)
                data_points = len(data.get('dates', []))
                company_name = data.get('companyName', ticker)
                summary = data.get('summary', {})
                current_price = summary.get('currentPrice', 0)
                
                print(f"  {ticker}: {data_points} data points ({'MOCK' if is_mock else 'REAL'} data)")
                print(f"    Company: {company_name}")
                print(f"    Current Price: ${current_price:.2f}")
                
                if is_mock:
                    print(f"    Notice: {data.get('mock_notice', 'Using mock data')}")
            
            print("\n=== Errors ===")
            errors = result.get('errors', {})
            if errors:
                for ticker, error in errors.items():
                    print(f"  {ticker}: {error}")
            else:
                print("  No errors!")
            
            if result.get('count', 0) >= 7:  # At least 7 out of 9 tickers should work
                print("\n🎉 SUCCESS: Enhanced Dashboard should work properly!")
                print("   Try opening: http://localhost:5000/enhanced-dashboard.html")
                
                # Test the enhanced dashboard JavaScript compatibility
                test_structure = check_data_structure(result)
                if test_structure:
                    print("✅ Data structure is compatible with enhanced dashboard JavaScript")
                else:
                    print("❌ Data structure may have issues with enhanced dashboard JavaScript")
                    
            else:
                print(f"\n❌ PARTIAL SUCCESS: Only {result.get('count', 0)} out of 9 tickers loaded")
                
        else:
            print(f"❌ Request failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def check_data_structure(result):
    """Check if the API response has the structure expected by enhanced dashboard"""
    if not result.get('results'):
        return False
    
    # Check one ticker to see if it has the expected structure
    first_ticker_data = next(iter(result['results'].values()))
    
    required_fields = ['dates', 'price', 'companyName', 'summary']
    missing_fields = []
    
    for field in required_fields:
        if field not in first_ticker_data:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"❌ Missing required fields: {missing_fields}")
        return False
    
    # Check summary structure
    summary = first_ticker_data.get('summary', {})
    summary_fields = ['currentPrice', 'priceChangePct', 'currentWT1', 'currentWT2', 'currentMF']
    missing_summary_fields = []
    
    for field in summary_fields:
        if field not in summary:
            missing_summary_fields.append(field)
    
    if missing_summary_fields:
        print(f"⚠️ Missing summary fields (may cause display issues): {missing_summary_fields}")
        return True  # Still compatible, just might have display issues
    
    return True

if __name__ == "__main__":
    test_enhanced_dashboard() 