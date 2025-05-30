"""
Timeframe Aggregation Module for Trading Dashboard
==================================================

This module provides aggregation functionality for creating custom timeframes
that are not natively supported by data providers (EOD API, yfinance).

Supports aggregating from base intervals (1h, 1d) to custom intervals:
- 3h, 6h (from 1h) 
- 2d, 3d (from 1d)

Includes proper time alignment for different asset types (crypto vs stocks)
and trading hours awareness.
"""

import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta
import pytz

logger = logging.getLogger(__name__)

class TimeframeAggregator:
    """
    Handles timeframe aggregation with proper time alignment and trading hours awareness
    """
    
    # Aggregation mappings - what intervals need aggregation and their base intervals
    AGGREGATION_RULES = {
        # From 1h to custom intervals
        '3h': {'base_interval': '1h', 'frequency': '3H', 'align_to': 'hour'},
        '6h': {'base_interval': '1h', 'frequency': '6H', 'align_to': 'hour'},
        
        # From 1d to custom intervals  
        '2d': {'base_interval': '1d', 'frequency': '2D', 'align_to': 'day'},
        '3d': {'base_interval': '1d', 'frequency': '3D', 'align_to': 'day'},
    }
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def get_asset_type(self, ticker):
        """
        Determine asset type from ticker symbol
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            str: 'stocks', 'crypto', or 'forex'
        """
        if '-USD' in ticker or ticker.endswith('USDT') or ticker.endswith('BTC') or '.CC' in ticker:
            return 'crypto'
        elif '=' in ticker or ticker.endswith('USD') or ticker.endswith('JPY') or ticker.endswith('EUR') or ticker.endswith('GBP') or '.FOREX' in ticker:
            return 'forex'
        else:
            return 'stocks'
    
    def should_aggregate(self, interval):
        """
        Check if an interval requires aggregation
        
        Args:
            interval: Target interval string
            
        Returns:
            bool: True if aggregation is needed
        """
        return interval in self.AGGREGATION_RULES
    
    def get_base_interval(self, interval):
        """
        Get the base interval needed for aggregation
        
        Args:
            interval: Target interval string
            
        Returns:
            str: Base interval to fetch
        """
        if interval in self.AGGREGATION_RULES:
            return self.AGGREGATION_RULES[interval]['base_interval']
        return interval
    
    def get_extended_period_for_aggregation(self, period, target_interval):
        """
        Calculate how much extra data we might need for proper aggregation
        
        Args:
            period: Original requested period
            target_interval: Target aggregation interval
            
        Returns:
            str: Extended period to fetch more base data
        """
        # For aggregation, we might need more data to get complete candles
        extensions = {
            '3h': {'1d': '2d', '5d': '6d', '1mo': '1mo'},
            '6h': {'1d': '2d', '5d': '6d', '1mo': '1mo'}, 
            '2d': {'1d': '3d', '5d': '7d', '1mo': '1mo'},
            '3d': {'1d': '5d', '5d': '8d', '1mo': '1mo'}
        }
        
        if target_interval in extensions and period in extensions[target_interval]:
            return extensions[target_interval][period]
        return period
    
    def align_timezone(self, df, asset_type):
        """
        Ensure DataFrame index has proper timezone information
        
        Args:
            df: DataFrame with datetime index
            asset_type: 'stocks', 'crypto', or 'forex'
            
        Returns:
            DataFrame with properly aligned timezone
        """
        try:
            if df.index.tzinfo is None:
                if asset_type == 'stocks':
                    # Assume US market timezone for stocks
                    df.index = df.index.tz_localize('America/New_York')
                    # Convert to UTC for consistency
                    df.index = df.index.tz_convert('UTC')
                else:
                    # Crypto and forex are already in UTC typically
                    df.index = df.index.tz_localize('UTC')
            elif df.index.tzinfo != pytz.UTC:
                # Convert to UTC if not already
                df.index = df.index.tz_convert('UTC')
                
            return df
            
        except Exception as e:
            self.logger.warning(f"Error aligning timezone: {e}")
            # Fallback: just ensure UTC
            if df.index.tzinfo is None:
                df.index = df.index.tz_localize('UTC')
            return df
    
    def filter_trading_hours(self, df, asset_type):
        """
        Filter data to trading hours for stocks (optional for crypto/forex)
        
        Args:
            df: DataFrame with datetime index
            asset_type: 'stocks', 'crypto', or 'forex'
            
        Returns:
            DataFrame filtered to trading hours
        """
        if asset_type != 'stocks':
            return df  # No filtering for crypto/forex
        
        try:
            # Convert to market timezone for filtering
            market_tz = pytz.timezone('America/New_York')
            df_market = df.copy()
            df_market.index = df_market.index.tz_convert(market_tz)
            
            # Filter to market hours (9:30 AM - 4:00 PM EST/EDT)
            market_open = pd.Timestamp('09:30').time()
            market_close = pd.Timestamp('16:00').time()
            
            # Create mask for trading hours
            mask = (
                (df_market.index.time >= market_open) & 
                (df_market.index.time <= market_close) &
                (df_market.index.weekday < 5)  # Monday=0, Friday=4
            )
            
            filtered_df = df[mask].copy()
            
            self.logger.info(f"Filtered {len(df)} -> {len(filtered_df)} data points for trading hours")
            return filtered_df
            
        except Exception as e:
            self.logger.warning(f"Error filtering trading hours: {e}")
            return df
    
    def get_alignment_anchor(self, interval, asset_type):
        """
        Get the appropriate time alignment anchor for the interval
        
        Args:
            interval: Target interval
            asset_type: Asset type
            
        Returns:
            dict: Alignment parameters
        """
        if interval in ['3h', '6h']:
            if asset_type == 'stocks':
                # Align to market open (13:30 UTC = 9:30 EST) - use timezone-aware origin
                return {
                    'freq': self.AGGREGATION_RULES[interval]['frequency'],
                    'origin': pd.Timestamp('1970-01-01 13:30:00', tz='UTC'),  # Market open in UTC
                }
            else:
                # Align to midnight UTC for crypto/forex
                return {
                    'freq': self.AGGREGATION_RULES[interval]['frequency'],
                    'origin': pd.Timestamp('1970-01-01 00:00:00', tz='UTC'),
                }
        elif interval in ['2d', '3d']:
            # Align to calendar days
            return {
                'freq': self.AGGREGATION_RULES[interval]['frequency'],
                'origin': pd.Timestamp('1970-01-01 00:00:00', tz='UTC'),
            }
        else:
            # Default alignment
            return {
                'freq': interval,
                'origin': None,
            }
    
    def aggregate_ohlcv(self, df, target_interval, ticker):
        """
        Aggregate OHLCV data to target interval
        
        Args:
            df: Source DataFrame with OHLCV data
            target_interval: Target interval (e.g., '3h', '6h', '2d')
            ticker: Ticker symbol for asset type detection
            
        Returns:
            DataFrame: Aggregated data
        """
        try:
            if not self.should_aggregate(target_interval):
                self.logger.info(f"No aggregation needed for {target_interval}")
                return df
            
            asset_type = self.get_asset_type(ticker)
            self.logger.info(f"Aggregating {ticker} ({asset_type}) to {target_interval}")
            
            # Ensure proper timezone alignment
            df = self.align_timezone(df, asset_type)
            
            # Optional: Filter to trading hours for stocks (only for hourly aggregations)
            if asset_type == 'stocks' and target_interval in ['3h', '6h']:
                df = self.filter_trading_hours(df, asset_type)
            
            # Get alignment parameters
            alignment = self.get_alignment_anchor(target_interval, asset_type)
            
            # Define aggregation functions
            agg_functions = {
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum'
            }
            
            # Handle Adj Close if present
            if 'Adj Close' in df.columns:
                agg_functions['Adj Close'] = 'last'
            
            # Perform resampling with proper alignment
            if alignment['origin']:
                resampled = df.resample(
                    alignment['freq'],
                    origin=alignment['origin']
                ).agg(agg_functions)
            else:
                resampled = df.resample(alignment['freq']).agg(agg_functions)
            
            # Remove rows with all NaN values
            resampled = resampled.dropna(how='all')
            
            # Fill any remaining NaN values in OHLC
            for col in ['Open', 'High', 'Low', 'Close']:
                if col in resampled.columns:
                    resampled[col] = resampled[col].fillna(method='ffill').fillna(method='bfill')
            
            # Ensure Volume is not negative and fill NaN with 0
            if 'Volume' in resampled.columns:
                resampled['Volume'] = resampled['Volume'].fillna(0).clip(lower=0)
            
            # Validate OHLC relationships
            resampled = self.validate_ohlc_data(resampled)
            
            self.logger.info(f"Aggregated {len(df)} -> {len(resampled)} {target_interval} candles")
            
            # Copy any attributes from original DataFrame
            if hasattr(df, 'attrs'):
                resampled.attrs = df.attrs.copy()
                resampled.attrs['was_aggregated'] = True
                resampled.attrs['base_interval'] = self.get_base_interval(target_interval)
                resampled.attrs['original_interval'] = target_interval
            
            return resampled
            
        except Exception as e:
            self.logger.error(f"Error aggregating to {target_interval}: {e}")
            return df  # Return original data as fallback
    
    def validate_ohlc_data(self, df):
        """
        Validate and fix OHLC relationships
        
        Args:
            df: DataFrame with OHLC data
            
        Returns:
            DataFrame: Validated OHLC data
        """
        try:
            # Check if we have the required columns
            ohlc_cols = ['Open', 'High', 'Low', 'Close']
            if not all(col in df.columns for col in ohlc_cols):
                return df
            
            # Fix OHLC relationships
            for i in range(len(df)):
                # Ensure High >= max(Open, Close) and Low <= min(Open, Close)
                open_val = df['Open'].iloc[i]
                close_val = df['Close'].iloc[i]
                high_val = df['High'].iloc[i]
                low_val = df['Low'].iloc[i]
                
                if pd.notna(open_val) and pd.notna(close_val):
                    # Fix High
                    min_high = max(open_val, close_val)
                    if pd.isna(high_val) or high_val < min_high:
                        df.loc[df.index[i], 'High'] = min_high
                    
                    # Fix Low
                    max_low = min(open_val, close_val)
                    if pd.isna(low_val) or low_val > max_low:
                        df.loc[df.index[i], 'Low'] = max_low
            
            return df
            
        except Exception as e:
            self.logger.warning(f"Error validating OHLC data: {e}")
            return df

