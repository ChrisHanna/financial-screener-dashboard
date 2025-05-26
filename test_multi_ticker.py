#!/usr/bin/env python3
"""
Test script for multi-ticker endpoint with mock data fallback
"""

import requests
import json
import time

def test_multi_ticker():
    print("=== Testing Multi-Ticker Endpoint ===")
    
    # Test with a few tickers that typically get rate limited
    url = "http://localhost:5000/api/multi-ticker"
    params = {
        'tickers': 'AAPL,MSFT,SPY',
        'period': '1mo',
        'interval': '1d',
        'mock_fallback': 'true'
    }
    
    print(f"Testing URL: {url}")
    print(f"Parameters: {params}")
    print()
    
    try:
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            print("✅ Request successful!")
            print(f"Success: {result.get('success')}")
            print(f"Total results: {result.get('count')}")
            print(f"Mock fallback available: {result.get('mock_fallback_available')}")
            
            processing_info = result.get('processing_info', {})
            print(f"Processing info: {processing_info}")
            
            print("\n=== Individual Results ===")
            for ticker, data in result.get('results', {}).items():
                is_mock = data.get('is_mock_data', False)
                data_points = len(data.get('dates', []))
                company_name = data.get('companyName', ticker)
                print(f"  {ticker}: {data_points} data points ({'MOCK' if is_mock else 'REAL'} data)")
                print(f"    Company: {company_name}")
                if is_mock:
                    print(f"    Notice: {data.get('mock_notice', 'Using mock data')}")
            
            print("\n=== Errors ===")
            for ticker, error in result.get('errors', {}).items():
                print(f"  {ticker}: {error}")
            
            if result.get('count', 0) > 0:
                print("\n✅ SUCCESS: At least some tickers loaded successfully!")
            else:
                print("\n❌ FAILURE: No tickers loaded successfully")
                
        else:
            print(f"❌ Request failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def test_single_ticker():
    print("\n=== Testing Single Ticker Endpoint ===")
    
    url = "http://localhost:5000/api/analyzer-b"
    params = {
        'ticker': 'AAPL',
        'period': '1mo',
        'interval': '1d'
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Single ticker request successful!")
            print(f"Ticker: {result.get('ticker')}")
            print(f"Data points: {len(result.get('dates', []))}")
            print(f"Company: {result.get('companyName')}")
        else:
            print(f"❌ Single ticker failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Single ticker error: {e}")

if __name__ == "__main__":
    test_multi_ticker()
    test_single_ticker() 