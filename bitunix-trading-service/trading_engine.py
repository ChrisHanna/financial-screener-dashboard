"""
🚀 Bitunix Cryptocurrency Trading Engine
Monitors Discord bot database for signals and executes crypto trades
"""

import os
import asyncio
import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field

from bitunix_trader import BitunixTrader, BitunixConfig
from database_utils import DatabaseManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bitunix_trading.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TradingEngineConfig:
    """Trading engine configuration"""
    # Check intervals
    signal_check_interval: int = 15  # Check every 15 seconds (crypto is fast!)
    health_check_interval: int = 300  # Health check every 5 minutes
    
    # Trading modes
    auto_trading_enabled: bool = False
    paper_trading_mode: bool = True
    spot_trading_enabled: bool = True
    futures_trading_enabled: bool = False  # Start conservative
    
    # Signal filtering
    max_signal_age_minutes: int = 60  # Only trade signals from last hour
    min_signal_strength: str = "Strong"  # Minimum signal strength
    tradeable_timeframes: List[str] = field(default_factory=lambda: ['1d', '4h', '1h', '15m'])
    
    # Rate limiting
    max_trades_per_minute: int = 2
    cooldown_between_trades_seconds: int = 30

class BitunixTradingEngine:
    """
    🚀 Bitunix Cryptocurrency Trading Engine
    
    Features:
    - Monitors Discord bot's PostgreSQL database for new crypto signals
    - Executes spot and futures trades on Bitunix exchange
    - Advanced risk management for cryptocurrency trading
    - 24/7 operation (crypto never sleeps!)
    - Paper trading mode for safe testing
    - Real-time performance tracking
    """
    
    def __init__(self, config: TradingEngineConfig = None):
        self.config = config or TradingEngineConfig()
        
        # Core components
        self.db_manager = DatabaseManager()
        self.trader = None
        
        # Engine state
        self.running = False
        self.last_processed_signal_id = 0
        self.processed_signals: Set[str] = set()
        self.last_trade_time = datetime.min
        
        # Trading configuration
        self.bitunix_config = BitunixConfig(
            api_key=os.getenv('BITUNIX_API_KEY', ''),
            api_secret=os.getenv('BITUNIX_API_SECRET', ''),
            max_position_size_usdt=float(os.getenv('MAX_POSITION_SIZE_USDT', '100.0')),
            max_daily_trades=int(os.getenv('MAX_DAILY_TRADES', '50')),
            default_leverage=int(os.getenv('DEFAULT_LEVERAGE', '3')),
            min_trade_amount=float(os.getenv('MIN_TRADE_AMOUNT', '15.0')),
            min_signal_strength=os.getenv('MIN_SIGNAL_STRENGTH', 'Strong')
        )
        
        # Statistics
        self.stats = {
            'engine_start_time': None,
            'signals_processed': 0,
            'trades_executed': 0,
            'successful_trades': 0,
            'failed_trades': 0,
            'last_signal_time': None,
            'last_trade_time': None
        }
        
        logger.info("🚀 Bitunix Trading Engine initialized")
    
    async def initialize(self) -> bool:
        """🔌 Initialize trading engine"""
        try:
            logger.info("🔌 Initializing Bitunix Trading Engine...")
            
            # Initialize database connection
            db_success = await self.db_manager.initialize()
            if not db_success:
                logger.error("❌ Failed to initialize database")
                return False
            
            # Initialize Bitunix trader
            self.trader = BitunixTrader(self.bitunix_config)
            
            # Set trading modes
            if self.config.paper_trading_mode:
                self.trader.enable_paper_trading()
            else:
                self.trader.disable_paper_trading()
            
            # Authenticate with Bitunix
            auth_success = await self.trader.authenticate()
            if not auth_success and not self.config.paper_trading_mode:
                logger.error("❌ Bitunix authentication failed")
                return False
            
            # Load last processed signal
            await self.load_last_processed_signal()
            
            # Update stats
            self.stats['engine_start_time'] = datetime.now()
            
            logger.info("✅ Bitunix Trading Engine ready")
            logger.info(f"📊 Configuration:")
            logger.info(f"   Paper Trading: {self.config.paper_trading_mode}")
            logger.info(f"   Auto Trading: {self.config.auto_trading_enabled}")
            logger.info(f"   Spot Trading: {self.config.spot_trading_enabled}")
            logger.info(f"   Futures Trading: {self.config.futures_trading_enabled}")
            logger.info(f"   Max Position Size: ${self.bitunix_config.max_position_size_usdt} USDT")
            logger.info(f"   Check Interval: {self.config.signal_check_interval} seconds")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize trading engine: {e}")
            return False
    
    async def load_last_processed_signal(self):
        """📖 Load last processed signal ID"""
        try:
            async with self.db_manager.pool.acquire() as conn:
                # Get the latest signal ID that was processed recently
                result = await conn.fetchval('''
                    SELECT COALESCE(MAX(id), 0) 
                    FROM signal_notifications 
                    WHERE notified_at < NOW() - INTERVAL '5 minutes'
                    AND (ticker LIKE '%-USD' OR ticker IN ('BTC', 'ETH', 'ADA', 'DOGE', 'SOL'))
                ''')
                
                self.last_processed_signal_id = result or 0
                logger.info(f"📖 Starting from signal ID: {self.last_processed_signal_id}")
                
        except Exception as e:
            logger.error(f"❌ Error loading last signal: {e}")
            self.last_processed_signal_id = 0
    
    async def get_new_crypto_signals(self) -> List[Dict]:
        """📡 Get new cryptocurrency signals"""
        try:
            signals = await self.db_manager.get_new_crypto_signals(self.last_processed_signal_id)
            
            # Filter signals by age with proper timezone handling
            filtered_signals = []
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=self.config.max_signal_age_minutes)
            
            for signal in signals:
                # Check signal age with timezone awareness
                signal_time = signal['notified_at']
                if isinstance(signal_time, str):
                    signal_time = datetime.fromisoformat(signal_time.replace('Z', '+00:00'))
                elif signal_time.tzinfo is None:
                    # If naive datetime, assume UTC
                    signal_time = signal_time.replace(tzinfo=timezone.utc)
                
                if signal_time >= cutoff_time:
                    filtered_signals.append(signal)
                else:
                    logger.debug(f"⏰ Signal too old: {signal['ticker']} from {signal_time}")
            
            if filtered_signals:
                self.stats['last_signal_time'] = datetime.now()
                
            return filtered_signals
            
        except Exception as e:
            logger.error(f"❌ Error getting crypto signals: {e}")
            return []
    
    def should_trade_signal(self, signal: Dict) -> tuple[bool, str]:
        """🎯 Determine if signal should be traded"""
        try:
            # Check if auto trading is enabled
            if not self.config.auto_trading_enabled:
                return False, "Auto trading disabled"
            
            # Check signal strength
            strength = signal.get('strength', 'Moderate')
            strength_levels = {'Weak': 1, 'Moderate': 2, 'Strong': 3, 'Very Strong': 4}
            min_strength_level = strength_levels.get(self.config.min_signal_strength, 3)
            signal_strength_level = strength_levels.get(strength, 2)
            
            if signal_strength_level < min_strength_level:
                return False, f"Signal strength too low: {strength} (minimum: {self.config.min_signal_strength})"
            
            # Check if it's a crypto signal
            ticker = signal['ticker']
            if not (ticker.endswith('-USD') or ticker in ['BTC', 'ETH', 'ADA', 'DOGE', 'SOL', 'HBAR', 'JTO', 'KAS', 'ONDO']):
                return False, f"Not a crypto signal: {ticker}"
            
            # Check signal type for trading patterns
            signal_type = signal.get('type', '').lower()
            tradeable_signals = [
                'buy signal', 'sell signal', 'bullish', 'bearish',
                'fast money', 'gold buy', 'gold sell', 'divergence',
                'wt buy', 'wt sell', 'rsi buy', 'rsi sell',
                'bear cross', 'bull cross', 'overbought', 'oversold',
                'reversal', 'entry', 'exit', 'cross'
            ]
            
            if not any(ts in signal_type for ts in tradeable_signals):
                return False, f"Signal type not tradeable: {signal_type}"
            
            # Check if already processed
            signal_key = f"{signal['ticker']}_{signal['type']}_{signal['date']}"
            if signal_key in self.processed_signals:
                return False, "Signal already processed"
            
            # Check rate limiting
            time_since_last_trade = datetime.now() - self.last_trade_time
            if time_since_last_trade.total_seconds() < self.config.cooldown_between_trades_seconds:
                return False, f"Cooldown active: {self.config.cooldown_between_trades_seconds - time_since_last_trade.total_seconds():.0f}s remaining"
            
            # Check timeframe suitability for crypto
            timeframe = signal.get('timeframe', '1d')
            if timeframe not in self.config.tradeable_timeframes:
                return False, f"Timeframe not suitable: {timeframe}"
            
            return True, "Signal approved for crypto trading"
            
        except Exception as e:
            logger.error(f"❌ Error evaluating signal: {e}")
            return False, f"Evaluation error: {e}"
    
    def determine_trading_mode(self, signal: Dict) -> str:
        """🎯 Determine trading mode (spot or futures)"""
        try:
            # Default to spot trading
            if not self.config.futures_trading_enabled:
                return "spot"
            
            # Use futures for very strong signals with specific patterns
            strength = signal.get('strength', 'Moderate')
            signal_type = signal.get('type', '').lower()
            
            # Futures criteria
            if (strength == 'Very Strong' and 
                ('fast money' in signal_type or 'gold' in signal_type or 'wt' in signal_type)):
                return "futures"
            
            return "spot"
            
        except Exception as e:
            logger.error(f"❌ Error determining trading mode: {e}")
            return "spot"
    
    async def process_crypto_signal(self, signal: Dict) -> Dict:
        """🎯 Process cryptocurrency signal"""
        try:
            logger.info(f"🎯 Processing signal: {signal['type']} for {signal['ticker']}")
            
            # Check if should trade
            should_trade, reason = self.should_trade_signal(signal)
            if not should_trade:
                logger.info(f"⏭️ Skipping: {reason}")
                return {'action': 'skipped', 'reason': reason}
            
            # Mark as being processed
            signal_key = f"{signal['ticker']}_{signal['type']}_{signal['date']}"
            self.processed_signals.add(signal_key)
            
            # Determine trading mode
            trading_mode = self.determine_trading_mode(signal)
            
            # Process the signal
            result = await self.trader.process_signal(
                signal, signal['ticker'], signal['timeframe'], trading_mode
            )
            
            # Update statistics
            self.stats['signals_processed'] += 1
            
            if result.get('action') in ['buy', 'sell']:
                self.stats['trades_executed'] += 1
                self.stats['last_trade_time'] = datetime.now()
                self.last_trade_time = datetime.now()
                
                if result.get('result', {}).get('code') == '0':
                    self.stats['successful_trades'] += 1
                else:
                    self.stats['failed_trades'] += 1
            
            # Log trade to database
            await self.db_manager.log_trade_execution(signal, result)
            
            # Mark signal as processed
            await self.db_manager.update_signal_processed(signal.get('id', 0))
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error processing crypto signal: {e}")
            self.stats['failed_trades'] += 1
            return {'action': 'error', 'message': str(e)}
    
    async def health_check(self):
        """🏥 Perform health check"""
        try:
            logger.info("🏥 Performing health check...")
            
            # Check database connection
            if not self.db_manager.pool or self.db_manager.pool.get_size() == 0:
                logger.warning("⚠️ Database connection lost, reconnecting...")
                await self.db_manager.initialize()
            
            # Check trader authentication
            if self.trader and not self.config.paper_trading_mode:
                portfolio = await self.trader.get_portfolio_summary()
                if portfolio.get('error'):
                    logger.warning("⚠️ Trader authentication issue")
            
            # Log statistics
            uptime = datetime.now() - self.stats['engine_start_time']
            logger.info(f"📊 Health Check - Uptime: {uptime}")
            logger.info(f"   Signals Processed: {self.stats['signals_processed']}")
            logger.info(f"   Trades Executed: {self.stats['trades_executed']}")
            logger.info(f"   Success Rate: {self.stats['successful_trades']}/{self.stats['trades_executed']} trades")
            
        except Exception as e:
            logger.error(f"❌ Health check failed: {e}")
    
    async def run_trading_loop(self):
        """🔄 Main trading loop"""
        logger.info("🔄 Starting cryptocurrency trading loop...")
        print("\n" + "🔄" * 30)
        print("🔄 BITUNIX TRADING ENGINE ACTIVE")
        print("🔄" * 30)
        print(f"📊 Configuration:")
        print(f"   • Paper Trading: {self.config.paper_trading_mode}")
        print(f"   • Auto Trading: {self.config.auto_trading_enabled}")
        print(f"   • Tradeable Timeframes: {', '.join(self.config.tradeable_timeframes)}")
        print(f"   • Check Interval: {self.config.signal_check_interval} seconds")
        print(f"   • Max Position Size: ${self.bitunix_config.max_position_size_usdt} USDT")
        print("🔄" * 30)
        
        if not self.config.auto_trading_enabled:
            print("⚠️ AUTO TRADING DISABLED - Only monitoring signals")
        if self.config.paper_trading_mode:
            print("📝 PAPER TRADING MODE - No real money at risk")
        
        print("🔄" * 30 + "\n")
        
        self.running = True
        
        last_health_check = datetime.min
        
        while self.running:
            try:
                # Health check
                if (datetime.now() - last_health_check).total_seconds() >= self.config.health_check_interval:
                    await self.health_check()
                    last_health_check = datetime.now()
                
                # Get new crypto signals
                new_signals = await self.get_new_crypto_signals()
                
                if new_signals:
                    print(f"\n📡 FOUND {len(new_signals)} NEW CRYPTO SIGNALS")
                    print("-" * 50)
                    
                    for i, signal in enumerate(new_signals, 1):
                        print(f"📊 Signal #{i}: {signal['ticker']} ({signal['timeframe']}) - {signal['type']}")
                    
                    print("-" * 50)
                    logger.info(f"📡 Processing {len(new_signals)} new crypto signals")
                    
                    for signal in new_signals:
                        # Process each signal
                        result = await self.process_crypto_signal(signal)
                        
                        # Update last processed
                        self.last_processed_signal_id = max(
                            self.last_processed_signal_id,
                            signal.get('id', 0)
                        )
                        
                        # Small delay between trades for rate limiting
                        if result.get('action') in ['buy', 'sell']:
                            await asyncio.sleep(self.config.cooldown_between_trades_seconds)
                        else:
                            await asyncio.sleep(2)  # Short delay for rejected signals
                else:
                    # Show monitoring status every few checks
                    current_time = datetime.now().strftime('%H:%M:%S')
                    print(f"🔍 {current_time} - Monitoring for crypto signals... (next check in {self.config.signal_check_interval}s)")
                
                # Wait before next check (crypto markets never close!)
                await asyncio.sleep(self.config.signal_check_interval)
                
            except Exception as e:
                logger.error(f"❌ Error in trading loop: {e}")
                await asyncio.sleep(60)  # Wait longer on error
    
    def enable_auto_trading(self):
        """🟢 Enable auto trading"""
        self.config.auto_trading_enabled = True
        if self.trader:
            self.trader.enable_trading()
        logger.info("🟢 Crypto auto trading ENABLED")
    
    def disable_auto_trading(self):
        """🔴 Disable auto trading"""
        self.config.auto_trading_enabled = False
        if self.trader:
            self.trader.disable_trading()
        logger.info("🔴 Crypto auto trading DISABLED")
    
    def enable_futures_trading(self):
        """🚀 Enable futures trading"""
        self.config.futures_trading_enabled = True
        logger.info("🚀 Futures trading ENABLED")
    
    def disable_futures_trading(self):
        """📈 Disable futures trading (spot only)"""
        self.config.futures_trading_enabled = False
        logger.info("📈 Spot trading only")
    
    def enable_paper_trading(self):
        """📝 Enable paper trading"""
        self.config.paper_trading_mode = True
        if self.trader:
            self.trader.enable_paper_trading()
        logger.info("📝 Paper trading mode ENABLED")
    
    def disable_paper_trading(self):
        """💰 Enable real trading"""
        self.config.paper_trading_mode = False
        if self.trader:
            self.trader.disable_paper_trading()
        logger.info("💰 Real trading mode ENABLED")
    
    async def get_status(self) -> Dict:
        """📊 Get comprehensive trading engine status"""
        try:
            # Get trader portfolio
            portfolio = await self.trader.get_portfolio_summary() if self.trader else {}
            
            # Get database stats
            db_stats = await self.db_manager.get_trading_stats(7)
            recent_trades = await self.db_manager.get_recent_trades(5)
            
            # Calculate uptime
            uptime_seconds = 0
            if self.stats['engine_start_time']:
                uptime_seconds = (datetime.now() - self.stats['engine_start_time']).total_seconds()
            
            return {
                'engine_status': {
                    'running': self.running,
                    'uptime_seconds': uptime_seconds,
                    'last_processed_signal_id': self.last_processed_signal_id,
                    'processed_signals_count': len(self.processed_signals)
                },
                'configuration': {
                    'auto_trading_enabled': self.config.auto_trading_enabled,
                    'paper_trading_mode': self.config.paper_trading_mode,
                    'spot_trading_enabled': self.config.spot_trading_enabled,
                    'futures_trading_enabled': self.config.futures_trading_enabled,
                    'signal_check_interval': self.config.signal_check_interval,
                    'max_position_size': self.bitunix_config.max_position_size_usdt,
                    'max_daily_trades': self.bitunix_config.max_daily_trades,
                    'tradeable_timeframes': self.config.tradeable_timeframes
                },
                'statistics': self.stats,
                'portfolio': portfolio,
                'database_stats': db_stats,
                'recent_trades': recent_trades
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting status: {e}")
            return {'error': str(e)}
    
    async def shutdown(self):
        """🛑 Shutdown trading engine"""
        logger.info("🛑 Shutting down Bitunix Trading Engine...")
        self.running = False
        
        if self.db_manager:
            await self.db_manager.close()
        
        logger.info("✅ Shutdown complete")


async def main():
    """🚀 Main entry point"""
    print("🚀 Bitunix Cryptocurrency Trading Engine")
    print("=" * 50)
    
    # Load configuration from environment
    config = TradingEngineConfig(
        auto_trading_enabled=os.getenv('AUTO_TRADING', 'false').lower() == 'true',
        paper_trading_mode=os.getenv('PAPER_TRADING', 'true').lower() == 'true',
        spot_trading_enabled=os.getenv('SPOT_TRADING', 'true').lower() == 'true',
        futures_trading_enabled=os.getenv('FUTURES_TRADING', 'false').lower() == 'true',
        signal_check_interval=int(os.getenv('SIGNAL_CHECK_INTERVAL', '15')),
        max_signal_age_minutes=int(os.getenv('MAX_SIGNAL_AGE_MINUTES', '60')),
        min_signal_strength=os.getenv('MIN_SIGNAL_STRENGTH', 'Strong'),
        tradeable_timeframes=os.getenv('TRADEABLE_TIMEFRAMES', '1d,4h,1h,15m').split(',')
    )
    
    engine = BitunixTradingEngine(config)
    
    try:
        # Initialize
        if not await engine.initialize():
            print("❌ Failed to initialize trading engine")
            return
        
        # Show status
        status = await engine.get_status()
        print("\n📊 Trading Engine Status:")
        print(f"   Paper Trading: {status['configuration']['paper_trading_mode']}")
        print(f"   Auto Trading: {status['configuration']['auto_trading_enabled']}")
        print(f"   Spot Trading: {status['configuration']['spot_trading_enabled']}")
        print(f"   Futures Trading: {status['configuration']['futures_trading_enabled']}")
        print(f"   Max Position: ${status['configuration']['max_position_size']} USDT")
        print(f"   Check Interval: {status['configuration']['signal_check_interval']} seconds")
        print(f"   Tradeable Timeframes: {', '.join(config.tradeable_timeframes)}")
        
        print(f"\n🔄 Monitoring crypto signals every {config.signal_check_interval} seconds")
        print("🏥 Health checks every 5 minutes")
        print("\nPress Ctrl+C to stop")
        
        # Enable auto trading if configured
        if config.auto_trading_enabled:
            engine.enable_auto_trading()
        
        # Run the trading loop
        await engine.run_trading_loop()
        
    except KeyboardInterrupt:
        print("\n⏹️ Shutdown requested...")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
    finally:
        await engine.shutdown()

if __name__ == "__main__":
    asyncio.run(main()) 