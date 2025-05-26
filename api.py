import pandas as pd
import numpy as np
import yfinance as yf
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import traceback
import logging
from datetime import datetime, timedelta
import concurrent.futures
import time
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Allow cross-origin requests

# Import mock data generator
try:
    from temporary_solution import generate_mock_data
    MOCK_DATA_AVAILABLE = True
    logger.info("Mock data generator available for rate limit fallback")
except ImportError:
    MOCK_DATA_AVAILABLE = False
    logger.warning("Mock data generator not available")

# Import EOD API integration
try:
    from eod_api import fetch_stock_data_eod, get_eod_provider
    EOD_AVAILABLE = True
    logger.info("EOD Historical Data API integration available")
except ImportError as e:
    EOD_AVAILABLE = False
    logger.warning(f"EOD API not available: {e}")

# Configuration - set which data provider to use
USE_EOD_API = os.getenv('USE_EOD_API', 'false').lower() == 'true'
EOD_API_KEY = os.getenv('EOD_API_KEY')

if USE_EOD_API and not EOD_AVAILABLE:
    logger.warning("EOD API requested but not available, falling back to yfinance")
    USE_EOD_API = False
elif USE_EOD_API and not EOD_API_KEY:
    logger.warning("EOD API requested but no API key found, falling back to yfinance")
    USE_EOD_API = False

logger.info(f"Data provider: {'EOD Historical Data' if USE_EOD_API else 'Yahoo Finance (yfinance)'}")

# Fix the NpEncoder to properly handle NaN, Infinity and -Infinity values
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return None if np.isnan(obj) or np.isinf(obj) else float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.Series):
            # Handle NaN, Infinity and -Infinity in Series
            return [None if pd.isna(x) or np.isinf(x) else x for x in obj]
        if pd.isna(obj) or (hasattr(obj, "__float__") and np.isinf(float(obj))):
            return None
        return super(NpEncoder, self).default(obj)

# Configure Flask to use our custom JSON encoder
app.json_encoder = NpEncoder

# Valid intervals and periods for yfinance
VALID_INTERVALS = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '4h', '8h', '12h', '1d', '5d', '1wk', '1mo', '3mo']
VALID_PERIODS = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']

# Define limits for different intervals
INTERVAL_LIMITS = {
    '1m': '7d',  # 1-minute data limited to 7 days
    '2m': '60d',
    '5m': '60d',
    '15m': '60d',
    '30m': '60d',
    '60m': '730d',
    '90m': '60d',
    '1h': '730d',
    '4h': '730d',  # Added 4-hour interval
    '8h': '730d',  # Added 8-hour interval
    '12h': '730d', # Added 12-hour interval
    '1d': 'max',
    '5d': 'max',
    '1wk': 'max',
    '1mo': 'max',
    '3mo': 'max'
}

# Simple cache implementation for ticker data to improve performance
ticker_cache = {}  # Format: {ticker_period_interval: {'data': result_object, 'timestamp': datetime}}
CACHE_TTL = 300  # Cache TTL in seconds (5 minutes)

def fetch_stock_data(ticker, period='1y', interval='1d', max_retries=3, retry_delay=2, use_cache=True):
    """
    Enhanced fetch stock data function with improved error handling and caching support
    Now supports both Yahoo Finance (yfinance) and EOD Historical Data API
    
    Args:
        ticker: Stock ticker symbol
        period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds
        use_cache: Whether to use cached data (for compatibility)
        
    Returns:
        DataFrame with stock data or None if failed
    """
    
    # Use EOD API if configured and available
    if USE_EOD_API:
        logger.info(f"Using EOD API for {ticker}")
        try:
            df = fetch_stock_data_eod(ticker, period, interval, max_retries, retry_delay, use_cache)
            if df is not None:
                logger.info(f"Successfully fetched {len(df)} rows from EOD API for {ticker}")
                return df
            else:
                logger.warning(f"EOD API returned no data for {ticker}")
        except Exception as e:
            logger.error(f"EOD API failed for {ticker}: {e}")
            logger.info("Falling back to yfinance...")
    
    # Fall back to yfinance or use as primary
    logger.info(f"Using yfinance for {ticker}")
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Fetching data for {ticker}, period: {period}, interval: {interval} (attempt {attempt+1}/{max_retries})")
            
            # Validate interval
            if interval not in VALID_INTERVALS:
                logger.warning(f"Invalid interval: {interval}, defaulting to 1d")
                interval = '1d'
                
            # Validate period
            if period not in VALID_PERIODS:
                logger.warning(f"Invalid period: {period}, defaulting to 1y")
                period = '1y'
                
            # Check if the requested period exceeds the limit for the interval
            if interval in INTERVAL_LIMITS:
                max_period = INTERVAL_LIMITS[interval]
                if max_period in VALID_PERIODS and VALID_PERIODS.index(period) > VALID_PERIODS.index(max_period):
                    logger.warning(f"Period '{period}' exceeds limit for interval '{interval}', using {max_period} instead")
                    period = max_period

            # For short timeframes, ensure we include the current day's data
            # by using a slightly extended period for intraday data
            if interval in ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '4h', '8h', '12h']:
                # If requested period is 1d, use '2d' to ensure we get current day + previous day
                # for better context
                if period == '1d':
                    logger.info(f"Extending period from '1d' to '2d' for intraday data to include current day")
                    period = '2d'
                # For 5d, extend to 7d to get full week + weekend
                elif period == '5d':
                    logger.info(f"Extending period from '5d' to '7d' for intraday data to include full week")
                    period = '7d'
            
            # Handle custom intervals not directly supported by yfinance
            custom_resampling = None
            original_interval = interval
            
            if interval == '4h':
                # Use 1h data and resample
                interval = '1h'
                custom_resampling = '4H'
            elif interval == '8h':
                # Use 1h data and resample
                interval = '1h'
                custom_resampling = '8H'
            elif interval == '12h':
                # Use 1h data and resample
                interval = '1h'
                custom_resampling = '12H'
            
            # Set timeout for yfinance request to prevent hanging
            import yfinance as yf
            from requests.exceptions import ReadTimeout, ConnectionError

            # Create yfinance ticker object
            stock = yf.Ticker(ticker)
            
            # Fetch historical data - remove unsupported parameters
            df = stock.history(period=period, interval=interval)
            
            if df is None or df.empty:
                logger.warning(f"No data returned for {ticker} with period={period}, interval={interval}")
                continue
            
            # Apply resampling for custom intervals
            if custom_resampling and not df.empty:
                logger.info(f"Resampling data from {interval} to {original_interval}")
                df = df.resample(custom_resampling).agg({
                    'Open': 'first',
                    'High': 'max',
                    'Low': 'min',
                    'Close': 'last',
                    'Volume': 'sum'
                }).dropna()
            
            if df.empty:
                logger.warning(f"No data returned for {ticker}")
                if attempt < max_retries - 1:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    continue
                return None
            
            # Validate data quality
            if len(df) < 5:  # Require at least 5 data points
                logger.warning(f"Insufficient data points for {ticker}: {len(df)}")
                if attempt < max_retries - 1:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    continue
                # Return what we have if this is the last attempt
            
            # Check for too many NaN values in critical columns
            critical_cols = ['Open', 'High', 'Low', 'Close']
            nan_pct = {col: df[col].isna().mean() for col in critical_cols}
            max_nan_pct = max(nan_pct.values())
            
            if max_nan_pct > 0.25:  # If more than 25% of any critical column is NaN
                logger.warning(f"High percentage of NaN values in data: {nan_pct}")
                # Fill NaN values with forward fill, then backward fill
                df[critical_cols] = df[critical_cols].fillna(method='ffill').fillna(method='bfill')
            
            # For intraday data, ensure we have the date component in the index
            if interval in ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h']:
                # Keep the existing datetime index but ensure it's timezone-aware
                if df.index.tzinfo is None:
                    df.index = df.index.tz_localize('UTC')
            
            logger.info(f"Successfully fetched {len(df)} rows of data for {ticker}")
            
            # Add company information if available
            try:
                info = stock.info
                if 'longName' in info:
                    df.attrs['company_name'] = info['longName']
                else:
                    df.attrs['company_name'] = ticker
                    
                if 'industry' in info and info['industry']:
                    df.attrs['industry'] = info['industry']
            except:
                df.attrs['company_name'] = ticker
                
            return df
            
        except ReadTimeout:
            logger.warning(f"Timeout when fetching data for {ticker}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to fetch data for {ticker} after {max_retries} attempts due to timeout")
                return None
                
        except ConnectionError:
            logger.warning(f"Connection error when fetching data for {ticker}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to fetch data for {ticker} after {max_retries} attempts due to connection error")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching data for {ticker}: {str(e)}")
            logger.error(traceback.format_exc())
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to fetch data for {ticker} after {max_retries} attempts")
                return None
    
    # This should only be reached if all retries fail
    logger.error(f"All retry attempts exhausted for {ticker}")
    return None

# Function for determining ticker type (stock, crypto, forex, commodity)
def get_ticker_type(ticker):
    if '-USD' in ticker or ticker.endswith('USDT') or ticker.endswith('BTC') or ticker.endswith('.D'):
        return 'crypto'
    elif '=' in ticker or ticker.endswith('USD') or ticker.endswith('JPY') or ticker.endswith('EUR') or ticker.endswith('GBP'):
        return 'forex'
    elif ticker in ['GC=F', 'SI=F', 'CL=F', 'BZ=F', 'NG=F', 'ZC=F', 'ZS=F', 'ZW=F', 'CC=F', 'KC=F']:
        return 'commodity'
    else:
        return 'stock'

def calculate_hlc3(df):
    """Calculate HLC3 (High + Low + Close) / 3"""
    return (df['High'] + df['Low'] + df['Close']) / 3

def calculate_wavetrend(df, wtChannelLen=9, wtAverageLen=12, wtMALen=3):
    """Calculate WaveTrend indicators based on Pine Script implementation"""
    hlc3 = calculate_hlc3(df)
    
    # First Wave - exact match with Pine Script
    ema = hlc3.ewm(span=wtChannelLen, adjust=False).mean()
    d = (hlc3 - ema).abs().ewm(span=wtChannelLen, adjust=False).mean()
    ci = (hlc3 - ema) / (0.015 * d)
    tci = ci.ewm(span=wtAverageLen, adjust=False).mean()
    wt1 = tci
    wt2 = wt1.rolling(window=wtMALen).mean()  # Using SMA as in Pine Script
    wtVwap = wt1 - wt2
    
    return wt1, wt2, wtVwap

def stoch_heikin_ashi(df, len_period=40, k=2):
    """Calculate Stochastic based on Heikin Ashi data as used in Pine Script"""
    # To simulate Heikin Ashi calculation in Python
    ha_close = (df['Open'] + df['High'] + df['Low'] + df['Close']) / 4
    ha_open = (df['Open'].shift(1) + df['Close'].shift(1)) / 2
    ha_high = df[['High', 'Open', 'Close']].max(axis=1)
    ha_low = df[['Low', 'Open', 'Close']].min(axis=1)
    
    # Stochastic calculation on Heikin Ashi data
    stoch_k = pd.Series(
        (ha_close - ha_low.rolling(window=len_period).min()) / 
        (ha_high.rolling(window=len_period).max() - ha_low.rolling(window=len_period).min()) * 100
    )
    return stoch_k.rolling(window=k).mean()

def calculate_money_flow(df, period=5, mf_period=60):
    """Calculate Money Flow exactly as in the Pine Script"""
    hlc3 = calculate_hlc3(df)
    m = hlc3.rolling(window=period).mean()  # Using SMA as in Pine Script
    f = (hlc3 - m).abs().rolling(window=period).mean()  # Using SMA as in Pine Script
    i = (hlc3 - m) / (0.015 * f)
    mf = i.rolling(window=mf_period).mean()  # Using SMA as in Pine Script
    return mf

