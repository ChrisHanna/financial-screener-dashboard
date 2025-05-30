import pandas as pd
import numpy as np
from eodhd import APIClient
import logging
from datetime import datetime, timedelta
import time
import os
from dotenv import load_dotenv

# Import aggregation functionality
try:
    from timeframe_aggregator import (
        get_aggregator, 
        should_aggregate_interval, 
        get_base_interval_for_aggregation,
        get_extended_period_for_aggregation
    )
    AGGREGATION_AVAILABLE = True
    logging.info("Timeframe aggregation module loaded in EOD API")
except ImportError:
    AGGREGATION_AVAILABLE = False
    logging.warning("Timeframe aggregation module not available in EOD API")

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EODDataProvider:
    def __init__(self, api_key=None):
        """
        Initialize EOD Historical Data provider
        
        Args:
            api_key: Your EOD API key. If None, will try to get from environment variable EOD_API_KEY
        """
        if api_key is None:
            api_key = os.getenv('EOD_API_KEY')
            
        if not api_key:
            raise ValueError("EOD API key is required. Set EOD_API_KEY environment variable or pass api_key parameter")
            
        self.api = APIClient(api_key)
        self.logger = logging.getLogger(__name__)
        
    def fetch_stock_data(self, ticker, period='1y', interval='1d'):
        """
        Fetch stock data from EOD Historical Data API with aggregation support
        
        Args:
            ticker: Stock ticker symbol (e.g., 'AAPL', 'BTC-USD')
            period: Data period ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max')
            interval: Data interval ('1m', '5m', '15m', '30m', '1h', '3h', '6h', '1d', '2d', '3d')
            
        Returns:
            DataFrame with OHLCV data or None if failed
        """
        try:
            # Check if we need aggregation
            needs_aggregation = False
            original_interval = interval
            
            if AGGREGATION_AVAILABLE and should_aggregate_interval(interval):
                needs_aggregation = True
                base_interval = get_base_interval_for_aggregation(interval)
                extended_period = get_extended_period_for_aggregation(period, interval)
                
                self.logger.info(f"Will aggregate {base_interval} -> {interval} for {ticker}")
                
                # Fetch base interval data with extended period
                df = self._fetch_base_data(ticker, extended_period, base_interval)
                
                if df is None or df.empty:
                    self.logger.warning(f"No base data available for aggregation")
                    return None
                
                # Perform aggregation
                aggregator = get_aggregator()
                df = aggregator.aggregate_ohlcv(df, original_interval, ticker)
                
            else:
                # Direct fetch without aggregation
                df = self._fetch_base_data(ticker, period, interval)
            
            if df is None or df.empty:
                return None
            
            # Add metadata
            df.attrs['company_name'] = ticker
            df.attrs['original_interval'] = original_interval
            df.attrs['was_aggregated'] = needs_aggregation
            
            if needs_aggregation:
                df.attrs['base_interval'] = base_interval
                df.attrs['aggregation_method'] = 'smart_timeframe_aggregator'
                
            self.logger.info(f"Successfully fetched {len(df)} rows for {ticker} ({original_interval})")
            return df
            
        except Exception as e:
            self.logger.error(f"Error fetching data for {ticker}: {str(e)}")
            return None
    
    def _fetch_base_data(self, ticker, period, interval):
        """
        Fetch base data from EOD API (no aggregation)
        
        Args:
            ticker: Stock ticker symbol
            period: Data period
            interval: Data interval (must be supported by EOD)
            
        Returns:
            DataFrame with OHLCV data or None if failed
        """
        try:
            # Convert our period format to EOD API format
            from_date, to_date = self._convert_period_to_dates(period)
            
            # Convert ticker format
            eod_symbol = self._convert_ticker_format(ticker)
            
            self.logger.info(f"Fetching EOD base data for {eod_symbol}, period: {period}, interval: {interval}")
            
            # Map our intervals to EOD supported intervals
            eod_interval_map = {
                '1m': '1m',
                '5m': '5m', 
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '1d': 'd',
                '1wk': 'w',
                '1mo': 'm'
            }
            
            if interval not in eod_interval_map:
                self.logger.error(f"Unsupported base interval for EOD API: {interval}")
                return None
            
            eod_interval = eod_interval_map[interval]
            
            if interval in ['1m', '5m', '15m', '30m', '1h']:
                # Use intraday API for short intervals
                df = self._fetch_intraday_data(eod_symbol, eod_interval, from_date, to_date)
            else:
                # Use end-of-day API for daily and longer intervals
                df = self._fetch_eod_data(eod_symbol, from_date, to_date)
            
            return df
            
        except Exception as e:
            self.logger.error(f"Error fetching base data: {str(e)}")
            return None
    
    def _convert_ticker_format(self, ticker):
        """
        Convert ticker to EOD format
        
        EOD uses format: SYMBOL.EXCHANGE
        - US stocks: AAPL.US
        - Crypto: BTC-USD.CC  
        - Forex: EURUSD.FOREX
        """
        if '-USD' in ticker and not ticker.endswith('.CC'):
            # Crypto currency
            return f"{ticker}.CC"
        elif '=' in ticker or ticker.endswith('USD') or ticker.endswith('EUR') or ticker.endswith('GBP'):
            # Forex
            clean_ticker = ticker.replace('=X', '').replace('=', '')
            return f"{clean_ticker}.FOREX"
        elif '.' not in ticker and not any(suffix in ticker for suffix in ['-USD', '.CC', '.FOREX']):
            # Assume US stock if no exchange specified
            return f"{ticker}.US"
        else:
            # Already in correct format or keep as is
            return ticker
    
    def _convert_period_to_dates(self, period):
        """Convert period string to from_date and to_date"""
        end_date = datetime.now()
        
        if period == '1d':
            start_date = end_date - timedelta(days=1)
        elif period == '5d':
            start_date = end_date - timedelta(days=5)
        elif period == '1mo':
            start_date = end_date - timedelta(days=30)
        elif period == '3mo':
            start_date = end_date - timedelta(days=90)
        elif period == '6mo':
            start_date = end_date - timedelta(days=180)
        elif period == '1y':
            start_date = end_date - timedelta(days=365)
        elif period == '2y':
            start_date = end_date - timedelta(days=730)
        elif period == '5y':
            start_date = end_date - timedelta(days=1825)
        elif period == '10y':
            start_date = end_date - timedelta(days=3650)
        else:  # 'max'
            start_date = datetime(2000, 1, 1)  # Go back to 2000
            
        return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')
    
    def _fetch_eod_data(self, symbol, from_date, to_date):
        """Fetch end-of-day data"""
        try:
            data = self.api.get_eod_historical_stock_market_data(
                symbol=symbol,
                period='d',
                from_date=from_date,
                to_date=to_date,
                order='a'  # ascending order
            )
            
            if not data:
                return None
                
            df = pd.DataFrame(data)
            
            # Rename columns to match yfinance format
            column_mapping = {
                'date': 'Date',
                'open': 'Open',
                'high': 'High', 
                'low': 'Low',
                'close': 'Close',
                'adjusted_close': 'Adj Close',
                'volume': 'Volume'
            }
            
            df = df.rename(columns=column_mapping)
            
            # Convert date column to datetime and set as index
            df['Date'] = pd.to_datetime(df['Date'])
            df.set_index('Date', inplace=True)
            
            # Sort by date
            df.sort_index(inplace=True)
            
            return df
            
        except Exception as e:
            self.logger.error(f"Error fetching EOD data for {symbol}: {str(e)}")
            return None
    
    def _fetch_intraday_data(self, symbol, interval, from_date, to_date):
        """Fetch intraday data"""
        try:
            # Convert interval format
            interval_mapping = {
                '1m': '1m',
                '5m': '5m', 
                '15m': '15m',
                '30m': '30m',
                '1h': '1h'
            }
            
            eod_interval = interval_mapping.get(interval, '1h')
            
            # Convert dates to Unix timestamps for intraday API
            from_ts = int(datetime.strptime(from_date, '%Y-%m-%d').timestamp())
            to_ts = int(datetime.strptime(to_date, '%Y-%m-%d').timestamp())
            
            data = self.api.get_intraday_historical_data(
                symbol=symbol,
                interval=eod_interval,
                from_unix_time=from_ts,
                to_unix_time=to_ts
            )
            
            if not data:
                return None
                
            df = pd.DataFrame(data)
            
            # Rename columns to match yfinance format
            column_mapping = {
                'datetime': 'Date',
                'open': 'Open',
                'high': 'High',
                'low': 'Low', 
                'close': 'Close',
                'volume': 'Volume'
            }
            
            df = df.rename(columns=column_mapping)
            
            # Convert datetime column and set as index
            df['Date'] = pd.to_datetime(df['Date'])
            df.set_index('Date', inplace=True)
            
            # Sort by date
            df.sort_index(inplace=True)
            
            return df
            
        except Exception as e:
            self.logger.error(f"Error fetching intraday data for {symbol}: {str(e)}")
            return None

