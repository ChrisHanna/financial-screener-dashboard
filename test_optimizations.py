#!/usr/bin/env python3
"""
Test script for API optimizations
=================================

This script tests the optimized functions and compares performance
with the standard implementations.
"""

import time
import pandas as pd
import numpy as np
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_data_fetching():
    """Test basic data fetching functionality"""
    logger.info("Testing data fetching...")
    
    try:
        from api import fetch_stock_data
        
        # Test with a reliable ticker
        tickers = ['AAPL', 'MSFT', 'GOOGL']
        
        for ticker in tickers:
            logger.info(f"Testing data fetch for {ticker}")
            
            start_time = time.time()
            df = fetch_stock_data(ticker, '1mo', '1d', use_cache=False)
            fetch_time = time.time() - start_time
            
            if df is not None and not df.empty:
                logger.info(f"✓ {ticker}: {len(df)} data points fetched in {fetch_time:.2f}s")
                
                # Check for essential columns
                essential_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
                missing_cols = [col for col in essential_cols if col not in df.columns]
                
                if missing_cols:
                    logger.warning(f"  Missing columns: {missing_cols}")
                else:
                    logger.info(f"  All essential columns present")
                
                # Check for NaN values
                nan_counts = df[essential_cols].isna().sum()
                if nan_counts.sum() > 0:
                    logger.warning(f"  NaN values found: {nan_counts.to_dict()}")
                else:
                    logger.info(f"  No NaN values in essential columns")
                    
            else:
                logger.error(f"✗ {ticker}: No data retrieved")
                
    except Exception as e:
        logger.error(f"Error in data fetching test: {e}")

def test_optimization_availability():
    """Test if optimization modules are available"""
    logger.info("Testing optimization availability...")
    
    try:
        from api_optimization import (
            detect_divergences_optimized,
            validate_data_quality,
            calculate_indicators_batch,
            REQUIRED_COLUMNS
        )
        logger.info("✓ Optimization modules available")
        return True
        
    except ImportError as e:
        logger.warning(f"✗ Optimization modules not available: {e}")
        return False

def test_analyzer_performance():
    """Test and compare analyzer performance"""
    logger.info("Testing analyzer performance...")
    
    try:
        from api import analyzer_b, fetch_stock_data
        
        # Test with different data sizes
        test_cases = [
            ('AAPL', '5d', '1d'),
            ('MSFT', '1mo', '1d'),
            ('GOOGL', '3mo', '1d')
        ]
        
        optimization_available = test_optimization_availability()
        
        for ticker, period, interval in test_cases:
            logger.info(f"Testing {ticker} ({period}, {interval})")
            
            # Test standard analyzer
            start_time = time.time()
            df_standard = analyzer_b(ticker, period, interval, use_cache=False)
            standard_time = time.time() - start_time
            
            if df_standard is not None:
                logger.info(f"  Standard analyzer: {len(df_standard)} points in {standard_time:.2f}s")
                
                # Test optimized analyzer if available
                if optimization_available:
                    try:
                        from api import analyzer_b_optimized
                        
                        start_time = time.time()
                        df_optimized = analyzer_b_optimized(ticker, period, interval, use_cache=False)
                        optimized_time = time.time() - start_time
                        
                        if df_optimized is not None:
                            logger.info(f"  Optimized analyzer: {len(df_optimized)} points in {optimized_time:.2f}s")
                            
                            # Compare performance
                            speedup = standard_time / optimized_time if optimized_time > 0 else 0
                            logger.info(f"  Performance: {speedup:.2f}x speedup")
                            
                            # Compare data quality
                            common_cols = set(df_standard.columns) & set(df_optimized.columns)
                            if len(common_cols) > 5:
                                logger.info(f"  Data consistency: {len(common_cols)} common columns")
                            else:
                                logger.warning(f"  Data inconsistency: only {len(common_cols)} common columns")
                                
                        else:
                            logger.warning(f"  Optimized analyzer returned no data")
                            
                    except Exception as e:
                        logger.error(f"  Error testing optimized analyzer: {e}")
                        
            else:
                logger.error(f"  Standard analyzer returned no data")
                
    except Exception as e:
        logger.error(f"Error in analyzer performance test: {e}")