def generate_signals(wt1, wt2, mf, obLevel=53, osLevel=-53, osLevel3=-75):
    """Generate trading signals based on WaveTrend and Money Flow"""
    # WaveTrend conditions - exactly match Pine Script logic
    wt_oversold = wt2 <= osLevel
    wt_overbought = wt2 >= obLevel
    
    # Crosses - directly matching Pine Script logic
    wt_cross = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    wt_cross_up = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    wt_cross_down = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    
    for i in range(1, len(wt1)):
        # Cross condition (ta.cross in Pine Script)
        if (wt1.iloc[i-1] < wt2.iloc[i-1] and wt1.iloc[i] > wt2.iloc[i]) or \
           (wt1.iloc[i-1] > wt2.iloc[i-1] and wt1.iloc[i] < wt2.iloc[i]):
            wt_cross.iloc[i] = 1
            
        # Cross up (ta.crossover in Pine Script)
        if wt1.iloc[i-1] < wt2.iloc[i-1] and wt1.iloc[i] > wt2.iloc[i]:
            wt_cross_up.iloc[i] = 1
        
        # Cross down (ta.crossunder in Pine Script)
        if wt1.iloc[i-1] > wt2.iloc[i-1] and wt1.iloc[i] < wt2.iloc[i]:
            wt_cross_down.iloc[i] = 1
    
    # Signal Logic - Exactly as in Pine Script
    # buySignal = wtCross and wtCrossUp and wtOversold
    buy_signal = (wt_cross == 1) & (wt_cross_up == 1) & wt_oversold
    # sellSignal = wtCross and wtCrossDown and wtOverbought
    sell_signal = (wt_cross == 1) & (wt_cross_down == 1) & wt_overbought
    
    # Improved Gold Buy signal logic - adds more criteria for stronger signals
    # goldBuy = buySignal and wt2 <= osLevel3 and mf > 0
    # Enhanced to better match Market Cipher B:
    # - Check deeper oversold level
    # - Require positive money flow
    # - Require wt1 < wt2 before the cross (diamond setup)
    gold_buy = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    for i in range(1, len(wt1)):
        if buy_signal.iloc[i] and wt2.iloc[i] <= osLevel3 and mf.iloc[i] > 0:
            # Check for "diamond setup" - WT1 < WT2 before the cross
            diamond_setup = False
            # Look back up to 3 bars for the setup
            for j in range(1, min(4, i+1)):
                if wt1.iloc[i-j] < wt2.iloc[i-j]:
                    diamond_setup = True
                    break
            
            if diamond_setup:
                gold_buy.iloc[i] = 1
    
    # Additional signal for cross points (needed for visualization)
    cross_points = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    for i in range(len(wt1)):
        if wt_cross.iloc[i] == 1:
            cross_points.iloc[i] = wt2.iloc[i]
        else:
            cross_points.iloc[i] = np.nan
    
    return buy_signal, gold_buy, sell_signal, wt_cross, cross_points

# Function to adapt parameters based on the selected interval
def adjust_parameters_for_interval(interval):
    """Adjust WT parameters based on the selected interval"""
    if interval in ['1m', '2m', '5m']:
        # For very short timeframes
        return {
            'wtChannelLen': 7,
            'wtAverageLen': 9,
            'wtMALen': 3,
            'stochPeriod1': 20,
            'stochPeriod2': 40,
            'mfPeriod1': 3,
            'mfPeriod2': 20
        }
    elif interval in ['15m', '30m', '60m', '90m', '1h']:
        # For medium timeframes
        return {
            'wtChannelLen': 9,
            'wtAverageLen': 12,
            'wtMALen': 3,
            'stochPeriod1': 30,
            'stochPeriod2': 60,
            'mfPeriod1': 5,
            'mfPeriod2': 40
        }
    elif interval in ['4h', '8h', '12h']:
        # For larger hourly timeframes
        return {
            'wtChannelLen': 9,
            'wtAverageLen': 12,
            'wtMALen': 3,
            'stochPeriod1': 35,
            'stochPeriod2': 70,
            'mfPeriod1': 5,
            'mfPeriod2': 50
        }
    else:
        # For daily and above (default)
        return {
            'wtChannelLen': 9,
            'wtAverageLen': 12,
            'wtMALen': 3,
            'stochPeriod1': 40,
            'stochPeriod2': 81,
            'mfPeriod1': 5,
            'mfPeriod2': 60
        }

def detect_divergences(df, wt2, price, lookback=5):
    """
    Detect regular and hidden divergences between WaveTrend and price
    
    Regular Divergences:
    - Bullish: Price making lower low but WT2 making higher low (strength)
    - Bearish: Price making higher high but WT2 making lower high (weakness)
    
    Hidden Divergences:
    - Bullish: Price making higher low but WT2 making lower low (continuation)
    - Bearish: Price making lower high but WT2 making higher high (continuation)
    """
    bullish_div = pd.Series(np.zeros(len(df)), index=df.index)
    bearish_div = pd.Series(np.zeros(len(df)), index=df.index)
    hidden_bullish_div = pd.Series(np.zeros(len(df)), index=df.index)
    hidden_bearish_div = pd.Series(np.zeros(len(df)), index=df.index)
    
    # Need at least 2*lookback+1 bars to detect divergence
    if len(df) < 2 * lookback + 1:
        return bullish_div, bearish_div, hidden_bullish_div, hidden_bearish_div
    
    # Find local minima and maxima
    for i in range(lookback, len(df) - lookback):
        # Check if current bar is a local minimum in WT2
        wt_is_min = True
        for j in range(1, lookback + 1):
            if wt2.iloc[i] > wt2.iloc[i - j] or wt2.iloc[i] > wt2.iloc[i + j]:
                wt_is_min = False
                break
        
        # Check if current bar is a local maximum in WT2
        wt_is_max = True
        for j in range(1, lookback + 1):
            if wt2.iloc[i] < wt2.iloc[i - j] or wt2.iloc[i] < wt2.iloc[i + j]:
                wt_is_max = False
                break
        
        # Check if current bar is a local minimum in price
        price_is_min = True
        for j in range(1, lookback + 1):
            if price.iloc[i] > price.iloc[i - j] or price.iloc[i] > price.iloc[i + j]:
                price_is_min = False
                break
                
        # Check if current bar is a local maximum in price
        price_is_max = True
        for j in range(1, lookback + 1):
            if price.iloc[i] < price.iloc[i - j] or price.iloc[i] < price.iloc[i + j]:
                price_is_max = False
                break
        
        # For regular bullish divergence (when WT2 is near oversold and we have price min and wt min)
        if wt_is_min and price_is_min and wt2.iloc[i] < -40:
            # Find the previous local minimum in WT2 and price
            prev_min_idx = None
            for j in range(i - lookback, 0, -1):
                prev_wt_is_min = True
                prev_price_is_min = True
                
                for k in range(1, lookback + 1):
                    if j - k >= 0 and j + k < len(wt2):
                        if wt2.iloc[j] > wt2.iloc[j - k] or wt2.iloc[j] > wt2.iloc[j + k]:
                            prev_wt_is_min = False
                        if price.iloc[j] > price.iloc[j - k] or price.iloc[j] > price.iloc[j + k]:
                            prev_price_is_min = False
                
                if prev_wt_is_min and prev_price_is_min and wt2.iloc[j] < -40 and i - j > lookback:
                    prev_min_idx = j
                    break
            
            # Check for regular bullish divergence
            if prev_min_idx is not None:
                # If price is making a lower low but WT2 is making a higher low
                if price.iloc[i] < price.iloc[prev_min_idx] and wt2.iloc[i] > wt2.iloc[prev_min_idx]:
                    bullish_div.iloc[i] = 1
        
        # For regular bearish divergence (when WT2 is near overbought and we have price max and wt max)
        if wt_is_max and price_is_max and wt2.iloc[i] > 40:
            # Find the previous local maximum in WT2 and price
            prev_max_idx = None
            for j in range(i - lookback, 0, -1):
                prev_wt_is_max = True
                prev_price_is_max = True
                
                for k in range(1, lookback + 1):
                    if j - k >= 0 and j + k < len(wt2):
                        if wt2.iloc[j] < wt2.iloc[j - k] or wt2.iloc[j] < wt2.iloc[j + k]:
                            prev_wt_is_max = False
                        if price.iloc[j] < price.iloc[j - k] or price.iloc[j] < price.iloc[j + k]:
                            prev_price_is_max = False
                
                if prev_wt_is_max and prev_price_is_max and wt2.iloc[j] > 40 and i - j > lookback:
                    prev_max_idx = j
                    break
            
            # Check for regular bearish divergence
            if prev_max_idx is not None:
                # If price is making a higher high but WT2 is making a lower high
                if price.iloc[i] > price.iloc[prev_max_idx] and wt2.iloc[i] < wt2.iloc[prev_max_idx]:
                    bearish_div.iloc[i] = 1
        
        # For hidden bullish divergence (when WT2 is near oversold and we have price min and wt min)
        if wt_is_min and price_is_min and wt2.iloc[i] < -40:
            prev_min_idx = None
            for j in range(i - lookback, 0, -1):
                prev_wt_is_min = True
                prev_price_is_min = True
                
                for k in range(1, lookback + 1):
                    if j - k >= 0 and j + k < len(wt2):
                        if wt2.iloc[j] > wt2.iloc[j - k] or wt2.iloc[j] > wt2.iloc[j + k]:
                            prev_wt_is_min = False
                        if price.iloc[j] > price.iloc[j - k] or price.iloc[j] > price.iloc[j + k]:
                            prev_price_is_min = False
                
                if prev_wt_is_min and prev_price_is_min and wt2.iloc[j] < -40 and i - j > lookback:
                    prev_min_idx = j
                    break
            
            # Check for hidden bullish divergence
            if prev_min_idx is not None:
                # If price is making a higher low but WT2 is making a lower low
                if price.iloc[i] > price.iloc[prev_min_idx] and wt2.iloc[i] < wt2.iloc[prev_min_idx]:
                    hidden_bullish_div.iloc[i] = 1
        
        # For hidden bearish divergence (when WT2 is near overbought and we have price max and wt max)
        if wt_is_max and price_is_max and wt2.iloc[i] > 40:
            prev_max_idx = None
            for j in range(i - lookback, 0, -1):
                prev_wt_is_max = True
                prev_price_is_max = True
                
                for k in range(1, lookback + 1):
                    if j - k >= 0 and j + k < len(wt2):
                        if wt2.iloc[j] < wt2.iloc[j - k] or wt2.iloc[j] < wt2.iloc[j + k]:
                            prev_wt_is_max = False
                        if price.iloc[j] < price.iloc[j - k] or price.iloc[j] < price.iloc[j + k]:
                            prev_price_is_max = False
                
                if prev_wt_is_max and prev_price_is_max and wt2.iloc[j] > 40 and i - j > lookback:
                    prev_max_idx = j
                    break
            
            # Check for hidden bearish divergence
            if prev_max_idx is not None:
                # If price is making a lower high but WT2 is making a higher high
                if price.iloc[i] < price.iloc[prev_max_idx] and wt2.iloc[i] > wt2.iloc[prev_max_idx]:
                    hidden_bearish_div.iloc[i] = 1
    
    return bullish_div, bearish_div, hidden_bullish_div, hidden_bearish_div

def detect_mf_divergences(df, mf, price, lookback=5):
    """
    Detect divergences between Money Flow and price
    
    Money Flow Divergences:
    - Bullish: Price making lower low but Money Flow making higher low
    - Bearish: Price making higher high but Money Flow making lower high
    """
    mf_bullish_div = pd.Series(np.zeros(len(df)), index=df.index)
    mf_bearish_div = pd.Series(np.zeros(len(df)), index=df.index)
    
    # Need at least 2*lookback+1 bars to detect divergence
    if len(df) < 2 * lookback + 1:
        return mf_bullish_div, mf_bearish_div
    
    # Find local minima and maxima
    for i in range(lookback, len(df) - lookback):
        # Check if current bar is a local minimum in Money Flow
        mf_is_min = True
        for j in range(1, lookback + 1):
            if mf.iloc[i] > mf.iloc[i - j] or mf.iloc[i] > mf.iloc[i + j]:
                mf_is_min = False
                break
        
        # Check if current bar is a local maximum in Money Flow
        mf_is_max = True
        for j in range(1, lookback + 1):
            if mf.iloc[i] < mf.iloc[i - j] or mf.iloc[i] < mf.iloc[i + j]:
                mf_is_max = False
                break
        
        # Check if current bar is a local minimum in price
        price_is_min = True
        for j in range(1, lookback + 1):
            if price.iloc[i] > price.iloc[i - j] or price.iloc[i] > price.iloc[i + j]:
                price_is_min = False
                break
                
        # Check if current bar is a local maximum in price
        price_is_max = True
        for j in range(1, lookback + 1):
            if price.iloc[i] < price.iloc[i - j] or price.iloc[i] < price.iloc[i + j]:
                price_is_max = False
                break
        
        # For Money Flow bullish divergence (when price is making a lower low but MF is making a higher low)
        if mf_is_min and price_is_min:
            # Find the previous local minimum in MF and price
            prev_min_idx = None
            for j in range(i - lookback, 0, -1):
                prev_mf_is_min = True
                prev_price_is_min = True
                
                for k in range(1, lookback + 1):
                    if j - k >= 0 and j + k < len(mf):
                        if mf.iloc[j] > mf.iloc[j - k] or mf.iloc[j] > mf.iloc[j + k]:
                            prev_mf_is_min = False
                        if price.iloc[j] > price.iloc[j - k] or price.iloc[j] > price.iloc[j + k]:
                            prev_price_is_min = False
                
                if prev_mf_is_min and prev_price_is_min and i - j > lookback:
                    prev_min_idx = j
                    break
            
            # Check for Money Flow bullish divergence
            if prev_min_idx is not None:
                # If price is making a lower low but MF is making a higher low
                if price.iloc[i] < price.iloc[prev_min_idx] and mf.iloc[i] > mf.iloc[prev_min_idx]:
                    mf_bullish_div.iloc[i] = 1
        
        # For Money Flow bearish divergence (when price is making a higher high but MF is making a lower high)
        if mf_is_max and price_is_max:
            # Find the previous local maximum in MF and price
            prev_max_idx = None
            for j in range(i - lookback, 0, -1):
                prev_mf_is_max = True
                prev_price_is_max = True
                
                for k in range(1, lookback + 1):
                    if j - k >= 0 and j + k < len(mf):
                        if mf.iloc[j] < mf.iloc[j - k] or mf.iloc[j] < mf.iloc[j + k]:
                            prev_mf_is_max = False
                        if price.iloc[j] < price.iloc[j - k] or price.iloc[j] < price.iloc[j + k]:
                            prev_price_is_max = False
                
                if prev_mf_is_max and prev_price_is_max and i - j > lookback:
                    prev_max_idx = j
                    break
            
            # Check for Money Flow bearish divergence
            if prev_max_idx is not None:
                # If price is making a higher high but MF is making a lower high
                if price.iloc[i] > price.iloc[prev_max_idx] and mf.iloc[i] < mf.iloc[prev_max_idx]:
                    mf_bearish_div.iloc[i] = 1
    
    return mf_bullish_div, mf_bearish_div

