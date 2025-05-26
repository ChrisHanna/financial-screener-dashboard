"""
Example usage of Progressive Soft Actor-Critic (SAC) for financial trading

This script demonstrates how to use the Progressive SAC implementation
with the Screener project's regime detection for financial trading.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import os
import logging
import time
import torch

from progressive_sac import ProgressiveSAC
from progressive_sac_utils import (
    detect_market_regime,
    prepare_state_from_indicators,
    calculate_reward,
    train_progressive_sac,
    evaluate_agent,
    plot_training_results
)

logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Main function to demonstrate Progressive SAC usage"""
    os.makedirs("models", exist_ok=True)
    os.makedirs("results", exist_ok=True)
    
    from api import analyzer_b
    
    ticker = 'AAPL'
    period = '1y'
    interval = '1d'
    
    logger.info(f"Fetching data for {ticker} with period={period}, interval={interval}")
    df = analyzer_b(ticker, period, interval)
    
    if df is None or df.empty:
        logger.error(f"Failed to fetch data for {ticker}")
        return
    
    logger.info(f"Successfully fetched data with shape {df.shape}")
    
    required_cols = ['Close', 'Open', 'High', 'Low', 'Volume', 'WT1', 'WT2', 'RSI',
                    'BayesianPriceRegime', 'BayesianWTRegime', 'CUSUMPriceRegime', 'CUSUMWTRegime',
                    'HMMPriceRegime', 'HMMWTRegime', 'SlidingPriceRegime', 'SlidingWTRegime',
                    'CombinedPriceRegime', 'CombinedWTRegime']
    
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        logger.warning(f"Missing columns in data: {missing_cols}")
        for col in missing_cols:
            df[col] = 0
    
    df['Returns'] = df['Close'].pct_change().fillna(0)
    df['Volatility'] = df['Returns'].rolling(window=20).std().fillna(0)
    
    lookback = 10
    feature_cols = ['Close', 'Volume', 'WT1', 'WT2', 'RSI', 'Volatility',
                   'BayesianPriceRegime', 'BayesianWTRegime',
                   'CombinedPriceRegime', 'CombinedWTRegime']
    
    sample_state = prepare_state_from_indicators(df, lookback, lookback)
    state_dim = len(sample_state)
    logger.info(f"Using state_dim={state_dim} based on actual data")
    
    action_dim = 1  # Position size (-1 to 1)
    
    agent = ProgressiveSAC(
        state_dim=state_dim,
        action_dim=action_dim,
        hidden_dims=[256, 256],
        buffer_size=100000,
        batch_size=64,
        gamma=0.99,
        tau=0.005,
        lr=3e-4,
        alpha=0.2,
        auto_entropy_tuning=True
    )
    
    def simple_training_example(agent, df, num_episodes=5):
        """Simple training example for demonstration purposes"""
        logger.info("Starting simple training example...")
        
        for episode in range(num_episodes):
            total_reward = 0
            position = 0
            
            start_idx = np.random.randint(lookback, len(df) // 2)
            
            for step in range(100):  # Run for 100 steps or until end of data
                idx = min(start_idx + step, len(df) - 1)
                if idx >= len(df) - 1:
                    break
                
                regime = detect_market_regime(df.iloc[:idx])
                
                state = prepare_state_from_indicators(df[feature_cols], idx, lookback)
                
                action = agent.select_action(state, regime=regime)
                position = action[0] if isinstance(action, np.ndarray) else action
                
                reward = calculate_reward(df, idx, position, 
                                         prev_position=position if step > 0 else 0)
                
                next_idx = min(idx + 1, len(df) - 1)
                next_state = prepare_state_from_indicators(df[feature_cols], next_idx, lookback)
                
                done = (next_idx == len(df) - 1)
                agent.replay_buffer.push(state, action, reward, next_state, done, regime)
                
                if len(agent.replay_buffer) > 1000 and step % 10 == 0:
                    agent.update_parameters(regime=regime)
                
                total_reward += reward
                
                if done:
                    break
            
            logger.info(f"Episode {episode+1}/{num_episodes}, Total Reward: {total_reward:.4f}")
    
    simple_training_example(agent, df)
    
    logger.info("Starting full training with curriculum learning...")
    
    trained_agent = train_progressive_sac(
        env_data=df,
        state_dim=state_dim,
        action_dim=action_dim,
        episodes=10,  # Use a small number for demonstration
        max_steps=100,
        save_path='models/progressive_sac_demo',
        eval_interval=5,
        curriculum_eval_metric='sharpe_ratio'
    )
    
    sharpe_ratio = evaluate_agent(trained_agent, df, metric='sharpe_ratio')
    total_return = evaluate_agent(trained_agent, df, metric='return')
    max_drawdown = evaluate_agent(trained_agent, df, metric='max_drawdown')
    
    logger.info(f"Evaluation Results:")
    logger.info(f"Sharpe Ratio: {sharpe_ratio:.4f}")
    logger.info(f"Total Return: {total_return:.4f}")
    logger.info(f"Max Drawdown: {max_drawdown:.4f}")
    
    trained_agent.save('models/progressive_sac_final.pt')
    
    logger.info("Progressive SAC example completed successfully")

if __name__ == "__main__":
    main()
