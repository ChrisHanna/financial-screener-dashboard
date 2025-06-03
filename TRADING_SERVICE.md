# 🚀 Bitunix Trading Service

The Bitunix trading service has been moved to its own separate repository for better modularity and maintainability.

## 📍 **New Repository Location:**

The trading service is now available as a standalone microservice at:

```
./bitunix-trading-service/
```

**Note**: This is now a separate git repository with its own version control.

## 🔧 **Setup Instructions:**

1. **Navigate to the trading service:**
   ```bash
   cd bitunix-trading-service
   ```

2. **Check the status of the separate repo:**
   ```bash
   git status
   ```

3. **Follow the README in that directory:**
   ```bash
   cat README.md
   ```

## ✨ **Benefits of Separation:**

- **Modular Architecture**: Independent development and deployment
- **Separate Versioning**: Trading service has its own release cycle
- **Reusability**: Can be used with other projects
- **Better Organization**: Cleaner separation of concerns
- **Independent Testing**: Isolated test suites and CI/CD

## 🔗 **Integration with Discord Bot:**

The Discord bot and trading service communicate through:

- **Signal Database**: Shared database for signal communication
- **Configuration**: Environment variables for coordination
- **API Endpoints**: RESTful communication when needed

## 🚀 **Quick Start:**

```bash
# Navigate to trading service
cd bitunix-trading-service

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Test the service
python test_api_connection.py

# Start trading
python bitunix_trader.py
```

## 📝 **Development Workflow:**

When making changes that affect both repositories:

1. **Update Discord Bot** (this repo)
2. **Update Trading Service** (separate repo)
3. **Test Integration** between both services
4. **Deploy Both** with coordinated releases

## 🔄 **Version Compatibility:**

- **Discord Bot**: v2.x.x
- **Trading Service**: v1.3.0+

Ensure compatible versions are deployed together.

---

**For detailed trading service documentation, see `bitunix-trading-service/README.md`** 