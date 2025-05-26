"""
Utility functions for Progressive Soft Actor-Critic (SAC) implementation

This module provides training, evaluation, and integration utilities for the
Progressive SAC reinforcement learning system, specifically designed for
financial trading applications with regime awareness.
"""

import numpy as np
import pandas as pd
import torch
import matplotlib.pyplot as plt
import os
import logging
import time
from progressive_sac import ProgressiveSAC

logger = logging.getLogger(__name__)

def detect_market_regime(data, method='combined'):
    """
    Detect the current market regime from financial data
    
    Args:
        data: DataFrame with financial data (must include regime detection columns)
        method: Which regime detection method to use ('bayesian', 'cusum', 'hmm', 'sliding', 'combined')
        
    Returns:
        Integer representing the detected regime
    """
    if method not in ['bayesian', 'cusum', 'hmm', 'sliding', 'combined']:
        raise ValueError(f"Unknown regime detection method: {method}")
    
    price_col = f"{method.capitalize()}PriceRegime"
    wt_col = f"{method.capitalize()}WTRegime"
    
    if price_col not in data.columns or wt_col not in data.columns:
        logger.warning(f"Regime detection columns not found: {price_col}, {wt_col}")
        return 0  # Default regime
    
    window_size = max(int(len(data) * 0.2), 5)
    recent_data = data.iloc[-window_size:]
    
    price_changes = recent_data[price_col].sum()
    wt_changes = recent_data[wt_col].sum()
    
    if price_changes >= 2 and wt_changes >= 2:
        return 3  # Highly volatile regime
    elif price_changes >= 1 or wt_changes >= 1:
        return 2  # Moderately volatile regime
    else:
        return 1  # Stable regime

def prepare_state_from_indicators(data, idx, lookback=10, normalize=True):
    """
    Prepare state representation from financial indicators
    
    Args:
        data: DataFrame with financial indicators
        idx: Current index in the DataFrame
        lookback: Number of past time steps to include in the state
        normalize: Whether to normalize the state features
        
    Returns:
        Numpy array representing the state
    """
    numeric_cols = data.select_dtypes(include=['number']).columns
    if len(numeric_cols) == 0:
        raise ValueError("No numeric columns found in data")
    
    numeric_data = data[numeric_cols]
    
    if idx < lookback:
        padding = np.zeros((lookback - idx, len(numeric_data.columns)), dtype=np.float32)
        history = numeric_data.iloc[:idx].values.astype(np.float32)
        combined = np.vstack([padding, history])
    else:
        combined = numeric_data.iloc[idx-lookback:idx].values.astype(np.float32)
    
    state = combined.flatten()
    
    if normalize:
        state_mean = np.mean(state)
        state_std = np.std(state) + 1e-8  # Avoid division by zero
        state = (state - state_mean) / state_std
    
    return state.astype(np.float32)  # Ensure float32 type for PyTorch compatibility

def calculate_reward(data, idx, action, prev_position=0, risk_aversion=0.5):
    """
    Calculate reward for a trading action
    
    Args:
        data: DataFrame with financial data
        idx: Current index in the DataFrame
        action: Action taken by the agent (-1 to 1, representing position size)
        prev_position: Previous position size
        risk_aversion: Risk aversion coefficient (higher = more risk-averse)
        
    Returns:
        Reward value
    """
    if idx >= len(data) - 1:
        return 0.0  # No reward at the end of the data
    
    current_price = data.iloc[idx]['Close']
    next_price = data.iloc[idx+1]['Close']
    price_return = (next_price - current_price) / current_price
    
    position_change = abs(action - prev_position)
    transaction_cost = position_change * 0.001  # 0.1% transaction cost
    
    return_reward = action * price_return  # Directional return
    risk_penalty = risk_aversion * abs(action) * data.iloc[idx].get('Volatility', 0.01)  # Risk penalty
    
    reward = return_reward - transaction_cost - risk_penalty
    
    return reward

