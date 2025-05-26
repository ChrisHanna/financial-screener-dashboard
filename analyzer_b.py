import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import yfinance as yf
from datetime import datetime, timedelta

def fetch_stock_data(ticker, period='1y', interval='1d'):
    """Fetch stock data for the given ticker"""
    stock = yf.Ticker(ticker)
    df = stock.history(period=period, interval=interval)
    return df

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
    
    # Crosses
    # In Pine Script: wtCross = ta.cross(wt1, wt2)
    wt_cross = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    wt_cross_up = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    wt_cross_down = pd.Series(np.zeros(len(wt1)), index=wt1.index)
    
    for i in range(1, len(wt1)):
        # Cross condition
        if (wt1.iloc[i-1] < wt2.iloc[i-1] and wt1.iloc[i] > wt2.iloc[i]) or \
           (wt1.iloc[i-1] > wt2.iloc[i-1] and wt1.iloc[i] < wt2.iloc[i]):
            wt_cross.iloc[i] = 1
            
        # Cross up (wtCrossUp = ta.crossover(wt1, wt2))
        if wt1.iloc[i-1] < wt2.iloc[i-1] and wt1.iloc[i] > wt2.iloc[i]:
            wt_cross_up.iloc[i] = 1
        
        # Cross down (wtCrossDown = ta.crossunder(wt1, wt2))
        if wt1.iloc[i-1] > wt2.iloc[i-1] and wt1.iloc[i] < wt2.iloc[i]:
            wt_cross_down.iloc[i] = 1
    
    # Signals - exactly match Pine Script logic
    buy_signal = (wt_cross == 1) & (wt_cross_up == 1) & wt_oversold
    sell_signal = (wt_cross == 1) & (wt_cross_down == 1) & wt_overbought
    gold_buy = buy_signal & (wt2 <= osLevel3) & (mf > 0)
    
    return buy_signal, gold_buy, sell_signal, wt_cross

def analyzer_b(ticker, period='1y', interval='1d'):
    """Generate Analyzer B oscillator for a stock ticker"""
    # Fetch data
    df = fetch_stock_data(ticker, period, interval)
    
    # Calculate indicators - using Pine Script parameters
    wt1, wt2, wtVwap = calculate_wavetrend(df, 9, 12, 3)
    
    # Calculate Stochastic RSI based on Pine Script
    rsi = stoch_heikin_ashi(df, 40, 2)
    stoch_rsi = stoch_heikin_ashi(df, 81, 2)
    
    # Calculate Money Flow
    mf = calculate_money_flow(df, 5, 60)
    
    # Generate signals with Pine Script default parameters
    buy_signal, gold_buy, sell_signal, wt_cross = generate_signals(wt1, wt2, mf, 53, -53, -75)
    
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
    
    return df