# Global aggregator instance
_aggregator = None

def get_aggregator():
    """Get or create global aggregator instance"""
    global _aggregator
    if _aggregator is None:
        _aggregator = TimeframeAggregator()
    return _aggregator

def aggregate_timeframe(df, target_interval, ticker):
    """
    Convenience function to aggregate DataFrame to target interval
    
    Args:
        df: Source DataFrame
        target_interval: Target interval string
        ticker: Ticker symbol
        
    Returns:
        DataFrame: Aggregated data
    """
    aggregator = get_aggregator()
    return aggregator.aggregate_ohlcv(df, target_interval, ticker)

def should_aggregate_interval(interval):
    """
    Check if interval needs aggregation
    
    Args:
        interval: Interval string
        
    Returns:
        bool: True if aggregation needed
    """
    aggregator = get_aggregator()
    return aggregator.should_aggregate(interval)

def get_base_interval_for_aggregation(interval):
    """
    Get base interval needed for aggregation
    
    Args:
        interval: Target interval
        
    Returns:
        str: Base interval to fetch
    """
    aggregator = get_aggregator()
    return aggregator.get_base_interval(interval)

def get_extended_period_for_aggregation(period, interval):
    """
    Get extended period for better aggregation
    
    Args:
        period: Original period
        interval: Target interval
        
    Returns:
        str: Extended period
    """
    aggregator = get_aggregator()
    return aggregator.get_extended_period_for_aggregation(period, interval)