def train_progressive_sac(env_data, 
                          state_dim, 
                          action_dim=1, 
                          episodes=1000, 
                          max_steps=None,
                          save_path='models/progressive_sac',
                          eval_interval=10,
                          curriculum_eval_metric='sharpe_ratio',
                          lookback=10):
    """
    Train a Progressive SAC agent on financial data
    
    Args:
        env_data: DataFrame with financial data and indicators
        state_dim: Dimension of the state space
        action_dim: Dimension of the action space
        episodes: Number of training episodes
        max_steps: Maximum steps per episode (defaults to length of data)
        save_path: Path to save model checkpoints
        eval_interval: Interval for evaluation and curriculum updates
        curriculum_eval_metric: Metric to use for curriculum progression
        lookback: Number of past time steps to include in the state
        
    Returns:
        Trained ProgressiveSAC agent
    """
    if max_steps is None:
        max_steps = len(env_data)
    
    agent = ProgressiveSAC(state_dim=state_dim, action_dim=action_dim)
    
    episode_rewards = []
    curriculum_metrics = []
    
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    for episode in range(1, episodes + 1):
        total_reward = 0
        position = 0
        
        if agent.curriculum_stage == 1:
            valid_indices = [i for i in range(lookback, len(env_data)-1) 
                            if detect_market_regime(env_data.iloc[:i]) == 1]
            start_idx = np.random.choice(valid_indices) if valid_indices else lookback
        elif agent.curriculum_stage == 2:
            valid_indices = [i for i in range(lookback, len(env_data)-1) 
                            if detect_market_regime(env_data.iloc[:i]) <= 2]
            start_idx = np.random.choice(valid_indices) if valid_indices else lookback
        else:
            start_idx = np.random.randint(lookback, len(env_data) - 1)
        
        for step in range(max_steps):
            idx = min(start_idx + step, len(env_data) - 1)
            if idx >= len(env_data) - 1:
                break
                
            regime = detect_market_regime(env_data.iloc[:idx])
            
            state = prepare_state_from_indicators(env_data, idx)
            
            action = agent.select_action(state, regime=regime)
            position = action[0] if isinstance(action, np.ndarray) else action
            
            reward = calculate_reward(env_data, idx, position, 
                                     prev_position=position if step > 0 else 0)
            
            next_idx = min(idx + 1, len(env_data) - 1)
            next_state = prepare_state_from_indicators(env_data, next_idx)
            
            done = (next_idx == len(env_data) - 1)
            agent.replay_buffer.push(state, action, reward, next_state, done, regime)
            
            if agent.total_steps > agent.update_after and agent.total_steps % agent.update_every == 0:
                for _ in range(agent.num_updates):
                    agent.update_parameters(regime=regime)
            
            agent.total_steps += 1
            total_reward += reward
            
            if done:
                break
        
        episode_rewards.append(total_reward)
        agent.episodes += 1
        
        if episode % 10 == 0:
            avg_reward = np.mean(episode_rewards[-10:])
            logger.info(f"Episode {episode}/{episodes}, Avg Reward: {avg_reward:.4f}, "
                       f"Curriculum Stage: {agent.curriculum_stage}")
        
        if episode % eval_interval == 0:
            eval_metric = evaluate_agent(agent, env_data, metric=curriculum_eval_metric)
            curriculum_metrics.append(eval_metric)
            
            advanced = agent.increase_curriculum_stage(eval_metric)
            if advanced:
                logger.info(f"Advanced to curriculum stage {agent.curriculum_stage}")
            
            agent.save(f"{save_path}_episode_{episode}.pt")
    
    agent.save(f"{save_path}_final.pt")
    
    return agent

