# 🚀 Bitunix Cryptocurrency Trading Service

**Advanced cryptocurrency trading integration for Discord Signal Bot**

Monitor your Discord bot signals and automatically execute trades on [Bitunix](https://bitunix.com) - a leading crypto derivatives exchange with 24/7 trading, no PDT rules, and up to 100x leverage.

## ✨ Features

- 🎯 **Signal Integration**: Automatically processes crypto signals from your Discord bot
- 🛡️ **Risk Management**: Built-in position sizing, daily limits, and loss protection
- 📝 **Paper Trading**: Test strategies safely before risking real money
- ⚡ **Real-time Execution**: 15-second signal monitoring with instant trade execution
- 💰 **Multiple Trading Modes**: Spot trading and futures trading support
- 📊 **Portfolio Tracking**: Real-time balance and performance monitoring
- 🔐 **Secure**: API-only trading, no password storage required

## 🎯 Supported Cryptocurrencies

- **Bitcoin (BTC)** - The original cryptocurrency
- **Ethereum (ETH)** - Smart contract platform
- **Cardano (ADA)** - Proof-of-stake blockchain
- **Dogecoin (DOGE)** - The people's cryptocurrency
- **Solana (SOL)** - High-performance blockchain
- **And many more...** (configurable in .env)

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy environment template
copy .env.template .env

# Edit .env with your settings (see Configuration section)
notepad .env
```

### 2. Get Bitunix API Credentials

1. Create account at [bitunix.com](https://bitunix.com)
2. Go to API Management in your account settings
3. Create new API key with trading permissions
4. Add credentials to your `.env` file

### 3. Start Trading Service

**Windows:**
```bash
start_trading.bat
```

**Python Direct:**
```bash
python start_trading.py
```

**First Run (Safe Mode):**
The service starts in paper trading mode by default - no real money at risk!

## ⚙️ Configuration

Edit your `.env` file with these settings:

### 🔌 Database Connection
```env
# Use the same database as your Discord bot
DATABASE_URL=postgresql://username:password@host:port/database
```

### 🔑 Bitunix API Credentials
```env
BITUNIX_API_KEY=your_api_key_here
BITUNIX_API_SECRET=your_api_secret_here
```

### 💰 Trading Configuration
```env
# Position sizing
MAX_POSITION_SIZE_USDT=100          # Maximum per trade
MAX_DAILY_TRADES=50                 # Trades per day limit
MIN_TRADE_AMOUNT=10                 # Minimum trade size

# Risk management
DAILY_LOSS_LIMIT=500               # Stop trading if daily loss exceeds
MAX_PORTFOLIO_RISK=0.02            # Max 2% of portfolio per trade
DEFAULT_LEVERAGE=1                 # Conservative leverage

# Signal processing
SIGNAL_CHECK_INTERVAL=15           # Check for new signals every 15 seconds
MAX_SIGNAL_AGE_MINUTES=60          # Ignore signals older than 1 hour
MIN_SIGNAL_STRENGTH=0.6            # Minimum confidence to trade
```

### 🛡️ Safety Settings
```env
# Trading modes (start with these for safety)
PAPER_TRADING=true                 # Simulate trades (no real money)
AUTO_TRADING=false                 # Require manual approval
SPOT_TRADING=true                  # Enable spot trading
FUTURES_TRADING=false              # Enable futures (higher risk)
```

### 📊 Supported Pairs
```env
TRADEABLE_PAIRS=BTC-USDT,ETH-USDT,ADA-USDT,DOGE-USDT,SOL-USDT
```

## 🛡️ Safety First

### Start with Paper Trading
```env
PAPER_TRADING=true      # Simulates trades with fake money
AUTO_TRADING=false      # Manual approval for each trade
```

### Graduate to Live Trading
```env
PAPER_TRADING=false     # Use real money
AUTO_TRADING=true       # Automatic execution
```

**⚠️ Never skip paper trading! Test thoroughly before using real money.**

## 📊 How It Works

1. **Signal Detection**: Your Discord bot detects trading signals in the database
2. **Signal Processing**: Trading engine picks up new crypto signals every 15 seconds
3. **Risk Validation**: Checks position limits, daily trades, account balance
4. **Trade Execution**: Places orders on Bitunix (spot or futures)
5. **Result Tracking**: Logs all trades and performance metrics

## 📈 Trading Flow

```
Discord Bot Signal → Database → Trading Engine → Bitunix Exchange
     ↓                ↓              ↓              ↓
  Detection       Storage      Processing      Execution
```

## 🔧 Architecture

```
bitunix-trading-service/
├── bitunix_trader.py       # Core trading logic and API integration
├── trading_engine.py       # Main engine that monitors signals
├── database_utils.py       # Database connectivity and queries
├── start_trading.py        # Startup script with health checks
├── requirements.txt        # Python dependencies
├── .env.template          # Configuration template
└── README.md              # This file
```

## 📊 Monitoring & Logs

The service provides real-time monitoring:

- **Signal Processing**: Shows new signals detected and processed
- **Trade Execution**: Logs all buy/sell orders with timestamps
- **Risk Management**: Alerts when limits are hit
- **Performance**: Track daily P&L and win rate
- **Health Checks**: Database and API connectivity status

## 🚨 Error Handling

The service handles common issues gracefully:

- **API Failures**: Retries with exponential backoff
- **Network Issues**: Queues trades until connectivity restored
- **Invalid Signals**: Logs and skips problematic data
- **Risk Violations**: Blocks dangerous trades automatically
- **Database Errors**: Maintains operation with local caching

## 🔍 Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check environment file
cat .env

# Test database connection
python -c "from database_utils import test_database_connection; import asyncio; asyncio.run(test_database_connection())"

# Verify API credentials
python -c "from bitunix_trader import test_bitunix_trader; import asyncio; asyncio.run(test_bitunix_trader())"
```

**No trades executing:**
- Check `AUTO_TRADING=true` in .env
- Verify signal strength meets `MIN_SIGNAL_STRENGTH`
- Ensure crypto pairs are in `TRADEABLE_PAIRS`
- Check daily trade limits haven't been hit

**API errors:**
- Verify Bitunix API credentials
- Check account has sufficient balance
- Ensure API key has trading permissions

### Debug Mode

Enable verbose logging:
```env
LOG_LEVEL=DEBUG
```

## ⚡ Performance

- **Signal Processing**: ~50ms per signal
- **Database Queries**: Optimized for sub-second response
- **Trade Execution**: 1-3 seconds via Bitunix API
- **Memory Usage**: ~50MB typical operation
- **CPU Usage**: <5% on modern systems

## 🔐 Security

- **API Keys**: Stored in environment variables only
- **No Password Storage**: Uses API authentication exclusively
- **Local Database**: All sensitive data stays in your database
- **Encrypted Communications**: HTTPS/TLS for all API calls
- **Trade Limits**: Built-in position and loss limits

## 💡 Tips for Success

1. **Start Small**: Begin with small position sizes
2. **Paper Trade First**: Test all strategies thoroughly
3. **Monitor Closely**: Watch initial trades carefully
4. **Risk Management**: Never risk more than you can afford to lose
5. **Diversify**: Don't put all capital in one signal
6. **Stay Updated**: Keep the service and dependencies updated

## 📞 Support

- **Issues**: Check logs in the terminal output
- **Configuration**: Review the .env.template file
- **Trading**: Refer to Bitunix documentation
- **Development**: See individual Python files for technical details

## ⚖️ Disclaimer

**This software is for educational and informational purposes only. Cryptocurrency trading involves substantial risk of loss. Never trade with money you cannot afford to lose. The authors are not responsible for any financial losses.**

---

**🚀 Ready to start? Run `start_trading.bat` and begin your automated crypto trading journey!** 