def detect_rsi_trend_breaks(df, rsi, lookback=5):
    """
    Detect RSI trend breaks - when RSI breaks above/below a significant trend line
    
    RSI Trend Breaks:
    - Bullish: RSI breaks above a downtrend line
    - Bearish: RSI breaks below an uptrend line
    """
    rsi_trend_break_buy = pd.Series(np.zeros(len(df)), index=df.index)
    rsi_trend_break_sell = pd.Series(np.zeros(len(df)), index=df.index)
    
    # Need at least lookback+5 bars to detect trend breaks
    if len(df) < lookback + 5:
        return rsi_trend_break_buy, rsi_trend_break_sell
    
    # Detect RSI trend breaks
    for i in range(lookback + 5, len(df)):
        # Check for bullish RSI trend break
        # Look for a series of lower highs in RSI followed by a break above
        if rsi.iloc[i] > rsi.iloc[i-1] and rsi.iloc[i-1] < 50:
            # Check if we have a downtrend in RSI
            downtrend = True
            for j in range(2, lookback + 2):
                if i-j < 0 or rsi.iloc[i-j+1] > rsi.iloc[i-j]:
                    downtrend = False
                    break
            
            if downtrend and rsi.iloc[i] > rsi.iloc[i-2]:
                rsi_trend_break_buy.iloc[i] = 1
        
        # Check for bearish RSI trend break
        # Look for a series of higher lows in RSI followed by a break below
        if rsi.iloc[i] < rsi.iloc[i-1] and rsi.iloc[i-1] > 50:
            # Check if we have an uptrend in RSI
            uptrend = True
            for j in range(2, lookback + 2):
                if i-j < 0 or rsi.iloc[i-j+1] < rsi.iloc[i-j]:
                    uptrend = False
                    break
            
            if uptrend and rsi.iloc[i] < rsi.iloc[i-2]:
                rsi_trend_break_sell.iloc[i] = 1
    
    return rsi_trend_break_buy, rsi_trend_break_sell

def calculate_williams_r(df, length):
    """Calculate Williams %R indicator"""
    highest_high = df['High'].rolling(window=length).max()
    lowest_low = df['Low'].rolling(window=length).min()
    wr = -100 * (highest_high - df['Close']) / (highest_high - lowest_low)
    return wr

def calculate_ema(data, period):
    """Calculate Exponential Moving Average"""
    return data.ewm(span=period, adjust=False).mean()

def calculate_macd(series, fast_period=12, slow_period=26, signal_period=9):
    """
    Calculate Moving Average Convergence Divergence (MACD)
    
    Args:
        series: Price series (typically Close)
        fast_period: Period for fast EMA
        slow_period: Period for slow EMA
        signal_period: Period for signal line
        
    Returns:
        Tuple of (MACD line, Signal line, Histogram)
    """
    fast_ema = calculate_ema(series, fast_period)
    slow_ema = calculate_ema(series, slow_period)
    macd_line = fast_ema - slow_ema
    signal_line = calculate_ema(macd_line, signal_period)
    histogram = macd_line - signal_line
    
    return macd_line, signal_line, histogram

def calculate_bollinger_bands(series, period=20, std_dev=2):
    """
    Calculate Bollinger Bands
    
    Args:
        series: Price series (typically Close)
        period: Period for moving average
        std_dev: Number of standard deviations
        
    Returns:
        Tuple of (Upper Band, Middle Band, Lower Band)
    """
    middle_band = series.rolling(window=period).mean()
    rolling_std = series.rolling(window=period).std()
    
    upper_band = middle_band + (rolling_std * std_dev)
    lower_band = middle_band - (rolling_std * std_dev)
    
    return upper_band, middle_band, lower_band

def calculate_adx(df, period=14):
    """
    Calculate Average Directional Index (ADX)
    
    Args:
        df: DataFrame with High, Low, Close columns
        period: Period for calculations
        
    Returns:
        Tuple of (ADX, +DI, -DI)
    """
    df = df.copy()
    df['H-L'] = df['High'] - df['Low']
    df['H-PC'] = abs(df['High'] - df['Close'].shift(1))
    df['L-PC'] = abs(df['Low'] - df['Close'].shift(1))
    df['TR'] = df[['H-L', 'H-PC', 'L-PC']].max(axis=1)
    df['ATR'] = df['TR'].rolling(window=period).mean()
    
    df['UpMove'] = df['High'] - df['High'].shift(1)
    df['DownMove'] = df['Low'].shift(1) - df['Low']
    
    df['PlusDM'] = np.where((df['UpMove'] > df['DownMove']) & (df['UpMove'] > 0), df['UpMove'], 0)
    df['MinusDM'] = np.where((df['DownMove'] > df['UpMove']) & (df['DownMove'] > 0), df['DownMove'], 0)
    
    df['PlusDI'] = 100 * (df['PlusDM'].rolling(window=period).mean() / df['ATR'])
    df['MinusDI'] = 100 * (df['MinusDM'].rolling(window=period).mean() / df['ATR'])
    
    df['DX'] = 100 * (abs(df['PlusDI'] - df['MinusDI']) / (df['PlusDI'] + df['MinusDI']))
    
    df['ADX'] = df['DX'].rolling(window=period).mean()
    
    return df['ADX'], df['PlusDI'], df['MinusDI']

def detect_regime_bayesian(df, feature_col, penalty=10):
    """
    Detect regime changes using Bayesian Change Point Detection
    
    Args:
        df: DataFrame with time series data
        feature_col: Series containing the feature to detect changes on (could be Close price, WT, etc.)
        penalty: Penalty term for adding a change point (higher = fewer change points)
        
    Returns:
        Series with 1s at detected regime change points, 0s elsewhere
    """
    import ruptures as rpt
    
    regime_changes = pd.Series(np.zeros(len(df)), index=df.index)
    
    if len(df) < 20:
        return regime_changes
        
    signal = feature_col.values
    
    try:
        algo = rpt.Binseg(model="rbf").fit(signal.reshape(-1, 1))
        change_points = algo.predict(pen=penalty)
        
        for cp in change_points[:-1]:
            if cp > 0 and cp < len(regime_changes):
                regime_changes.iloc[cp] = 1
    except Exception as e:
        logger.warning(f"Error in Bayesian change point detection: {e}")
        
    return regime_changes

def detect_regime_cusum(df, feature_col, threshold=1.0, drift=0.0):
    """
    Detect regime changes using CUSUM (Cumulative Sum) Control Charts
    
    Args:
        df: DataFrame with time series data
        feature_col: Series containing the feature to detect changes on
        threshold: Threshold for detecting changes (higher = fewer detections)
        drift: Drift parameter to prevent false alarms
        
    Returns:
        Series with 1s at detected regime change points, 0s elsewhere
    """
    
    regime_changes = pd.Series(np.zeros(len(df)), index=df.index)
    
    if len(df) < 20:
        return regime_changes
        
    try:
        data = feature_col.values
        normalized_data = (data - np.mean(data)) / np.std(data)
        
        cusum_pos = np.zeros(len(normalized_data))
        cusum_neg = np.zeros(len(normalized_data))
        
        for i in range(1, len(normalized_data)):
            cusum_pos[i] = max(0, cusum_pos[i-1] + normalized_data[i] - drift)
            cusum_neg[i] = max(0, cusum_neg[i-1] - normalized_data[i] - drift)
            
            if cusum_pos[i] > threshold or cusum_neg[i] > threshold:
                regime_changes.iloc[i] = 1
                cusum_pos[i] = 0
                cusum_neg[i] = 0
    except Exception as e:
        logger.warning(f"Error in CUSUM detection: {e}")
        
    return regime_changes

