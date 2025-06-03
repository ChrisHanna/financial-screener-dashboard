"""
🚀 Bitunix Trading Integration for Discord Signal Bot
Advanced cryptocurrency trading with the Bitunix exchange API
"""

import os
import asyncio
import logging
import hmac
import hashlib
import time
import requests
import json
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_DOWN
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TradeAction(Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"

class OrderType(Enum):
    MARKET = 2
    LIMIT = 1

class OrderSide(Enum):
    SELL = 1
    BUY = 2

@dataclass
class BitunixConfig:
    """Bitunix trading configuration"""
    api_key: str = ""
    api_secret: str = ""
    base_url: str = "https://open-api.bitunix.com"
    
    # Trading parameters
    max_position_size_usdt: float = 100.0  # Max $100 USDT per position
    max_daily_trades: int = 50             # Higher limit for crypto (24/7 markets)
    max_portfolio_risk: float = 0.05       # 5% max portfolio risk
    default_leverage: int = 3              # Conservative 3x leverage
    min_trade_amount: float = 15.0         # Minimum $15 USDT trade
    
    # Signal filtering
    min_signal_strength: str = "Strong"
    tradeable_pairs: List[str] = field(default_factory=lambda: [
        "BTCUSDT", "ETHUSDT", "ADAUSDT", "DOGEUSDT",
        "SOLUSDT", "DOTUSDT", "LINKUSDT", "UNIUSDT",
        "LTCUSDT", "BCHUSDT", "XLMUSDT", "TRXUSDT",
        "HBARUSDT", "JTOUSDT", "KASUSDT", "ONDOUSDT"
    ])

class BitunixTrader:
    """
    🚀 Bitunix Exchange Trading Integration
    
    Features:
    - Spot and futures trading
    - Advanced risk management for crypto
    - Real-time portfolio tracking
    - Comprehensive logging
    - Paper trading mode for safety
    """
    
    def __init__(self, config: BitunixConfig = None):
        self.config = config or BitunixConfig()
        self.session = requests.Session()
        
        # Account info
        self.account_balance = 0.0
        self.positions = {}
        self.orders_today = []
        
        # Trading controls
        self.authenticated = False
        self.trading_enabled = False
        self.paper_trading = True
        self.emergency_stop = False
        
        # Daily limits and tracking
        self.daily_trades_count = 0
        self.daily_pnl = 0.0
        self.daily_loss_limit = 200.0  # $200 daily loss limit
        self.last_reset_date = datetime.now().date()
        
        logger.info("🚀 Bitunix Trader initialized")
    
    def _generate_signature(self, params: str, secret: str) -> str:
        """Generate API signature for Bitunix"""
        return hmac.new(
            secret.encode('utf-8'),
            params.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    def _get_headers(self, params: str = "") -> Dict:
        """Generate authentication headers"""
        timestamp = str(int(time.time() * 1000))
        
        if params:
            signature_payload = f"{timestamp}{params}"
        else:
            signature_payload = timestamp
            
        signature = self._generate_signature(signature_payload, self.config.api_secret)
        
        return {
            'Content-Type': 'application/json',
            'X-ACCESS-KEY': self.config.api_key,
            'X-ACCESS-SIGN': signature,
            'X-ACCESS-TIMESTAMP': timestamp
        }
    
    def _reset_daily_counters(self):
        """Reset daily counters if new day"""
        current_date = datetime.now().date()
        if current_date > self.last_reset_date:
            self.daily_trades_count = 0
            self.daily_pnl = 0.0
            self.orders_today = []
            self.last_reset_date = current_date
            logger.info(f"📅 Daily counters reset for {current_date}")
    
    async def authenticate(self) -> bool:
        """🔐 Authenticate with Bitunix API"""
        try:
            if not self.config.api_key or not self.config.api_secret:
                logger.warning("⚠️ No API credentials provided - running in paper trading only")
                self.paper_trading = True
                return True
            
            # Test API connection with account balance call
            response = await self.get_account_balance()
            
            if response and 'code' in response:
                if response['code'] == '0':  # Success
                    self.authenticated = True
                    logger.info("✅ Bitunix authentication successful")
                    return True
                else:
                    logger.error(f"❌ Bitunix authentication failed: {response.get('msg', 'Unknown error')}")
                    return False
            else:
                logger.error("❌ Invalid response from Bitunix API")
                return False
                
        except Exception as e:
            logger.error(f"❌ Authentication error: {e}")
            return False
    
    async def get_account_balance(self) -> Dict:
        """💰 Get account balance"""
        try:
            if self.paper_trading:
                # 🛡️ FIX: Update account_balance in paper trading mode too
                paper_balance_data = {
                    'code': '0',
                    'data': {
                        'USDT': {'available': '1000.00', 'frozen': '0.00'}
                    }
                }
                # Update our balance tracking for paper trading
                usdt_balance = paper_balance_data.get('data', {}).get('USDT', {})
                self.account_balance = float(usdt_balance.get('available', 0))
                return paper_balance_data
            
            url = f"{self.config.base_url}/api/v1/account/balance"
            headers = self._get_headers()
            
            response = self.session.get(url, headers=headers)
            data = response.json()
            
            if data.get('code') == '0':
                # Update our balance tracking
                usdt_balance = data.get('data', {}).get('USDT', {})
                self.account_balance = float(usdt_balance.get('available', 0))
                
            return data
            
        except Exception as e:
            logger.error(f"❌ Error getting account balance: {e}")
            return {'code': '1', 'msg': str(e)}
    
    async def get_ticker_price(self, symbol: str) -> float:
        """📊 Get current ticker price"""
        try:
            # Convert from Discord bot format (BTC-USD) to Bitunix format (BTCUSDT)
            bitunix_symbol = self.convert_symbol_format(symbol)
            
            url = f"{self.config.base_url}/api/v1/ticker/price"
            params = {'symbol': bitunix_symbol}
            
            response = self.session.get(url, params=params)
            data = response.json()
            
            if data.get('code') == '0' and 'data' in data:
                price = float(data['data']['price'])
                return price
            else:
                logger.error(f"❌ Error getting price for {symbol}: {data}")
                return 0.0
                
        except Exception as e:
            logger.error(f"❌ Error getting ticker price: {e}")
            return 0.0
    
    def convert_symbol_format(self, symbol: str) -> str:
        """🔄 Convert symbol from Discord bot format to Bitunix format"""
        # Discord bot format: BTC-USD, ETH-USD, ADA-USD
        # Bitunix format: BTCUSDT, ETHUSDT, ADAUSDT
        
        symbol_map = {
            'BTC-USD': 'BTCUSDT',
            'ETH-USD': 'ETHUSDT', 
            'ADA-USD': 'ADAUSDT',
            'DOGE-USD': 'DOGEUSDT',
            'SOL-USD': 'SOLUSDT',
            'DOT-USD': 'DOTUSDT',
            'LINK-USD': 'LINKUSDT',
            'UNI-USD': 'UNIUSDT',
            'LTC-USD': 'LTCUSDT',
            'BCH-USD': 'BCHUSDT',
            'XLM-USD': 'XLMUSDT',
            'TRX-USD': 'TRXUSDT',
            'HBAR-USD': 'HBARUSDT',
            'JTO-USD': 'JTOUSDT',
            'KAS-USD': 'KASUSDT',
            'ONDO-USD': 'ONDOUSDT'
        }
        
        return symbol_map.get(symbol, symbol.replace('-USD', 'USDT'))
    
    def calculate_position_size(self, symbol: str, current_price: float, signal_strength: str) -> float:
        """💡 Calculate position size in USDT"""
        try:
            # Reset daily counters if new day
            self._reset_daily_counters()
            
            # Base position size
            base_size = self.config.max_position_size_usdt
            
            # Adjust based on signal strength
            strength_multipliers = {
                "Very Strong": 1.0,
                "Strong": 0.8,
                "Moderate": 0.5,
                "Weak": 0.3
            }
            
            multiplier = strength_multipliers.get(signal_strength, 0.5)
            adjusted_size = base_size * multiplier
            
            # Ensure minimum trade amount
            final_size = max(adjusted_size, self.config.min_trade_amount)
            
            # Check available balance (use 90% of available)
            available_balance = self.account_balance * 0.9
            final_size = min(final_size, available_balance)
            
            logger.info(f"💡 Position size for {symbol}: ${final_size:.2f} USDT")
            logger.info(f"   Signal strength: {signal_strength} (multiplier: {multiplier})")
            logger.info(f"   Available balance: ${available_balance:.2f}")
            
            return round(final_size, 2)
            
        except Exception as e:
            logger.error(f"❌ Error calculating position size: {e}")
            return 0.0
    
    async def place_spot_order(self, symbol: str, side: str, amount: float, order_type: str = "market") -> Dict:
        """📈 Place spot trading order"""
        try:
            bitunix_symbol = self.convert_symbol_format(symbol)
            current_price = await self.get_ticker_price(symbol)
            
            if self.paper_trading:
                # Simulate order execution for paper trading
                paper_result = {
                    'code': '0',
                    'data': {
                        'orderId': f"paper_spot_{int(time.time())}",
                        'symbol': bitunix_symbol,
                        'side': side,
                        'amount': amount,
                        'price': current_price,
                        'status': 'filled',
                        'timestamp': datetime.now().isoformat(),
                        'type': 'spot'
                    },
                    'paper_trade': True
                }
                
                # Enhanced console logging
                print("=" * 60)
                print(f"📝 PAPER TRADE EXECUTED - SPOT ORDER")
                print("=" * 60)
                print(f"🎯 Symbol: {symbol} ({bitunix_symbol})")
                print(f"📊 Action: {side.upper()}")
                print(f"💰 Amount: ${amount:.2f} USDT")
                print(f"💲 Price: ${current_price:.4f}")
                print(f"🆔 Order ID: {paper_result['data']['orderId']}")
                print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"🔄 Order Type: MARKET SPOT")
                print("=" * 60)
                
                logger.info(f"📝 Paper spot trade: {side.upper()} ${amount:.2f} USDT of {symbol} @ ${current_price:.4f}")
                return paper_result
            
            # Real trading - prepare order data
            order_data = {
                "symbol": bitunix_symbol,
                "side": OrderSide.BUY.value if side.lower() == "buy" else OrderSide.SELL.value,
                "type": OrderType.MARKET.value if order_type == "market" else OrderType.LIMIT.value,
                "volume": str(amount)
            }
            
            if order_type == "market":
                order_data["price"] = "0"  # Market orders use price 0
            
            # Real trading execution
            url = f"{self.config.base_url}/api/v1/spot/order"
            headers = self._get_headers(json.dumps(order_data))
            
            response = self.session.post(url, headers=headers, json=order_data)
            result = response.json()
            
            if result.get('code') == '0':
                logger.info(f"✅ Spot order placed: {side.upper()} ${amount:.2f} USDT of {symbol}")
            else:
                logger.error(f"❌ Spot order failed: {result}")
                
            return result
            
        except Exception as e:
            logger.error(f"❌ Error placing spot order: {e}")
            return {'code': '1', 'msg': str(e)}
    
    async def place_futures_order(self, symbol: str, side: str, amount: float, leverage: int = None) -> Dict:
        """🚀 Place futures trading order"""
        try:
            bitunix_symbol = self.convert_symbol_format(symbol)
            leverage = leverage or self.config.default_leverage
            current_price = await self.get_ticker_price(symbol)
            
            if self.paper_trading:
                paper_result = {
                    'code': '0', 
                    'data': {
                        'orderId': f"paper_futures_{int(time.time())}",
                        'symbol': bitunix_symbol,
                        'side': side,
                        'amount': amount,
                        'price': current_price,
                        'leverage': leverage,
                        'status': 'filled',
                        'timestamp': datetime.now().isoformat(),
                        'type': 'futures'
                    },
                    'paper_trade': True
                }
                
                # Enhanced console logging
                print("=" * 60)
                print(f"🚀 PAPER TRADE EXECUTED - FUTURES ORDER")
                print("=" * 60)
                print(f"🎯 Symbol: {symbol} ({bitunix_symbol})")
                print(f"📊 Action: {side.upper()}")
                print(f"💰 Amount: ${amount:.2f} USDT")
                print(f"💲 Price: ${current_price:.4f}")
                print(f"⚡ Leverage: {leverage}x")
                print(f"🎰 Notional Value: ${amount * leverage:.2f} USDT")
                print(f"🆔 Order ID: {paper_result['data']['orderId']}")
                print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"🔄 Order Type: MARKET FUTURES")
                print("=" * 60)
                
                logger.info(f"📝 Paper futures: {side.upper()} ${amount:.2f} USDT of {symbol} @ {leverage}x leverage")
                return paper_result
            
            # Set leverage first for real trading
            await self.set_leverage(bitunix_symbol, leverage)
            
            order_data = {
                "symbol": bitunix_symbol,
                "side": OrderSide.BUY.value if side.lower() == "buy" else OrderSide.SELL.value,
                "type": OrderType.MARKET.value,
                "volume": str(amount),
                "price": "0"  # Market order
            }
            
            # Real futures trading
            url = f"{self.config.base_url}/api/v1/futures/order"
            headers = self._get_headers(json.dumps(order_data))
            
            response = self.session.post(url, headers=headers, json=order_data)
            result = response.json()
            
            if result.get('code') == '0':
                logger.info(f"✅ Futures order: {side.upper()} ${amount:.2f} USDT of {symbol} @ {leverage}x")
            else:
                logger.error(f"❌ Futures order failed: {result}")
                
            return result
            
        except Exception as e:
            logger.error(f"❌ Error placing futures order: {e}")
            return {'code': '1', 'msg': str(e)}
    
    async def set_leverage(self, symbol: str, leverage: int) -> Dict:
        """⚡ Set leverage for futures trading"""
        try:
            if self.paper_trading:
                return {'code': '0', 'msg': 'Paper trading - leverage set'}
            
            leverage_data = {
                "symbol": symbol,
                "leverage": leverage
            }
            
            url = f"{self.config.base_url}/api/v1/futures/leverage"
            headers = self._get_headers(json.dumps(leverage_data))
            
            response = self.session.post(url, headers=headers, json=leverage_data)
            return response.json()
            
        except Exception as e:
            logger.error(f"❌ Error setting leverage: {e}")
            return {'code': '1', 'msg': str(e)}
    
    def determine_trade_action(self, signal: Dict) -> TradeAction:
        """🧠 Determine trade action from signal"""
        signal_type = signal.get('type', '').lower()
        
        buy_signals = [
            'buy signal', 'buy', 'bullish', 'long', 'gold buy',
            'fast money buy', 'bullish entry', 'bullish divergence',
            'wt buy', 'rsi buy'
        ]
        
        sell_signals = [
            'sell signal', 'sell', 'bearish', 'short', 'gold sell',
            'fast money sell', 'bearish entry', 'bearish divergence',
            'wt sell', 'rsi sell'
        ]
        
        for pattern in buy_signals:
            if pattern in signal_type:
                return TradeAction.BUY
                
        for pattern in sell_signals:
            if pattern in signal_type:
                return TradeAction.SELL
                
        return TradeAction.HOLD
    
    async def validate_trade(self, signal: Dict, symbol: str) -> Tuple[bool, str]:
        """✅ Validate trade before execution"""
        try:
            # Reset daily counters if new day
            self._reset_daily_counters()
            
            # Check if trading is enabled
            if not self.trading_enabled:
                return False, "Trading disabled"
            
            # Check emergency stop
            if self.emergency_stop:
                return False, "Emergency stop active"
            
            # Check if symbol is supported
            bitunix_symbol = self.convert_symbol_format(symbol)
            if bitunix_symbol not in self.config.tradeable_pairs:
                return False, f"Symbol {symbol} not in tradeable pairs"
            
            # Check signal strength
            strength = signal.get('strength', 'Moderate')
            if strength not in ['Strong', 'Very Strong'] and self.config.min_signal_strength == 'Strong':
                return False, f"Signal strength too low: {strength}"
            
            # Check daily trade limit
            if self.daily_trades_count >= self.config.max_daily_trades:
                return False, f"Daily trade limit reached: {self.daily_trades_count}"
            
            # Check daily loss limit
            if self.daily_pnl < -self.daily_loss_limit:
                return False, f"Daily loss limit exceeded: ${self.daily_pnl:.2f}"
            
            # Check account balance
            if self.account_balance < self.config.min_trade_amount:
                return False, f"Insufficient balance: ${self.account_balance:.2f}"
            
            return True, "Trade validated"
            
        except Exception as e:
            logger.error(f"❌ Error validating trade: {e}")
            return False, f"Validation error: {e}"
    
    async def process_signal(self, signal: Dict, ticker: str, timeframe: str, trading_mode: str = "spot") -> Dict:
        """🎯 Process trading signal and execute trades"""
        try:
            print("\n" + "🎯" * 20)
            print(f"🎯 PROCESSING SIGNAL")
            print("🎯" * 20)
            print(f"📊 Signal Type: {signal.get('type', 'Unknown')}")
            print(f"🎯 Ticker: {ticker}")
            print(f"⏰ Timeframe: {timeframe}")
            print(f"💪 Strength: {signal.get('strength', 'Moderate')}")
            print(f"🏭 System: {signal.get('system', 'Unknown')}")
            print(f"🔄 Trading Mode: {trading_mode.upper()}")
            print("🎯" * 20)
            
            logger.info(f"🎯 Processing {trading_mode} signal: {signal.get('type')} for {ticker}")
            
            # Refresh account info
            await self.get_account_balance()
            
            # Validate trade
            is_valid, reason = await self.validate_trade(signal, ticker)
            if not is_valid:
                print(f"❌ TRADE REJECTED: {reason}")
                print("🎯" * 20 + "\n")
                logger.warning(f"⚠️ Trade validation failed: {reason}")
                return {'action': 'rejected', 'reason': reason}
            
            print("✅ Trade validation passed!")
            
            # Determine action
            action = self.determine_trade_action(signal)
            if action == TradeAction.HOLD:
                print("⏸️ HOLD SIGNAL - No action needed")
                print("🎯" * 20 + "\n")
                return {'action': 'hold', 'reason': 'No trade action needed'}
            
            print(f"🎯 Determined Action: {action.value.upper()}")
            
            # Get current price and calculate position size
            current_price = await self.get_ticker_price(ticker)
            if current_price <= 0:
                print(f"❌ Could not get price for {ticker}")
                print("🎯" * 20 + "\n")
                return {'action': 'failed', 'reason': 'Could not get current price'}
            
            print(f"💲 Current Price: ${current_price:.4f}")
            
            position_size_usdt = self.calculate_position_size(
                ticker, current_price, signal.get('strength', 'Moderate')
            )
            
            if position_size_usdt < self.config.min_trade_amount:
                print(f"❌ Position size too small: ${position_size_usdt:.2f} < ${self.config.min_trade_amount}")
                print("🎯" * 20 + "\n")
                return {'action': 'rejected', 'reason': 'Position size too small'}
            
            # Execute trade based on mode
            if trading_mode.lower() == "futures":
                result = await self.place_futures_order(
                    ticker, action.value, position_size_usdt
                )
            else:  # spot trading
                result = await self.place_spot_order(
                    ticker, action.value, position_size_usdt
                )
            
            # Update counters if successful
            if result.get('code') == '0':
                self.daily_trades_count += 1
                self.orders_today.append({
                    'symbol': ticker,
                    'action': action.value,
                    'amount': position_size_usdt,
                    'price': current_price,
                    'timestamp': datetime.now(),
                    'signal_type': signal.get('type'),
                    'trading_mode': trading_mode,
                    'result': result
                })
            
            logger.info(f"📊 Signal processing complete:")
            logger.info(f"   Action: {action.value.upper()}")
            logger.info(f"   Amount: ${position_size_usdt:.2f} USDT")
            logger.info(f"   Price: ${current_price:.4f}")
            logger.info(f"   Mode: {trading_mode.upper()}")
            logger.info(f"   Status: {result.get('code', 'Unknown')}")
            
            return {
                'action': action.value,
                'amount': position_size_usdt,
                'price': current_price,
                'trading_mode': trading_mode,
                'result': result,
                'signal': signal
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing signal: {e}")
            return {'action': 'error', 'reason': str(e)}
    
    async def get_portfolio_summary(self) -> Dict:
        """📊 Get comprehensive portfolio summary"""
        try:
            self._reset_daily_counters()
            balance_data = await self.get_account_balance()
            
            summary = {
                'authenticated': self.authenticated,
                'paper_trading': self.paper_trading,
                'trading_enabled': self.trading_enabled,
                'emergency_stop': self.emergency_stop,
                'account_balance': self.account_balance,
                'daily_trades': self.daily_trades_count,
                'max_daily_trades': self.config.max_daily_trades,
                'daily_pnl': self.daily_pnl,
                'daily_loss_limit': self.daily_loss_limit,
                'orders_today': len(self.orders_today),
                'last_reset_date': self.last_reset_date.isoformat(),
                'config': {
                    'max_position_size': self.config.max_position_size_usdt,
                    'default_leverage': self.config.default_leverage,
                    'min_trade_amount': self.config.min_trade_amount,
                    'min_signal_strength': self.config.min_signal_strength
                },
                'balance_data': balance_data
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"❌ Error getting portfolio summary: {e}")
            return {'error': str(e)}
    
    def enable_trading(self):
        """🟢 Enable trading"""
        self.trading_enabled = True
        logger.info("🟢 Bitunix trading ENABLED")
    
    def disable_trading(self):
        """🔴 Disable trading"""
        self.trading_enabled = False
        logger.info("🔴 Bitunix trading DISABLED")
    
    def enable_paper_trading(self):
        """📝 Enable paper trading"""
        self.paper_trading = True
        logger.info("📝 Paper trading mode ENABLED")
    
    def disable_paper_trading(self):
        """💰 Enable real trading"""
        self.paper_trading = False
        logger.info("💰 Real trading mode ENABLED")
    
    def set_emergency_stop(self, enabled: bool = True):
        """🚨 Emergency stop"""
        self.emergency_stop = enabled
        if enabled:
            logger.warning("🚨 EMERGENCY STOP ACTIVATED")
        else:
            logger.info("✅ Emergency stop deactivated")


# Test function
async def test_bitunix_trader():
    """🧪 Test Bitunix trader"""
    
    config = BitunixConfig(
        max_position_size_usdt=50.0,
        max_daily_trades=5
    )
    
    trader = BitunixTrader(config)
    trader.enable_paper_trading()
    trader.enable_trading()
    
    print("🔐 Testing authentication...")
    auth_success = await trader.authenticate()
    print(f"Authentication: {'✅ Success' if auth_success else '❌ Failed'}")
    
    # Test signal processing
    test_signal = {
        'type': 'WT Buy Signal',
        'strength': 'Strong',
        'system': 'Wave Trend'
    }
    
    print(f"🎯 Testing signal processing...")
    result = await trader.process_signal(test_signal, 'BTC-USD', '1d', 'spot')
    print(f"Result: {result}")
    
    # Get portfolio summary
    portfolio = await trader.get_portfolio_summary()
    print(f"📊 Portfolio: {portfolio}")

if __name__ == "__main__":
    asyncio.run(test_bitunix_trader()) 