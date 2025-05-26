"""
API Optimization for Trading Dashboard
=====================================

This file contains optimized versions of computationally intensive functions
from api.py to improve performance and reliability.
"""

import pandas as pd
import numpy as np
import logging
from scipy.signal import argrelextrema
from numba import jit, njit
import warnings

logger = logging.getLogger(__name__)
warnings.filterwarnings('ignore')

@njit
def find_local_extrema_numba(data, order=5):
    """
    Numba-optimized function to find local minima and maxima
    
    Args:
        data: 1D numpy array
        order: Number of points on each side to compare
        
    Returns:
        Tuple of (minima_indices, maxima_indices)
    """
    n = len(data)
    minima = []
    maxima = []
    
    for i in range(order, n - order):
        is_min = True
        is_max = True
        
        for j in range(1, order + 1):
            if data[i] >= data[i - j] or data[i] >= data[i + j]:
                is_min = False
            if data[i] <= data[i - j] or data[i] <= data[i + j]:
                is_max = False
                
        if is_min:
            minima.append(i)
        if is_max:
            maxima.append(i)
            
    return minima, maxima

def detect_divergences_optimized(df, wt2, price, lookback=5):
    """
    Optimized divergence detection using scipy and numba for better performance
    """
    n = len(df)
    
    # Initialize result arrays
    bullish_div = np.zeros(n, dtype=bool)
    bearish_div = np.zeros(n, dtype=bool)
    hidden_bullish_div = np.zeros(n, dtype=bool)
    hidden_bearish_div = np.zeros(n, dtype=bool)
    
    if n < 2 * lookback + 1:
        return (pd.Series(bullish_div, index=df.index),
                pd.Series(bearish_div, index=df.index),
                pd.Series(hidden_bullish_div, index=df.index),
                pd.Series(hidden_bearish_div, index=df.index))
    
    # Convert to numpy arrays for faster processing
    wt2_values = wt2.values
    price_values = price.values
    
    # Find local extrema using scipy (much faster than nested loops)
    try:
        # Find local minima
        wt_minima = argrelextrema(wt2_values, np.less, order=lookback)[0]
        price_minima = argrelextrema(price_values, np.less, order=lookback)[0]
        
        # Find local maxima
        wt_maxima = argrelextrema(wt2_values, np.greater, order=lookback)[0]
        price_maxima = argrelextrema(price_values, np.greater, order=lookback)[0]
        
        # Process divergences for oversold conditions only
        oversold_wt_minima = wt_minima[wt2_values[wt_minima] < -40]
        overbought_wt_maxima = wt_maxima[wt2_values[wt_maxima] > 40]
        
        # Check for bullish divergences (regular and hidden)
        for i, wt_min_idx in enumerate(oversold_wt_minima):
            # Find corresponding price minimum close in time
            close_price_minima = price_minima[np.abs(price_minima - wt_min_idx) <= lookback]
            
            if len(close_price_minima) == 0:
                continue
                
            price_min_idx = close_price_minima[np.argmin(np.abs(close_price_minima - wt_min_idx))]
            
            # Look for previous minima for comparison
            prev_wt_minima = oversold_wt_minima[oversold_wt_minima < wt_min_idx - lookback]
            
            if len(prev_wt_minima) > 0:
                prev_wt_min_idx = prev_wt_minima[-1]  # Most recent previous minimum
                
                # Find corresponding previous price minimum
                prev_price_minima = price_minima[np.abs(price_minima - prev_wt_min_idx) <= lookback]
                
                if len(prev_price_minima) > 0:
                    prev_price_min_idx = prev_price_minima[np.argmin(np.abs(prev_price_minima - prev_wt_min_idx))]
                    
                    # Regular bullish divergence: price lower low, WT2 higher low
                    if (price_values[price_min_idx] < price_values[prev_price_min_idx] and
                        wt2_values[wt_min_idx] > wt2_values[prev_wt_min_idx]):
                        bullish_div[wt_min_idx] = True
                        
                    # Hidden bullish divergence: price higher low, WT2 lower low
                    if (price_values[price_min_idx] > price_values[prev_price_min_idx] and
                        wt2_values[wt_min_idx] < wt2_values[prev_wt_min_idx]):
                        hidden_bullish_div[wt_min_idx] = True
        
        # Check for bearish divergences (regular and hidden)
        for i, wt_max_idx in enumerate(overbought_wt_maxima):
            # Find corresponding price maximum close in time
            close_price_maxima = price_maxima[np.abs(price_maxima - wt_max_idx) <= lookback]
            
            if len(close_price_maxima) == 0:
                continue
                
            price_max_idx = close_price_maxima[np.argmin(np.abs(close_price_maxima - wt_max_idx))]
            
            # Look for previous maxima for comparison
            prev_wt_maxima = overbought_wt_maxima[overbought_wt_maxima < wt_max_idx - lookback]
            
            if len(prev_wt_maxima) > 0:
                prev_wt_max_idx = prev_wt_maxima[-1]  # Most recent previous maximum
                
                # Find corresponding previous price maximum
                prev_price_maxima = price_maxima[np.abs(price_maxima - prev_wt_max_idx) <= lookback]
                
                if len(prev_price_maxima) > 0:
                    prev_price_max_idx = prev_price_maxima[np.argmin(np.abs(prev_price_maxima - prev_wt_max_idx))]
                    
                    # Regular bearish divergence: price higher high, WT2 lower high
                    if (price_values[price_max_idx] > price_values[prev_price_max_idx] and
                        wt2_values[wt_max_idx] < wt2_values[prev_wt_max_idx]):
                        bearish_div[wt_max_idx] = True
                        
                    # Hidden bearish divergence: price lower high, WT2 higher high
                    if (price_values[price_max_idx] < price_values[prev_price_max_idx] and
                        wt2_values[wt_max_idx] > wt2_values[prev_wt_max_idx]):
                        hidden_bearish_div[wt_max_idx] = True
        
    except Exception as e:
        logger.warning(f"Error in optimized divergence detection: {e}")
        # Fallback to basic method or return empty results
        pass
    
    return (pd.Series(bullish_div, index=df.index),
            pd.Series(bearish_div, index=df.index),
            pd.Series(hidden_bullish_div, index=df.index),
            pd.Series(hidden_bearish_div, index=df.index))