def detect_regime_hmm(df, feature_col, n_states=2):
    """
    Detect regime changes using Hidden Markov Models (HMMs)
    
    Args:
        df: DataFrame with time series data
        feature_col: Series containing the feature to detect changes on
        n_states: Number of regimes/states to detect
        
    Returns:
        Series with 1s at detected regime change points, 0s elsewhere
    """
    regime_changes = pd.Series(np.zeros(len(df)), index=df.index)
    
    if len(df) < 30:
        return regime_changes
    
    try:
        from hmmlearn import hmm
        
        # Handle potential NaN values in the input feature column
        feature_col_clean = feature_col.fillna(method='ffill').fillna(method='bfill')
        
        # Check if any NaNs remain after filling (e.g., if the entire series was NaN)
        if feature_col_clean.isnull().any():
            logger.warning(f"Feature column contains NaNs that could not be filled. Skipping HMM.")
            return regime_changes
        
        data = feature_col_clean.values.reshape(-1, 1)
        
        # Avoid scaling if standard deviation is zero or near zero
        data_std = np.std(data)
        if data_std < 1e-8:
             logger.warning(f"Standard deviation of feature column is near zero. Skipping scaling for HMM.")
             data_scaled = data
        else:
            data_scaled = (data - np.mean(data)) / data_std
        
        model = hmm.GaussianHMM(n_components=n_states, random_state=42)
        model.fit(data_scaled)
        
        hidden_states = model.predict(data_scaled)
        
        for i in range(1, len(hidden_states)):
            if hidden_states[i] != hidden_states[i-1]:
                regime_changes.iloc[i] = 1
    except Exception as e:
        logger.warning(f"Error in HMM regime detection: {e}. Using fallback method.")
        
        # Use the cleaned feature column for the fallback as well
        if 'feature_col_clean' in locals() and not feature_col_clean.isnull().all():
            window = min(30, len(df) // 4)
            if window > 0:
                try:
                    # Calculate rolling mean and std on the cleaned data
                    rolling_mean = feature_col_clean.rolling(window=window).mean()
                    feature_std = feature_col_clean.std()
                    
                    if feature_std > 1e-8: # Ensure standard deviation is meaningful
                        for i in range(window, len(df)):
                            # Check for NaNs before comparison
                            if not pd.isna(rolling_mean.iloc[i]) and not pd.isna(feature_col_clean.iloc[i]):
                                if abs(feature_col_clean.iloc[i] - rolling_mean.iloc[i]) > 2 * feature_std:
                                    regime_changes.iloc[i] = 1
                    else:
                        logger.warning("Fallback HMM: Standard deviation near zero, cannot apply threshold.")
                except Exception as fallback_e:
                     logger.error(f"Error during HMM fallback calculation: {fallback_e}")
        else:
             logger.warning("Fallback HMM: Cleaned feature column not available or is all NaN.")
        
    return regime_changes

def detect_regime_sliding_window(df, feature_col, window_size=20, threshold=2.0):
    """
    Detect regime changes using Sliding Window Analysis
    
    Args:
        df: DataFrame with time series data
        feature_col: Series containing the feature to detect changes on
        window_size: Size of sliding window
        threshold: Threshold for detecting changes (higher = fewer detections)
        
    Returns:
        Series with 1s at detected regime change points, 0s elsewhere
    """
    regime_changes = pd.Series(np.zeros(len(df)), index=df.index)
    
    if len(df) < 2 * window_size:
        return regime_changes
        
    try:
        rolling_mean = feature_col.rolling(window=window_size).mean()
        rolling_std = feature_col.rolling(window=window_size).std()
        
        for i in range(window_size, len(df)):
            current = feature_col.iloc[i]
            
            prev_mean = rolling_mean.iloc[i-1]
            prev_std = rolling_std.iloc[i-1]
            
            if prev_std > 0:  # Avoid division by zero
                z_score = abs((current - prev_mean) / prev_std)
                
                if z_score > threshold:
                    regime_changes.iloc[i] = 1
    except Exception as e:
        logger.warning(f"Error in sliding window regime detection: {e}")
        
    return regime_changes

def detect_regimes(df, price_col, wt2_col, volume_col=None):
    """
    Detect market regimes using multiple methods
    
    Args:
        df: DataFrame with time series data
        price_col: Series containing price data (typically Close)
        wt2_col: Series containing WaveTrend WT2 data
        volume_col: Series containing volume data (optional)
        
    Returns:
        Tuple of Series, each containing regime change points detected by different methods
    """
    bayesian_price = detect_regime_bayesian(df, price_col)
    bayesian_wt = detect_regime_bayesian(df, wt2_col)
    
    cusum_price = detect_regime_cusum(df, price_col)
    cusum_wt = detect_regime_cusum(df, wt2_col)
    
    hmm_price = detect_regime_hmm(df, price_col)
    hmm_wt = detect_regime_hmm(df, wt2_col)
    
    sliding_price = detect_regime_sliding_window(df, price_col)
    sliding_wt = detect_regime_sliding_window(df, wt2_col)
    
    combined_price = pd.Series(np.zeros(len(df)), index=df.index)
    combined_wt = pd.Series(np.zeros(len(df)), index=df.index)
    
    for i in range(len(df)):
        price_votes = bayesian_price.iloc[i] + cusum_price.iloc[i] + hmm_price.iloc[i] + sliding_price.iloc[i]
        wt_votes = bayesian_wt.iloc[i] + cusum_wt.iloc[i] + hmm_wt.iloc[i] + sliding_wt.iloc[i]
        
        if price_votes >= 2:
            combined_price.iloc[i] = 1
            
        if wt_votes >= 2:
            combined_wt.iloc[i] = 1
    
    return (bayesian_price, bayesian_wt, cusum_price, cusum_wt, 
            hmm_price, hmm_wt, sliding_price, sliding_wt,
            combined_price, combined_wt)

def generate_trading_recommendations(df, lookback=5):
    """
    Generate trading recommendations based on combined analysis of all indicators
    
    Args:
        df: DataFrame with all technical indicators
        lookback: Number of periods to look back for signal analysis
        
    Returns:
        Dictionary with trading recommendations and confidence levels
    """
    recent = df.iloc[-lookback:].copy() if len(df) >= lookback else df.copy()
    
    buy_score = 0
    sell_score = 0
    hold_score = 0
    max_score = 0  # Track maximum possible score
    
    if recent['Buy'].sum() > 0:
        buy_score += 3
    if recent['GoldBuy'].sum() > 0:
        buy_score += 5
    if recent['Sell'].sum() > 0:
        sell_score += 3
    max_score += 5
    
    if recent['BullishDiv'].sum() + recent['HiddenBullishDiv'].sum() > 0:
        buy_score += 2
    if recent['BearishDiv'].sum() + recent['HiddenBearishDiv'].sum() > 0:
        sell_score += 2
    if 'MFBullishDiv' in recent.columns and recent['MFBullishDiv'].sum() > 0:
        buy_score += 2
    if 'MFBearishDiv' in recent.columns and recent['MFBearishDiv'].sum() > 0:
        sell_score += 2
    max_score += 4
    
    if 'CombinedPriceRegime' in recent.columns and recent['CombinedPriceRegime'].sum() > 0:
        if recent['Close'].iloc[-1] > recent['Close'].iloc[-min(3, len(recent))]:
            buy_score += 2  # Upward regime change
        else:
            sell_score += 2  # Downward regime change
    max_score += 2
    
    if 'RSI' in recent.columns:
        last_rsi = recent['RSI'].iloc[-1]
        if last_rsi < 30:  # Oversold
            buy_score += 1
        elif last_rsi > 70:  # Overbought
            sell_score += 1
        else:  # Neutral
            hold_score += 1
    max_score += 1
    
    if 'MACD' in recent.columns and 'MACDSignal' in recent.columns:
        if recent['MACD'].iloc[-2] < recent['MACDSignal'].iloc[-2] and recent['MACD'].iloc[-1] > recent['MACDSignal'].iloc[-1]:
            buy_score += 2  # Bullish crossover
        elif recent['MACD'].iloc[-2] > recent['MACDSignal'].iloc[-2] and recent['MACD'].iloc[-1] < recent['MACDSignal'].iloc[-1]:
            sell_score += 2  # Bearish crossover
        
        if 'MACDHist' in recent.columns:
            if recent['MACDHist'].iloc[-1] > 0 and recent['MACDHist'].iloc[-1] > recent['MACDHist'].iloc[-2]:
                buy_score += 1  # Increasing positive histogram
            elif recent['MACDHist'].iloc[-1] < 0 and recent['MACDHist'].iloc[-1] < recent['MACDHist'].iloc[-2]:
                sell_score += 1  # Decreasing negative histogram
    max_score += 3
    
    if 'BBUpper' in recent.columns and 'BBLower' in recent.columns:
        last_close = recent['Close'].iloc[-1]
        if last_close <= recent['BBLower'].iloc[-1]:
            buy_score += 1  # Price at or below lower band
        elif last_close >= recent['BBUpper'].iloc[-1]:
            sell_score += 1  # Price at or above upper band
    max_score += 1
    
    if 'ADX' in recent.columns and 'PlusDI' in recent.columns and 'MinusDI' in recent.columns:
        last_adx = recent['ADX'].iloc[-1]
        if last_adx > 25:  # Strong trend
            if recent['PlusDI'].iloc[-1] > recent['MinusDI'].iloc[-1]:
                buy_score += 2  # Strong uptrend
            else:
                sell_score += 2  # Strong downtrend
        else:
            hold_score += 1  # Weak trend, better to hold
    max_score += 2
    
    if recent['FastMoneyBuy'].sum() > 0:
        buy_score += 1
    if recent['FastMoneySell'].sum() > 0:
        sell_score += 1
    if recent['ZeroLineRejectBuy'].sum() > 0:
        buy_score += 1
    if recent['ZeroLineRejectSell'].sum() > 0:
        sell_score += 1
    max_score += 2
    
    total_score = max(1, max_score)  # Avoid division by zero
    buy_confidence = int((buy_score / total_score) * 100)
    sell_confidence = int((sell_score / total_score) * 100)
    hold_confidence = int((hold_score / total_score) * 100)
    
    if buy_score > sell_score and buy_score > hold_score:
        recommendation = "BUY"
        confidence = buy_confidence
        confidence_color = "success"  # Green
    elif sell_score > buy_score and sell_score > hold_score:
        recommendation = "SELL"
        confidence = sell_confidence
        confidence_color = "danger"  # Red
    else:
        recommendation = "HOLD"
        confidence = hold_confidence
        confidence_color = "warning"  # Yellow
    
    reasons = []
    
    if recent['Buy'].sum() > 0:
        reasons.append("WaveTrend buy signal detected")
    if recent['GoldBuy'].sum() > 0:
        reasons.append("Strong gold buy signal detected")
    if recent['Sell'].sum() > 0:
        reasons.append("WaveTrend sell signal detected")
    
    if recent['BullishDiv'].sum() + recent['HiddenBullishDiv'].sum() > 0:
        reasons.append("Bullish divergence detected")
    if recent['BearishDiv'].sum() + recent['HiddenBearishDiv'].sum() > 0:
        reasons.append("Bearish divergence detected")
    
    if 'RSI' in recent.columns:
        last_rsi = recent['RSI'].iloc[-1]
        if last_rsi < 30:
            reasons.append(f"RSI oversold at {last_rsi:.1f}")
        elif last_rsi > 70:
            reasons.append(f"RSI overbought at {last_rsi:.1f}")
    
    if 'CombinedPriceRegime' in recent.columns and recent['CombinedPriceRegime'].sum() > 0:
        reasons.append("Recent regime change detected")
    
    if 'MACD' in recent.columns and 'MACDSignal' in recent.columns:
        if recent['MACD'].iloc[-2] < recent['MACDSignal'].iloc[-2] and recent['MACD'].iloc[-1] > recent['MACDSignal'].iloc[-1]:
            reasons.append("Bullish MACD crossover")
        elif recent['MACD'].iloc[-2] > recent['MACDSignal'].iloc[-2] and recent['MACD'].iloc[-1] < recent['MACDSignal'].iloc[-1]:
            reasons.append("Bearish MACD crossover")
    
    if 'ADX' in recent.columns:
        last_adx = recent['ADX'].iloc[-1]
        if last_adx > 25:
            if 'PlusDI' in recent.columns and 'MinusDI' in recent.columns:
                if recent['PlusDI'].iloc[-1] > recent['MinusDI'].iloc[-1]:
                    reasons.append(f"Strong uptrend (ADX: {last_adx:.1f})")
                else:
                    reasons.append(f"Strong downtrend (ADX: {last_adx:.1f})")
        else:
            reasons.append(f"Weak trend (ADX: {last_adx:.1f})")
    
    return {
        "recommendation": recommendation,
        "confidence": confidence,
        "confidenceColor": confidence_color,
        "buyScore": buy_score,
        "sellScore": sell_score,
        "holdScore": hold_score,
        "reasons": reasons
    }

def get_exhaust_data(df):
    """Generate TrendExhaust oscillator data based on the TrendExhaust.pine script"""
    if df is None or df.empty:
        return None
    
    # Default parameters from TrendExhaust.pine
    short_length = 21
    long_length = 112
    short_smoothing_length = 7
    long_smoothing_length = 3
    average_ma = 3
    threshold = 20
    
    # Calculate Williams %R for both periods
    s_percent_r = calculate_williams_r(df, short_length)
    l_percent_r = calculate_williams_r(df, long_length)
    
    # Calculate average %R
    avg_percent_r = (s_percent_r + l_percent_r) / 2
    
    # Apply smoothing (EMA by default)
    if short_smoothing_length > 1:
        s_percent_r = calculate_ema(s_percent_r, short_smoothing_length)
    
    if long_smoothing_length > 1:
        l_percent_r = calculate_ema(l_percent_r, long_smoothing_length)
    
    if average_ma > 1:
        avg_percent_r = calculate_ema(avg_percent_r, average_ma)
    
    # Detect overbought/oversold conditions
    overbought = pd.Series(np.zeros(len(df)), index=df.index)
    oversold = pd.Series(np.zeros(len(df)), index=df.index)
    ob_reversal = pd.Series(np.zeros(len(df)), index=df.index)
    os_reversal = pd.Series(np.zeros(len(df)), index=df.index)
    
    # Detect crossovers
    cross_bull = pd.Series(np.zeros(len(df)), index=df.index)
    cross_bear = pd.Series(np.zeros(len(df)), index=df.index)
    
    for i in range(1, len(df)):
        # Overbought/oversold conditions using average %R
        overbought.iloc[i] = 1 if avg_percent_r.iloc[i] >= -threshold else 0
        oversold.iloc[i] = 1 if avg_percent_r.iloc[i] <= -100 + threshold else 0
        
        # Detect reversals
        if overbought.iloc[i-1] == 1 and overbought.iloc[i] == 0:
            ob_reversal.iloc[i] = 1
        
        if oversold.iloc[i-1] == 1 and oversold.iloc[i] == 0:
            os_reversal.iloc[i] = 1
        
        # Detect crossovers
        if s_percent_r.iloc[i-1] <= l_percent_r.iloc[i-1] and s_percent_r.iloc[i] > l_percent_r.iloc[i]:
            cross_bull.iloc[i] = 1
        
        if s_percent_r.iloc[i-1] >= l_percent_r.iloc[i-1] and s_percent_r.iloc[i] < l_percent_r.iloc[i]:
            cross_bear.iloc[i] = 1
    
    # Store results in dataframe
    df['ShortPercentR'] = s_percent_r
    df['LongPercentR'] = l_percent_r
    df['AvgPercentR'] = avg_percent_r
    df['TEOverbought'] = overbought
    df['TEOversold'] = oversold
    df['TEOBReversal'] = ob_reversal
    df['TEOSReversal'] = os_reversal
    df['TECrossBull'] = cross_bull
    df['TECrossBear'] = cross_bear
    
    return df

def analyzer_b(ticker, period='1y', interval='1d'):
    """Generate Analyzer B oscillator for a stock ticker"""
    # Check cache first
    cache_key = f"{ticker}_{period}_{interval}"
    if cache_key in ticker_cache:
        cache_time = ticker_cache[cache_key]['timestamp']
        if (datetime.now() - cache_time).total_seconds() < CACHE_TTL:
            logger.info(f"Using cached data for {ticker}")
            return ticker_cache[cache_key]['data']
    
    # Fetch data
    df = fetch_stock_data(ticker, period, interval)
    
    if df is None or df.empty:
        return None
    
    # Adjust parameters based on interval
    params = adjust_parameters_for_interval(interval)
    
    # Calculate indicators with interval-appropriate parameters
    wt1, wt2, wtVwap = calculate_wavetrend(
        df, 
        wtChannelLen=params['wtChannelLen'], 
        wtAverageLen=params['wtAverageLen'], 
        wtMALen=params['wtMALen']
    )
    
    # Calculate Stochastic RSI based on Pine Script with adjusted parameters
    rsi = stoch_heikin_ashi(df, len_period=params['stochPeriod1'], k=2)
    stoch_rsi = stoch_heikin_ashi(df, len_period=params['stochPeriod2'], k=2)
    
    # Calculate Money Flow with adjusted parameters
    mf = calculate_money_flow(df, period=params['mfPeriod1'], mf_period=params['mfPeriod2'])
    
    # Calculate RSI3M3+ oscillator
    rsi3_raw, rsi3m3, rsi3m3_state, rsi3m3_buy, rsi3m3_sell = calculate_rsi3m3(df)
    
    # Detect regular and hidden divergences between WT2 and price
    bullish_div, bearish_div, hidden_bullish_div, hidden_bearish_div = detect_divergences(df, wt2, df['Close'], lookback=5)
    
    # Detect Money Flow divergences between price and Money Flow indicator
    mf_bullish_div, mf_bearish_div = detect_mf_divergences(df, mf, df['Close'], lookback=5)
    
    # Detect RSI trend breaks
    rsi_trend_break_buy, rsi_trend_break_sell = detect_rsi_trend_breaks(df, rsi, lookback=5)
    
    macd_line, macd_signal, macd_hist = calculate_macd(df['Close'])
    
    bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(df['Close'])
    
    adx, plus_di, minus_di = calculate_adx(df)
    
    (bayesian_price_regime, bayesian_wt_regime, 
     cusum_price_regime, cusum_wt_regime,
     hmm_price_regime, hmm_wt_regime, 
     sliding_price_regime, sliding_wt_regime,
     combined_price_regime, combined_wt_regime) = detect_regimes(df, df['Close'], wt2, 
                                                              df['Volume'] if 'Volume' in df.columns else None)
    
    # Generate signals with Pine Script default parameters
    buy_signal, gold_buy, sell_signal, wt_cross, cross_points = generate_signals(wt1, wt2, mf, 53, -53, -75)
    
    # Detect Fast Money patterns (Quick WT overbought/oversold transitions)
    fast_money_buy = pd.Series(np.zeros(len(df)), index=df.index)
    fast_money_sell = pd.Series(np.zeros(len(df)), index=df.index)
    
    for i in range(3, len(df)):
        # Fast money buy: WT2 went from < -75 to > -30 in 3 bars or less
        extreme_oversold = False
        for j in range(1, 4):  # Look back up to 3 bars
            if i-j >= 0 and wt2.iloc[i-j] < -75:
                extreme_oversold = True
                break
        
        if extreme_oversold and wt2.iloc[i] > -30 and wt1.iloc[i] > wt2.iloc[i]:
            fast_money_buy.iloc[i] = 1
            
        # Fast money sell: WT2 went from > 75 to < 30 in 3 bars or less
        extreme_overbought = False
        for j in range(1, 4):  # Look back up to 3 bars
            if i-j >= 0 and wt2.iloc[i-j] > 75:
                extreme_overbought = True
                break
        
        if extreme_overbought and wt2.iloc[i] < 30 and wt1.iloc[i] < wt2.iloc[i]:
            fast_money_sell.iloc[i] = 1
    
    # Detect Zero-Line Rejections (bouncing off the zero line)
    zero_line_reject_buy = pd.Series(np.zeros(len(df)), index=df.index)
    zero_line_reject_sell = pd.Series(np.zeros(len(df)), index=df.index)
    
    for i in range(2, len(df)):
        # Zero-line buy: WT2 crosses just below zero and then moves up
        if -10 < wt2.iloc[i-1] < 0 and wt2.iloc[i] > 0 and wt1.iloc[i] > wt2.iloc[i]:
            zero_line_reject_buy.iloc[i] = 1
            
        # Zero-line sell: WT2 crosses just above zero and then moves down
        if 0 < wt2.iloc[i-1] < 10 and wt2.iloc[i] < 0 and wt1.iloc[i] < wt2.iloc[i]:
            zero_line_reject_sell.iloc[i] = 1
    
    # Add all indicators to the dataframe
    df['WT1'] = wt1
    df['WT2'] = wt2
    df['WTVwap'] = wtVwap
    df['RSI'] = rsi
    df['Stoch'] = stoch_rsi
    df['MF'] = mf
    df['Buy'] = buy_signal
    df['GoldBuy'] = gold_buy
    df['Sell'] = sell_signal
    df['WTCross'] = wt_cross
    df['CrossPoints'] = cross_points  # Added for visualization
    df['CrossColor'] = np.where((wt2 - wt1) > 0, 1, 0)  # 1 for red, 0 for green
    
    # Add RSI3M3+ oscillator data
    df['RSI3'] = rsi3_raw
    df['RSI3M3'] = rsi3m3
    df['RSI3M3State'] = rsi3m3_state
    df['RSI3M3Buy'] = rsi3m3_buy
    df['RSI3M3Sell'] = rsi3m3_sell
    
    # Add divergence indicators
    df['BullishDiv'] = bullish_div
    df['BearishDiv'] = bearish_div
    df['HiddenBullishDiv'] = hidden_bullish_div
    df['HiddenBearishDiv'] = hidden_bearish_div
    df['MFBullishDiv'] = mf_bullish_div
    df['MFBearishDiv'] = mf_bearish_div
    
    # Add additional pattern indicators
    df['FastMoneyBuy'] = fast_money_buy
    df['FastMoneySell'] = fast_money_sell
    df['ZeroLineRejectBuy'] = zero_line_reject_buy
    df['ZeroLineRejectSell'] = zero_line_reject_sell
    df['RSITrendBreakBuy'] = rsi_trend_break_buy
    df['RSITrendBreakSell'] = rsi_trend_break_sell
    
    df['BayesianPriceRegime'] = bayesian_price_regime
    df['BayesianWTRegime'] = bayesian_wt_regime
    df['CUSUMPriceRegime'] = cusum_price_regime
    df['CUSUMWTRegime'] = cusum_wt_regime
    df['HMMPriceRegime'] = hmm_price_regime
    df['HMMWTRegime'] = hmm_wt_regime
    df['SlidingPriceRegime'] = sliding_price_regime
    df['SlidingWTRegime'] = sliding_wt_regime
    df['CombinedPriceRegime'] = combined_price_regime
    df['CombinedWTRegime'] = combined_wt_regime
    
    df['MACD'] = macd_line
    df['MACDSignal'] = macd_signal
    df['MACDHist'] = macd_hist
    df['BBUpper'] = bb_upper
    df['BBMiddle'] = bb_middle
    df['BBLower'] = bb_lower
    df['ADX'] = adx
    df['PlusDI'] = plus_di
    df['MinusDI'] = minus_di
    
    # Calculate signal strength (combined metric for sorting)
    signal_strength = 0
    recent_df = df.iloc[-10:] if len(df) >= 10 else df
    
    # Gold Buy signals are strongest
    if recent_df['GoldBuy'].sum() > 0:
        signal_strength += 3
    # Regular Buy signals
    elif recent_df['Buy'].sum() > 0:
        signal_strength += 2
    # Fast Money Buy signals
    elif recent_df['FastMoneyBuy'].sum() > 0:
        signal_strength += 2
    # Zero Line Reject Buy
    elif recent_df['ZeroLineRejectBuy'].sum() > 0:
        signal_strength += 1
    # RSI Trend Break Buy
    elif recent_df['RSITrendBreakBuy'].sum() > 0:
        signal_strength += 2
    # Sell signals are negative
    elif recent_df['Sell'].sum() > 0:
        signal_strength -= 2
    # Fast Money Sell signals
    elif recent_df['FastMoneySell'].sum() > 0:
        signal_strength -= 2
    # Zero Line Reject Sell
    elif recent_df['ZeroLineRejectSell'].sum() > 0:
        signal_strength -= 1
    # RSI Trend Break Sell
    elif recent_df['RSITrendBreakSell'].sum() > 0:
        signal_strength -= 2
    
    # Boost signal strength for regular bullish divergence (strongest)
    if recent_df['BullishDiv'].sum() > 0:
        signal_strength += 2
    # Boost signal strength for hidden bullish divergence
    elif recent_df['HiddenBullishDiv'].sum() > 0:
        signal_strength += 1
    # Boost signal strength for Money Flow bullish divergence
    elif recent_df['MFBullishDiv'].sum() > 0:
        signal_strength += 2
    # Reduce signal strength for regular bearish divergence (strongest)
    if recent_df['BearishDiv'].sum() > 0:
        signal_strength -= 2
    # Reduce signal strength for hidden bearish divergence
    elif recent_df['HiddenBearishDiv'].sum() > 0:
        signal_strength -= 1
    # Reduce signal strength for Money Flow bearish divergence
    elif recent_df['MFBearishDiv'].sum() > 0:
        signal_strength -= 2
        
    # Add bonus for strong money flow
    if df['MF'].iloc[-1] > 3:
        signal_strength += 1
    elif df['MF'].iloc[-1] < -3:
        signal_strength -= 1
        
    # Store signal strength in dataframe
    df.attrs['signal_strength'] = signal_strength
    
    # Calculate price change percentage
    if len(df) >= 2:
        first_price = df['Close'].iloc[-2]
        last_price = df['Close'].iloc[-1]
        if first_price > 0:
            df.attrs['price_change'] = ((last_price - first_price) / first_price) * 100
        else:
            df.attrs['price_change'] = 0
    else:
        df.attrs['price_change'] = 0
    
    # Store ticker type
    df.attrs['ticker_type'] = get_ticker_type(ticker)
    
    # Calculate TrendExhaust data
    df = get_exhaust_data(df)
    
    if df is not None:
        df['BayesianPriceRegime'] = bayesian_price_regime
        df['BayesianWTRegime'] = bayesian_wt_regime
        df['CUSUMPriceRegime'] = cusum_price_regime
        df['CUSUMWTRegime'] = cusum_wt_regime
        df['HMMPriceRegime'] = hmm_price_regime
        df['HMMWTRegime'] = hmm_wt_regime
        df['SlidingPriceRegime'] = sliding_price_regime
        df['SlidingWTRegime'] = sliding_wt_regime
        df['CombinedPriceRegime'] = combined_price_regime
        df['CombinedWTRegime'] = combined_wt_regime
    
    # Add to cache with timestamp
    result = df
    ticker_cache[cache_key] = {
        'data': result,
        'timestamp': datetime.now()
    }
    
    return result

def format_analyzer_result(ticker, df, period, interval):
    """Format the analyzer result for API response"""
    if df is None:
        return None
        
    # Format the data for charting
    # For date formatting, handle both date-only and datetime indices
    if df.index[0].time().hour == 0 and df.index[0].time().minute == 0 and df.index[0].time().second == 0:
        # Date-only index
        dates = df.index.strftime('%Y-%m-%d').tolist()
    else:
        # Datetime index
        dates = df.index.strftime('%Y-%m-%d %H:%M:%S').tolist()
    
    # Clean numeric arrays - replace NaN, inf with None
    def clean_array(arr):
        if arr is None:
            return []
        return [None if pd.isna(x) or np.isinf(x) else x for x in arr]
    
    # Format OHLC data for candlestick charts
    ohlc_data = []
    for i in range(len(df)):
        if (not pd.isna(df['Open'].iloc[i]) and 
            not pd.isna(df['High'].iloc[i]) and
            not pd.isna(df['Low'].iloc[i]) and
            not pd.isna(df['Close'].iloc[i])):
            ohlc_data.append({
                't': dates[i],
                'o': float(df['Open'].iloc[i]),
                'h': float(df['High'].iloc[i]),
                'l': float(df['Low'].iloc[i]),
                'c': float(df['Close'].iloc[i]),
                'v': float(df['Volume'].iloc[i]) if 'Volume' in df.columns and not pd.isna(df['Volume'].iloc[i]) else 0
            })
    
    # Prepare cross points data
    cross_points_data = []
    
    for i, cp in enumerate(df['CrossPoints']):
        if not pd.isna(cp) and not np.isinf(cp):
            cross_points_data.append({
                'date': dates[i],
                'value': float(cp),
                'isRed': bool(df['CrossColor'].iloc[i] == 1)
            })
    
    # Prepare divergence data
    divergences = {
        'bullish': [dates[i] for i, val in enumerate(df['BullishDiv']) if val == 1],
        'bearish': [dates[i] for i, val in enumerate(df['BearishDiv']) if val == 1],
        'hiddenBullish': [dates[i] for i, val in enumerate(df['HiddenBullishDiv']) if val == 1],
        'hiddenBearish': [dates[i] for i, val in enumerate(df['HiddenBearishDiv']) if val == 1],
        'mfBullish': [dates[i] for i, val in enumerate(df['MFBullishDiv']) if val == 1] if 'MFBullishDiv' in df.columns else [],
        'mfBearish': [dates[i] for i, val in enumerate(df['MFBearishDiv']) if val == 1] if 'MFBearishDiv' in df.columns else []
    }
    
    # Prepare additional pattern data
    patterns = {
        'fastMoneyBuy': [dates[i] for i, val in enumerate(df['FastMoneyBuy']) if val == 1],
        'fastMoneySell': [dates[i] for i, val in enumerate(df['FastMoneySell']) if val == 1],
        'zeroLineRejectBuy': [dates[i] for i, val in enumerate(df['ZeroLineRejectBuy']) if val == 1],
        'zeroLineRejectSell': [dates[i] for i, val in enumerate(df['ZeroLineRejectSell']) if val == 1],
        'rsiTrendBreakBuy': [dates[i] for i, val in enumerate(df['RSITrendBreakBuy']) if val == 1] if 'RSITrendBreakBuy' in df.columns else [],
        'rsiTrendBreakSell': [dates[i] for i, val in enumerate(df['RSITrendBreakSell']) if val == 1] if 'RSITrendBreakSell' in df.columns else []
    }
    
    regimes = {
        'bayesianPrice': [dates[i] for i, val in enumerate(df['BayesianPriceRegime']) if val == 1] if 'BayesianPriceRegime' in df.columns else [],
        'bayesianWT': [dates[i] for i, val in enumerate(df['BayesianWTRegime']) if val == 1] if 'BayesianWTRegime' in df.columns else [],
        'cusumPrice': [dates[i] for i, val in enumerate(df['CUSUMPriceRegime']) if val == 1] if 'CUSUMPriceRegime' in df.columns else [],
        'cusumWT': [dates[i] for i, val in enumerate(df['CUSUMWTRegime']) if val == 1] if 'CUSUMWTRegime' in df.columns else [],
        'hmmPrice': [dates[i] for i, val in enumerate(df['HMMPriceRegime']) if val == 1] if 'HMMPriceRegime' in df.columns else [],
        'hmmWT': [dates[i] for i, val in enumerate(df['HMMWTRegime']) if val == 1] if 'HMMWTRegime' in df.columns else [],
        'slidingPrice': [dates[i] for i, val in enumerate(df['SlidingPriceRegime']) if val == 1] if 'SlidingPriceRegime' in df.columns else [],
        'slidingWT': [dates[i] for i, val in enumerate(df['SlidingWTRegime']) if val == 1] if 'SlidingWTRegime' in df.columns else [],
        'combinedPrice': [dates[i] for i, val in enumerate(df['CombinedPriceRegime']) if val == 1] if 'CombinedPriceRegime' in df.columns else [],
        'combinedWT': [dates[i] for i, val in enumerate(df['CombinedWTRegime']) if val == 1] if 'CombinedWTRegime' in df.columns else []
    }
    
    # Get company name from dataframe attributes
    company_name = df.attrs.get('company_name', ticker)
    
    recommendations = generate_trading_recommendations(df)
    
    result = {
        'success': True,
        'ticker': ticker,
        'companyName': company_name,
        'interval': interval,
        'period': period,
        'dates': dates,
        'price': clean_array(df['Close'].tolist()),
        'high': clean_array(df['High'].tolist()),
        'low': clean_array(df['Low'].tolist()),
        'open': clean_array(df['Open'].tolist()),
        'close': clean_array(df['Close'].tolist()),
        'volume': clean_array(df['Volume'].tolist() if 'Volume' in df.columns else []),
        'ohlc': ohlc_data,  # Added OHLC data formatted for candlestick charts
        'wt1': clean_array(df['WT1'].tolist()),
        'wt2': clean_array(df['WT2'].tolist()),
        'wtVwap': clean_array(df['WTVwap'].tolist()),
        'rsi': clean_array(df['RSI'].tolist()),
        'stoch': clean_array(df['Stoch'].tolist()),
        'moneyFlow': clean_array(df['MF'].tolist()),
        'macd': clean_array(df['MACD'].tolist()) if 'MACD' in df.columns else [],
        'macdSignal': clean_array(df['MACDSignal'].tolist()) if 'MACDSignal' in df.columns else [],
        'macdHist': clean_array(df['MACDHist'].tolist()) if 'MACDHist' in df.columns else [],
        'bbUpper': clean_array(df['BBUpper'].tolist()) if 'BBUpper' in df.columns else [],
        'bbMiddle': clean_array(df['BBMiddle'].tolist()) if 'BBMiddle' in df.columns else [],
        'bbLower': clean_array(df['BBLower'].tolist()) if 'BBLower' in df.columns else [],
        'adx': clean_array(df['ADX'].tolist()) if 'ADX' in df.columns else [],
        'plusDI': clean_array(df['PlusDI'].tolist()) if 'PlusDI' in df.columns else [],
        'minusDI': clean_array(df['MinusDI'].tolist()) if 'MinusDI' in df.columns else [],
        'signals': {
            'buy': [dates[i] for i, val in enumerate(df['Buy']) if val],
            'goldBuy': [dates[i] for i, val in enumerate(df['GoldBuy']) if val],
            'sell': [dates[i] for i, val in enumerate(df['Sell']) if val],
            'cross': cross_points_data
        },
        'rsi3m3': {
            'rsi3': clean_array(df['RSI3'].tolist()) if 'RSI3' in df.columns else [],
            'rsi3m3': clean_array(df['RSI3M3'].tolist()) if 'RSI3M3' in df.columns else [],
            'state': clean_array(df['RSI3M3State'].tolist()) if 'RSI3M3State' in df.columns else [],
            'signals': {
                'buy': [dates[i] for i, val in enumerate(df['RSI3M3Buy']) if val] if 'RSI3M3Buy' in df.columns else [],
                'sell': [dates[i] for i, val in enumerate(df['RSI3M3Sell']) if val] if 'RSI3M3Sell' in df.columns else []
            },
            'parameters': {
                'rsiLength': 3,
                'maLength': 3,
                'overbought': 70,
                'oversold': 30,
                'buyLine': 39,
                'sellLine': 61
            }
        },
        'divergences': divergences,
        'patterns': patterns,
        'regimes': regimes,
        'recommendations': recommendations,
        'parameters': adjust_parameters_for_interval(interval),
        'tickerType': df.attrs.get('ticker_type', 'stock')
    }
    
    # Add TrendExhaust data if available
    if 'ShortPercentR' in df.columns and 'LongPercentR' in df.columns:
        result['trendExhaust'] = {
            'shortPercentR': clean_array(df['ShortPercentR'].tolist()),
            'longPercentR': clean_array(df['LongPercentR'].tolist()),
            'avgPercentR': clean_array(df['AvgPercentR'].tolist()),
            'signals': {
                'overbought': [dates[i] for i, val in enumerate(df['TEOverbought']) if val == 1],
                'oversold': [dates[i] for i, val in enumerate(df['TEOversold']) if val == 1],
                'obReversal': [dates[i] for i, val in enumerate(df['TEOBReversal']) if val == 1],
                'osReversal': [dates[i] for i, val in enumerate(df['TEOSReversal']) if val == 1],
                'bullCross': [dates[i] for i, val in enumerate(df['TECrossBull']) if val == 1],
                'bearCross': [dates[i] for i, val in enumerate(df['TECrossBear']) if val == 1]
            },
            'parameters': {
                'shortLength': 21,
                'longLength': 112,
                'shortSmoothingLength': 7,
                'longSmoothingLength': 3,
                'threshold': 20
            }
        }
    
    # Add summary and current status
    recent = df.iloc[-10:]  # Last 10 periods
    
    # Safely get current values with fallbacks for NaN
    def safe_float(value):
        if pd.isna(value) or np.isinf(value):
            return 0
        return float(value)
    
    current_wt1 = safe_float(df['WT1'].iloc[-1])
    current_wt2 = safe_float(df['WT2'].iloc[-1])
    current_mf = safe_float(df['MF'].iloc[-1])
    
    # Calculate price change percentage
    if len(df) >= 2:
        prev_close = safe_float(df['Close'].iloc[-2])
        current_close = safe_float(df['Close'].iloc[-1])
        if prev_close > 0:
            price_change_pct = ((current_close - prev_close) / prev_close) * 100
        else:
            price_change_pct = 0
    else:
        price_change_pct = 0
        
    result['summary'] = {
        'buySignals': int(recent['Buy'].sum()),
        'goldBuySignals': int(recent['GoldBuy'].sum()),
        'sellSignals': int(recent['Sell'].sum()),
        'fastMoneyBuySignals': int(recent['FastMoneyBuy'].sum()),
        'fastMoneySellSignals': int(recent['FastMoneySell'].sum()),
        'bullishDivergenceSignals': int(recent['BullishDiv'].sum() + recent['HiddenBullishDiv'].sum()),
        'bearishDivergenceSignals': int(recent['BearishDiv'].sum() + recent['HiddenBearishDiv'].sum()),
        'mfBullishDivergenceSignals': int(recent['MFBullishDiv'].sum() if 'MFBullishDiv' in recent.columns else 0),
        'mfBearishDivergenceSignals': int(recent['MFBearishDiv'].sum() if 'MFBearishDiv' in recent.columns else 0),
        'rsiTrendBreakBuySignals': int(recent['RSITrendBreakBuy'].sum() if 'RSITrendBreakBuy' in recent.columns else 0),
        'rsiTrendBreakSellSignals': int(recent['RSITrendBreakSell'].sum() if 'RSITrendBreakSell' in recent.columns else 0),
        'currentWT1': current_wt1,
        'currentWT2': current_wt2,
        'currentMF': current_mf,
        'lastUpdate': dates[-1] if dates else None,
        'currentPrice': safe_float(df['Close'].iloc[-1]),
        'priceChangePct': price_change_pct,
        'signalStrength': df.attrs.get('signal_strength', 0),
        'regimes': regimes
    }
    
    if current_wt1 > current_wt2 and current_wt2 < -53:
        result['status'] = "Potential buy zone"
    elif current_wt1 < current_wt2 and current_wt2 > 53:
        result['status'] = "Potential sell zone"
    else:
        result['status'] = "Neutral zone"
        
    return result

@app.route('/api/analyzer-b', methods=['GET'])
def get_analyzer_b_data():
    """
    Enhanced API endpoint for Analyzer B data with optimization and better error handling
    """
    try:
        # Get parameters from request
        ticker = request.args.get('ticker', 'AAPL').upper()
        period = request.args.get('period', '1mo')
        interval = request.args.get('interval', '1d')
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        use_optimized = request.args.get('optimized', 'false').lower() == 'true'
        
        logger.info(f"API request for {ticker} ({period}, {interval}) - optimized: {use_optimized}, force_refresh: {force_refresh}")
        
        # Validate parameters
        valid_periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']
        valid_intervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo']
        
        if period not in valid_periods:
            return jsonify({
                'success': False,
                'error': f'Invalid period. Must be one of: {valid_periods}',
                'ticker': ticker
            }), 400
            
        if interval not in valid_intervals:
            return jsonify({
                'success': False,
                'error': f'Invalid interval. Must be one of: {valid_intervals}',
                'ticker': ticker
            }), 400
        
        # Clear cache if force refresh is requested
        if force_refresh:
            cache_key = f"{ticker}_{period}_{interval}"
            if cache_key in data_cache:
                del data_cache[cache_key]
                logger.info(f"Cache cleared for {cache_key}")
        
        # Choose analyzer function
        if use_optimized and OPTIMIZATION_AVAILABLE:
            logger.info(f"Using optimized analyzer for {ticker}")
            df = analyzer_b_optimized(ticker, period, interval, use_cache=True, force_refresh=force_refresh)
        else:
            logger.info(f"Using standard analyzer for {ticker}")
            df = analyzer_b(ticker, period, interval)
        
        # Check if data was retrieved successfully
        if df is None or df.empty:
            logger.error(f"No data retrieved for {ticker}")
            return jsonify({
                'success': False,
                'error': 'No data available for the specified ticker and parameters',
                'ticker': ticker,
                'period': period,
                'interval': interval,
                'suggestions': [
                    'Try a different time period (e.g., 1mo, 3mo, 1y)',
                    'Check if the ticker symbol is correct',
                    'Try again later as the data source might be temporarily unavailable'
                ]
            }), 404
        
        # Validate data quality before sending response
        if OPTIMIZATION_AVAILABLE:
            is_valid, issues, _ = validate_data_quality(df, REQUIRED_COLUMNS['basic'])
            if not is_valid:
                logger.warning(f"Data quality issues for {ticker}: {issues}")
                # Still proceed but include warnings in response
        
        # Check for minimum data points
        valid_data_points = len(df.dropna(subset=['Close']))
        if valid_data_points < 10:
            logger.warning(f"Insufficient data points for {ticker}: {valid_data_points}")
            return jsonify({
                'success': False,
                'error': f'Insufficient data points: {valid_data_points} (minimum 10 required)',
                'ticker': ticker,
                'period': period,
                'interval': interval,
                'suggestions': [
                    'Try a longer time period',
                    'Use a smaller interval (e.g., 1d instead of 1wk)',
                    'Check if the ticker is actively traded'
                ]
            }), 400
        
        # Check for essential columns
        essential_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
        missing_columns = [col for col in essential_columns if col not in df.columns]
        if missing_columns:
            logger.error(f"Missing essential columns for {ticker}: {missing_columns}")
            return jsonify({
                'success': False,
                'error': f'Missing essential data columns: {missing_columns}',
                'ticker': ticker,
                'period': period,
                'interval': interval
            }), 500
        
        logger.info(f"Successfully processed {len(df)} data points for {ticker}")
        
        # Format and return the result
        result = format_analyzer_result(ticker, df, period, interval)
        
        # Add metadata to response
        result['metadata'] = {
            'data_points': len(df),
            'valid_data_points': valid_data_points,
            'period': period,
            'interval': interval,
            'optimized': use_optimized and OPTIMIZATION_AVAILABLE,
            'cache_used': not force_refresh,
            'processing_time': None,  # Could add timing if needed
            'data_quality_issues': issues if OPTIMIZATION_AVAILABLE and not is_valid else []
        }
        
        return jsonify(result)
        
    except ValueError as e:
        logger.error(f"Value error in analyzer API for {ticker}: {e}")
        return jsonify({
            'success': False,
            'error': f'Invalid parameter value: {str(e)}',
            'ticker': ticker if 'ticker' in locals() else 'unknown'
        }), 400
        
    except ConnectionError as e:
        logger.error(f"Connection error in analyzer API for {ticker}: {e}")
        return jsonify({
            'success': False,
            'error': 'Unable to connect to data source. Please try again later.',
            'ticker': ticker if 'ticker' in locals() else 'unknown',
            'suggestions': [
                'Check your internet connection',
                'Try again in a few minutes',
                'Use cached data if available'
            ]
        }), 503
        
    except Exception as e:
        logger.error(f"Unexpected error in analyzer API for {ticker if 'ticker' in locals() else 'unknown'}: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}',
            'ticker': ticker if 'ticker' in locals() else 'unknown',
            'suggestions': [
                'Try again with different parameters',
                'Contact support if the issue persists'
            ]
        }), 500

