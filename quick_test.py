#!/usr/bin/env python3
"""
Quick test for data fetching
"""

import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_basic_import():
    """Test basic imports"""
    try:
        import yfinance as yf
        import pandas as pd
        import numpy as np
        logger.info("✓ Basic imports successful")
        return True
    except ImportError as e:
        logger.error(f"✗ Import error: {e}")
        return False

def test_yfinance_direct():
    """Test yfinance directly"""
    try:
        import yfinance as yf
        
        logger.info("Testing yfinance directly...")
        ticker = yf.Ticker("AAPL")
        data = ticker.history(period="5d", interval="1d")
        
        if data is not None and not data.empty:
            logger.info(f"✓ yfinance direct test: {len(data)} rows")
            logger.info(f"  Columns: {list(data.columns)}")
            return True
        else:
            logger.error("✗ yfinance returned no data")
            return False
            
    except Exception as e:
        logger.error(f"✗ yfinance direct test failed: {e}")
        return False

def test_api_fetch():
    """Test API fetch function"""
    try:
        from api import fetch_stock_data
        
        logger.info("Testing API fetch function...")
        df = fetch_stock_data('AAPL', '5d', '1d')
        
        if df is not None and not df.empty:
            logger.info(f"✓ API fetch test: {len(df)} rows")
            logger.info(f"  Columns: {list(df.columns)}")
            return True
        else:
            logger.error("✗ API fetch returned no data")
            return False
            
    except Exception as e:
        logger.error(f"✗ API fetch test failed: {e}")
        return False

def test_analyzer():
    """Test analyzer function"""
    try:
        from api import analyzer_b
        
        logger.info("Testing analyzer function...")
        df = analyzer_b('AAPL', '5d', '1d')
        
        if df is not None and not df.empty:
            logger.info(f"✓ Analyzer test: {len(df)} rows")
            logger.info(f"  Columns: {list(df.columns)}")
            return True
        else:
            logger.error("✗ Analyzer returned no data")
            return False
            
    except Exception as e:
        logger.error(f"✗ Analyzer test failed: {e}")
        return False

if __name__ == "__main__":
    logger.info("Starting quick tests...")
    
    tests = [
        test_basic_import,
        test_yfinance_direct,
        test_api_fetch,
        test_analyzer
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            logger.error(f"Test {test.__name__} crashed: {e}")
            results.append(False)
        
        logger.info("-" * 40)
    
    passed = sum(results)
    total = len(results)
    
    logger.info(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        logger.info("✓ All tests passed!")
        sys.exit(0)
    else:
        logger.error("✗ Some tests failed")
        sys.exit(1) 