@njit
def calculate_wavetrend_numba(hlc3_values, wt_channel_len, wt_average_len):
    """
    Numba-optimized WaveTrend calculation
    
    Args:
        hlc3_values: numpy array of HLC3 values
        wt_channel_len: Channel length parameter
        wt_average_len: Average length parameter
        
    Returns:
        Tuple of (wt1, wt2) as numpy arrays
    """
    n = len(hlc3_values)
    
    # EMA calculation with numba
    ema = np.zeros(n)
    alpha = 2.0 / (wt_channel_len + 1)
    ema[0] = hlc3_values[0]
    
    for i in range(1, n):
        ema[i] = alpha * hlc3_values[i] + (1 - alpha) * ema[i-1]
    
    # Calculate d (deviation)
    d = np.zeros(n)
    abs_diff = np.abs(hlc3_values - ema)
    d[0] = abs_diff[0]
    
    for i in range(1, n):
        d[i] = alpha * abs_diff[i] + (1 - alpha) * d[i-1]
    
    # Calculate ci (Commodity Index)
    ci = np.zeros(n)
    for i in range(n):
        if d[i] != 0:
            ci[i] = (hlc3_values[i] - ema[i]) / (0.015 * d[i])
    
    # Calculate tci (averaged ci)
    tci = np.zeros(n)
    alpha_avg = 2.0 / (wt_average_len + 1)
    tci[0] = ci[0]
    
    for i in range(1, n):
        tci[i] = alpha_avg * ci[i] + (1 - alpha_avg) * tci[i-1]
    
    return tci