# New endpoint to handle multiple tickers at once
@app.route('/api/multi-ticker', methods=['GET'])
def get_multi_ticker_data():
    tickers_str = request.args.get('tickers', default='AAPL', type=str)
    period = request.args.get('period', default='1y', type=str)  # Changed back to '1y' for proper indicator warm-up with EOD API
    interval = request.args.get('interval', default='1d', type=str)
    safe_mode = request.args.get('safe_mode', default='false', type=str).lower() == 'true'
    
    # Parse tickers from comma-separated string
    tickers = [t.strip() for t in tickers_str.split(',') if t.strip()]
    
    if len(tickers) > 20:
        return jsonify({
            'success': False,
            'message': 'Maximum 20 tickers allowed per request'
        }), 400
    
    logger.info(f"Multi-ticker API request received for {len(tickers)} tickers, period: {period}, interval: {interval}, safe_mode: {safe_mode}")
    
    results = {}
    errors = {}
    
    # Process tickers sequentially with delays to avoid rate limiting
    for i, ticker in enumerate(tickers):
        try:
            logger.info(f"Processing ticker {i+1}/{len(tickers)}: {ticker}")
            
            # With EOD API (paid service), we don't need aggressive delays
            # Add minimal delay only for very rapid requests
            if i > 0:
                delay = 0.5  # Just 0.5 second delay between requests
                logger.info(f"Adding {delay}s delay before {ticker}")
                time.sleep(delay)
            
            # Fetch data with proper error handling
            df = analyzer_b(ticker, period, interval)
            
            if df is not None:
                result = format_analyzer_result(ticker, df, period, interval)
                if result:
                    results[ticker] = result
                    logger.info(f"✅ Successfully loaded {ticker}")
                else:
                    errors[ticker] = 'Failed to format data'
            else:
                errors[ticker] = 'No data available - likely rate limited'
                
        except Exception as e:
            logger.error(f"Error processing {ticker}: {str(e)}")
            if "rate limit" in str(e).lower():
                errors[ticker] = 'Rate limited by Yahoo Finance'
            else:
                errors[ticker] = str(e)
    
    return jsonify({
        'success': True,
        'results': results,
        'errors': errors,
        'count': len(results),
        'processing_info': {
            'total_tickers': len(tickers),
            'successful': len(results),
            'failed': len(errors),
            'sequential_processing': True,
            'safe_mode': safe_mode
        },
        'rate_limit_notice': 'If you see many rate limit errors, add &safe_mode=true to the URL for much longer delays'
    })

