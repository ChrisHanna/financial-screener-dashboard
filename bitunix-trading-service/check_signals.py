"""
🔍 Quick Signal Checker
Check what signals are currently in the database
"""

import os
import asyncio
from database_utils import DatabaseManager
from datetime import datetime, timedelta

async def check_current_signals():
    """🔍 Check current signals in database"""
    
    # Set database URL
    db_url = "postgresql://postgres:uHhRVHaFpglqZlNFaEFCLrQrkFQJypwD@centerbeam.proxy.rlwy.net:55570/railway"
    os.environ['DATABASE_URL'] = db_url
    
    print("🔍 Checking Current Signals in Database")
    print("=" * 60)
    
    db = DatabaseManager()
    
    try:
        # Initialize connection
        success = await db.initialize()
        if not success:
            print("❌ Failed to connect to database")
            return
        
        print("✅ Connected to database")
        
        # Check recent signals (last 2 hours)
        async with db.pool.acquire() as conn:
            recent_signals = await conn.fetch('''
                SELECT 
                    id, ticker, timeframe, signal_type, signal_date, 
                    notified_at, strength, system, priority_level
                FROM signal_notifications 
                WHERE notified_at >= NOW() - INTERVAL '2 hours'
                    AND (
                        ticker LIKE '%-USD' 
                        OR ticker IN ('BTC', 'ETH', 'ADA', 'DOGE', 'SOL')
                    )
                ORDER BY notified_at DESC
                LIMIT 20
            ''')
            
            print(f"\n📡 RECENT CRYPTO SIGNALS (Last 2 Hours): {len(recent_signals)} found")
            print("-" * 60)
            
            if recent_signals:
                for signal in recent_signals:
                    time_ago = datetime.now() - signal['notified_at'].replace(tzinfo=None)
                    minutes_ago = int(time_ago.total_seconds() / 60)
                    
                    print(f"🎯 {signal['ticker']} ({signal['timeframe']}) - {signal['signal_type']}")
                    print(f"   💪 Strength: {signal['strength']} | 🏭 System: {signal['system']}")
                    print(f"   ⏰ {minutes_ago} minutes ago | 🆔 ID: {signal['id']}")
                    print()
            else:
                print("   No recent crypto signals found")
            
            # Check daily signals specifically
            daily_signals = await conn.fetch('''
                SELECT 
                    id, ticker, timeframe, signal_type, signal_date, 
                    notified_at, strength, system
                FROM signal_notifications 
                WHERE notified_at >= NOW() - INTERVAL '24 hours'
                    AND timeframe = '1d'
                    AND (
                        ticker LIKE '%-USD' 
                        OR ticker IN ('BTC', 'ETH', 'ADA', 'DOGE', 'SOL')
                    )
                ORDER BY notified_at DESC
                LIMIT 10
            ''')
            
            print(f"\n📊 DAILY CRYPTO SIGNALS (Last 24 Hours): {len(daily_signals)} found")
            print("-" * 60)
            
            if daily_signals:
                for signal in daily_signals:
                    time_ago = datetime.now() - signal['notified_at'].replace(tzinfo=None)
                    hours_ago = int(time_ago.total_seconds() / 3600)
                    
                    print(f"📈 {signal['ticker']} (1d) - {signal['signal_type']}")
                    print(f"   💪 {signal['strength']} | 🏭 {signal['system']} | ⏰ {hours_ago}h ago")
                    print()
            else:
                print("   No daily crypto signals found")
                
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(check_current_signals()) 