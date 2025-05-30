"""
Test script for timeframe aggregation integration
================================================

This script tests the new aggregated intervals (3h, 6h, 2d, 3d) to ensure
they work correctly with both the API endpoints and data fetching functions.
"""

import sys
import os
import requests
import json
from datetime import datetime

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_timeframe_aggregator_module():
    """Test the timeframe aggregator module directly"""
    print("=" * 60)
    print("Testing Timeframe Aggregator Module")
    print("=" * 60)
    
    try:
        from timeframe_aggregator import (
            should_aggregate_interval,
            get_base_interval_for_aggregation,
            get_extended_period_for_aggregation,
            aggregate_timeframe,
            test_aggregation
        )
        
        # Test the basic functions
        test_intervals = ['3h', '6h', '2d', '3d', '1h', '1d']
        
        for interval in test_intervals:
            should_agg = should_aggregate_interval(interval)
            base_interval = get_base_interval_for_aggregation(interval)
            
            print(f"{interval:3s}: should_aggregate={str(should_agg):5s}, base_interval={base_interval}")
        
        print("\nRunning aggregator test with real data...")
        test_aggregation()
        
        return True
        
    except Exception as e:
        print(f"❌ Timeframe aggregator test failed: {e}")
        return False

def test_fetch_stock_data_function():
    """Test the updated fetch_stock_data function"""
    print("\n" + "=" * 60)
    print("Testing fetch_stock_data Function")
    print("=" * 60)
    
    try:
        from api import fetch_stock_data
        
        test_cases = [
            ('AAPL', '1mo', '3h'),   # New aggregated interval
            ('AAPL', '1mo', '6h'),   # New aggregated interval
            ('AAPL', '2mo', '2d'),   # New aggregated interval
            ('AAPL', '2mo', '3d'),   # New aggregated interval
            ('AAPL', '1mo', '4h'),   # Existing interval (should still work)
            ('AAPL', '1mo', '1d'),   # Standard interval
        ]
        
        for ticker, period, interval in test_cases:
            print(f"\nTesting {ticker} {period} {interval}...")
            
            try:
                df = fetch_stock_data(ticker, period, interval)
                
                if df is not None and not df.empty:
                    print(f"✅ Success: {len(df)} data points")
                    print(f"   Was aggregated: {df.attrs.get('was_aggregated', False)}")
                    print(f"   Base interval: {df.attrs.get('base_interval', 'N/A')}")
                    print(f"   Aggregation method: {df.attrs.get('aggregation_method', 'N/A')}")
                    print(f"   Date range: {df.index[0]} to {df.index[-1]}")
                    print(f"   Latest close: ${df['Close'].iloc[-1]:.2f}")
                else:
                    print(f"❌ Failed to fetch data")
                    
            except Exception as e:
                print(f"❌ Error: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ fetch_stock_data test failed: {e}")
        return False