def test_api_endpoint():
    """Test API endpoint functionality"""
    logger.info("Testing API endpoint...")
    
    try:
        import requests
        import json
        
        # Test different endpoints
        base_url = "http://localhost:5000"
        test_cases = [
            f"{base_url}/api/analyzer-b?ticker=AAPL&period=1mo&interval=1d",
            f"{base_url}/api/analyzer-b?ticker=MSFT&period=5d&interval=1d&optimized=true",
            f"{base_url}/api/analyzer-b?ticker=GOOGL&period=1mo&interval=1d&force_refresh=true"
        ]
        
        for url in test_cases:
            logger.info(f"Testing: {url}")
            
            try:
                start_time = time.time()
                response = requests.get(url, timeout=30)
                response_time = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success', False):
                        logger.info(f"  ✓ Success in {response_time:.2f}s")
                        
                        # Check response structure
                        if 'data' in data and 'metadata' in data:
                            logger.info(f"  Data points: {data['metadata'].get('data_points', 'unknown')}")
                            logger.info(f"  Optimized: {data['metadata'].get('optimized', 'unknown')}")
                        else:
                            logger.warning(f"  Missing expected response structure")
                    else:
                        logger.error(f"  ✗ API returned error: {data.get('error', 'unknown')}")
                else:
                    logger.error(f"  ✗ HTTP {response.status_code}: {response.text[:100]}")
                    
            except requests.exceptions.ConnectionError:
                logger.warning(f"  ⚠ API server not running (connection refused)")
                break
            except requests.exceptions.Timeout:
                logger.error(f"  ✗ Request timeout after 30s")
            except Exception as e:
                logger.error(f"  ✗ Request error: {e}")
                
    except ImportError:
        logger.warning("Requests library not available, skipping API endpoint test")
    except Exception as e:
        logger.error(f"Error in API endpoint test: {e}")

def test_data_quality():
    """Test data quality validation"""
    logger.info("Testing data quality validation...")
    
    optimization_available = test_optimization_availability()
    
    if not optimization_available:
        logger.warning("Skipping data quality test - optimization module not available")
        return
    
    try:
        from api_optimization import validate_data_quality, REQUIRED_COLUMNS
        from api import fetch_stock_data
        
        # Test with real data
        df = fetch_stock_data('AAPL', '1mo', '1d', use_cache=False)
        
        if df is not None:
            is_valid, issues, cleaned_df = validate_data_quality(df, REQUIRED_COLUMNS['basic'])
            
            logger.info(f"Data validation result: {'Valid' if is_valid else 'Invalid'}")
            if issues:
                logger.info(f"Issues found: {issues}")
            
            logger.info(f"Original data: {len(df)} rows")
            logger.info(f"Cleaned data: {len(cleaned_df)} rows")
            
            # Test with problematic data
            df_with_nans = df.copy()
            df_with_nans.loc[df_with_nans.index[:10], 'Close'] = np.nan
            
            is_valid_nan, issues_nan, cleaned_nan = validate_data_quality(df_with_nans, REQUIRED_COLUMNS['basic'])
            
            logger.info(f"Data with NaNs validation: {'Valid' if is_valid_nan else 'Invalid'}")
            if issues_nan:
                logger.info(f"Issues with NaN data: {issues_nan}")
                
        else:
            logger.error("No data available for quality testing")
            
    except Exception as e:
        logger.error(f"Error in data quality test: {e}")

def run_comprehensive_test():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("STARTING COMPREHENSIVE OPTIMIZATION TESTS")
    logger.info("=" * 60)
    
    start_time = time.time()
    
    # Run individual tests
    test_data_fetching()
    logger.info("-" * 40)
    
    test_optimization_availability()
    logger.info("-" * 40)
    
    test_data_quality()
    logger.info("-" * 40)
    
    test_analyzer_performance()
    logger.info("-" * 40)
    
    test_api_endpoint()
    logger.info("-" * 40)
    
    total_time = time.time() - start_time
    
    logger.info("=" * 60)
    logger.info(f"ALL TESTS COMPLETED IN {total_time:.2f} SECONDS")
    logger.info("=" * 60)

if __name__ == "__main__":
    run_comprehensive_test() 