def validate_data_quality(df, essential_columns):
    """
    Comprehensive data quality validation
    
    Args:
        df: DataFrame to validate
        essential_columns: List of columns that must be present and valid
        
    Returns:
        Tuple of (is_valid, issues, cleaned_df)
    """
    issues = []
    is_valid = True
    
    # Check for missing columns
    missing_cols = [col for col in essential_columns if col not in df.columns]
    if missing_cols:
        issues.append(f"Missing columns: {missing_cols}")
        is_valid = False
    
    # Check for insufficient data
    if len(df) < 30:
        issues.append(f"Insufficient data points: {len(df)} (minimum 30 required)")
        is_valid = False
    
    # Check for excessive NaN values
    for col in essential_columns:
        if col in df.columns:
            nan_pct = df[col].isna().mean()
            if nan_pct > 0.5:
                issues.append(f"Excessive NaN values in {col}: {nan_pct:.1%}")
                is_valid = False
            elif nan_pct > 0.1:
                issues.append(f"High NaN values in {col}: {nan_pct:.1%}")
    
    # Create cleaned DataFrame
    cleaned_df = df.copy()
    
    # Fill NaN values intelligently
    for col in essential_columns:
        if col in cleaned_df.columns:
            if col in ['Open', 'High', 'Low', 'Close']:
                # Forward fill then backward fill for price data
                cleaned_df[col] = cleaned_df[col].fillna(method='ffill').fillna(method='bfill')
            elif col == 'Volume':
                # Fill volume with 0 or median
                cleaned_df[col] = cleaned_df[col].fillna(0)
            else:
                # Fill indicators with interpolation or forward/backward fill
                cleaned_df[col] = cleaned_df[col].interpolate().fillna(method='ffill').fillna(method='bfill')
    
    return is_valid, issues, cleaned_df

def calculate_indicators_batch(df, params):
    """
    Calculate all indicators in an optimized batch process
    
    Args:
        df: DataFrame with OHLCV data
        params: Dictionary of parameters
        
    Returns:
        DataFrame with all indicators added
    """
    try:
        # Validate and clean data first
        essential_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        is_valid, issues, df_clean = validate_data_quality(df, essential_cols)
        
        if not is_valid:
            logger.warning(f"Data quality issues: {issues}")
            
        # Calculate HLC3 once
        hlc3 = (df_clean['High'] + df_clean['Low'] + df_clean['Close']) / 3
        
        # Calculate WaveTrend using optimized function
        wt1 = calculate_wavetrend_numba(
            hlc3.values, 
            params['wtChannelLen'], 
            params['wtAverageLen']
        )
        
        # Simple moving average for WT2
        wt2 = pd.Series(wt1).rolling(window=params['wtMALen']).mean()
        
        # Add to DataFrame
        df_clean['WT1'] = wt1
        df_clean['WT2'] = wt2
        df_clean['WTVwap'] = wt1 - wt2
        
        # Calculate other indicators efficiently
        from api import (calculate_money_flow, stoch_heikin_ashi, 
                        calculate_macd, calculate_bollinger_bands, 
                        calculate_adx)
        
        # Money Flow
        mf = calculate_money_flow(df_clean, params['mfPeriod1'], params['mfPeriod2'])
        df_clean['MF'] = mf
        
        # RSI and Stochastic
        rsi = stoch_heikin_ashi(df_clean, params['stochPeriod1'], 2)
        stoch_rsi = stoch_heikin_ashi(df_clean, params['stochPeriod2'], 2)
        df_clean['RSI'] = rsi
        df_clean['Stoch'] = stoch_rsi
        
        # MACD
        macd_line, macd_signal, macd_hist = calculate_macd(df_clean['Close'])
        df_clean['MACD'] = macd_line
        df_clean['MACDSignal'] = macd_signal
        df_clean['MACDHist'] = macd_hist
        
        # Bollinger Bands
        bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(df_clean['Close'])
        df_clean['BBUpper'] = bb_upper
        df_clean['BBMiddle'] = bb_middle
        df_clean['BBLower'] = bb_lower
        
        # ADX
        adx, plus_di, minus_di = calculate_adx(df_clean)
        df_clean['ADX'] = adx
        df_clean['PlusDI'] = plus_di
        df_clean['MinusDI'] = minus_di
        
        return df_clean
        
    except Exception as e:
        logger.error(f"Error in batch indicator calculation: {e}")
        return df