def plot_analyzer_b(df, ticker):
    """Plot Analyzer B oscillator results to match Pine Script visualization"""
    # Create figure and axes
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(14, 12), gridspec_kw={'height_ratios': [1, 2, 1]})
    
    # Plot price chart
    ax1.plot(df.index, df['Close'], color='blue', label='Close Price')
    ax1.set_title(f"{ticker} Price Chart")
    ax1.grid(True)
    ax1.legend()
    
    # Plot WaveTrend with Pine Script colors and levels
    ax2.axhline(y=0, color='gray', linestyle='-', alpha=0.5, label='Zero Line')
    ax2.axhline(y=53, color='gray', linestyle='-', alpha=0.5, label='OB1')
    ax2.axhline(y=60, color='gray', linestyle='--', alpha=0.5, label='OB2')
    ax2.axhline(y=100, color='gray', linestyle=':', alpha=0.5, label='OB3')
    ax2.axhline(y=-53, color='gray', linestyle='-', alpha=0.5, label='OS1')
    ax2.axhline(y=-60, color='gray', linestyle='--', alpha=0.5, label='OS2')
    ax2.axhline(y=-75, color='gray', linestyle=':', alpha=0.5, label='OS3')
    
    # Use Pine Script colors
    ax2.plot(df.index, df['WT1'], color='white', alpha=0.7, linewidth=2, label='WT1')
    ax2.plot(df.index, df['WT2'], color='#2a2e39', alpha=0.96, linewidth=2, label='WT2')
    ax2.plot(df.index, df['WTVwap'], color='#ffe500', alpha=1, linewidth=2, label='VWAP')
    
    # Plot RSI and Stoch as in Pine
    ax2.plot(df.index, df['RSI'], color='#d900ff', linewidth=1, label='RSI')
    
    # Apply color to Stoch RSI based on comparison with RSI (matching Pine Script)
    for i in range(1, len(df)):
        if df['Stoch'].iloc[i] < df['RSI'].iloc[i]:
            ax2.plot(df.index[i-1:i+1], df['Stoch'].iloc[i-1:i+1], color='#22ff00', linewidth=1)
        else:
            ax2.plot(df.index[i-1:i+1], df['Stoch'].iloc[i-1:i+1], color='#ff0000', linewidth=1)
    
    # Plot Money Flow with Pine Script colors
    ax3.plot(df.index, df['MF'], color='green', label='Money Flow')
    ax3.fill_between(df.index, df['MF'], 0, where=(df['MF'] > 0), color='#3cff00', alpha=0.3)
    ax3.fill_between(df.index, df['MF'], 0, where=(df['MF'] < 0), color='#ff1100', alpha=0.3)
    ax3.set_title("Money Flow")
    ax3.grid(True)
    
    # Mark Buy/Sell signals on WT chart using Pine colors
    buy_points = df[df['Buy'] == True].index
    gold_buy_points = df[df['GoldBuy'] == True].index
    sell_points = df[df['Sell'] == True].index
    cross_points = df[df['WTCross'] == True].index
    
    # Plot signals using Pine Script colors
    for bp in buy_points:
        ax2.scatter(bp, -107, color='#3fff00', s=80, marker='o', label='_Buy')
        ax1.axvline(x=bp, color='#3fff00', linestyle='--', alpha=0.5)
    
    for gbp in gold_buy_points:
        ax2.scatter(gbp, -107, color='#e2a400', s=120, marker='o', label='_GoldBuy')
        ax1.axvline(x=gbp, color='#e2a400', linestyle='--', alpha=0.7)
    
    for sp in sell_points:
        ax2.scatter(sp, 107, color='#ff5252', s=80, marker='o', label='_Sell')
        ax1.axvline(x=sp, color='#ff5252', linestyle='--', alpha=0.5)
    
    # Plot cross points as in Pine
    for cp in cross_points:
        idx = df.index.get_loc(cp)
        if idx > 0:
            if df['WT2'].iloc[idx] - df['WT1'].iloc[idx] > 0:
                ax2.scatter(cp, df['WT2'].iloc[idx], color='#ff5252', s=50, marker='o')
            else:
                ax2.scatter(cp, df['WT2'].iloc[idx], color='#3fff00', s=50, marker='o')
    
    # Format dates on x-axis
    for ax in [ax1, ax2, ax3]:
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        ax.xaxis.set_major_locator(mdates.MonthLocator())
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)
    
    # Add legend for WT chart
    handles, labels = ax2.get_legend_handles_labels()
    unique_labels = [(h, l) for i, (h, l) in enumerate(zip(handles, labels)) if l not in labels[:i]]
    ax2.legend(*zip(*unique_labels))
    
    ax2.set_title("WaveTrend Oscillator")
    ax2.grid(True)
    
    plt.tight_layout()
    plt.show()

def main():
    ticker = input("Enter stock ticker symbol (e.g., AAPL): ")
    period = input("Enter period (default: 1y): ") or "1y"
    interval = input("Enter interval (default: 1d): ") or "1d"
    
    print(f"Fetching data for {ticker}...")
    df = analyzer_b(ticker, period, interval)
    
    print(f"Plotting Analyzer B oscillator for {ticker}...")
    plot_analyzer_b(df, ticker)
    
    # Print summary of recent signals
    recent = df.iloc[-10:]  # Last 10 periods
    buy_signals = recent['Buy'].sum()
    gold_buy_signals = recent['GoldBuy'].sum()
    sell_signals = recent['Sell'].sum()
    
    print(f"\nSignal summary for last 10 periods:")
    print(f"Buy signals: {buy_signals}")
    print(f"Gold Buy signals: {gold_buy_signals}")
    print(f"Sell signals: {sell_signals}")
    
    current_wt1 = df['WT1'].iloc[-1]
    current_wt2 = df['WT2'].iloc[-1]
    current_mf = df['MF'].iloc[-1]
    
    print(f"\nCurrent indicator values:")
    print(f"WT1: {current_wt1:.2f}")
    print(f"WT2: {current_wt2:.2f}")
    print(f"Money Flow: {current_mf:.2f}")
    
    if current_wt1 > current_wt2 and current_wt2 < -53:
        print("Current status: Potential buy zone")
    elif current_wt1 < current_wt2 and current_wt2 > 53:
        print("Current status: Potential sell zone")
    else:
        print("Current status: Neutral zone")

if __name__ == "__main__":
    main()