def evaluate_agent(agent, eval_data, metric='sharpe_ratio', episodes=5, lookback=10):
    """
    Evaluate a trained agent on financial data
    
    Args:
        agent: Trained ProgressiveSAC agent
        eval_data: DataFrame with financial data for evaluation
        metric: Evaluation metric ('sharpe_ratio', 'sortino_ratio', 'max_drawdown', 'return')
        episodes: Number of evaluation episodes
        lookback: Number of past time steps included in the state
        
    Returns:
        Evaluation metric value
    """
    all_returns = []
    all_positions = []
    
    # Set the policy network to evaluation mode
    agent.policy.eval()
    
    try:
        for episode in range(episodes):
            start_idx = np.random.randint(lookback, len(eval_data) - 100)
            
            episode_returns = []
            episode_positions = []
            
            for step in range(100):  # Evaluate on 100-step episodes
                idx = min(start_idx + step, len(eval_data) - 1)
                if idx >= len(eval_data) - 1:
                    break
                    
                regime = detect_market_regime(eval_data.iloc[:idx])
                
                state = prepare_state_from_indicators(eval_data, idx)
                
                action = agent.select_action(state, evaluate=True, regime=regime)
                position = action[0] if isinstance(action, np.ndarray) else action
                
                current_price = eval_data.iloc[idx]['Close']
                next_price = eval_data.iloc[idx+1]['Close']
                price_return = (next_price - current_price) / current_price
                position_return = position * price_return
                
                episode_returns.append(position_return)
                episode_positions.append(position)
            
            all_returns.extend(episode_returns)
            all_positions.extend(episode_positions)
    finally:
        # Ensure the policy network is set back to training mode
        agent.policy.train()
        
    returns = np.array(all_returns)
    
    if metric == 'return':
        return np.sum(returns)
    elif metric == 'sharpe_ratio':
        return np.mean(returns) / (np.std(returns) + 1e-8) * np.sqrt(252)  # Annualized
    elif metric == 'sortino_ratio':
        downside_returns = returns[returns < 0]
        downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 1e-8
        return np.mean(returns) / downside_std * np.sqrt(252)  # Annualized
    elif metric == 'max_drawdown':
        cumulative_returns = np.cumsum(returns)
        max_drawdown = 0
        peak = cumulative_returns[0]
        for ret in cumulative_returns:
            if ret > peak:
                peak = ret
            drawdown = (peak - ret) / (peak + 1e-8)
            max_drawdown = max(max_drawdown, drawdown)
        return -max_drawdown  # Negative so higher is better
    else:
        raise ValueError(f"Unknown evaluation metric: {metric}")

def plot_training_results(agent, episode_rewards, curriculum_metrics, save_path=None):
    """
    Plot training results
    
    Args:
        agent: Trained ProgressiveSAC agent
        episode_rewards: List of episode rewards
        curriculum_metrics: List of curriculum evaluation metrics
        save_path: Path to save the plot
    """
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 15))
    
    ax1.plot(episode_rewards)
    ax1.set_title('Episode Rewards')
    ax1.set_xlabel('Episode')
    ax1.set_ylabel('Total Reward')
    ax1.grid(True)
    
    eval_episodes = np.arange(0, len(episode_rewards), len(episode_rewards) // len(curriculum_metrics))
    ax2.plot(eval_episodes[:len(curriculum_metrics)], curriculum_metrics)
    ax2.set_title('Curriculum Evaluation Metrics')
    ax2.set_xlabel('Episode')
    ax2.set_ylabel('Evaluation Metric')
    ax2.grid(True)
    
    regimes = list(agent.regime_transitions.keys())
    counts = list(agent.regime_transitions.values())
    ax3.bar(range(len(regimes)), counts)
    ax3.set_title('Regime Transitions')
    ax3.set_xlabel('Regime Transition')
    ax3.set_ylabel('Count')
    ax3.set_xticks(range(len(regimes)))
    ax3.set_xticklabels([f"{r[0]}->{r[1]}" for r in regimes], rotation=45)
    ax3.grid(True)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path)
    
    plt.show()

if __name__ == "__main__":
    
    import sys
    sys.path.append('.')  # Add current directory to path
    
    logging.basicConfig(level=logging.INFO, 
                        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    from api import analyzer_b
    
    ticker = 'AAPL'
    period = '1y'
    interval = '1d'
    
    data = analyzer_b(ticker, period, interval)
    
    lookback = 10
    feature_cols = ['Close', 'Volume', 'WT1', 'WT2', 'RSI', 
                   'BayesianPriceRegime', 'BayesianWTRegime',
                   'CombinedPriceRegime', 'CombinedWTRegime']
    
    state_dim = len(feature_cols) * lookback
    action_dim = 1  # Position size (-1 to 1)
    
    agent = train_progressive_sac(
        env_data=data,
        state_dim=state_dim,
        action_dim=action_dim,
        episodes=500,
        save_path='models/progressive_sac_aapl'
    )
    
    eval_metric = evaluate_agent(agent, data)
    print(f"Final evaluation metric: {eval_metric:.4f}")