# Test function
def test_aggregation():
    """Test the aggregation functionality"""
    import yfinance as yf
    
    # Test data
    ticker = 'AAPL'
    
    try:
        # Get 1h data
        stock = yf.Ticker(ticker)
        df_1h = stock.history(period='5d', interval='1h')
        
        if df_1h.empty:
            print("❌ No test data available")
            return
        
        print(f"Original 1h data: {len(df_1h)} candles")
        print(f"Date range: {df_1h.index[0]} to {df_1h.index[-1]}")
        
        # Test different aggregations
        test_intervals = ['3h', '6h']
        
        for interval in test_intervals:
            aggregated = aggregate_timeframe(df_1h.copy(), interval, ticker)
            print(f"\n{interval} aggregation: {len(aggregated)} candles")
            
            if not aggregated.empty:
                print(f"  Date range: {aggregated.index[0]} to {aggregated.index[-1]}")
                print(f"  Latest OHLC: O={aggregated['Open'].iloc[-1]:.2f}, "
                      f"H={aggregated['High'].iloc[-1]:.2f}, "
                      f"L={aggregated['Low'].iloc[-1]:.2f}, "
                      f"C={aggregated['Close'].iloc[-1]:.2f}")
                print(f"  Was aggregated: {aggregated.attrs.get('was_aggregated', False)}")
        
        # Test daily aggregations
        df_1d = stock.history(period='1mo', interval='1d')
        test_daily_intervals = ['2d', '3d']
        
        for interval in test_daily_intervals:
            aggregated = aggregate_timeframe(df_1d.copy(), interval, ticker)
            print(f"\n{interval} aggregation: {len(aggregated)} candles")
            
            if not aggregated.empty:
                print(f"  Date range: {aggregated.index[0]} to {aggregated.index[-1]}")
                print(f"  Was aggregated: {aggregated.attrs.get('was_aggregated', False)}")
        
        print("\n✅ Aggregation tests completed successfully")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_aggregation() 