def analyzer_b_with_data(ticker, df, period, interval):
    """
    Run analyzer_b using provided data instead of fetching from yfinance
    """
    try:
        # Adjust parameters based on interval
        params = adjust_parameters_for_interval(interval)
        
        # Calculate indicators with interval-appropriate parameters
        wt1, wt2, wtVwap = calculate_wavetrend(
            df, 
            wtChannelLen=params['wtChannelLen'], 
            wtAverageLen=params['wtAverageLen'], 
            wtMALen=params['wtMALen']
        )
        
        # Calculate Stochastic RSI based on Pine Script with adjusted parameters
        rsi = stoch_heikin_ashi(df, len_period=params['stochPeriod1'], k=2)
        stoch_rsi = stoch_heikin_ashi(df, len_period=params['stochPeriod2'], k=2)
        
        # Calculate Money Flow with adjusted parameters
        mf = calculate_money_flow(df, period=params['mfPeriod1'], mf_period=params['mfPeriod2'])
        
        # Calculate RSI3M3+ oscillator
        rsi3_raw, rsi3m3, rsi3m3_state, rsi3m3_buy, rsi3m3_sell = calculate_rsi3m3(df)
        
        # Detect regular and hidden divergences between WT2 and price
        bullish_div, bearish_div, hidden_bullish_div, hidden_bearish_div = detect_divergences(df, wt2, df['Close'], lookback=5)
        
        # Detect Money Flow divergences between price and Money Flow indicator
        mf_bullish_div, mf_bearish_div = detect_mf_divergences(df, mf, df['Close'], lookback=5)
        
        # Add all indicators to the dataframe
        df['WT1'] = wt1
        df['WT2'] = wt2
        df['WTVwap'] = wtVwap
        df['RSI'] = rsi
        df['Stoch'] = stoch_rsi
        df['MF'] = mf
        
        # Add divergence indicators
        df['BullishDiv'] = bullish_div
        df['BearishDiv'] = bearish_div
        df['HiddenBullishDiv'] = hidden_bullish_div
        df['HiddenBearishDiv'] = hidden_bearish_div
        df['MFBullishDiv'] = mf_bullish_div
        df['MFBearishDiv'] = mf_bearish_div
        
        # Generate signals
        buy_signal, gold_buy, sell_signal, wt_cross, cross_points = generate_signals(wt1, wt2, mf, 53, -53, -75)
        df['Buy'] = buy_signal
        df['GoldBuy'] = gold_buy
        df['Sell'] = sell_signal
        df['WTCross'] = wt_cross
        df['CrossPoints'] = cross_points
        df['CrossColor'] = np.where((wt2 - wt1) > 0, 1, 0)  # 1 for red, 0 for green
        
        # Add RSI3M3+ oscillator data
        df['RSI3'] = rsi3_raw
        df['RSI3M3'] = rsi3m3
        df['RSI3M3State'] = rsi3m3_state
        df['RSI3M3Buy'] = rsi3m3_buy
        df['RSI3M3Sell'] = rsi3m3_sell
        
        # Store ticker type
        df.attrs['ticker_type'] = get_ticker_type(ticker)
        
        return df
        
    except Exception as e:
        logger.error(f"Error in analyzer_b_with_data for {ticker}: {e}")
        return None

