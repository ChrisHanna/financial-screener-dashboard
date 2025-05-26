"""
Progressive Soft Actor-Critic (SAC) Implementation for Financial Trading

This module implements a robust Progressive SAC reinforcement learning system
that leverages technical indicators and regime detection for optimal trading decisions.
The implementation focuses on adaptability to different market regimes and
progressive learning capabilities.
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.distributions import Normal
import logging
import os
from collections import deque, namedtuple
import random
import copy
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

Transition = namedtuple('Transition', 
                        ('state', 'action', 'reward', 'next_state', 'done', 'regime'))

class PrioritizedReplayBuffer:
    """
    Prioritized Experience Replay Buffer with regime-aware sampling
    """
    def __init__(self, capacity, alpha=0.6, beta_start=0.4, beta_frames=100000):
        self.capacity = capacity
        self.buffer = []
        self.position = 0
        self.priorities = np.zeros((capacity,), dtype=np.float32)
        self.alpha = alpha
        self.beta_start = beta_start
        self.beta_frames = beta_frames
        self.frame = 1
        
        self.regime_indices = {}
        
    def push(self, state, action, reward, next_state, done, regime):
        """Store a transition with maximum priority"""
        max_prio = self.priorities.max() if self.buffer else 1.0
        
        if len(self.buffer) < self.capacity:
            self.buffer.append(None)
        
        self.buffer[self.position] = Transition(state, action, reward, next_state, done, regime)
        self.priorities[self.position] = max_prio
        
        if regime not in self.regime_indices:
            self.regime_indices[regime] = []
        
        self.regime_indices[regime].append(self.position)
        
        for r in self.regime_indices:
            if r != regime and self.position in self.regime_indices[r]:
                self.regime_indices[r].remove(self.position)
        
        self.position = (self.position + 1) % self.capacity
    
    def sample(self, batch_size, regime=None):
        """Sample a batch of transitions with importance sampling weights"""
        if len(self.buffer) == self.capacity:
            prios = self.priorities
        else:
            prios = self.priorities[:self.position]
            
        if regime is not None and regime in self.regime_indices and len(self.regime_indices[regime]) > 0:
            regime_size = min(batch_size // 2, len(self.regime_indices[regime]))
            general_size = batch_size - regime_size
            
            regime_indices = np.array(self.regime_indices[regime])
            regime_probs = prios[regime_indices] ** self.alpha
            regime_probs /= regime_probs.sum()
            regime_idx = np.random.choice(regime_indices, regime_size, p=regime_probs)
            
            general_probs = prios ** self.alpha
            general_probs /= general_probs.sum()
            general_idx = np.random.choice(len(self.buffer), general_size, p=general_probs)
            
            indices = np.concatenate([regime_idx, general_idx])
        else:
            probs = prios ** self.alpha
            probs /= probs.sum()
            indices = np.random.choice(len(self.buffer), batch_size, p=probs)
        
        beta = self.beta_start + (1.0 - self.beta_start) * (self.frame / self.beta_frames)
        self.frame = min(self.frame + 1, self.beta_frames)
        
        weights = (len(self.buffer) * probs[indices]) ** (-beta)
        weights /= weights.max()
        
        batch = [self.buffer[idx] for idx in indices]
        states, actions, rewards, next_states, dones, regimes = zip(*batch)
        
        return (
            torch.FloatTensor(np.array(states)).to(device),
            torch.FloatTensor(np.array(actions)).to(device),
            torch.FloatTensor(np.array(rewards)).to(device),
            torch.FloatTensor(np.array(next_states)).to(device),
            torch.FloatTensor(np.array(dones)).to(device),
            indices,
            torch.FloatTensor(weights).to(device),
            regimes
        )
    
    def update_priorities(self, indices, priorities):
        """Update priorities of sampled transitions"""
        for idx, priority in zip(indices, priorities):
            self.priorities[idx] = priority
    
    def __len__(self):
        return len(self.buffer)


class ProgressiveNetwork(nn.Module):
    """
    Base class for progressive networks that can increase complexity over time
    """
    def __init__(self, input_dim, output_dim, hidden_dims=[256, 256], 
                 activation=F.relu, stage=1, max_stages=3):
        super(ProgressiveNetwork, self).__init__()
        self.input_dim = input_dim
        self.output_dim = output_dim
        self.activation = activation
        self.stage = stage
        self.max_stages = max_stages
        
        self.networks = nn.ModuleList()
        
        stage1_layers = []
        stage1_layers.append(nn.Linear(input_dim, hidden_dims[0]))
        stage1_layers.append(nn.Linear(hidden_dims[0], output_dim))
        self.networks.append(nn.ModuleList(stage1_layers))
        
        if max_stages >= 2:
            stage2_layers = []
            stage2_layers.append(nn.Linear(input_dim, hidden_dims[0]))
            stage2_layers.append(nn.Linear(hidden_dims[0], hidden_dims[0]))
            stage2_layers.append(nn.Linear(hidden_dims[0], output_dim))
            self.networks.append(nn.ModuleList(stage2_layers))
        
        if max_stages >= 3:
            stage3_layers = []
            stage3_layers.append(nn.Linear(input_dim, hidden_dims[0]))
            stage3_layers.append(nn.Linear(hidden_dims[0], hidden_dims[1]))
            stage3_layers.append(nn.Linear(hidden_dims[1], hidden_dims[0]))
            stage3_layers.append(nn.Linear(hidden_dims[0], output_dim))
            self.networks.append(nn.ModuleList(stage3_layers))
    
    def forward(self, x):
        """Forward pass using the current stage network"""
        network = self.networks[self.stage - 1]
        
        for i, layer in enumerate(network):
            if i == len(network) - 1:  # Last layer
                x = layer(x)
            else:
                x = self.activation(layer(x))
                
        return x
    
    def increase_complexity(self):
        """Move to the next stage of complexity if available"""
        if self.stage < self.max_stages:
            prev_weights = copy.deepcopy(self.state_dict())
            
            self.stage += 1
            logger.info(f"Increasing network complexity to stage {self.stage}")
            
            return prev_weights
        else:
            logger.info("Already at maximum complexity stage")
            return None


class ProgressivePolicyNetwork(ProgressiveNetwork):
    """
    Progressive policy network with adaptive entropy regularization
    """
    def __init__(self, state_dim, action_dim, hidden_dims=[256, 256], 
                 activation=F.relu, stage=1, max_stages=3, log_std_min=-20, log_std_max=2):
        super(ProgressivePolicyNetwork, self).__init__(
            state_dim, action_dim * 2, hidden_dims, activation, stage, max_stages)
        
        self.action_dim = action_dim
        self.log_std_min = log_std_min
        self.log_std_max = log_std_max
        
        self.target_entropy = -action_dim  # Heuristic from SAC paper
        self.log_alpha = torch.zeros(1, requires_grad=True, device=device)
        self.alpha_optimizer = optim.Adam([self.log_alpha], lr=3e-4)
        
        self.regime_log_alphas = {}
        self.regime_optimizers = {}
        
        # Initialize weights with Xavier/Glorot initialization
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight, gain=0.1)  # Reduced gain for stability
                nn.init.constant_(m.bias, 0.0)
        
        # Add layer normalization for stability
        self.layer_norm = nn.LayerNorm(state_dim)
        
        # Add dropout for regularization
        self.dropout = nn.Dropout(p=0.1)
        
        # Add regime-specific batch normalization
        self.regime_bn = nn.ModuleDict()
        for regime in [1, 2, 3]:  # Assuming 3 possible regimes
            self.regime_bn[str(regime)] = nn.BatchNorm1d(state_dim, track_running_stats=True)
        
        # Track last regime for smooth transitions
        self.last_regime = None
        self.regime_transition_buffer = []
        self.max_transition_buffer = 10
        
        # Track evaluation mode
        self.eval_mode = False
    
    def forward(self, state, regime=None):
        """Forward pass returning mean and log_std for the policy"""
        # Normalize input state
        state = self.layer_norm(state)
        
        # Apply regime-specific batch normalization if regime is provided
        if regime is not None:
            regime_key = str(regime)
            if regime_key in self.regime_bn:
                # Batch norm layers automatically handle training/eval mode
                # based on self.training attribute set by .train()/.eval()
                state = self.regime_bn[regime_key](state)
            
            # Handle regime transitions smoothly
            if self.last_regime is not None and self.last_regime != regime:
                self.regime_transition_buffer.append((self.last_regime, regime))
                if len(self.regime_transition_buffer) > self.max_transition_buffer:
                    self.regime_transition_buffer.pop(0)
                
                # If we're seeing rapid regime transitions, add more stability
                if len(self.regime_transition_buffer) >= 3:
                    recent_transitions = self.regime_transition_buffer[-3:]
                    if all(t[0] != t[1] for t in recent_transitions):  # All transitions are different
                        state = state * 0.9  # Reduce magnitude during rapid transitions
            
            self.last_regime = regime
        
        # Apply dropout
        state = self.dropout(state)
        
        x = super(ProgressivePolicyNetwork, self).forward(state)
        
        # Split into mean and log_std
        mean, log_std = torch.chunk(x, 2, dim=-1)
        
        # Clamp log_std to prevent numerical instability
        log_std = torch.clamp(log_std, self.log_std_min, self.log_std_max)
        
        # Add small noise to prevent deterministic outputs
        mean = mean + torch.randn_like(mean) * 0.01
        
        # Additional stability measures
        mean = torch.clamp(mean, -10.0, 10.0)
        log_std = torch.clamp(log_std, -20.0, 2.0)
        
        return mean, log_std
    
    def sample(self, state, regime=None):
        """Sample an action from the policy distribution"""
        mean, log_std = self.forward(state, regime)
        
        # Additional clamping for numerical stability
        mean = torch.clamp(mean, -10.0, 10.0)
        log_std = torch.clamp(log_std, -20.0, 2.0)
        
        # Compute std with numerical stability
        std = torch.exp(log_std)
        
        # Check for NaN values and handle them gracefully
        if torch.isnan(mean).any() or torch.isnan(std).any():
            logger.warning("NaN values detected in policy network outputs. Using fallback values.")
            mean = torch.zeros_like(mean)
            std = torch.ones_like(std)
        
        # Sample from normal distribution with reparameterization trick
        normal = Normal(mean, std)
        x_t = normal.rsample()
        
        # Apply tanh squashing with numerical stability
        action = torch.tanh(x_t)
        
        # Compute log probability with numerical stability
        log_prob = normal.log_prob(x_t)
        log_prob -= torch.log(1 - action.pow(2) + 1e-6)
        log_prob = log_prob.sum(-1, keepdim=True)
        
        # Additional stability check
        if torch.isnan(log_prob).any():
            logger.warning("NaN values in log probability. Using fallback values.")
            log_prob = torch.zeros_like(log_prob)
        
        return action, log_prob, mean
    
    def eval(self):
        """Set the network to evaluation mode"""
        self.eval_mode = True
        super().eval()
        return self
    
    def train(self, mode=True):
        """Set the network to training mode"""
        self.eval_mode = not mode
        super().train(mode)
        return self
    
    def get_alpha(self, regime=None):
        """Get the entropy coefficient (alpha), potentially regime-specific"""
        if regime is not None and regime in self.regime_log_alphas:
            return self.regime_log_alphas[regime].exp()
        return self.log_alpha.exp()
    
    def update_alpha(self, log_probs, regime=None):
        """Update the entropy coefficient to maintain target entropy"""
        if regime is not None and regime in self.regime_log_alphas:
            log_alpha = self.regime_log_alphas[regime]
            alpha_optimizer = self.regime_optimizers[regime]
        else:
            log_alpha = self.log_alpha
            alpha_optimizer = self.alpha_optimizer
        
        alpha_loss = -(log_alpha * (log_probs + self.target_entropy).detach()).mean()
        
        alpha_optimizer.zero_grad()
        alpha_loss.backward()
        alpha_optimizer.step()
        
        return alpha_loss.item()
    
    def add_regime_alpha(self, regime, initial_value=None):
        """Add a regime-specific entropy coefficient"""
        if regime not in self.regime_log_alphas:
            if initial_value is None:
                initial_value = self.log_alpha.item()
            
            self.regime_log_alphas[regime] = torch.tensor(
                [initial_value], requires_grad=True, device=device)
            self.regime_optimizers[regime] = optim.Adam(
                [self.regime_log_alphas[regime]], lr=3e-4)
            
            logger.info(f"Added regime-specific entropy coefficient for regime {regime}")


class HierarchicalCriticNetwork(nn.Module):
    """
    Hierarchical critic network with regime-specific heads
    """
    def __init__(self, state_dim, action_dim, hidden_dims=[256, 256], activation=F.relu):
        super(HierarchicalCriticNetwork, self).__init__()
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.activation = activation
        
        self.feature_net = nn.Sequential(
            nn.Linear(state_dim + action_dim, hidden_dims[0]),
            nn.ReLU(),
            nn.Linear(hidden_dims[0], hidden_dims[1]),
            nn.ReLU()
        )
        
        self.main_head = nn.Linear(hidden_dims[1], 1)
        
        self.short_term_head = nn.Linear(hidden_dims[1], 1)
        self.medium_term_head = nn.Linear(hidden_dims[1], 1)
        self.long_term_head = nn.Linear(hidden_dims[1], 1)
        
        self.regime_heads = nn.ModuleDict()
        
        self.risk_head = nn.Linear(hidden_dims[1], 1)
    
    def forward(self, state, action, regime=None):
        """Forward pass returning Q-values from all heads"""
        x = torch.cat([state, action], dim=1)
        features = self.feature_net(x)
        
        q_value = self.main_head(features)
        
        q_short = self.short_term_head(features)
        q_medium = self.medium_term_head(features)
        q_long = self.long_term_head(features)
        
        q_regime = None
        if regime is not None and str(regime) in self.regime_heads:
            q_regime = self.regime_heads[str(regime)](features)
        
        risk = self.risk_head(features)
        
        return q_value, (q_short, q_medium, q_long), q_regime, risk
    
    def get_q_value(self, state, action, regime=None):
        """Get the main Q-value (for standard SAC updates)"""
        q_value, _, _, _ = self.forward(state, action, regime)
        return q_value
    
    def add_regime_head(self, regime):
        """Add a new regime-specific critic head"""
        if str(regime) not in self.regime_heads:
            self.regime_heads[str(regime)] = nn.Linear(256, 1)
            logger.info(f"Added regime-specific critic head for regime {regime}")


class ProgressiveSAC:
    """
    Progressive Soft Actor-Critic implementation with regime awareness
    """
    def __init__(self, state_dim, action_dim, hidden_dims=[256, 256], 
                 buffer_size=1000000, batch_size=256, gamma=0.99, tau=0.005, 
                 lr=3e-4, alpha=0.2, auto_entropy_tuning=True, 
                 start_steps=10000, update_after=1000, update_every=50,
                 num_updates=1, target_update_interval=1):
        
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.hidden_dims = hidden_dims
        self.gamma = gamma
        self.tau = tau
        self.alpha = alpha
        self.batch_size = batch_size
        self.start_steps = start_steps
        self.update_after = update_after
        self.update_every = update_every
        self.num_updates = num_updates
        self.target_update_interval = target_update_interval
        self.auto_entropy_tuning = auto_entropy_tuning
        
        self.policy = ProgressivePolicyNetwork(
            state_dim, action_dim, hidden_dims, stage=1, max_stages=3)
        
        self.critic1 = HierarchicalCriticNetwork(state_dim, action_dim, hidden_dims)
        self.critic2 = HierarchicalCriticNetwork(state_dim, action_dim, hidden_dims)
        
        self.critic1_target = HierarchicalCriticNetwork(state_dim, action_dim, hidden_dims)
        self.critic2_target = HierarchicalCriticNetwork(state_dim, action_dim, hidden_dims)
        
        self.critic1_target.load_state_dict(self.critic1.state_dict())
        self.critic2_target.load_state_dict(self.critic2.state_dict())
        
        self.policy_optimizer = optim.Adam(self.policy.parameters(), lr=lr)
        self.critic1_optimizer = optim.Adam(self.critic1.parameters(), lr=lr)
        self.critic2_optimizer = optim.Adam(self.critic2.parameters(), lr=lr)
        
        self.replay_buffer = PrioritizedReplayBuffer(buffer_size)
        
        self.total_steps = 0
        self.episodes = 0
        self.best_reward = -float('inf')
        
        self.current_regime = None
        self.regime_history = []
        self.regime_transitions = {}  # Track transitions between regimes
        
        self.curriculum_stage = 1
        self.curriculum_thresholds = {
            1: 0.0,    # Stage 1: Basic performance threshold
            2: 0.5,    # Stage 2: Medium performance threshold
            3: 0.8     # Stage 3: Advanced performance threshold
        }
        
        self.exploration_noise = 0.1
        self.exploration_decay = 0.9999
        self.min_exploration_noise = 0.01
        
        self.objective_weights = {
            'return': 1.0,
            'risk': 0.5,
            'regime_robustness': 0.3
        }
        
        self.adversarial_noise_scale = 0.01
        self.adversarial_prob = 0.1
        
        self.use_ensemble = False
        self.ensemble_policies = []
        self.ensemble_weights = []
        
        logger.info(f"Initialized Progressive SAC with state_dim={state_dim}, action_dim={action_dim}")
    
    def select_action(self, state, evaluate=False, regime=None):
        """Select an action from the policy with optional exploration"""
        state = torch.FloatTensor(state).unsqueeze(0).to(device)
        
        if regime is not None and regime != self.current_regime:
            self._handle_regime_transition(regime)
        
        if evaluate:
            _, _, action_mean = self.policy.sample(state, regime)
            return action_mean.detach().cpu().numpy()[0]
        else:
            if self.total_steps < self.start_steps:
                action = np.random.uniform(-1, 1, size=self.action_dim)
            else:
                action, _, _ = self.policy.sample(state, regime)
                action = action.detach().cpu().numpy()[0]
                
                if not evaluate and self.exploration_noise > self.min_exploration_noise:
                    noise = np.random.normal(0, self.exploration_noise, size=self.action_dim)
                    action = np.clip(action + noise, -1, 1)
                    
                    self.exploration_noise *= self.exploration_decay
            
            return action
    
    def update_parameters(self, batch_size=None, regime=None):
        """Update policy and critic parameters"""
        if batch_size is None:
            batch_size = self.batch_size
            
        states, actions, rewards, next_states, dones, indices, weights, regimes = \
            self.replay_buffer.sample(batch_size, regime)
        
        q1_loss, q2_loss, critic_loss = self._update_critics(
            states, actions, rewards, next_states, dones, weights, regimes)
        
        policy_loss, alpha_loss = self._update_policy(states, regimes)
        
        if self.total_steps % self.target_update_interval == 0:
            self._update_targets()
        
        td_errors = self._compute_td_errors(states, actions, rewards, next_states, dones, regimes)
        self.replay_buffer.update_priorities(indices, td_errors.detach().cpu().numpy())
        
        return {
            'critic_loss': critic_loss.item(),
            'q1_loss': q1_loss.item(),
            'q2_loss': q2_loss.item(),
            'policy_loss': policy_loss.item(),
            'alpha_loss': alpha_loss
        }
    
    def _update_critics(self, states, actions, rewards, next_states, dones, weights, regimes):
        """Update critic networks"""
        with torch.no_grad():
            next_actions, next_log_probs, _ = self.policy.sample(next_states)
            
            next_q1_main = self.critic1_target.get_q_value(next_states, next_actions)
            next_q2_main = self.critic2_target.get_q_value(next_states, next_actions)
            
            next_q = torch.min(next_q1_main, next_q2_main)
            
            alpha = self.policy.get_alpha(regimes[0] if len(set(regimes)) == 1 else None)
            next_q = next_q - alpha * next_log_probs
            
            target_q = rewards + (1 - dones) * self.gamma * next_q
        
        current_q1 = self.critic1.get_q_value(states, actions)
        current_q2 = self.critic2.get_q_value(states, actions)
        
        q1_loss = F.mse_loss(current_q1, target_q, reduction='none') * weights
        q2_loss = F.mse_loss(current_q2, target_q, reduction='none') * weights
        
        q1_loss = q1_loss.mean()
        q2_loss = q2_loss.mean()
        critic_loss = q1_loss + q2_loss
        
        self.critic1_optimizer.zero_grad()
        self.critic2_optimizer.zero_grad()
        critic_loss.backward()
        self.critic1_optimizer.step()
        self.critic2_optimizer.step()
        
        return q1_loss, q2_loss, critic_loss
    
    def _update_policy(self, states, regimes):
        """Update policy network and entropy coefficient"""
        actions, log_probs, _ = self.policy.sample(states)
        
        q1 = self.critic1.get_q_value(states, actions)
        q2 = self.critic2.get_q_value(states, actions)
        q = torch.min(q1, q2)
        
        alpha = self.policy.get_alpha(regimes[0] if len(set(regimes)) == 1 else None)
        
        policy_loss = (alpha * log_probs - q).mean()
        
        self.policy_optimizer.zero_grad()
        policy_loss.backward()
        self.policy_optimizer.step()
        
        alpha_loss = 0
        if self.auto_entropy_tuning:
            alpha_loss = self.policy.update_alpha(log_probs, regimes[0] if len(set(regimes)) == 1 else None)
        
        return policy_loss, alpha_loss
    
    def _update_targets(self):
        """Update target networks with polyak averaging"""
        for target_param, param in zip(self.critic1_target.parameters(), self.critic1.parameters()):
            target_param.data.copy_(target_param.data * (1.0 - self.tau) + param.data * self.tau)
            
        for target_param, param in zip(self.critic2_target.parameters(), self.critic2.parameters()):
            target_param.data.copy_(target_param.data * (1.0 - self.tau) + param.data * self.tau)
    
    def _compute_td_errors(self, states, actions, rewards, next_states, dones, regimes):
        """Compute TD errors for prioritized replay"""
        with torch.no_grad():
            current_q1 = self.critic1.get_q_value(states, actions)
            current_q2 = self.critic2.get_q_value(states, actions)
            
            next_actions, next_log_probs, _ = self.policy.sample(next_states)
            next_q1 = self.critic1_target.get_q_value(next_states, next_actions)
            next_q2 = self.critic2_target.get_q_value(next_states, next_actions)
            next_q = torch.min(next_q1, next_q2)
            
            alpha = self.policy.get_alpha(regimes[0] if len(set(regimes)) == 1 else None)
            next_q = next_q - alpha * next_log_probs
            
            target_q = rewards + (1 - dones) * self.gamma * next_q
            
            td_errors1 = torch.abs(current_q1 - target_q)
            td_errors2 = torch.abs(current_q2 - target_q)
            td_errors = torch.max(td_errors1, td_errors2)
        
        return td_errors
    
    def _handle_regime_transition(self, new_regime):
        """Handle transition to a new market regime"""
        if self.current_regime is not None:
            transition_key = (self.current_regime, new_regime)
            if transition_key not in self.regime_transitions:
                self.regime_transitions[transition_key] = 0
            self.regime_transitions[transition_key] += 1
            
            logger.info(f"Regime transition: {self.current_regime} -> {new_regime}")
        
        self.current_regime = new_regime
        self.regime_history.append(new_regime)
        
        self.policy.add_regime_alpha(new_regime)
        self.critic1.add_regime_head(new_regime)
        self.critic2.add_regime_head(new_regime)
        self.critic1_target.add_regime_head(new_regime)
        self.critic2_target.add_regime_head(new_regime)
    
    def increase_curriculum_stage(self, performance_metric):
        """Progress to the next curriculum stage if performance threshold is met"""
        if self.curriculum_stage < 3 and performance_metric >= self.curriculum_thresholds[self.curriculum_stage + 1]:
            self.curriculum_stage += 1
            
            prev_weights = self.policy.increase_complexity()
            
            if self.curriculum_stage == 2:
                self.exploration_noise *= 0.5
                self.objective_weights['risk'] *= 1.5
            elif self.curriculum_stage == 3:
                self.exploration_noise *= 0.5
                self.objective_weights['regime_robustness'] *= 2.0
                
                self.use_ensemble = True
                self._initialize_ensemble()
            
            logger.info(f"Advanced to curriculum stage {self.curriculum_stage}")
            return True
        
        return False
    
    def _initialize_ensemble(self, num_models=3):
        """Initialize an ensemble of policies for robustness"""
        if not self.ensemble_policies:
            for i in range(num_models):
                policy = ProgressivePolicyNetwork(
                    self.state_dim, self.action_dim, self.hidden_dims, 
                    stage=self.policy.stage, max_stages=self.policy.max_stages)
                
                policy.load_state_dict(self.policy.state_dict())
                
                for param in policy.parameters():
                    param.data += torch.randn_like(param.data) * 0.01
                
                self.ensemble_policies.append(policy)
                self.ensemble_weights.append(1.0 / num_models)
            
            logger.info(f"Initialized ensemble with {num_models} policies")
    
    def save(self, path):
        """Save model parameters"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        torch.save({
            'policy': self.policy.state_dict(),
            'critic1': self.critic1.state_dict(),
            'critic2': self.critic2.state_dict(),
            'critic1_target': self.critic1_target.state_dict(),
            'critic2_target': self.critic2_target.state_dict(),
            'policy_optimizer': self.policy_optimizer.state_dict(),
            'critic1_optimizer': self.critic1_optimizer.state_dict(),
            'critic2_optimizer': self.critic2_optimizer.state_dict(),
            'total_steps': self.total_steps,
            'episodes': self.episodes,
            'curriculum_stage': self.curriculum_stage,
            'exploration_noise': self.exploration_noise,
            'objective_weights': self.objective_weights,
            'regime_history': self.regime_history,
            'regime_transitions': self.regime_transitions
        }, path)
        
        logger.info(f"Model saved to {path}")
    
    def load(self, path):
        """Load model parameters"""
        checkpoint = torch.load(path)
        
        self.policy.load_state_dict(checkpoint['policy'])
        self.critic1.load_state_dict(checkpoint['critic1'])
        self.critic2.load_state_dict(checkpoint['critic2'])
        self.critic1_target.load_state_dict(checkpoint['critic1_target'])
        self.critic2_target.load_state_dict(checkpoint['critic2_target'])
        self.policy_optimizer.load_state_dict(checkpoint['policy_optimizer'])
        self.critic1_optimizer.load_state_dict(checkpoint['critic1_optimizer'])
        self.critic2_optimizer.load_state_dict(checkpoint['critic2_optimizer'])
        
        self.total_steps = checkpoint['total_steps']
        self.episodes = checkpoint['episodes']
        self.curriculum_stage = checkpoint['curriculum_stage']
        self.exploration_noise = checkpoint['exploration_noise']
        self.objective_weights = checkpoint['objective_weights']
        self.regime_history = checkpoint['regime_history']
        self.regime_transitions = checkpoint['regime_transitions']
        
        logger.info(f"Model loaded from {path}")