def optimize_regime_detection(df, price_col, wt2_col):
    """
    Optimized regime detection that only runs necessary methods based on data size
    """
    regime_results = {}
    
    # Only run computationally expensive methods on larger datasets
    if len(df) > 100:
        try:
            from api import detect_regime_hmm, detect_regime_bayesian
            regime_results['hmm_price'] = detect_regime_hmm(df, price_col)
            regime_results['hmm_wt'] = detect_regime_hmm(df, wt2_col)
            regime_results['bayesian_price'] = detect_regime_bayesian(df, price_col)
            regime_results['bayesian_wt'] = detect_regime_bayesian(df, wt2_col)
        except Exception as e:
            logger.warning(f"Error in advanced regime detection: {e}")
    
    # Always run fast methods
    try:
        from api import detect_regime_cusum, detect_regime_sliding_window
        regime_results['cusum_price'] = detect_regime_cusum(df, price_col)
        regime_results['cusum_wt'] = detect_regime_cusum(df, wt2_col)
        regime_results['sliding_price'] = detect_regime_sliding_window(df, price_col)
        regime_results['sliding_wt'] = detect_regime_sliding_window(df, wt2_col)
    except Exception as e:
        logger.warning(f"Error in basic regime detection: {e}")
    
    # Combine results
    combined_price = pd.Series(np.zeros(len(df)), index=df.index)
    combined_wt = pd.Series(np.zeros(len(df)), index=df.index)
    
    price_methods = [key for key in regime_results.keys() if 'price' in key]
    wt_methods = [key for key in regime_results.keys() if 'wt' in key]
    
    for i in range(len(df)):
        price_votes = sum(regime_results[method].iloc[i] for method in price_methods if method in regime_results)
        wt_votes = sum(regime_results[method].iloc[i] for method in wt_methods if method in regime_results)
        
        if price_votes >= len(price_methods) // 2:
            combined_price.iloc[i] = 1
        if wt_votes >= len(wt_methods) // 2:
            combined_wt.iloc[i] = 1
    
    regime_results['combined_price'] = combined_price
    regime_results['combined_wt'] = combined_wt
    
    return regime_results

def performance_monitor(func):
    """
    Decorator to monitor function performance
    """
    import time
    import functools
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            logger.info(f"{func.__name__} executed in {execution_time:.3f}s")
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"{func.__name__} failed after {execution_time:.3f}s: {e}")
            raise
    
    return wrapper

# Data validation schemas
REQUIRED_COLUMNS = {
    'basic': ['Open', 'High', 'Low', 'Close', 'Volume'],
    'indicators': ['WT1', 'WT2', 'RSI', 'MF'],
    'optional': ['MACD', 'MACDSignal', 'MACDHist', 'BBUpper', 'BBMiddle', 'BBLower', 'ADX']
}

def create_robust_api_response(ticker, df, period, interval):
    """
    Create a robust API response with comprehensive error handling
    """
    try:
        if df is None or df.empty:
            return {
                'success': False,
                'error': 'No data available',
                'ticker': ticker,
                'period': period,
                'interval': interval
            }
        
        # Validate data quality
        is_valid, issues, _ = validate_data_quality(df, REQUIRED_COLUMNS['basic'])
        
        if not is_valid:
            return {
                'success': False,
                'error': 'Data quality issues',
                'issues': issues,
                'ticker': ticker,
                'period': period,
                'interval': interval
            }
        
        # Use the existing format_analyzer_result function
        from api import format_analyzer_result
        return format_analyzer_result(ticker, df, period, interval)
        
    except Exception as e:
        logger.error(f"Error creating API response: {e}")
        return {
            'success': False,
            'error': f'Processing error: {str(e)}',
            'ticker': ticker,
            'period': period,
            'interval': interval
        } 