# Endpoint to get available intervals and periods
@app.route('/api/available-options', methods=['GET'])
def get_available_options():
    return jsonify({
        'intervals': VALID_INTERVALS,
        'periods': VALID_PERIODS,
        'intervalLimits': INTERVAL_LIMITS
    })

# Add a new API endpoint to clear the cache
@app.route('/api/clear-cache', methods=['GET'])
def clear_cache():
    """Clear the data cache"""
    global ticker_cache
    ticker_cache = {}
    logger.info("Cache cleared")
    return jsonify({
        'success': True,
        'message': 'Cache cleared successfully'
    })

@app.route('/')
def home():
    """Basic route to test if API is running"""
    return "Analyzer B API is running. Use /api/analyzer-b?ticker=SYMBOL to get data."

# Add routes to serve dashboard files
@app.route('/dashboard.html')
def dashboard():
    """Serve the standard dashboard"""
    return app.send_static_file('dashboard.html')

@app.route('/enhanced-dashboard.html')
def enhanced_dashboard():
    """Serve the enhanced dashboard"""
    return app.send_static_file('enhanced-dashboard.html')

@app.route('/index.html')
def index():
    """Serve the index page"""
    return app.send_static_file('index.html')

@app.route('/dashboard-core.js')
def dashboard_core_js():
    """Serve the dashboard core JS"""
    return app.send_static_file('dashboard-core.js')

@app.route('/enhanced-dashboard.js')
def enhanced_dashboard_js():
    """Serve the enhanced dashboard JS"""
    return app.send_static_file('enhanced-dashboard.js')

@app.route('/enhanced-dashboard.css')
def enhanced_dashboard_css():
    """Serve the enhanced dashboard CSS"""
    return app.send_static_file('enhanced-dashboard.css')

@app.route('/script.js')
def script_js():
    """Serve the main script JS"""
    return app.send_static_file('script.js')

@app.route('/dashboard-detail.js')
def dashboard_detail_js():
    """Serve the dashboard detail JS"""
    return app.send_static_file('dashboard-detail.js')

@app.route('/dashboard-detail-updated.js')
def dashboard_detail_updated_js():
    """Serve the updated dashboard detail JS"""
    return app.send_static_file('dashboard-detail-updated.js')

@app.route('/enhanced-dashboard-detail.js')
def enhanced_dashboard_detail_js():
    """Serve the enhanced dashboard detail JS"""
    return app.send_static_file('enhanced-dashboard-detail.js')

@app.route('/displayTradingRecommendations.js')
def display_trading_recommendations_js():
    """Serve the trading recommendations JS"""
    return app.send_static_file('displayTradingRecommendations.js')

# Add this import at the top of the file with other imports
try:
    from api_optimization import (
        detect_divergences_optimized, 
        validate_data_quality, 
        calculate_indicators_batch,
        optimize_regime_detection,
        performance_monitor,
        REQUIRED_COLUMNS
    )
    OPTIMIZATION_AVAILABLE = True
except ImportError:
    OPTIMIZATION_AVAILABLE = False
    logger.warning("Optimization module not available, using standard functions")
    
    # Create dummy decorator for performance_monitor
    def performance_monitor(func):
        return func