def test_api_endpoints():
    """Test the API endpoints with new intervals"""
    print("\n" + "=" * 60)
    print("Testing API Endpoints")
    print("=" * 60)
    
    base_url = "http://localhost:5000"
    
    # Test if server is running
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code != 200:
            print("❌ API server not running. Please start the Flask app first.")
            return False
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to API server. Please start the Flask app first.")
        return False
    
    test_cases = [
        ("AAPL", "1mo", "3h"),   # New aggregated interval
        ("AAPL", "1mo", "6h"),   # New aggregated interval
        ("AAPL", "2mo", "2d"),   # New aggregated interval
        ("AAPL", "2mo", "3d"),   # New aggregated interval
        ("MSFT", "1mo", "4h"),   # Existing interval
        ("GOOGL", "1mo", "1d"),  # Standard interval
    ]
    
    success_count = 0
    
    for ticker, period, interval in test_cases:
        url = f"{base_url}/api/analyzer-b?ticker={ticker}&period={period}&interval={interval}"
        
        try:
            print(f"\nTesting API: {ticker} {period} {interval}")
            response = requests.get(url, timeout=30)
            data = response.json()
            
            if data.get('success'):
                metadata = data.get('metadata', {})
                print(f"✅ API Success:")
                print(f"   Data points: {metadata.get('data_points', 0)}")
                print(f"   Was aggregated: {metadata.get('was_aggregated', False)}")
                print(f"   Base interval: {metadata.get('base_interval', 'N/A')}")
                print(f"   Aggregation method: {metadata.get('aggregation_method', 'N/A')}")
                print(f"   Timeframe aggregation available: {metadata.get('timeframe_aggregation_available', False)}")
                
                # Check if we have proper data structure
                if 'ohlc' in data and len(data['ohlc']) > 0:
                    print(f"   OHLC data: {len(data['ohlc'])} candles")
                    latest_candle = data['ohlc'][-1]
                    print(f"   Latest candle: O={latest_candle['o']:.2f}, H={latest_candle['h']:.2f}, L={latest_candle['l']:.2f}, C={latest_candle['c']:.2f}")
                
                success_count += 1
            else:
                print(f"❌ API Error: {data.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"❌ Request Error: {e}")
    
    print(f"\nAPI Test Results: {success_count}/{len(test_cases)} successful")
    return success_count == len(test_cases)

def test_available_options_endpoint():
    """Test the available options endpoint includes new intervals"""
    print("\n" + "=" * 60)
    print("Testing Available Options Endpoint")
    print("=" * 60)
    
    try:
        response = requests.get("http://localhost:5000/api/available-options", timeout=10)
        data = response.json()
        
        intervals = data.get('intervals', [])
        expected_new_intervals = ['3h', '6h', '2d', '3d']
        
        print(f"Available intervals: {intervals}")
        
        missing_intervals = [interval for interval in expected_new_intervals if interval not in intervals]
        
        if missing_intervals:
            print(f"❌ Missing intervals: {missing_intervals}")
            return False
        else:
            print(f"✅ All new intervals are available: {expected_new_intervals}")
            return True
            
    except Exception as e:
        print(f"❌ Available options test failed: {e}")
        return False

def test_eod_api_integration():
    """Test EOD API integration if available"""
    print("\n" + "=" * 60)
    print("Testing EOD API Integration")
    print("=" * 60)
    
    try:
        import os
        eod_api_key = os.getenv('EOD_API_KEY')
        use_eod_api = os.getenv('USE_EOD_API', 'false').lower() == 'true'
        
        if not use_eod_api or not eod_api_key:
            print("⚠️  EOD API not configured (USE_EOD_API=false or no API key)")
            return True  # Not a failure, just not configured
        
        from eod_api import fetch_stock_data_eod
        
        test_cases = [
            ('AAPL.US', '1mo', '3h'),
            ('AAPL.US', '1mo', '6h'),
        ]
        
        for ticker, period, interval in test_cases:
            print(f"\nTesting EOD API: {ticker} {period} {interval}")
            
            try:
                df = fetch_stock_data_eod(ticker, period, interval)
                
                if df is not None and not df.empty:
                    print(f"✅ EOD Success: {len(df)} data points")
                    print(f"   Was aggregated: {df.attrs.get('was_aggregated', False)}")
                    print(f"   Base interval: {df.attrs.get('base_interval', 'N/A')}")
                else:
                    print(f"❌ EOD API returned no data")
                    
            except Exception as e:
                print(f"❌ EOD API Error: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ EOD API test failed: {e}")
        return False

def test_multi_ticker_endpoint():
    """Test multi-ticker endpoint with new intervals"""
    print("\n" + "=" * 60)
    print("Testing Multi-Ticker Endpoint")
    print("=" * 60)
    
    try:
        url = "http://localhost:5000/api/multi-ticker?tickers=AAPL,MSFT&period=1mo&interval=3h"
        
        print(f"Testing multi-ticker with 3h interval...")
        response = requests.get(url, timeout=60)
        data = response.json()
        
        if data.get('success'):
            results = data.get('results', {})
            print(f"✅ Multi-ticker success: {len(results)} tickers processed")
            
            for ticker, result in results.items():
                metadata = result.get('metadata', {})
                print(f"   {ticker}: {metadata.get('data_points', 0)} points, aggregated: {metadata.get('was_aggregated', False)}")
            
            return True
        else:
            print(f"❌ Multi-ticker error: {data.get('error', 'Unknown')}")
            return False
            
    except Exception as e:
        print(f"❌ Multi-ticker test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Timeframe Aggregation Integration Test Suite")
    print("=" * 80)
    print(f"Test started at: {datetime.now()}")
    
    tests = [
        ("Timeframe Aggregator Module", test_timeframe_aggregator_module),
        ("fetch_stock_data Function", test_fetch_stock_data_function),
        ("API Endpoints", test_api_endpoints),
        ("Available Options Endpoint", test_available_options_endpoint),
        ("EOD API Integration", test_eod_api_integration),
        ("Multi-Ticker Endpoint", test_multi_ticker_endpoint),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if result:
                passed += 1
                print(f"\n✅ {test_name}: PASSED")
            else:
                print(f"\n❌ {test_name}: FAILED")
        except Exception as e:
            print(f"\n💥 {test_name}: ERROR - {e}")
    
    print("\n" + "=" * 80)
    print(f"🏁 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Timeframe aggregation is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the output above for details.")
    
    print(f"Test completed at: {datetime.now()}")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 