# Global EOD provider instance
_eod_provider = None

def get_eod_provider(api_key=None):
    """Get or create EOD provider instance"""
    global _eod_provider
    if _eod_provider is None:
        _eod_provider = EODDataProvider(api_key=api_key)
    return _eod_provider

def fetch_stock_data_eod(ticker, period='1y', interval='1d', max_retries=3, retry_delay=2, use_cache=True):
    """
    EOD version of fetch_stock_data function - drop-in replacement for yfinance version
    
    Args:
        ticker: Stock ticker symbol
        period: Data period ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max')
        interval: Data interval ('1m', '5m', '15m', '30m', '1h', '1d')
        max_retries: Maximum number of retry attempts (kept for compatibility)
        retry_delay: Delay between retries in seconds (kept for compatibility)
        use_cache: Whether to use caching (kept for compatibility)
        
    Returns:
        DataFrame with stock data or None if failed
    """
    try:
        provider = get_eod_provider()
        return provider.fetch_stock_data(ticker, period, interval)
    except Exception as e:
        logger.error(f"Error in EOD fetch_stock_data for {ticker}: {str(e)}")
        return None

# Test function
def test_eod_api():
    """Test the EOD API integration"""
    try:
        # Test with a few different types of assets
        test_symbols = ['AAPL', 'BTC-USD', 'EUR=X']
        
        for symbol in test_symbols:
            print(f"\nTesting {symbol}...")
            df = fetch_stock_data_eod(symbol, period='1y', interval='1d')
            
            if df is not None:
                print(f"✅ {symbol}: {len(df)} data points")
                print(f"   Company: {df.attrs.get('company_name', 'N/A')}")
                print(f"   Date range: {df.index[0]} to {df.index[-1]}")
                print(f"   Latest close: ${df['Close'].iloc[-1]:.2f}")
            else:
                print(f"❌ {symbol}: Failed to fetch data")
                
    except Exception as e:
        print(f"Test error: {e}")

if __name__ == "__main__":
    test_eod_api() 