@performance_monitor
def analyzer_b_optimized(ticker, period='1mo', interval='1d', use_cache=True, force_refresh=False):
    """
    Optimized version of analyzer_b with improved performance and reliability
    
    Args:
        ticker: Stock ticker symbol
        period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        use_cache: Whether to use cached data
        force_refresh: Force refresh of cached data
        
    Returns:
        DataFrame with all indicators and analysis
    """
    try:
        logger.info(f"Starting optimized analysis for {ticker} ({period}, {interval})")
        
        # Clear cache if force refresh is requested
        if force_refresh and use_cache:
            cache_key = f"{ticker}_{period}_{interval}"
            if cache_key in data_cache:
                del data_cache[cache_key]
                logger.info(f"Cache cleared for {cache_key}")
        
        # Fetch stock data with improved error handling
        df = fetch_stock_data(
            ticker=ticker, 
            period=period, 
            interval=interval, 
            max_retries=3, 
            retry_delay=5,  # Increased from 2 to 5 seconds
            use_cache=use_cache
        )
        
        if df is None or df.empty:
            logger.error(f"No data available for {ticker}")
            return None
        
        # Validate data quality first
        if OPTIMIZATION_AVAILABLE:
            is_valid, issues, df_clean = validate_data_quality(df, REQUIRED_COLUMNS['basic'])
            if not is_valid:
                logger.warning(f"Data quality issues for {ticker}: {issues}")
                # Try to proceed with cleaned data if possible
                if len(df_clean) < 10:
                    logger.error(f"Insufficient data after cleaning for {ticker}")
                    return None
                df = df_clean
        
        logger.info(f"Processing {len(df)} data points for {ticker}")
        
        # Define parameters
        params = {
            'wtChannelLen': 10,
            'wtAverageLen': 21,
            'wtMALen': 4,
            'mfPeriod1': 7,
            'mfPeriod2': 25,
            'stochPeriod1': 14,
            'stochPeriod2': 14
        }
        
        # Use optimized indicator calculation if available
        if OPTIMIZATION_AVAILABLE and len(df) > 50:
            logger.info("Using optimized indicator calculation")
            df = calculate_indicators_batch(df, params)
        else:
            # Fall back to original method
            logger.info("Using standard indicator calculation")
            df = calculate_all_indicators_standard(df, params)
        
        # Validate that essential indicators were calculated
        essential_indicators = ['WT1', 'WT2', 'RSI', 'MF']
        missing_indicators = [col for col in essential_indicators if col not in df.columns or df[col].isna().all()]
        
        if missing_indicators:
            logger.warning(f"Missing or invalid indicators for {ticker}: {missing_indicators}")
            # Try to recalculate missing indicators
            df = recalculate_missing_indicators(df, missing_indicators, params)
        
        # Calculate divergences with optimization if available
        if OPTIMIZATION_AVAILABLE and 'WT2' in df.columns and len(df) > 20:
            logger.info("Using optimized divergence detection")
            bullish_div, bearish_div, hidden_bullish_div, hidden_bearish_div = detect_divergences_optimized(
                df, df['WT2'], df['Close']
            )
        else:
            logger.info("Using standard divergence detection")
            bullish_div, bearish_div, hidden_bullish_div, hidden_bearish_div = detect_divergences(
                df, df['WT2'], df['Close']
            )
        
        # Add divergence results to DataFrame
        df['BullishDiv'] = bullish_div
        df['BearishDiv'] = bearish_div
        df['HiddenBullishDiv'] = hidden_bullish_div
        df['HiddenBearishDiv'] = hidden_bearish_div
        
        # Money Flow divergences
        if 'MF' in df.columns:
            mf_bullish_div, mf_bearish_div = detect_mf_divergences(df, df['MF'], df['Close'])
            df['MFBullishDiv'] = mf_bullish_div
            df['MFBearishDiv'] = mf_bearish_div
        
        # Regime detection with optimization
        if len(df) > 30:
            if OPTIMIZATION_AVAILABLE:
                logger.info("Using optimized regime detection")
                regime_results = optimize_regime_detection(df, 'Close', 'WT2')
                # Add key regime results to DataFrame
                df['RegimePrice'] = regime_results.get('combined_price', pd.Series(0, index=df.index))
                df['RegimeWT'] = regime_results.get('combined_wt', pd.Series(0, index=df.index))
            else:
                logger.info("Using standard regime detection")
                regime_results = detect_regimes(df, 'Close', 'WT2')
                df = pd.concat([df, regime_results], axis=1)
        
        # Calculate signals and recommendations
        df = calculate_trading_signals(df)
        df = calculate_recommendations(df)
        
        # Generate proper WaveTrend signals (missing from optimized version)
        if 'WT1' in df.columns and 'WT2' in df.columns and 'MF' in df.columns:
            buy_signal, gold_buy, sell_signal, wt_cross, cross_points = generate_signals(df['WT1'], df['WT2'], df['MF'], 53, -53, -75)
            df['Buy'] = buy_signal
            df['GoldBuy'] = gold_buy
            df['Sell'] = sell_signal
            df['WTCross'] = wt_cross
            df['CrossPoints'] = cross_points
            df['CrossColor'] = np.where((df['WT2'] - df['WT1']) > 0, 1, 0)  # 1 for red, 0 for green
        
        # Calculate RSI3M3+ oscillator (missing from optimized version)
        rsi3_raw, rsi3m3, rsi3m3_state, rsi3m3_buy, rsi3m3_sell = calculate_rsi3m3(df)
        df['RSI3'] = rsi3_raw
        df['RSI3M3'] = rsi3m3
        df['RSI3M3State'] = rsi3m3_state
        df['RSI3M3Buy'] = rsi3m3_buy
        df['RSI3M3Sell'] = rsi3m3_sell
        
        # Final data validation
        final_row_count = len(df.dropna(subset=['Close']))
        logger.info(f"Analysis completed for {ticker}: {final_row_count} valid data points")
        
        if final_row_count < 5:
            logger.warning(f"Very few valid data points remaining for {ticker}: {final_row_count}")
        
        return df
        
    except Exception as e:
        logger.error(f"Error in optimized analyzer for {ticker}: {e}")
        # Fallback to original analyzer
        logger.info(f"Falling back to standard analyzer for {ticker}")
        return analyzer_b(ticker, period, interval)

def calculate_all_indicators_standard(df, params):
    """
    Standard indicator calculation method (fallback)
    """
    try:
        # Calculate HLC3
        hlc3 = (df['High'] + df['Low'] + df['Close']) / 3
        
        # WaveTrend
        wt1, wt2 = calculate_wavetrend(hlc3, params['wtChannelLen'], params['wtAverageLen'], params['wtMALen'])
        df['WT1'] = wt1
        df['WT2'] = wt2
        df['WTVwap'] = wt1 - wt2
        
        # Money Flow
        df['MF'] = calculate_money_flow(df, params['mfPeriod1'], params['mfPeriod2'])
        
        # RSI and Stochastic
        df['RSI'] = stoch_heikin_ashi(df, params['stochPeriod1'], 2)
        df['Stoch'] = stoch_heikin_ashi(df, params['stochPeriod2'], 2)
        
        # MACD
        macd_line, macd_signal, macd_hist = calculate_macd(df['Close'])
        df['MACD'] = macd_line
        df['MACDSignal'] = macd_signal
        df['MACDHist'] = macd_hist
        
        # Bollinger Bands
        bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(df['Close'])
        df['BBUpper'] = bb_upper
        df['BBMiddle'] = bb_middle
        df['BBLower'] = bb_lower
        
        # ADX
        adx, plus_di, minus_di = calculate_adx(df)
        df['ADX'] = adx
        df['PlusDI'] = plus_di
        df['MinusDI'] = minus_di
        
        return df
        
    except Exception as e:
        logger.error(f"Error in standard indicator calculation: {e}")
        return df

def recalculate_missing_indicators(df, missing_indicators, params):
    """
    Attempt to recalculate missing indicators
    """
    try:
        if 'WT1' in missing_indicators or 'WT2' in missing_indicators:
            hlc3 = (df['High'] + df['Low'] + df['Close']) / 3
            wt1, wt2 = calculate_wavetrend(hlc3, params['wtChannelLen'], params['wtAverageLen'], params['wtMALen'])
            df['WT1'] = wt1
            df['WT2'] = wt2
            df['WTVwap'] = wt1 - wt2
        
        if 'MF' in missing_indicators:
            df['MF'] = calculate_money_flow(df, params['mfPeriod1'], params['mfPeriod2'])
        
        if 'RSI' in missing_indicators:
            df['RSI'] = stoch_heikin_ashi(df, params['stochPeriod1'], 2)
        
        return df
        
    except Exception as e:
        logger.error(f"Error recalculating missing indicators: {e}")
        return df

def calculate_trading_signals(df):
    """
    Calculate trading signals based on indicators
    """
    try:
        # Initialize signal columns
        df['BuySignal'] = False
        df['SellSignal'] = False
        df['StrongBuySignal'] = False
        df['StrongSellSignal'] = False
        
        # Basic buy signals
        if 'WT2' in df.columns and 'RSI' in df.columns:
            df['BuySignal'] = (
                (df['WT2'] < -40) & 
                (df['RSI'] < 30) & 
                (df['BullishDiv'] == True)
            )
            
            df['SellSignal'] = (
                (df['WT2'] > 40) & 
                (df['RSI'] > 70) & 
                (df['BearishDiv'] == True)
            )
            
            # Strong signals with multiple confirmations
            df['StrongBuySignal'] = (
                df['BuySignal'] & 
                (df['MFBullishDiv'] == True) if 'MFBullishDiv' in df.columns else df['BuySignal']
            )
            
            df['StrongSellSignal'] = (
                df['SellSignal'] & 
                (df['MFBearishDiv'] == True) if 'MFBearishDiv' in df.columns else df['SellSignal']
            )
        
        return df
        
    except Exception as e:
        logger.error(f"Error calculating trading signals: {e}")
        return df

def calculate_recommendations(df):
    """
    Calculate trading recommendations based on multiple factors
    """
    try:
        # Initialize recommendation column
        df['Recommendation'] = 'HOLD'
        
        # Count bullish and bearish signals
        bullish_signals = 0
        bearish_signals = 0
        
        if 'WT2' in df.columns:
            latest_wt2 = df['WT2'].iloc[-1] if not pd.isna(df['WT2'].iloc[-1]) else 0
            if latest_wt2 < -40:
                bullish_signals += 1
            elif latest_wt2 > 40:
                bearish_signals += 1
        
        if 'RSI' in df.columns:
            latest_rsi = df['RSI'].iloc[-1] if not pd.isna(df['RSI'].iloc[-1]) else 50
            if latest_rsi < 30:
                bullish_signals += 1
            elif latest_rsi > 70:
                bearish_signals += 1
        
        if 'BullishDiv' in df.columns and df['BullishDiv'].iloc[-5:].any():
            bullish_signals += 2
        
        if 'BearishDiv' in df.columns and df['BearishDiv'].iloc[-5:].any():
            bearish_signals += 2
        
        # Determine recommendation
        if bullish_signals >= 3:
            df.loc[df.index[-1], 'Recommendation'] = 'STRONG_BUY'
        elif bullish_signals >= 2:
            df.loc[df.index[-1], 'Recommendation'] = 'BUY'
        elif bearish_signals >= 3:
            df.loc[df.index[-1], 'Recommendation'] = 'STRONG_SELL'
        elif bearish_signals >= 2:
            df.loc[df.index[-1], 'Recommendation'] = 'SELL'
        
        return df
        
    except Exception as e:
        logger.error(f"Error calculating recommendations: {e}")
        return df

def calculate_rsi3m3(df, rsi_length=3, ma_length=3, overbought=70, oversold=30, buy_line=39, sell_line=61):
    """
    Calculate RSI3M3+ oscillator based on Pine Script implementation
    
    This oscillator uses a 3-period RSI smoothed with a 3-period MA
    and includes advanced trend state detection with background colors
    
    Args:
        df: DataFrame with OHLCV data
        rsi_length: RSI calculation period (default 3)
        ma_length: Smoothing MA period (default 3)
        overbought: Overbought level (default 70)
        oversold: Oversold level (default 30)
        buy_line: Bressert buy line (default 39)
        sell_line: Bressert sell line (default 61)
        
    Returns:
        Tuple of (rsi3m3, rsi3m3_ma, trend_state, buy_signals, sell_signals)
    """
    try:
        # Calculate 3-period RSI
        delta = df['Close'].diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        
        avg_gain = gain.rolling(window=rsi_length).mean()
        avg_loss = loss.rolling(window=rsi_length).mean()
        
        rs = avg_gain / avg_loss
        rsi3 = 100 - (100 / (1 + rs))
        
        # Smooth with 3-period MA
        rsi3m3_ma = rsi3.rolling(window=ma_length).mean()
        
        # Trend state detection (matching Pine Script logic)
        ts1 = 67  # Upper threshold
        ts2 = 33  # Lower threshold  
        ts1a = 61 # Upper secondary
        ts2a = 39 # Lower secondary
        
        trend_state = pd.Series(0, index=df.index)  # 0=neutral, 1=bullish, 2=bearish, 3=transition
        
        for i in range(1, len(df)):
            prev_state = trend_state.iloc[i-1]
            current_rsi = rsi3.iloc[i]
            prev_rsi = rsi3.iloc[i-1] if i > 0 else current_rsi
            
            # Crossover logic (matching Pine Script)
            if prev_rsi <= ts1 and current_rsi > ts1:  # Crossover 67
                trend_state.iloc[i] = 1  # Bullish
            elif prev_rsi >= ts2 and current_rsi < ts2:  # Crossunder 33
                trend_state.iloc[i] = 2  # Bearish
            elif prev_state == 1 and prev_rsi >= ts2a and current_rsi < ts2a:  # From bullish, crossunder 39
                trend_state.iloc[i] = 3  # Transition
            elif prev_state == 2 and prev_rsi <= ts1a and current_rsi > ts1a:  # From bearish, crossover 61
                trend_state.iloc[i] = 3  # Transition
            else:
                trend_state.iloc[i] = prev_state  # Maintain previous state
        
        # Generate buy/sell signals (matching Pine Script conditions)
        buy_signals = pd.Series(False, index=df.index)
        sell_signals = pd.Series(False, index=df.index)
        
        for i in range(2, len(df)):
            ma_curr = rsi3m3_ma.iloc[i]
            ma_prev1 = rsi3m3_ma.iloc[i-1]
            ma_prev2 = rsi3m3_ma.iloc[i-2]
            
            # Buy signal: MA > MA[1] and MA[1] < MA[2] and MA[1] < oversold
            if (ma_curr > ma_prev1 and ma_prev1 < ma_prev2 and ma_prev1 < oversold):
                buy_signals.iloc[i] = True
                
            # Sell signal: MA < MA[1] and MA[1] > MA[2] and MA[1] > overbought  
            if (ma_curr < ma_prev1 and ma_prev1 > ma_prev2 and ma_prev1 > overbought):
                sell_signals.iloc[i] = True
        
        return rsi3, rsi3m3_ma, trend_state, buy_signals, sell_signals
        
    except Exception as e:
        logger.error(f"Error calculating RSI3M3: {e}")
        # Return empty series with same index
        empty_series = pd.Series(np.nan, index=df.index)
        empty_bool_series = pd.Series(False, index=df.index)
        return empty_series, empty_series, empty_series, empty_bool_series, empty_bool_series

def get_rsi3m3_background_color(state):
    """
    Get background color based on RSI3M3 trend state
    
    Args:
        state: Trend state (0=neutral, 1=bullish, 2=bearish, 3=transition)
        
    Returns:
        Color string for background
    """
    if state == 1:
        return '#00ff0a'  # Bright green (bullish)
    elif state == 2:
        return '#ff1100'  # Bright red (bearish)
    elif state == 3:
        return '#ffff00'  # Yellow (transition)
    else:
        return '#808080'  # Gray (neutral)

if __name__ == '__main__':
    logger.info("Starting Analyzer B API server on port 5000")
    app.run(debug=True, port=5000)
