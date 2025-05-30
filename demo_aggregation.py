"""
Quick Demo: Timeframe Aggregation for Trading Dashboard
======================================================

This script demonstrates the new aggregated intervals (3h, 6h, 2d, 3d)
with sample data fetching and analysis.
"""

import sys
import os
from datetime import datetime

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def demo_basic_aggregation():
    """Demo basic timeframe aggregation functionality"""
    print("🔥 Basic Timeframe Aggregation Demo")
    print("=" * 50)
    
    try:
        from timeframe_aggregator import (
            should_aggregate_interval,
            get_base_interval_for_aggregation,
            get_extended_period_for_aggregation
        )
        
        print("Supported Aggregated Intervals:")
        new_intervals = ['3h', '6h', '2d', '3d']
        
        for interval in new_intervals:
            base = get_base_interval_for_aggregation(interval)
            print(f"  {interval} → aggregated from {base}")
        
        print(f"\n✅ Aggregation module loaded successfully!")
        return True
        
    except ImportError as e:
        print(f"❌ Could not import aggregation module: {e}")
        return False

def demo_data_fetching():
    """Demo data fetching with new intervals"""
    print("\n📊 Data Fetching Demo")
    print("=" * 50)
    
    try:
        from api import fetch_stock_data
        
        ticker = 'AAPL'
        test_intervals = ['3h', '6h', '2d']
        
        for interval in test_intervals:
            print(f"\nFetching {ticker} data with {interval} interval...")
            
            try:
                df = fetch_stock_data(ticker, period='1mo', interval=interval)
                
                if df is not None and not df.empty:
                    print(f"✅ Success: {len(df)} candles")
                    print(f"   Aggregated: {df.attrs.get('was_aggregated', False)}")
                    print(f"   Method: {df.attrs.get('aggregation_method', 'N/A')}")
                    print(f"   Latest close: ${df['Close'].iloc[-1]:.2f}")
                else:
                    print(f"❌ No data returned")
                    
            except Exception as e:
                print(f"❌ Error: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Data fetching demo failed: {e}")
        return False

def demo_api_request():
    """Demo API request with new intervals"""
    print("\n🌐 API Request Demo")
    print("=" * 50)
    
    try:
        import requests
        
        base_url = "http://localhost:5000"
        
        # Test if server is running
        try:
            response = requests.get(f"{base_url}/", timeout=5)
        except:
            print("⚠️  API server not running. Start with: python api.py")
            return True  # Not a failure, just not running
        
        # Test new interval
        ticker = "AAPL"
        interval = "3h"
        period = "1mo"
        
        url = f"{base_url}/api/analyzer-b?ticker={ticker}&period={period}&interval={interval}"
        
        print(f"Making API request: {ticker} {period} {interval}")
        print(f"URL: {url}")
        
        response = requests.get(url, timeout=30)
        data = response.json()
        
        if data.get('success'):
            metadata = data.get('metadata', {})
            print(f"✅ API Success!")
            print(f"   Data points: {metadata.get('data_points', 0)}")
            print(f"   Was aggregated: {metadata.get('was_aggregated', False)}")
            print(f"   Base interval: {metadata.get('base_interval', 'N/A')}")
            print(f"   Current price: ${data.get('summary', {}).get('currentPrice', 0):.2f}")
            
            return True
        else:
            print(f"❌ API Error: {data.get('error', 'Unknown')}")
            return False
            
    except Exception as e:
        print(f"❌ API demo failed: {e}")
        return False

def demo_comparison():
    """Demo comparison between intervals"""
    print("\n⚖️  Interval Comparison Demo")
    print("=" * 50)
    
    try:
        from api import fetch_stock_data
        
        ticker = 'AAPL'
        period = '1mo'
        
        intervals = ['1h', '3h', '1d', '2d']
        results = {}
        
        print(f"Fetching {ticker} data with different intervals...")
        
        for interval in intervals:
            try:
                df = fetch_stock_data(ticker, period, interval)
                if df is not None and not df.empty:
                    results[interval] = {
                        'candles': len(df),
                        'aggregated': df.attrs.get('was_aggregated', False),
                        'latest_close': df['Close'].iloc[-1]
                    }
                    print(f"  {interval:3s}: {len(df):3d} candles, aggregated: {df.attrs.get('was_aggregated', False)}")
                else:
                    print(f"  {interval:3s}: No data")
            except Exception as e:
                print(f"  {interval:3s}: Error - {e}")
        
        print(f"\n📈 Results Summary:")
        for interval, data in results.items():
            status = "🔀 Aggregated" if data['aggregated'] else "📊 Direct"
            print(f"  {interval:3s}: {data['candles']:3d} candles, ${data['latest_close']:.2f} {status}")
        
        return True
        
    except Exception as e:
        print(f"❌ Comparison demo failed: {e}")
        return False

def main():
    """Run the demo"""
    print("🚀 Timeframe Aggregation Demo")
    print("=" * 80)
    print(f"Demo started at: {datetime.now()}")
    print()
    
    demos = [
        demo_basic_aggregation,
        demo_data_fetching,
        demo_comparison,
        demo_api_request,
    ]
    
    for demo in demos:
        try:
            demo()
        except Exception as e:
            print(f"❌ Demo error: {e}")
    
    print("\n" + "=" * 80)
    print("🎯 Demo Summary:")
    print("   ✨ New intervals: 3h, 6h, 2d, 3d")
    print("   🔀 Smart aggregation from base intervals")
    print("   📊 Proper time alignment for different asset types")
    print("   🌐 Full API integration")
    print("   📈 Compatible with existing dashboard")
    print()
    print("🚀 Ready to use! Try these URLs in your browser:")
    print("   http://localhost:5000/api/analyzer-b?ticker=AAPL&period=1mo&interval=3h")
    print("   http://localhost:5000/api/analyzer-b?ticker=AAPL&period=2mo&interval=2d")
    print()
    print(f"Demo completed at: {datetime.now()}")

if __name__ == "__main__":
    main() 