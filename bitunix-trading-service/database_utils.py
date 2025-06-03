"""
🗄️ Database utilities for Bitunix Trading Service
Connects to the same PostgreSQL database as the Discord bot
"""

import os
import asyncio
import asyncpg
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    🗄️ Database manager for crypto trading service
    
    Connects to the same PostgreSQL database as the Discord bot
    and queries signal notifications for trading decisions
    """
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or os.getenv('DATABASE_URL')
        self.pool = None
        
    async def initialize(self) -> bool:
        """🔌 Initialize database connection pool"""
        try:
            if not self.database_url:
                logger.error("❌ No DATABASE_URL provided")
                return False
                
            # Create connection pool
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=1,
                max_size=5,
                command_timeout=60
            )
            
            logger.info("✅ Database connection pool created")
            
            # Test connection
            async with self.pool.acquire() as conn:
                result = await conn.fetchval('SELECT version()')
                logger.info(f"📊 Connected to PostgreSQL: {result[:50]}...")
                
            return True
            
        except Exception as e:
            logger.error(f"❌ Database initialization failed: {e}")
            return False
    
    async def get_new_crypto_signals(self, last_processed_id: int = 0) -> List[Dict]:
        """📡 Get new cryptocurrency signals from database"""
        try:
            async with self.pool.acquire() as conn:
                # Query for new crypto signals using actual column names
                results = await conn.fetch('''
                    SELECT 
                        sn.id,
                        sn.ticker,
                        sn.timeframe,
                        sn.signal_type,
                        sn.signal_date,
                        sn.notified_at,
                        sn.strength,
                        sn.system,
                        sn.priority_level,
                        sn.priority_score
                    FROM signal_notifications sn
                    WHERE sn.id > $1
                        AND sn.notified_at >= NOW() - INTERVAL '1 hour'
                        AND (
                            sn.ticker LIKE '%-USD' 
                            OR sn.ticker IN ('BTC', 'ETH', 'ADA', 'DOGE', 'SOL', 'DOT', 'LINK', 'HBAR', 'JTO', 'KAS', 'ONDO')
                        )
                    ORDER BY sn.notified_at ASC
                    LIMIT 100
                ''', last_processed_id)
                
                signals = []
                for row in results:
                    signals.append({
                        'id': row['id'],
                        'ticker': row['ticker'],
                        'timeframe': row['timeframe'],
                        'type': row['signal_type'],
                        'date': row['signal_date'],
                        'notified_at': row['notified_at'],
                        'strength': row['strength'] or 'Moderate',
                        'system': row['system'] or self._determine_signal_system(row['signal_type']),
                        'priority_level': row['priority_level'],
                        'priority_score': row['priority_score']
                    })
                
                if signals:
                    logger.info(f"📡 Found {len(signals)} new crypto signals")
                    
                return signals
                
        except Exception as e:
            logger.error(f"❌ Error getting crypto signals: {e}")
            return []
    
    def _determine_signal_system(self, signal_type: str) -> str:
        """🧠 Determine signal system from signal type"""
        signal_type_lower = signal_type.lower()
        
        if 'wt' in signal_type_lower or 'wave trend' in signal_type_lower:
            return 'Wave Trend'
        elif 'rsi3m3' in signal_type_lower or 'rsi' in signal_type_lower:
            return 'RSI3M3+'
        elif 'divergence' in signal_type_lower:
            return 'Divergence'
        elif 'fast money' in signal_type_lower:
            return 'Patterns'
        elif 'gold' in signal_type_lower:
            return 'Gold Standard'
        else:
            return 'Technical'
    
    async def log_trade_execution(self, signal: Dict, trade_result: Dict) -> bool:
        """📝 Log trade execution to database"""
        try:
            async with self.pool.acquire() as conn:
                # Create trade log table if it doesn't exist
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS bitunix_trade_log (
                        id SERIAL PRIMARY KEY,
                        signal_id INTEGER,
                        ticker VARCHAR(20),
                        timeframe VARCHAR(10),
                        signal_type VARCHAR(100),
                        signal_strength VARCHAR(20),
                        action VARCHAR(20),
                        amount_usdt DECIMAL(18,8),
                        price DECIMAL(18,8),
                        trading_mode VARCHAR(20),
                        leverage INTEGER,
                        order_id VARCHAR(100),
                        status VARCHAR(20),
                        error_message TEXT,
                        paper_trade BOOLEAN DEFAULT false,
                        result_data JSONB,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                
                # Insert trade log
                await conn.execute('''
                    INSERT INTO bitunix_trade_log 
                    (signal_id, ticker, timeframe, signal_type, signal_strength, action, 
                     amount_usdt, price, trading_mode, leverage, order_id, status, 
                     error_message, paper_trade, result_data)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ''', 
                signal.get('id'), signal['ticker'], signal['timeframe'],
                signal['type'], signal.get('strength', 'Moderate'), 
                trade_result.get('action', 'unknown'),
                trade_result.get('amount', 0), trade_result.get('price', 0),
                trade_result.get('trading_mode', 'spot'),
                trade_result.get('result', {}).get('data', {}).get('leverage', 1),
                trade_result.get('result', {}).get('data', {}).get('orderId', ''),
                'success' if trade_result.get('result', {}).get('code') == '0' else 'failed',
                trade_result.get('reason', ''),
                trade_result.get('result', {}).get('paper_trade', False),
                trade_result.get('result', {}))
                
                logger.info(f"📝 Logged trade: {signal['ticker']} {trade_result.get('action', 'unknown')}")
                return True
                
        except Exception as e:
            logger.error(f"❌ Error logging trade: {e}")
            return False
    
    async def get_trading_stats(self, days: int = 7) -> Dict:
        """📊 Get trading statistics"""
        try:
            async with self.pool.acquire() as conn:
                # Create trade log table if it doesn't exist first
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS bitunix_trade_log (
                        id SERIAL PRIMARY KEY,
                        signal_id INTEGER,
                        ticker VARCHAR(20),
                        timeframe VARCHAR(10),
                        signal_type VARCHAR(100),
                        signal_strength VARCHAR(20),
                        action VARCHAR(20),
                        amount_usdt DECIMAL(18,8),
                        price DECIMAL(18,8),
                        trading_mode VARCHAR(20),
                        leverage INTEGER,
                        order_id VARCHAR(100),
                        status VARCHAR(20),
                        error_message TEXT,
                        paper_trade BOOLEAN DEFAULT false,
                        result_data JSONB,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                
                # Get trading stats for the last N days
                stats = await conn.fetchrow('''
                    SELECT 
                        COUNT(*) as total_trades,
                        COUNT(*) FILTER (WHERE status = 'success') as successful_trades,
                        COUNT(*) FILTER (WHERE action = 'buy') as buy_trades,
                        COUNT(*) FILTER (WHERE action = 'sell') as sell_trades,
                        COUNT(*) FILTER (WHERE trading_mode = 'spot') as spot_trades,
                        COUNT(*) FILTER (WHERE trading_mode = 'futures') as futures_trades,
                        COUNT(*) FILTER (WHERE paper_trade = true) as paper_trades,
                        COUNT(*) FILTER (WHERE paper_trade = false) as real_trades,
                        AVG(amount_usdt) as avg_trade_size,
                        SUM(amount_usdt) as total_volume
                    FROM bitunix_trade_log 
                    WHERE created_at >= NOW() - INTERVAL '{} days'
                '''.format(days))
                
                if stats:
                    success_rate = 0.0
                    if stats['total_trades'] > 0:
                        success_rate = (stats['successful_trades'] / stats['total_trades']) * 100
                    
                    return {
                        'total_trades': stats['total_trades'],
                        'successful_trades': stats['successful_trades'],
                        'success_rate': round(success_rate, 2),
                        'buy_trades': stats['buy_trades'],
                        'sell_trades': stats['sell_trades'],
                        'spot_trades': stats['spot_trades'],
                        'futures_trades': stats['futures_trades'],
                        'paper_trades': stats['paper_trades'],
                        'real_trades': stats['real_trades'],
                        'avg_trade_size': float(stats['avg_trade_size'] or 0),
                        'total_volume': float(stats['total_volume'] or 0),
                        'period_days': days
                    }
                else:
                    return {
                        'total_trades': 0,
                        'successful_trades': 0,
                        'success_rate': 0.0,
                        'period_days': days
                    }
                    
        except Exception as e:
            logger.error(f"❌ Error getting trading stats: {e}")
            return {'error': str(e)}
    
    async def get_recent_trades(self, limit: int = 10) -> List[Dict]:
        """📋 Get recent trades"""
        try:
            async with self.pool.acquire() as conn:
                # Create trade log table if it doesn't exist first
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS bitunix_trade_log (
                        id SERIAL PRIMARY KEY,
                        signal_id INTEGER,
                        ticker VARCHAR(20),
                        timeframe VARCHAR(10),
                        signal_type VARCHAR(100),
                        signal_strength VARCHAR(20),
                        action VARCHAR(20),
                        amount_usdt DECIMAL(18,8),
                        price DECIMAL(18,8),
                        trading_mode VARCHAR(20),
                        leverage INTEGER,
                        order_id VARCHAR(100),
                        status VARCHAR(20),
                        error_message TEXT,
                        paper_trade BOOLEAN DEFAULT false,
                        result_data JSONB,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                
                results = await conn.fetch('''
                    SELECT 
                        ticker, action, amount_usdt, price, trading_mode,
                        status, paper_trade, created_at
                    FROM bitunix_trade_log 
                    ORDER BY created_at DESC 
                    LIMIT $1
                ''', limit)
                
                trades = []
                for row in results:
                    trades.append({
                        'ticker': row['ticker'],
                        'action': row['action'],
                        'amount_usdt': float(row['amount_usdt']),
                        'price': float(row['price']),
                        'trading_mode': row['trading_mode'],
                        'status': row['status'],
                        'paper_trade': row['paper_trade'],
                        'created_at': row['created_at'].isoformat()
                    })
                
                return trades
                
        except Exception as e:
            logger.error(f"❌ Error getting recent trades: {e}")
            return []
    
    async def update_signal_processed(self, signal_id: int) -> bool:
        """✅ Mark signal as processed (optional)"""
        try:
            async with self.pool.acquire() as conn:
                # Create processed signals table if needed
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS processed_signals (
                        signal_id INTEGER PRIMARY KEY,
                        processed_at TIMESTAMP DEFAULT NOW()
                    )
                ''')
                
                # Insert processed signal
                await conn.execute('''
                    INSERT INTO processed_signals (signal_id) 
                    VALUES ($1) 
                    ON CONFLICT (signal_id) DO NOTHING
                ''', signal_id)
                
                return True
                
        except Exception as e:
            logger.error(f"❌ Error updating signal processed: {e}")
            return False
    
    async def close(self):
        """🔌 Close database connection"""
        if self.pool:
            await self.pool.close()
            logger.info("🔌 Database connection pool closed")
    
    async def inspect_database_schema(self) -> Dict:
        """🔍 Inspect existing database schema (no changes)"""
        try:
            async with self.pool.acquire() as conn:
                # Get signal_notifications table structure
                sn_columns = await conn.fetch('''
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'signal_notifications'
                    ORDER BY ordinal_position
                ''')
                
                # Get signals_detected table structure  
                sd_columns = await conn.fetch('''
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'signals_detected'
                    ORDER BY ordinal_position
                ''')
                
                # Sample recent data to understand format
                sample_sn = await conn.fetchrow('''
                    SELECT * FROM signal_notifications 
                    ORDER BY id DESC LIMIT 1
                ''')
                
                sample_sd = await conn.fetchrow('''
                    SELECT * FROM signals_detected 
                    ORDER BY id DESC LIMIT 1
                ''')
                
                schema_info = {
                    'signal_notifications': {
                        'columns': [{'name': col['column_name'], 'type': col['data_type']} for col in sn_columns],
                        'sample_data': dict(sample_sn) if sample_sn else None
                    },
                    'signals_detected': {
                        'columns': [{'name': col['column_name'], 'type': col['data_type']} for col in sd_columns],
                        'sample_data': dict(sample_sd) if sample_sd else None
                    }
                }
                
                logger.info("🔍 Database schema inspected")
                return schema_info
                
        except Exception as e:
            logger.error(f"❌ Error inspecting schema: {e}")
            return {'error': str(e)}


# Test database connection
async def test_database_connection():
    """🧪 Test database connection"""
    db = DatabaseManager()
    
    print("🔌 Testing database connection...")
    success = await db.initialize()
    
    if success:
        print("✅ Database connection successful")
        
        # Test getting signals
        signals = await db.get_new_crypto_signals()
        print(f"📡 Found {len(signals)} recent crypto signals")
        
        # Test getting stats
        stats = await db.get_trading_stats()
        print(f"📊 Trading stats: {stats}")
        
        # Test getting recent trades
        trades = await db.get_recent_trades(5)
        print(f"📋 Recent trades: {len(trades)} found")
        
    else:
        print("❌ Database connection failed")
    
    await db.close()

if __name__ == "__main__":
    asyncio.run(test_database_connection()) 