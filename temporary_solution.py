"""
Temporary solution for rate limiting - generates mock data for testing
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

def generate_mock_data(ticker, period='1mo', interval='1d'):
    """
    Generate realistic mock stock data when yfinance is rate-limited
    """
    
    # Determine number of data points based on period
    period_days = {
        '1d': 1, '5d': 5, '1mo': 30, '3mo': 90, 
        '6mo': 180, '1y': 365, '2y': 730
    }
    
    days = period_days.get(period, 30)
    
    # Create date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    if interval == '1d':
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        # Remove weekends for stock data
        dates = dates[dates.weekday < 5]
    else:
        dates = pd.date_range(start=start_date, end=end_date, freq='D')[:days]
    
    n_points = len(dates)
    
    # Generate realistic price data with trend and volatility
    np.random.seed(hash(ticker) % 1000)  # Consistent data per ticker
    
    # Base prices for different tickers
    base_prices = {
        'AAPL': 180, 'MSFT': 340, 'GOOGL': 140, 'TSLA': 190,
        'SPY': 420, 'BTC-USD': 45000, 'EUR=X': 1.08, 'NVDA': 450,
        'CVS': 75, 'SBUX': 95, 'ADA-USD': 0.45, 'XRP-USD': 0.52
    }
    
    base_price = base_prices.get(ticker, 100)
    
    # Generate random walk with trend
    returns = np.random.normal(0.001, 0.02, n_points)  # Small positive trend
    prices = [base_price]
    
    for ret in returns[1:]:
        new_price = prices[-1] * (1 + ret)
        prices.append(max(new_price, base_price * 0.5))  # Don't go below 50% of base
    
    # Create OHLCV data
    closes = np.array(prices)
    opens = np.roll(closes, 1)
    opens[0] = closes[0]
    
    # Generate realistic highs and lows
    highs = closes * np.random.uniform(1.0, 1.05, n_points)
    lows = closes * np.random.uniform(0.95, 1.0, n_points)
    
    # Ensure OHLC relationships are correct
    highs = np.maximum(highs, np.maximum(opens, closes))
    lows = np.minimum(lows, np.minimum(opens, closes))
    
    # Generate volume
    base_volume = 1000000 if ticker not in ['BTC-USD', 'ADA-USD', 'XRP-USD'] else 100000
    volumes = np.random.uniform(base_volume * 0.5, base_volume * 2, n_points)
    
    # Create DataFrame
    df = pd.DataFrame({
        'Open': opens,
        'High': highs,
        'Low': lows,
        'Close': closes,
        'Volume': volumes,
        'Adj Close': closes,  # Add Adj Close for compatibility
        'Dividends': np.zeros(n_points),
        'Stock Splits': np.zeros(n_points)
    }, index=dates)
    
    # Ensure no NaN values in critical columns
    critical_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
    for col in critical_cols:
        df[col] = df[col].fillna(method='ffill').fillna(method='bfill').fillna(base_price)
    
    df.attrs['company_name'] = f"{ticker} (Mock Data)"
    
    return df

def test_api_with_mock_data():
    """Test the API using mock data"""
    print("Testing API with mock data...")
    
    try:
        from api import analyze_mock_data
        
        # Test with AAPL mock data
        mock_df = generate_mock_data('AAPL', '1mo', '1d')
        result = analyze_mock_data('AAPL', mock_df, '1mo', '1d')
        
        if result and result.get('success'):
            print(f"✅ Mock data test successful: {len(result.get('dates', []))} data points")
            return True
        else:
            print("❌ Mock data test failed")
            return False
            
    except ImportError:
        print("❌ API module not available")
        return False

if __name__ == "__main__":
    print("Generating mock data for testing...")
    
    tickers = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'SPY']
    
    for ticker in tickers:
        mock_data = generate_mock_data(ticker, '1mo', '1d')
        print(f"✅ Generated {len(mock_data)} data points for {ticker}")
        print(f"   Price range: ${mock_data['Close'].min():.2f} - ${mock_data['Close'].max():.2f}")
    
    print("\nMock data generator ready!")
    print("Use this when yfinance is rate-limited.") 