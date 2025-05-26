"""
Test script to verify yfinance functionality without rate limiting issues
"""

import time
import logging
from api import fetch_stock_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_with_delay():
    """Test with delays between requests to avoid rate limiting"""
    
    # Different tickers to try
    tickers = ['MSFT', 'GOOGL', 'TSLA', 'NVDA']
    
    for ticker in tickers:
        try:
            logger.info(f"Testing {ticker}...")
            data = fetch_stock_data(ticker, period='5d', interval='1d')
            
            if data is not None and not data.empty:
                logger.info(f"SUCCESS: {ticker} - Got {len(data)} data points")
                logger.info(f"Date range: {data.index[0]} to {data.index[-1]}")
                logger.info(f"Columns: {list(data.columns)}")
                return True  # Success on first working ticker
            else:
                logger.warning(f"FAILED: {ticker} - No data returned")
                
        except Exception as e:
            logger.error(f"ERROR: {ticker} - {str(e)}")
        
        # Wait between requests to avoid rate limiting
        logger.info("Waiting 10 seconds to avoid rate limiting...")
        time.sleep(10)
    
    return False

def test_different_periods():
    """Test different time periods that might be less rate-limited"""
    
    periods = ['1mo', '3mo', '6mo']
    ticker = 'MSFT'  # Try Microsoft as it's usually reliable
    
    for period in periods:
        try:
            logger.info(f"Testing {ticker} with period {period}...")
            data = fetch_stock_data(ticker, period=period, interval='1d')
            
            if data is not None and not data.empty:
                logger.info(f"SUCCESS: {ticker} ({period}) - Got {len(data)} data points")
                return True
            else:
                logger.warning(f"FAILED: {ticker} ({period}) - No data returned")
                
        except Exception as e:
            logger.error(f"ERROR: {ticker} ({period}) - {str(e)}")
        
        # Wait between requests
        time.sleep(5)
    
    return False

if __name__ == "__main__":
    logger.info("Testing yfinance functionality...")
    
    # Test 1: Try with delays
    logger.info("=== Test 1: Different tickers with delays ===")
    success1 = test_with_delay()
    
    if not success1:
        # Test 2: Try different periods
        logger.info("=== Test 2: Different periods ===")
        success2 = test_different_periods()
        
        if not success2:
            logger.error("All tests failed - likely persistent rate limiting")
            logger.info("Try again in 15-30 minutes when rate limits reset")
        else:
            logger.info("SUCCESS: Found working configuration")
    else:
        logger.info("SUCCESS: Basic functionality working")
    
    logger.info("Test completed.") 