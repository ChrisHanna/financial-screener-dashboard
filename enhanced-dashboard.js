/**
 * Enhanced Trading Dashboard JavaScript
 * Implements advanced features for the enhanced trading dashboard
 */

console.log('Enhanced Dashboard JS v2.0 - Loading with Exhaustion Functions');

// === EXHAUSTION DATA PROCESSING FUNCTIONS ===
// Define these functions early to ensure they're available

function calculateExhaustionScore(trendExhaustData) {
    if (!trendExhaustData || !trendExhaustData.avgPercentR) {
        return 0;
    }
    
    // Get the last few values to calculate exhaustion score
    const avgPercentR = trendExhaustData.avgPercentR;
    const recentValues = avgPercentR.slice(-10); // Last 10 values
    
    if (recentValues.length === 0) return 0;
    
    // Calculate score based on average Williams %R values
    const currentValue = recentValues[recentValues.length - 1];
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Convert Williams %R (-100 to 0) to exhaustion score (0 to 100)
    // -20 to -80 range (normal) = 20-40 exhaustion score
    // Above -20 (overbought) = higher exhaustion score
    // Below -80 (oversold) = higher exhaustion score for reversal
    
    let exhaustionScore = 0;
    
    if (currentValue >= -20) {
        // Overbought territory - high exhaustion
        exhaustionScore = 70 + ((-20 - currentValue) / 20) * 30; // 70-100 range
    } else if (currentValue <= -80) {
        // Oversold territory - high exhaustion
        exhaustionScore = 70 + ((currentValue + 80) / 20) * 30; // 70-100 range
    } else {
        // Normal territory - calculate based on distance from midpoint
        const midpoint = -50;
        const distanceFromMid = Math.abs(currentValue - midpoint);
        exhaustionScore = 20 + (distanceFromMid / 30) * 40; // 20-60 range
    }
    
    return Math.max(0, Math.min(100, exhaustionScore));
}

function getExhaustionLevel(trendExhaustData) {
    if (!trendExhaustData || Object.keys(trendExhaustData).length === 0) {
        return 'No Data';
    }
    
    const score = calculateExhaustionScore(trendExhaustData);
    
    if (score >= 80) return 'Critical';
    if (score >= 65) return 'High';
    if (score >= 35) return 'Moderate';
    if (score >= 20) return 'Low';
    return 'Normal';
}

function countExhaustionSignals(trendExhaustData) {
    if (!trendExhaustData || !trendExhaustData.signals) {
        return 0;
    }
    
    const signals = trendExhaustData.signals;
    let count = 0;
    
    // Count recent signals (overbought/oversold reversals and crossovers)
    if (signals.obReversal) count += signals.obReversal.length;
    if (signals.osReversal) count += signals.osReversal.length;
    if (signals.bullCross) count += signals.bullCross.length;
    if (signals.bearCross) count += signals.bearCross.length;
    
    return count;
}

// Global variables
let tickersData = null;
let charts = {};
let detailedCharts = {};

// Enhanced filter object to handle oscillator-specific filters
let activeFilters = {
    category: 'all',
    signal: 'all',
    rsiState: 'all',
    exhaustion: 'all',
    confluence: 'all',
    momentum: 'all'
};

// Debug: Check if exhaustion functions exist
console.log('Function check:', {
    calculateExhaustionScore: typeof calculateExhaustionScore,
    getExhaustionLevel: typeof getExhaustionLevel,
    countExhaustionSignals: typeof countExhaustionSignals
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking functions again:', {
        calculateExhaustionScore: typeof calculateExhaustionScore,
        getExhaustionLevel: typeof getExhaustionLevel,
        countExhaustionSignals: typeof countExhaustionSignals
    });
    initDashboard();
    setupEventListeners();
});

function initDashboard() {
    const savedTickers = localStorage.getItem('enhancedDashboardTickers');
    const tickerInput = document.getElementById('tickerInput');
    
    if (savedTickers) {
        tickerInput.value = savedTickers;
        fetchTickersData(savedTickers.split(',').map(t => t.trim()));
    }
    
    updateTimestamp();
    
    document.getElementById('batchUploadForm').style.display = 'none';
}

function setupEventListeners() {
    // Existing event listeners
    document.getElementById('addTickers').addEventListener('click', () => {
        const tickers = document.getElementById('tickerInput').value.trim();
        if (tickers) {
            fetchTickersData(tickers);
        }
    });

    document.getElementById('tickerInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const tickers = e.target.value.trim();
            if (tickers) {
                fetchTickersData(tickers);
            }
        }
    });

    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
    document.getElementById('sortSelector').addEventListener('change', applyFiltersAndSort);

    // Enhanced filter event listeners for oscillator-specific filters
    
    // Category filters
    document.querySelectorAll('.filter-badge[data-category]').forEach(badge => {
        badge.addEventListener('click', () => {
            document.querySelectorAll('.filter-badge[data-category]').forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            activeFilters.category = badge.dataset.category;
            applyFiltersAndSort();
        });
    });

    // Legacy signal filters
    document.querySelectorAll('.filter-badge[data-signal]').forEach(badge => {
        badge.addEventListener('click', () => {
            document.querySelectorAll('.filter-badge[data-signal]').forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            activeFilters.signal = badge.dataset.signal;
            applyFiltersAndSort();
        });
    });

    // RSI3M3+ State filters
    document.querySelectorAll('.filter-badge[data-rsi-state]').forEach(badge => {
        badge.addEventListener('click', () => {
            document.querySelectorAll('.filter-badge[data-rsi-state]').forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            activeFilters.rsiState = badge.dataset.rsiState;
            applyFiltersAndSort();
        });
    });

    // Exhaustion level filters
    document.querySelectorAll('.filter-badge[data-exhaustion]').forEach(badge => {
        badge.addEventListener('click', () => {
            document.querySelectorAll('.filter-badge[data-exhaustion]').forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            activeFilters.exhaustion = badge.dataset.exhaustion;
            applyFiltersAndSort();
        });
    });

    // Confluence filters
    document.querySelectorAll('.filter-badge[data-confluence]').forEach(badge => {
        badge.addEventListener('click', () => {
            document.querySelectorAll('.filter-badge[data-confluence]').forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            activeFilters.confluence = badge.dataset.confluence;
            applyFiltersAndSort();
        });
    });

    // Momentum filters
    document.querySelectorAll('.filter-badge[data-momentum]').forEach(badge => {
        badge.addEventListener('click', () => {
            document.querySelectorAll('.filter-badge[data-momentum]').forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            activeFilters.momentum = badge.dataset.momentum;
            applyFiltersAndSort();
        });
    });

    // Modal close functionality
    const modal = document.getElementById('detailedViewModal');
    const closeModalBtn = document.querySelector('.close-modal');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Batch upload functionality
    const showBatchUploadBtn = document.getElementById('showBatchUploadBtn');
    const batchUploadForm = document.getElementById('batchUploadForm');
    
    if (showBatchUploadBtn && batchUploadForm) {
        showBatchUploadBtn.addEventListener('click', () => {
            batchUploadForm.style.display = batchUploadForm.style.display === 'none' ? 'block' : 'none';
        });

        batchUploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('batchFile');
            const file = fileInput.files[0];
            
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const tickers = e.target.result.split('\n')
                        .map(ticker => ticker.trim())
                        .filter(ticker => ticker.length > 0)
                        .join(',');
                    
                    if (tickers) {
                        fetchTickersData(tickers);
                        batchUploadForm.style.display = 'none';
                    }
                };
                reader.readAsText(file);
            }
        });
    }
}

function fetchTickersData(tickers) {
    if (!tickers || tickers.length === 0) return;
    
    console.log('fetchTickersData called with:', tickers);
    
    const period = document.getElementById('periodSelector').value;
    const interval = document.getElementById('intervalSelector').value;
    
    console.log('Period:', period, 'Interval:', interval);
    
    document.getElementById('loading').style.display = 'flex';
    
    const apiUrl = `/api/multi-ticker?tickers=${tickers.join(',')}&period=${period}&interval=${interval}`;
    console.log('API URL:', apiUrl);
    
    fetch(apiUrl)
        .then(response => {
            console.log('API Response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('API Response data:', data);
            tickersData = data;
            renderTickersGrid(data);
            updateTimestamp();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            showAlert('Error fetching data. Please try again.', 'error');
        })
        .finally(() => {
            document.getElementById('loading').style.display = 'none';
        });
}

function refreshData() {
    const tickerInput = document.getElementById('tickerInput');
    const tickers = tickerInput.value.split(',').map(t => t.trim()).filter(t => t);
    
    if (tickers.length > 0) {
        fetchTickersData(tickers);
    }
}

function updateTimestamp() {
    const timestampElement = document.getElementById('lastUpdated');
    if (timestampElement) {
        const now = new Date();
        timestampElement.textContent = now.toLocaleString();
    }
}

function clearCache() {
    fetch('/api/clear-cache')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Cache cleared successfully', 'success');
                refreshData();
            } else {
                showAlert('Failed to clear cache', 'error');
            }
        })
        .catch(error => {
            console.error('Error clearing cache:', error);
            showAlert('Error clearing cache', 'error');
        });
}

function showAlert(message, type) {
    const alertContainer = document.querySelector('.alert-container') || createAlertContainer();
    
    const alertItem = document.createElement('div');
    alertItem.className = `alert-item ${type}`;
    
    let iconClass = 'bi-info-circle';
    if (type === 'success') iconClass = 'bi-check-circle';
    if (type === 'warning') iconClass = 'bi-exclamation-triangle';
    if (type === 'error') iconClass = 'bi-x-circle';
    
    alertItem.innerHTML = `
        <div class="alert-icon"><i class="bi ${iconClass}"></i></div>
        <div class="alert-content">
            <div class="alert-message">${message}</div>
        </div>
        <button class="alert-close"><i class="bi bi-x"></i></button>
    `;
    
    alertContainer.appendChild(alertItem);
    
    alertItem.querySelector('.alert-close').addEventListener('click', function() {
        alertContainer.removeChild(alertItem);
    });
    
    setTimeout(() => {
        if (alertItem.parentNode === alertContainer) {
            alertContainer.removeChild(alertItem);
        }
    }, 5000);
}

function createAlertContainer() {
    const alertContainer = document.createElement('div');
    alertContainer.className = 'alert-container';
    document.body.appendChild(alertContainer);
    return alertContainer;
}

function applyFiltersAndSort() {
    const tickerItems = document.querySelectorAll('.ticker-item');
    const sortBy = document.getElementById('sortSelector').value;
    
    tickerItems.forEach(item => {
        const ticker = item.dataset.ticker;
        const category = item.dataset.category;
        const signals = item.dataset.signals ? item.dataset.signals.split(',') : [];
        
        // Get ticker data for oscillator-specific filtering
        const tickerData = tickersData?.results?.[ticker];
        
        // Category filter
        let showCategory = activeFilters.category === 'all' || activeFilters.category === category;
        
        // Legacy signal filter
        let showSignal = activeFilters.signal === 'all' || signals.includes(activeFilters.signal);
        
        // RSI3M3+ State filter
        let showRSIState = true;
        if (activeFilters.rsiState !== 'all' && tickerData) {
            const rsi3m3Data = tickerData.rsi3m3 || {};
            const currentState = rsi3m3Data.state ? rsi3m3Data.state[rsi3m3Data.state.length - 1] : 0;
            const rsi3m3StateChange = findLastRSI3M3StateChange(rsi3m3Data);
            
            switch (activeFilters.rsiState) {
                case 'bullish':
                    showRSIState = currentState === 1;
                    break;
                case 'bearish':
                    showRSIState = currentState === 2;
                    break;
                case 'transition':
                    showRSIState = currentState === 3;
                    break;
                case 'fresh-signal':
                    showRSIState = rsi3m3StateChange.daysSinceChange !== null && rsi3m3StateChange.daysSinceChange <= 3;
                    break;
            }
        }
        
        // Exhaustion level filter
        let showExhaustion = true;
        if (activeFilters.exhaustion !== 'all' && tickerData) {
            const exhaustionData = tickerData.trendExhaust || {};
            const exhaustionLevel = getExhaustionLevel(exhaustionData).toLowerCase();
            
            if (activeFilters.exhaustion !== exhaustionLevel) {
                showExhaustion = false;
            }
        }
        
        // Confluence filter
        let showConfluence = true;
        if (activeFilters.confluence !== 'all' && tickerData) {
            const unifiedAnalysis = calculateUnifiedAnalysis(tickerData);
            const score = unifiedAnalysis.score;
            const alignedSystems = Object.values(unifiedAnalysis.confluence).filter(val => val === true).length;
            const conflictedSystems = Object.values(unifiedAnalysis.confluence).filter(val => val === false).length;
            
            switch (activeFilters.confluence) {
                case 'strong-aligned':
                    showConfluence = alignedSystems >= 3;
                    break;
                case 'moderate-aligned':
                    showConfluence = alignedSystems === 2;
                    break;
                case 'conflicted':
                    showConfluence = conflictedSystems > alignedSystems;
                    break;
                case 'high-score':
                    showConfluence = score >= 75;
                    break;
                case 'low-score':
                    showConfluence = score <= 25;
                    break;
            }
        }
        
        // Momentum filter
        let showMomentum = true;
        if (activeFilters.momentum !== 'all' && tickerData) {
            const analyzerBSignals = findLastAnalyzerBSignals(tickerData);
            const momentum = analyzerBSignals.momentum.toLowerCase();
            
            switch (activeFilters.momentum) {
                case 'strong-bullish':
                    showMomentum = momentum === 'strong bullish';
                    break;
                case 'moderate-bullish':
                    showMomentum = momentum === 'moderate bullish';
                    break;
                case 'neutral':
                    showMomentum = momentum === 'normal';
                    break;
                case 'moderate-bearish':
                    showMomentum = momentum === 'moderate bearish';
                    break;
                case 'strong-bearish':
                    showMomentum = momentum === 'strong bearish';
                    break;
            }
        }
        
        // Show item only if all filters pass
        const shouldShow = showCategory && showSignal && showRSIState && showExhaustion && showConfluence && showMomentum;
        item.style.display = shouldShow ? 'block' : 'none';
    });

    // Sort functionality remains the same
    const tickersGrid = document.getElementById('tickersGrid');
    const items = Array.from(tickerItems);
    
    items.sort((a, b) => {
        const tickerA = a.dataset.ticker;
        const tickerB = b.dataset.ticker;
        const dataA = tickersData?.results?.[tickerA];
        const dataB = tickersData?.results?.[tickerB];
        
        if (!dataA || !dataB) return 0;
        
        switch (sortBy) {
            case 'alphabetical':
                return tickerA.localeCompare(tickerB);
            case 'price':
                const priceA = dataA.price ? dataA.price[dataA.price.length - 1] || 0 : 0;
                const priceB = dataB.price ? dataB.price[dataB.price.length - 1] || 0 : 0;
                return priceB - priceA;
            case 'change':
                const lastPriceA = dataA.price ? dataA.price[dataA.price.length - 1] || 0 : 0;
                const prevPriceA = dataA.price ? dataA.price[dataA.price.length - 2] || lastPriceA : lastPriceA;
                const changeA = prevPriceA !== 0 ? (lastPriceA - prevPriceA) / prevPriceA : 0;
                
                const lastPriceB = dataB.price ? dataB.price[dataB.price.length - 1] || 0 : 0;
                const prevPriceB = dataB.price ? dataB.price[dataB.price.length - 2] || lastPriceB : lastPriceB;
                const changeB = prevPriceB !== 0 ? (lastPriceB - prevPriceB) / prevPriceB : 0;
                
                return changeB - changeA;
            case 'signal':
                const unifiedA = calculateUnifiedAnalysis(dataA);
                const unifiedB = calculateUnifiedAnalysis(dataB);
                return unifiedB.score - unifiedA.score;
            case 'volume':
                const volumeA = dataA.volume ? dataA.volume[dataA.volume.length - 1] || 0 : 0;
                const volumeB = dataB.volume ? dataB.volume[dataB.volume.length - 1] || 0 : 0;
                return volumeB - volumeA;
            default:
                return 0;
        }
    });
    
    items.forEach(item => {
        tickersGrid.appendChild(item);
    });
}

function toggleFavorite(ticker, button) {
    const favorites = JSON.parse(localStorage.getItem('enhancedDashboardFavorites') || '[]');
    
    if (favorites.includes(ticker)) {
        const index = favorites.indexOf(ticker);
        favorites.splice(index, 1);
        button.classList.remove('active');
        button.querySelector('i').classList.remove('bi-star-fill');
        button.querySelector('i').classList.add('bi-star');
    } else {
        favorites.push(ticker);
        button.classList.add('active');
        button.querySelector('i').classList.remove('bi-star');
        button.querySelector('i').classList.add('bi-star-fill');
    }
    
    localStorage.setItem('enhancedDashboardFavorites', JSON.stringify(favorites));
}

// Helper functions
function safeValue(value, fallback = 0) {
    return (value !== null && value !== undefined && !isNaN(value)) ? value : fallback;
}

function formatPrice(price) {
    if (price == null || isNaN(price)) return '$0.00';
    
    if (price >= 1000000) {
        return '$' + (price / 1000000).toFixed(2) + 'M';
    } else if (price >= 1000) {
        return '$' + (price / 1000).toFixed(2) + 'K';
    } else if (price >= 1) {
        return '$' + price.toFixed(2);
    } else {
        return '$' + price.toFixed(4);
    }
}

// Render the tickers grid with comprehensive multi-oscillator analysis
function renderTickersGrid(data) {
    console.log('renderTickersGrid called with data:', data);
    
    const tickersGrid = document.getElementById('tickersGrid');
    
    if (!tickersGrid) {
        console.error('tickersGrid element not found!');
        return;
    }
    
    console.log('tickersGrid element found:', tickersGrid);
    
    // Clear the grid
    tickersGrid.innerHTML = '';
    
    // Check if data has the expected structure
    if (!data || !data.results) {
        console.error('Invalid data structure:', data);
        tickersGrid.innerHTML = '<div class="col-12"><div class="alert alert-danger">No data available. Please try refreshing.</div></div>';
        return;
    }
    
    console.log('Processing', Object.keys(data.results).length, 'tickers');
    
    // Process each ticker result with comprehensive analysis
    Object.entries(data.results).forEach(([ticker, tickerData]) => {
        // Extract comprehensive data
        const companyName = tickerData.companyName || ticker;
        const currentPrice = safeValue(tickerData.summary?.currentPrice, 0);
        const priceChangePct = safeValue(tickerData.summary?.priceChangePct, 0);
        
        // === ANALYZER B DATA ===
        const currentWT1 = safeValue(tickerData.summary?.currentWT1, 0);
        const currentWT2 = safeValue(tickerData.summary?.currentWT2, 0);
        const currentMF = safeValue(tickerData.summary?.currentMF, 0);
        const buySignals = safeValue(tickerData.summary?.buySignals, 0);
        const goldBuySignals = safeValue(tickerData.summary?.goldBuySignals, 0);
        const sellSignals = safeValue(tickerData.summary?.sellSignals, 0);
        const bullishDivs = safeValue(tickerData.summary?.bullishDivergenceSignals, 0);
        const bearishDivs = safeValue(tickerData.summary?.bearishDivergenceSignals, 0);
        
        // === RSI3M3+ DATA ===
        const rsi3m3Data = tickerData.rsi3m3 || {};
        const currentRSI3M3 = rsi3m3Data.rsi3m3 ? safeValue(rsi3m3Data.rsi3m3[rsi3m3Data.rsi3m3.length - 1], 0) : 0;
        const currentRSI3M3State = rsi3m3Data.state ? rsi3m3Data.state[rsi3m3Data.state.length - 1] : 0;
        const rsi3m3BuySignals = rsi3m3Data.signals?.buy?.length || 0;
        const rsi3m3SellSignals = rsi3m3Data.signals?.sell?.length || 0;
        const rsi3m3StateChange = findLastRSI3M3StateChange(rsi3m3Data);
        
        // Get the CURRENT state info - this is what we should display consistently
        const currentRSI3M3StateInfo = getRSI3M3StateInfo(currentRSI3M3State, currentRSI3M3);
        
        // Determine if this is a fresh signal (state changed recently)
        const isFreshRSI3M3Signal = rsi3m3StateChange.daysSinceChange !== null && rsi3m3StateChange.daysSinceChange <= 3;
        
        // === EXHAUSTION DATA ===
        const exhaustionData = tickerData.trendExhaust || {};
        const exhaustionScore = calculateExhaustionScore(exhaustionData);
        const exhaustionLevel = getExhaustionLevel(exhaustionData);
        const exhaustionSignals = countExhaustionSignals(exhaustionData);
        const exhaustionVisuals = getExhaustionVisualIndicators(exhaustionData);
        
        // === PROGRESSIVE SAC DATA ===
        const sacData = tickerData.progressive_sac || {};
        const sacPrediction = sacData.prediction || 'Neutral';
        const sacConfidence = safeValue(sacData.confidence, 0);
        const sacRecommendation = sacData.recommendation || 'Hold';
        const sacPositionSize = safeValue(sacData.position_size, 0);
        
        // === UNIFIED ANALYSIS ===
        const unifiedAnalysis = calculateUnifiedAnalysis(tickerData);
        
        // Get colors and states for each system
        const analyzerBState = getAnalyzerBState(currentWT1, currentWT2, currentMF, buySignals, sellSignals, goldBuySignals);
        const exhaustionState = getExhaustionState(exhaustionScore, exhaustionLevel, exhaustionData);
        const sacState = getSACState(sacPrediction, sacConfidence, sacData);
        
        const tickerType = getTickerCategory(ticker);
        
        // Determine overall signal class
        const overallSignal = determineOverallSignal(analyzerBState, currentRSI3M3StateInfo, exhaustionState, sacState);
        
        // Create enhanced card element
        const cardCol = document.createElement('div');
        cardCol.className = 'col-md-6 col-lg-4 ticker-item';
        cardCol.dataset.ticker = ticker;
        cardCol.dataset.category = tickerType;
        cardCol.dataset.signals = overallSignal.label.toLowerCase().replace(' ', '');
        
        // Generate comprehensive card HTML
        cardCol.innerHTML = `
            <div class="ticker-card enhanced-card">
                <!-- Header Section -->
                <div class="ticker-header">
                    <div>
                        <div class="ticker-symbol">
                            ${ticker}
                            <span class="ticker-tag ${getTagClass(tickerType)}">${getTagLabel(tickerType)}</span>
                            <div class="unified-score" style="background: ${overallSignal.color};">
                                ${unifiedAnalysis.score}/100
                            </div>
                        </div>
                        <div class="ticker-company">${companyName}</div>
                    </div>
                    <div class="text-end">
                        <div class="ticker-price">${formatPrice(currentPrice)}</div>
                        <div class="price-change ${priceChangePct > 0 ? 'positive' : priceChangePct < 0 ? 'negative' : 'neutral'}">
                            ${priceChangePct > 0 ? '+' : ''}${priceChangePct.toFixed(2)}%
                        </div>
                    </div>
                    <button class="favorite-btn" onclick="toggleFavorite('${ticker}', this)">
                        <i class="bi bi-star"></i>
                    </button>
                </div>
                
                <!-- Four Oscillators Dashboard -->
                <div class="oscillators-dashboard">
                    <!-- Analyzer B Section -->
                    <div class="oscillator-section analyzer-b" style="border-left: 4px solid ${analyzerBState.color};">
                        <div class="oscillator-header">
                            <span class="oscillator-name">Analyzer B</span>
                            <span class="oscillator-status" style="color: ${analyzerBState.color};">${analyzerBState.label}</span>
                        </div>
                        <div class="oscillator-values">
                            <div class="value-item">
                                <span>WT1:</span> <span style="color: ${currentWT1 > currentWT2 ? '#00ff0a' : '#ff1100'};">${currentWT1.toFixed(2)}</span>
                            </div>
                            <div class="value-item">
                                <span>WT2:</span> <span style="color: ${currentWT2 < currentWT1 ? '#00ff0a' : '#ff1100'};">${currentWT2.toFixed(2)}</span>
                            </div>
                            <div class="value-item">
                                <span>MF:</span> <span style="color: ${currentMF > 0 ? '#00ff0a' : '#ff1100'};">${currentMF.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="signal-indicators">
                            ${goldBuySignals > 0 ? '<span class="signal-dot gold-buy" title="Gold Buy">●</span>' : ''}
                            ${buySignals > 0 ? '<span class="signal-dot buy" title="Buy">●</span>' : ''}
                            ${sellSignals > 0 ? '<span class="signal-dot sell" title="Sell">●</span>' : ''}
                            ${bullishDivs > 0 ? '<span class="signal-dot bullish-div" title="Bullish Div">↗</span>' : ''}
                            ${bearishDivs > 0 ? '<span class="signal-dot bearish-div" title="Bearish Div">↘</span>' : ''}
                        </div>
                    </div>
                    
                    <!-- RSI3M3+ Section -->
                    <div class="oscillator-section rsi3m3" style="border-left: 4px solid ${currentRSI3M3StateInfo.color}; background: ${currentRSI3M3StateInfo.color}15;">
                        <div class="oscillator-header">
                            <span class="oscillator-name">RSI3M3+</span>
                            <span class="oscillator-status" style="color: ${currentRSI3M3StateInfo.color};">${currentRSI3M3StateInfo.label}</span>
                        </div>
                        <div class="oscillator-values">
                            <div class="value-item">
                                <span>Value:</span> <span style="color: ${currentRSI3M3StateInfo.color}; font-weight: bold;">${currentRSI3M3.toFixed(1)}</span>
                            </div>
                            <div class="value-item">
                                <span>Current State:</span> <span style="color: ${currentRSI3M3StateInfo.color}; font-weight: bold;">${currentRSI3M3StateInfo.label}</span>
                            </div>
                            ${rsi3m3StateChange.lastChange ? `
                            <div class="value-item transition-info">
                                <span>State Since:</span> <span style="color: ${currentRSI3M3StateInfo.color}; font-weight: bold;">${rsi3m3StateChange.daysSinceChange}d ago</span>
                            </div>
                            ${isFreshRSI3M3Signal ? `
                            <div class="value-item transition-info">
                                <span style="color: #FFD700; font-weight: bold;">⚡ Fresh ${currentRSI3M3StateInfo.label} Signal!</span>
                            </div>
                            ` : ''}
                            ` : ''}
                        </div>
                        <div class="signal-indicators">
                            ${currentRSI3M3State === 1 ? '<span class="signal-dot rsi-bullish" title="Currently Bullish" style="background: #00ff0a; color: white;">●</span>' : ''}
                            ${currentRSI3M3State === 2 ? '<span class="signal-dot rsi-bearish" title="Currently Bearish" style="background: #ff1100; color: white;">●</span>' : ''}
                            ${currentRSI3M3State === 3 ? '<span class="signal-dot rsi-transition" title="In Transition" style="background: #ffff00; color: black;">●</span>' : ''}
                            ${isFreshRSI3M3Signal ? '<span class="signal-dot fresh-signal" title="Fresh Signal" style="background: gold; color: black;">⚡</span>' : ''}
                        </div>
                    </div>
                    
                    <!-- Exhaustion Section -->
                    <div class="oscillator-section exhaustion" style="border-left: 4px solid ${exhaustionState.color};">
                        <div class="oscillator-header">
                            <span class="oscillator-name">Exhaustion</span>
                            <span class="oscillator-status" style="color: ${exhaustionState.color};">${exhaustionState.label}</span>
                        </div>
                        <div class="oscillator-values">
                            ${Object.keys(exhaustionData).length > 0 ? `
                            <div class="value-item">
                                <span>Score:</span> <span style="color: ${exhaustionState.color};">${exhaustionScore.toFixed(1)}/100</span>
                            </div>
                            <div class="value-item">
                                <span>Level:</span> <span style="color: ${exhaustionState.color};">${exhaustionLevel}</span>
                            </div>
                            <div class="value-item">
                                <span>Exhaustion Zones:</span> <span style="color: ${exhaustionState.color};">■ ${exhaustionVisuals.rectangles}</span>
                            </div>
                            <div class="value-item">
                                <span>Reversal Signals:</span> <span style="color: ${exhaustionState.color};">▲ ${exhaustionVisuals.triangles}</span>
                            </div>
                            ` : `
                            <div class="value-item">
                                <span style="color: #808080;">No Data Available</span>
                            </div>
                            `}
                        </div>
                        <div class="signal-indicators">
                            ${exhaustionVisuals.rectangles > 0 ? '<span class="signal-dot exhaustion-zone" title="Exhaustion Zones" style="background: orange;">■</span>' : ''}
                            ${exhaustionVisuals.triangles > 0 ? '<span class="signal-dot reversal-signal" title="Reversal Signals" style="background: red;">▲</span>' : ''}
                            ${exhaustionSignals > 0 ? '<span class="signal-dot exhaustion-signal" title="Exhaustion Signal">⚠</span>' : ''}
                        </div>
                    </div>
                    
                    <!-- Progressive SAC Section -->
                    <div class="oscillator-section progressive-sac" style="border-left: 4px solid ${sacState.color};">
                        <div class="oscillator-header">
                            <span class="oscillator-name">Progressive SAC</span>
                            <span class="oscillator-status" style="color: ${sacState.color};">${sacState.label}</span>
                        </div>
                        <div class="oscillator-values">
                            ${Object.keys(sacData).length > 0 ? `
                            <div class="value-item">
                                <span>Prediction:</span> <span style="color: ${sacState.color};">${sacPrediction}</span>
                            </div>
                            <div class="value-item">
                                <span>Confidence:</span> <span style="color: ${sacState.color};">${(sacConfidence * 100).toFixed(1)}%</span>
                            </div>
                            <div class="value-item">
                                <span>Position:</span> <span style="color: ${sacState.color};">${(sacPositionSize * 100).toFixed(1)}%</span>
                            </div>
                            ` : `
                            <div class="value-item">
                                <span style="color: #808080;">No Data Available</span>
                            </div>
                            `}
                        </div>
                        <div class="signal-indicators">
                            ${Object.keys(sacData).length > 0 ? `<span class="sac-recommendation" style="background: ${sacState.color}20; color: ${sacState.color};">${sacRecommendation}</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Unified Analysis Section -->
                <div class="unified-analysis" style="background: ${overallSignal.color}20; border: 1px solid ${overallSignal.color};">
                    <div class="analysis-header">
                        <span class="analysis-title">Unified Analysis</span>
                        <span class="analysis-score" style="color: ${overallSignal.color};">${overallSignal.label}</span>
                    </div>
                    <div class="analysis-content">
                        <p>${unifiedAnalysis.summary}</p>
                        <div class="confluence-indicators">
                            <div class="confluence-item ${unifiedAnalysis.confluence.analyzer_b ? 'aligned' : 'conflicted'}">
                                <span>Analyzer B</span>
                                <span>${unifiedAnalysis.confluence.analyzer_b ? '✓' : '✗'}</span>
                            </div>
                            <div class="confluence-item ${unifiedAnalysis.confluence.rsi3m3 ? 'aligned' : 'conflicted'}">
                                <span>RSI3M3+</span>
                                <span>${unifiedAnalysis.confluence.rsi3m3 ? '✓' : '✗'}</span>
                            </div>
                            <div class="confluence-item ${unifiedAnalysis.confluence.exhaustion === null ? 'missing' : unifiedAnalysis.confluence.exhaustion ? 'aligned' : 'conflicted'}">
                                <span>Exhaustion</span>
                                <span>${unifiedAnalysis.confluence.exhaustion === null ? '—' : unifiedAnalysis.confluence.exhaustion ? '✓' : '✗'}</span>
                            </div>
                            <div class="confluence-item ${unifiedAnalysis.confluence.sac === null ? 'missing' : unifiedAnalysis.confluence.sac ? 'aligned' : 'conflicted'}">
                                <span>Progressive SAC</span>
                                <span>${unifiedAnalysis.confluence.sac === null ? '—' : unifiedAnalysis.confluence.sac ? '✓' : '✗'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Mini Chart -->
                <div class="chart-container">
                    <canvas id="miniChart-${ticker.replace(/[^a-zA-Z0-9]/g, '_')}" width="300" height="120"></canvas>
                </div>
                
                <!-- Action Buttons -->
                <div class="ticker-actions">
                    <button class="action-btn view-details" onclick="openDetailedView('${ticker}')">
                        <i class="bi bi-graph-up"></i> Detailed Analysis
                    </button>
                    <button class="action-btn analyze" onclick="analyzeTicker('${ticker}')">
                        <i class="bi bi-cpu"></i> AI Analysis
                    </button>
                    <button class="action-btn sac-analysis" onclick="showSACAnalysis('${ticker}')">
                        <i class="bi bi-robot"></i> SAC Insights
                    </button>
                </div>
                
                <div class="timestamp">Last updated: ${tickerData.summary?.lastUpdate || 'N/A'}</div>
            </div>
        `;
        
        // Add the card to the grid
        tickersGrid.appendChild(cardCol);
        
        console.log('Added comprehensive card for ticker:', ticker);
        
        // Create enhanced mini chart
        setTimeout(() => {
            createEnhancedMiniChart(`miniChart-${ticker.replace(/[^a-zA-Z0-9]/g, '_')}`, tickerData);
        }, 100);
    });
    
    console.log('Finished processing all tickers. Total cards in grid:', tickersGrid.children.length);
    
    // Display errors if any
    if (data.errors && Object.keys(data.errors).length > 0) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'col-12 mt-3';
        errorDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Warning:</strong> Some tickers could not be loaded:
                <ul>
                    ${Object.entries(data.errors).map(([ticker, error]) => `<li>${ticker}: ${error}</li>`).join('')}
                </ul>
            </div>
        `;
        tickersGrid.appendChild(errorDiv);
    }
}

function getTickerCategory(ticker) {
    if (ticker.includes('-USD') || ticker.includes('BTC') || ticker.includes('ETH') || ticker.includes('ADA')) {
        return 'crypto';
    } else if (ticker.includes('=X') || ticker.includes('EUR') || ticker.includes('GBP') || ticker.includes('JPY')) {
        return 'forex';
    } else if (ticker.includes('GC=F') || ticker.includes('CL=F') || ticker.includes('SI=F')) {
        return 'commodity';
    } else {
        return 'stock';
    }
}

function createMiniChart(containerId, data) {
    const canvas = document.getElementById(containerId);
    if (!canvas || !data || !data.dates || !data.price) return;
    
    const ctx = canvas.getContext('2d');
    
    // Simple line chart for mini display
    const chartData = {
        labels: data.dates.slice(-30), // Last 30 data points
        datasets: [{
            label: 'Price',
            data: data.price.slice(-30),
            borderColor: data.price[data.price.length - 1] > data.price[data.price.length - 2] ? '#4ade80' : '#f87171',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1
        }]
    };
    
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 }
            }
        }
    };
    
    if (charts[containerId]) {
        charts[containerId].destroy();
    }
    
    charts[containerId] = new Chart(ctx, config);
}

function openDetailedView(ticker) {
    console.log('openDetailedView called for ticker:', ticker);
    
    const data = tickersData?.results?.[ticker];
    if (!data) {
        console.error('No data found for ticker:', ticker);
        showAlert(`No data available for ${ticker}`, 'error');
        return;
    }
    
    console.log('Opening detailed view for:', ticker, 'with data:', data);
    
    // Set modal title
    const modalTitle = document.getElementById('modalTickerTitle');
    if (modalTitle) {
        modalTitle.textContent = `${ticker} - Detailed Analysis`;
    } else {
        console.error('modalTickerTitle element not found');
    }
    
    // Show the modal
    const modal = document.getElementById('detailedViewModal');
    if (modal) {
        modal.style.display = 'block';
        console.log('Modal displayed');
        
        // Add some basic content to the modal
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            // Add ticker summary to modal
            const summaryDiv = document.createElement('div');
            summaryDiv.id = 'modalTickerSummary';
            summaryDiv.innerHTML = `
                <div style="margin: 20px 0; padding: 15px; background: var(--tertiary-bg); border-radius: 8px;">
                    <h4>${ticker} - Summary</h4>
                    <p><strong>Current Price:</strong> $${data.summary?.currentPrice?.toFixed(2) || 'N/A'}</p>
                    <p><strong>Price Change:</strong> ${data.summary?.priceChangePct?.toFixed(2) || 'N/A'}%</p>
                    <p><strong>RSI3M3:</strong> ${data.rsi3m3?.rsi3m3?.[data.rsi3m3.rsi3m3.length - 1]?.toFixed(2) || 'N/A'}</p>
                    <p><strong>RSI3M3 State:</strong> ${getRSI3M3StateLabel(data.rsi3m3?.state?.[data.rsi3m3.state.length - 1])}</p>
                    <p><strong>Data Points:</strong> ${data.dates?.length || 0}</p>
                    <p><strong>Last Update:</strong> ${data.summary?.lastUpdate || 'N/A'}</p>
                </div>
            `;
            
            // Remove existing summary if it exists
            const existingSummary = document.getElementById('modalTickerSummary');
            if (existingSummary) {
                existingSummary.remove();
            }
            
            // Insert summary after the title
            modalTitle.insertAdjacentElement('afterend', summaryDiv);
        }
        
        // Create detailed charts
        createDetailedCharts(ticker, data);
    } else {
        console.error('detailedViewModal element not found');
        showAlert('Modal not available', 'error');
    }
}

function analyzeTicker(ticker) {
    console.log('analyzeTicker called for ticker:', ticker);
    
    const data = tickersData?.results?.[ticker];
    if (!data) {
        console.error('No data found for ticker:', ticker);
        showAlert(`No data available for ${ticker}`, 'error');
        return;
    }
    
    // Perform basic analysis
    const analysis = performBasicAnalysis(ticker, data);
    
    // Show analysis results
    showAlert(`Analysis for ${ticker}: ${analysis}`, 'info');
    
    console.log('Analysis completed for:', ticker, analysis);
}

function getRSI3M3StateLabel(state) {
    switch (state) {
        case 1: return 'Bullish';
        case 2: return 'Bearish'; 
        case 3: return 'Transition';
        default: return 'Neutral';
    }
}

function performBasicAnalysis(ticker, data) {
    const summary = data.summary || {};
    const rsi3m3Data = data.rsi3m3 || {};
    
    const currentPrice = summary.currentPrice || 0;
    const priceChange = summary.priceChangePct || 0;
    const currentRSI3M3 = rsi3m3Data.rsi3m3 ? rsi3m3Data.rsi3m3[rsi3m3Data.rsi3m3.length - 1] : 0;
    const rsi3m3State = rsi3m3Data.state ? rsi3m3Data.state[rsi3m3Data.state.length - 1] : 0;
    
    let analysis = [];
    
    // Price trend analysis
    if (priceChange > 2) {
        analysis.push('Strong upward momentum');
    } else if (priceChange > 0) {
        analysis.push('Positive price movement');
    } else if (priceChange < -2) {
        analysis.push('Strong downward pressure');
    } else if (priceChange < 0) {
        analysis.push('Negative price movement');
    } else {
        analysis.push('Sideways movement');
    }
    
    // RSI3M3 analysis
    if (rsi3m3State === 1) {
        analysis.push('RSI3M3 shows bullish conditions');
    } else if (rsi3m3State === 2) {
        analysis.push('RSI3M3 shows bearish conditions');
    } else if (rsi3m3State === 3) {
        analysis.push('RSI3M3 in transition phase');
    }
    
    // Signal analysis
    const buySignals = summary.buySignals || 0;
    const sellSignals = summary.sellSignals || 0;
    const goldBuySignals = summary.goldBuySignals || 0;
    
    if (goldBuySignals > 0) {
        analysis.push('Gold buy signals detected');
    } else if (buySignals > 0) {
        analysis.push('Buy signals present');
    } else if (sellSignals > 0) {
        analysis.push('Sell signals present');
    }
    
    return analysis.join('. ') || 'No significant signals detected';
}

function createDetailedCharts(ticker, data) {
    console.log('Creating detailed charts for', ticker, data);
    
    // Remove existing detailed content
    const existingDetails = document.getElementById('detailedAnalysisContent');
    if (existingDetails) {
        existingDetails.remove();
    }
    
    const modal = document.getElementById('detailedViewModal');
    const modalContent = modal?.querySelector('.modal-content');
    if (!modalContent) return;
    
    // Extract all oscillator data
    const rsi3m3Data = data.rsi3m3 || {};
    const exhaustionData = data.trendExhaust || {};
    const sacData = data.progressive_sac || {};
    const tickerSummary = data.summary || {};
    
    // Calculate enhanced metrics with new timing functions
    const rsi3m3StateChange = findLastRSI3M3StateChange(rsi3m3Data);
    const rsi3m3Curve = analyzeRSI3M3Curve(rsi3m3Data);
    const analyzerBSignals = findLastAnalyzerBSignals(data);
    const exhaustionVisuals = getExhaustionVisualIndicators(exhaustionData);
    const exhaustionSignals = findLastExhaustionSignals(exhaustionData);
    const exhaustionScore = calculateExhaustionScore(exhaustionData);
    const exhaustionLevel = getExhaustionLevel(exhaustionData);
    
    // NEW: Enhanced analysis components
    const signalTimeline = createSignalTimeline(data);
    const signalPerformance = analyzeSignalPerformance(data);
    const marketContext = analyzeMarketContext(data);
    const signalAlerts = createSignalAlert(ticker, {
        analyzer_b: analyzerBSignals,
        rsi3m3: rsi3m3StateChange,
        exhaustion: exhaustionSignals
    });
    
    // Create comprehensive detailed analysis content
    const detailedDiv = document.createElement('div');
    detailedDiv.id = 'detailedAnalysisContent';
    detailedDiv.innerHTML = `
        <div style="margin: 20px 0;">
            <h4>🎯 Advanced Multi-Oscillator Analysis & Signal Intelligence - ${ticker}</h4>
            
            <!-- Fresh Signal Alerts (if any) -->
            ${signalAlerts.length > 0 ? `
            <div style="background: linear-gradient(135deg, #ff6b6b20 0%, #4ecdc420 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border: 2px solid #FFD700;">
                <h5><i class="bi bi-exclamation-triangle-fill" style="color: #FFD700;"></i> 🚨 FRESH SIGNALS DETECTED!</h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    ${signalAlerts.map(alert => `
                    <div style="background: ${alert.priority === 'Critical' ? '#ff000020' : alert.priority === 'High' ? '#ff950020' : '#4ecdc420'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${alert.priority === 'Critical' ? '#ff0000' : alert.priority === 'High' ? '#ff9500' : '#4ecdc4'};">
                        <div style="font-weight: bold; color: ${alert.priority === 'Critical' ? '#ff0000' : alert.priority === 'High' ? '#ff9500' : '#4ecdc4'};">
                            ${alert.system} - ${alert.type}
                        </div>
                        <div style="color: #ccc; font-size: 0.9em;">
                            ${alert.daysSince} day${alert.daysSince === 1 ? '' : 's'} ago | Strength: ${alert.strength}
                        </div>
                        <div style="color: #FFD700; font-size: 0.8em; margin-top: 5px;">
                            ⚡ FRESH - Act quickly for optimal timing!
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <!-- Market Context & Overview -->
            <div style="background: var(--tertiary-bg); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #2962ff;">
                <h5><i class="bi bi-globe"></i> Market Context & Overview</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h6><i class="bi bi-graph-up-arrow"></i> Price & Volume</h6>
                        <p><strong>Current Price:</strong> $${tickerSummary?.currentPrice?.toFixed(2) || 'N/A'}</p>
                        <p><strong>Price Change:</strong> <span style="color: ${(tickerSummary?.priceChangePct || 0) > 0 ? '#00ff0a' : '#ff1100'};">${tickerSummary?.priceChangePct?.toFixed(2) || 'N/A'}%</span></p>
                        <p><strong>Volume:</strong> ${tickerSummary.volume?.toLocaleString() || 'N/A'}</p>
                        <p><strong>Volume Ratio:</strong> <span style="color: ${parseFloat(marketContext.volumeRatio) > 1.5 ? '#00ff0a' : parseFloat(marketContext.volumeRatio) < 0.8 ? '#ff1100' : '#808080'};">${marketContext.volumeRatio}x</span></p>
                    </div>
                    <div>
                        <h6><i class="bi bi-speedometer2"></i> Market Dynamics</h6>
                        <p><strong>Trend:</strong> <span style="color: ${marketContext.trend.includes('Up') ? '#00ff0a' : marketContext.trend.includes('Down') ? '#ff1100' : '#808080'}; font-weight: bold;">${marketContext.trend}</span></p>
                        <p><strong>Volatility:</strong> <span style="color: ${marketContext.volatility === 'Very High' ? '#ff1100' : marketContext.volatility === 'High' ? '#ff9500' : '#808080'};">${marketContext.volatility} (${marketContext.volatilityValue}%)</span></p>
                        <p><strong>Momentum:</strong> <span style="color: ${marketContext.momentum.includes('Strong') ? '#00ff0a' : marketContext.momentum.includes('Weak') ? '#ff1100' : '#808080'};">${marketContext.momentum} (${marketContext.momentumValue}%)</span></p>
                        <p><strong>Data Points:</strong> ${data.dates?.length || 0} | <strong>Period:</strong> ${data.dates?.length ? `${data.dates[0]} to ${data.dates[data.dates.length - 1]}` : 'N/A'}</p>
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px;">
                    <h6><i class="bi bi-lightbulb"></i> Trading Context</h6>
                    <p style="margin: 0; color: #ccc;">${marketContext.context}</p>
                </div>
            </div>

            <!-- Signal Performance Analysis -->
            <div style="background: var(--tertiary-bg); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #9c27b0;">
                <h5><i class="bi bi-bar-chart-line"></i> Signal Performance Analysis</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                    <div>
                        <h6><i class="bi bi-trophy"></i> Performance Metrics</h6>
                        <p><strong>Overall Performance:</strong> <span style="color: ${signalPerformance.performance === 'Excellent' ? '#00ff0a' : signalPerformance.performance === 'Good' ? '#32CD32' : signalPerformance.performance === 'Fair' ? '#ffff00' : '#ff1100'}; font-weight: bold;">${signalPerformance.performance}</span></p>
                        <p><strong>Average Return:</strong> <span style="color: ${signalPerformance.avgReturn > 0 ? '#00ff0a' : '#ff1100'}; font-weight: bold;">${signalPerformance.avgReturn.toFixed(2)}%</span></p>
                        <p><strong>Win Rate:</strong> <span style="color: ${signalPerformance.winRate > 60 ? '#00ff0a' : signalPerformance.winRate > 40 ? '#ffff00' : '#ff1100'}; font-weight: bold;">${signalPerformance.winRate.toFixed(1)}%</span></p>
                        <p><strong>Signals Analyzed:</strong> ${signalPerformance.signalCount}</p>
                    </div>
                    <div>
                        <h6><i class="bi bi-graph-up"></i> Signal Quality</h6>
                        <p><strong>Best Signal Type:</strong> <span style="color: #FFD700; font-weight: bold;">${signalPerformance.bestSignal}</span></p>
                        <p><strong>Analyzer B Quality:</strong> <span style="color: ${analyzerBSignals.signalQuality === 'Excellent' ? '#00ff0a' : analyzerBSignals.signalQuality === 'Good' ? '#32CD32' : '#808080'}; font-weight: bold;">${analyzerBSignals.signalQuality}</span></p>
                        <p><strong>Signal Frequency:</strong> <span style="color: ${analyzerBSignals.signalFrequency === 'High' ? '#00ff0a' : analyzerBSignals.signalFrequency === 'Medium' ? '#ffff00' : '#808080'};">${analyzerBSignals.signalFrequency}</span></p>
                        <p><strong>Avg Days Between:</strong> ${analyzerBSignals.averageDaysBetweenSignals || 'N/A'} days</p>
                    </div>
                    <div>
                        <h6><i class="bi bi-exclamation-circle"></i> Risk Assessment</h6>
                        <p><strong>Volatility Risk:</strong> <span style="color: ${marketContext.volatility === 'Very High' ? '#ff1100' : marketContext.volatility === 'High' ? '#ff9500' : '#00ff0a'};">${marketContext.volatility}</span></p>
                        <p><strong>Signal Reliability:</strong> <span style="color: ${signalPerformance.winRate > 70 ? '#00ff0a' : signalPerformance.winRate > 50 ? '#ffff00' : '#ff1100'};">${signalPerformance.winRate > 70 ? 'High' : signalPerformance.winRate > 50 ? 'Medium' : 'Low'}</span></p>
                        ${signalPerformance.signalCount >= 5 ? `
                        <div style="margin-top: 10px; padding: 8px; background: #2a2a2a; border-radius: 6px;">
                            <small style="color: #ccc;">
                                <strong>Note:</strong> Based on ${signalPerformance.signalCount} signals with 10-day holding period
                            </small>
                        </div>
                        ` : `
                        <div style="margin-top: 10px; padding: 8px; background: #ff11001a; border-radius: 6px; border: 1px solid #ff110030;">
                            <small style="color: #ff9500;">
                                <strong>Limited Data:</strong> Need more signals for reliable analysis
                            </small>
                        </div>
                        `}
                    </div>
                </div>
            </div>

            <!-- Comprehensive Signal Timeline -->
            <div style="background: var(--tertiary-bg); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #ff6b6b;">
                <h5><i class="bi bi-clock-history"></i> Complete Signal Timeline & History</h5>
                ${signalTimeline.length > 0 ? `
                <div style="margin-bottom: 15px;">
                    <p style="color: #ccc;">Showing the last ${signalTimeline.length} signals across all systems:</p>
                </div>
                <div style="max-height: 400px; overflow-y: auto; border: 1px solid #404040; border-radius: 8px; padding: 15px; background: #1a1a1a;">
                    ${signalTimeline.map((signal, index) => `
                    <div style="display: flex; align-items: center; padding: 12px; margin-bottom: 10px; background: ${signal.color}15; border-left: 4px solid ${signal.color}; border-radius: 6px;">
                        <div style="font-size: 1.5em; margin-right: 15px;">${signal.icon}</div>
                        <div style="flex-grow: 1;">
                            <div style="display: flex; justify-content-between; align-items: center;">
                                <div>
                                    <span style="color: ${signal.color}; font-weight: bold;">${signal.system}</span>
                                    <span style="color: #ccc; margin-left: 10px;">${signal.type}</span>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #ccc; font-size: 0.9em;">${new Date(signal.date).toLocaleDateString()}</div>
                                    <div style="color: ${signal.daysSince <= 3 ? '#FFD700' : signal.daysSince <= 7 ? '#ff9500' : '#808080'}; font-size: 0.8em;">
                                        ${signal.daysSince} day${signal.daysSince === 1 ? '' : 's'} ago
                                        ${signal.daysSince <= 3 ? ' ⚡' : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 5px;">
                                <span style="background: ${signal.color}30; color: ${signal.color}; padding: 2px 8px; border-radius: 12px; font-size: 0.8em;">
                                    Strength: ${signal.strength}
                                </span>
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <small style="color: #808080;">
                        💡 <strong>Fresh signals (≤3 days)</strong> are marked with ⚡ for optimal entry timing
                    </small>
                </div>
                ` : `
                <div style="text-align: center; padding: 40px; color: #808080;">
                    <i class="bi bi-info-circle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                    <p>No recent signals detected across all systems. This may indicate a consolidation phase or that signals are older than the display window.</p>
                </div>
                `}
            </div>

            <!-- Enhanced Analyzer B Section -->
            <div style="background: var(--tertiary-bg); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #00ff0a;">
                <h5><i class="bi bi-activity"></i> Analyzer B (Wave Trend) - Complete Signal Analysis</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                    <div>
                        <h6><i class="bi bi-speedometer2"></i> Current Indicators</h6>
                        <p><strong>WT1:</strong> <span style="color: ${(tickerSummary.currentWT1 || 0) > (tickerSummary.currentWT2 || 0) ? '#00ff0a' : '#ff1100'}; font-weight: bold;">${tickerSummary.currentWT1?.toFixed(2) || 'N/A'}</span></p>
                        <p><strong>WT2:</strong> <span style="color: ${(tickerSummary.currentWT2 || 0) < (tickerSummary.currentWT1 || 0) ? '#00ff0a' : '#ff1100'}; font-weight: bold;">${tickerSummary.currentWT2?.toFixed(2) || 'N/A'}</span></p>
                        <p><strong>Money Flow:</strong> <span style="color: ${(tickerSummary.currentMF || 0) > 0 ? '#00ff0a' : '#ff1100'}; font-weight: bold;">${tickerSummary.currentMF?.toFixed(2) || 'N/A'}</span></p>
                        <p><strong>Current Trend:</strong> <span style="color: ${analyzerBSignals.currentTrend.includes('Bullish') ? '#00ff0a' : analyzerBSignals.currentTrend.includes('Bearish') ? '#ff1100' : '#808080'}; font-weight: bold;">${analyzerBSignals.currentTrend}</span></p>
                    </div>
                    <div>
                        <h6><i class="bi bi-graph-up"></i> Advanced Metrics</h6>
                        <p><strong>Curvature:</strong> <span style="color: ${analyzerBSignals.curvature.includes('Up') ? '#00ff0a' : analyzerBSignals.curvature.includes('Down') ? '#ff1100' : '#808080'}; font-weight: bold;">${analyzerBSignals.curvature}</span></p>
                        <p><strong>Momentum:</strong> <span style="color: ${analyzerBSignals.momentum.includes('Bullish') ? '#00ff0a' : analyzerBSignals.momentum.includes('Bearish') ? '#ff1100' : '#808080'}; font-weight: bold;">${analyzerBSignals.momentum}</span></p>
                        <p><strong>Signal Quality:</strong> <span style="color: ${analyzerBSignals.signalQuality === 'Excellent' ? '#00ff0a' : analyzerBSignals.signalQuality === 'Good' ? '#32CD32' : '#808080'}; font-weight: bold;">${analyzerBSignals.signalQuality}</span></p>
                        <p><strong>Signal Frequency:</strong> <span style="color: ${analyzerBSignals.signalFrequency === 'High' ? '#00ff0a' : '#808080'};">${analyzerBSignals.signalFrequency}</span></p>
                    </div>
                    <div>
                        <h6><i class="bi bi-clock-history"></i> Most Recent Signals</h6>
                        ${analyzerBSignals.mostRecentSignal ? `
                        <p><strong>Last Signal:</strong><br>
                        <span style="color: ${getSignalColor(analyzerBSignals.mostRecentSignalType)}; font-weight: bold;">${analyzerBSignals.mostRecentSignalType}</span><br>
                        <small style="color: ${analyzerBSignals.daysSinceMostRecent <= 5 ? '#FFD700' : '#808080'};">
                            ${new Date(analyzerBSignals.mostRecentSignal).toLocaleDateString()} (${analyzerBSignals.daysSinceMostRecent} days ago)
                        </small></p>
                        <p><strong>Signal Strength:</strong> <span style="color: ${analyzerBSignals.signalStrength === 'Very Strong' ? '#00ff0a' : analyzerBSignals.signalStrength === 'Strong' ? '#32CD32' : '#808080'};">${analyzerBSignals.signalStrength}</span></p>
                        ` : '<p style="color: #808080;">No recent signals detected</p>'}
                        
                        <div style="margin-top: 10px;">
                            <h6 style="font-size: 0.9em;">Signal Counts (Total)</h6>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85em;">
                                <div><strong>Buy:</strong> <span style="color: #00ff0a;">${analyzerBSignals.totalBuySignals}</span></div>
                                <div><strong>Gold Buy:</strong> <span style="color: #FFD700;">${analyzerBSignals.totalGoldBuySignals}</span></div>
                                <div><strong>Sell:</strong> <span style="color: #ff1100;">${analyzerBSignals.totalSellSignals}</span></div>
                                <div><strong>Divergences:</strong> <span style="color: #32CD32;">${analyzerBSignals.totalBullishDivs + analyzerBSignals.totalBearishDivs}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Continue with other sections... -->
            <!-- RSI3M3+ Enhanced Section -->
            <div style="background: var(--tertiary-bg); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #ff6b6b;">
                <h5><i class="bi bi-speedometer2"></i> RSI3M3+ - Precision Timing & State Analysis</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                    <div>
                        <h6><i class="bi bi-info-circle"></i> Current State</h6>
                        <p><strong>RSI3M3 Value:</strong> <span style="font-weight: bold; color: ${getRSI3M3StateInfo(rsi3m3Data.state?.[rsi3m3Data.state.length - 1], 0).color};">${rsi3m3Data.rsi3m3?.[rsi3m3Data.rsi3m3.length - 1]?.toFixed(2) || 'N/A'}</span></p>
                        <p><strong>State:</strong> <span style="color: ${getRSI3M3StateInfo(rsi3m3Data.state?.[rsi3m3Data.state.length - 1], 0).color}; font-weight: bold;">${getRSI3M3StateLabel(rsi3m3Data.state?.[rsi3m3Data.state.length - 1])}</span></p>
                        <p><strong>Signal Strength:</strong> <span style="color: ${rsi3m3StateChange.signalStrength === 'Strong' ? '#00ff0a' : rsi3m3StateChange.signalStrength === 'Moderate' ? '#ffff00' : '#808080'}; font-weight: bold;">${rsi3m3StateChange.signalStrength}</span></p>
                        <p><strong>Trend Duration:</strong> <span style="color: ${rsi3m3StateChange.trendDuration >= 5 ? '#00ff0a' : '#808080'};">${rsi3m3StateChange.trendDuration} periods</span></p>
                    </div>
                    <div>
                        <h6><i class="bi bi-graph-up"></i> Advanced Analysis</h6>
                        <p><strong>Trend:</strong> <span style="color: ${rsi3m3Curve.trend === 'Rising' ? '#00ff0a' : rsi3m3Curve.trend === 'Falling' ? '#ff1100' : '#808080'}; font-weight: bold;">${rsi3m3Curve.trend}</span></p>
                        <p><strong>Curvature:</strong> <span style="color: ${rsi3m3Curve.curvature === 'Accelerating' ? '#00ff0a' : rsi3m3Curve.curvature === 'Decelerating' ? '#ff1100' : '#808080'}; font-weight: bold;">${rsi3m3Curve.curvature}</span></p>
                        <p><strong>Momentum:</strong> <span style="color: ${rsi3m3Curve.momentum === 'Strong' ? '#00ff0a' : rsi3m3Curve.momentum === 'Weak' ? '#ff1100' : '#808080'}; font-weight: bold;">${rsi3m3Curve.momentum}</span></p>
                        <p><strong>Volatility:</strong> <span style="color: ${rsi3m3Curve.volatility === 'High' ? '#ff9500' : rsi3m3Curve.volatility === 'Low' ? '#00ff0a' : '#808080'}; font-weight: bold;">${rsi3m3Curve.volatility}</span></p>
                    </div>
                    <div style="background: ${getRSI3M3StateInfo(rsi3m3Data.state?.[rsi3m3Data.state.length - 1], 0).color}20; padding: 15px; border-radius: 8px;">
                        <h6><i class="bi bi-clock-history"></i> Critical Timing</h6>
                        ${rsi3m3StateChange.lastChange ? `
                        <p><strong>Last Change:</strong><br>
                        <span style="color: ${getRSI3M3StateInfo(rsi3m3Data.state?.[rsi3m3Data.state.length - 1], 0).color}; font-weight: bold;">${new Date(rsi3m3StateChange.lastChange).toLocaleDateString()}</span></p>
                        <p><strong>Days Since:</strong> <span style="color: ${rsi3m3StateChange.daysSinceChange <= 3 ? '#FFD700' : '#808080'}; font-weight: bold;">${rsi3m3StateChange.daysSinceChange} days</span></p>
                        <p><strong>Entry Type:</strong> <span style="color: ${getRSI3M3StateInfo(rsi3m3Data.state?.[rsi3m3Data.state.length - 1], 0).color}; font-weight: bold;">${rsi3m3StateChange.changeType}</span></p>
                        ${rsi3m3StateChange.daysSinceChange <= 3 ? 
                            '<p style="color: #FFD700; font-weight: bold;"><i class="bi bi-lightning-fill"></i> FRESH SIGNAL - Optimal Entry Window!</p>' : 
                            '<p style="color: #808080;">Signal aging - consider waiting for fresh transition</p>'
                        }
                        <p><strong>Signal Valid:</strong> <span style="color: ${rsi3m3StateChange.isValidSignal ? '#00ff0a' : '#ff1100'};">${rsi3m3StateChange.isValidSignal ? 'Yes' : 'No'}</span></p>
                        ` : '<p style="color: #808080;">No recent state changes detected</p>'}
                        
                        <div style="margin-top: 10px; padding: 8px; background: #1a1a1a; border-radius: 4px;">
                            <small style="color: #ccc;">
                                <strong>🎯 Trading Tip:</strong> Enter positions within 3 days of state changes for optimal timing
                            </small>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Exhaustion Enhanced Detailed Section -->
            <div style="background: var(--tertiary-bg); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #ff9500;">
                <h5><i class="bi bi-exclamation-triangle"></i> Exhaustion Analysis - TrendExhaust Oscillator with Enhanced Signal Dating</h5>
                ${Object.keys(exhaustionData).length > 0 ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                    <div>
                        <h6><i class="bi bi-speedometer2"></i> Exhaustion Metrics</h6>
                        <p><strong>Exhaustion Score:</strong> <span style="color: ${getExhaustionState(exhaustionScore, exhaustionLevel, exhaustionData).color}; font-weight: bold;">${exhaustionScore.toFixed(1)}/100</span></p>
                        <p><strong>Exhaustion Level:</strong> <span style="color: ${getExhaustionState(exhaustionScore, exhaustionLevel, exhaustionData).color}; font-weight: bold;">${exhaustionLevel}</span></p>
                        <p><strong>Current Williams %R:</strong> <span style="font-weight: bold;">${exhaustionData.avgPercentR?.[exhaustionData.avgPercentR.length - 1]?.toFixed(2) || 'N/A'}</span></p>
                        <p><strong>Severity:</strong> <span style="color: ${exhaustionSignals.severity === 'Extreme' ? '#ff0000' : exhaustionSignals.severity === 'High' ? '#ff9500' : '#808080'}; font-weight: bold;">${exhaustionSignals.severity}</span></p>
                        <p><strong>Signal Count:</strong> <span style="color: ${exhaustionSignals.signalCount > 5 ? '#00ff0a' : '#808080'};">${exhaustionSignals.signalCount} total</span></p>
                        <p><strong>Signal Frequency:</strong> <span style="color: ${exhaustionSignals.signalFrequency === 'High' ? '#00ff0a' : '#808080'};">${exhaustionSignals.signalFrequency}</span></p>
                    </div>
                    <div>
                        <h6><i class="bi bi-diagram-3"></i> Visual Indicators (PineScript Style)</h6>
                        <p><strong>Exhaustion Zones (■):</strong> <span class="exhaustion-zone" style="color: orange; font-weight: bold;">${exhaustionVisuals.rectangles} rectangles</span></p>
                        <p><strong>Reversal Signals (▲):</strong> <span class="reversal-signal" style="color: red; font-weight: bold;">${exhaustionVisuals.triangles} triangles</span></p>
                        <div style="margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 6px;">
                            <small style="color: #ccc;">
                                <strong>■ Rectangles:</strong> Exhaustion zones (overbought/oversold)<br>
                                <strong>▲ Triangles:</strong> Expected reversal points<br>
                                <strong>Signal Strength:</strong> ${exhaustionSignals.signalStrength || 'N/A'}
                            </small>
                        </div>
                    </div>
                    <div>
                        <h6><i class="bi bi-clock-history"></i> Enhanced Signal Dating & Types</h6>
                        ${exhaustionSignals.mostRecentSignal ? `
                        <p><strong>Most Recent Signal:</strong><br>
                        <span style="color: #ff9500; font-weight: bold;">${exhaustionSignals.mostRecentSignalType}</span></p>
                        <p><strong>Signal Date:</strong><br>
                        <span style="color: ${exhaustionSignals.daysSinceLastSignal <= 5 ? '#FFD700' : '#808080'}; font-weight: bold;">
                            ${new Date(exhaustionSignals.mostRecentSignal).toLocaleDateString()}
                        </span><br>
                        <small style="color: ${exhaustionSignals.daysSinceLastSignal <= 5 ? '#FFD700' : '#808080'};">
                            (${exhaustionSignals.daysSinceLastSignal} days ago)
                        </small></p>
                        <p><strong>Signal Strength:</strong> <span style="color: ${exhaustionSignals.signalStrength === 'Extreme' ? '#ff0000' : exhaustionSignals.signalStrength === 'Strong' ? '#ff9500' : '#808080'};">${exhaustionSignals.signalStrength}</span></p>
                        
                        ${exhaustionSignals.lastOverboughtSignal ? `
                        <p><strong>Last Overbought:</strong><br>
                        <small style="color: #ff4444;">${new Date(exhaustionSignals.lastOverboughtSignal).toLocaleDateString()}</small></p>
                        ` : ''}
                        ${exhaustionSignals.lastOversoldSignal ? `
                        <p><strong>Last Oversold:</strong><br>
                        <small style="color: #44ff44;">${new Date(exhaustionSignals.lastOversoldSignal).toLocaleDateString()}</small></p>
                        ` : ''}
                        ` : '<p style="color: #808080;">No recent exhaustion signals detected</p>'}
                    </div>
                </div>
                ${exhaustionSignals.recentSignals && exhaustionSignals.recentSignals.length > 0 ? `
                <div style="margin-top: 15px;">
                    <h6><i class="bi bi-list-ul"></i> Recent Signals History (Last 10)</h6>
                    <div style="max-height: 200px; overflow-y: auto; background: #1a1a1a; padding: 10px; border-radius: 6px;">
                        ${exhaustionSignals.recentSignals.slice(0, 10).map(signal => 
                            `<div style="background: ${getExhaustionSignalColor(signal.type)}20; color: ${getExhaustionSignalColor(signal.type)}; padding: 5px 10px; margin-bottom: 5px; border-radius: 15px; font-size: 0.85em; border: 1px solid ${getExhaustionSignalColor(signal.type)}50;">
                                ${getExhaustionSignalIcon(signal.type)} ${signal.type} - ${new Date(signal.date).toLocaleDateString()} (${signal.daysSince}d ago) - ${signal.strength}
                            </div>`
                        ).join('')}
                    </div>
                </div>
                ` : ''}
                ` : `
                <div style="text-align: center; padding: 40px; color: #808080;">
                    <i class="bi bi-info-circle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                    <p>Exhaustion data not available yet. This will show comprehensive timing analysis once the TrendExhaust system is connected to the API.</p>
                </div>
                `}
            </div>

            <!-- Progressive SAC Enhanced Detailed Section -->
            <div style="background: var(--tertiary-bg); padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #9c27b0;">
                <h5><i class="bi bi-robot"></i> Progressive SAC - AI-Driven Trading Intelligence</h5>
                ${Object.keys(sacData).length > 0 ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                    <div>
                        <h6><i class="bi bi-cpu"></i> SAC Predictions</h6>
                        <p><strong>Prediction:</strong> <span style="color: ${getSACState(sacData.prediction, sacData.confidence, sacData).color}; font-weight: bold;">${sacData.prediction || 'Neutral'}</span></p>
                        <p><strong>Confidence:</strong> <span style="color: ${getSACState(sacData.prediction, sacData.confidence, sacData).color}; font-weight: bold;">${((sacData.confidence || 0) * 100).toFixed(1)}%</span></p>
                        <p><strong>Recommendation:</strong> <span style="color: ${getSACState(sacData.prediction, sacData.confidence, sacData).color}; font-weight: bold;">${sacData.recommendation || 'Hold'}</span></p>
                        <p><strong>Model State:</strong> <span style="color: #808080;">${sacData.model_state || 'Learning'}</span></p>
                    </div>
                    <div>
                        <h6><i class="bi bi-calculator"></i> Position Sizing & Risk</h6>
                        <p><strong>Suggested Position:</strong> <span style="font-weight: bold;">${((sacData.position_size || 0) * 100).toFixed(1)}%</span></p>
                        <p><strong>Risk Level:</strong> <span style="color: ${(sacData.confidence || 0) > 0.7 ? '#00ff0a' : (sacData.confidence || 0) > 0.5 ? '#ffff00' : '#ff1100'};">${(sacData.confidence || 0) > 0.7 ? 'Low' : (sacData.confidence || 0) > 0.5 ? 'Medium' : 'High'}</span></p>
                        <p><strong>Expected Return:</strong> <span style="color: ${(sacData.expected_return || 0) > 0 ? '#00ff0a' : '#ff1100'};">${((sacData.expected_return || 0) * 100).toFixed(2)}%</span></p>
                        <p><strong>Sharpe Ratio:</strong> <span style="color: ${(sacData.sharpe_ratio || 0) > 1 ? '#00ff0a' : (sacData.sharpe_ratio || 0) > 0.5 ? '#ffff00' : '#ff1100'};">${(sacData.sharpe_ratio || 0).toFixed(2)}</span></p>
                    </div>
                    <div>
                        <h6><i class="bi bi-graph-up"></i> AI Model Insights</h6>
                        <p><strong>Market Regime:</strong> <span style="font-weight: bold;">${sacData.detected_regime || 'Unknown'}</span></p>
                        <p><strong>Volatility Forecast:</strong> <span style="color: ${(sacData.volatility_forecast || 0) > 0.3 ? '#ff1100' : (sacData.volatility_forecast || 0) > 0.2 ? '#ff9500' : '#00ff0a'};">${((sacData.volatility_forecast || 0) * 100).toFixed(1)}%</span></p>
                        <p><strong>Trend Strength:</strong> <span style="color: ${Math.abs(sacData.trend_strength || 0) > 0.7 ? '#00ff0a' : Math.abs(sacData.trend_strength || 0) > 0.3 ? '#ffff00' : '#808080'};">${(sacData.trend_strength || 0).toFixed(2)}</span></p>
                        <div style="margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 6px;">
                            <small style="color: #ccc;">
                                <strong>Progressive SAC:</strong> Uses reinforcement learning to adapt to changing market conditions and optimize risk-adjusted returns.
                            </small>
                        </div>
                    </div>
                </div>
                ` : `
                <div style="text-align: center; padding: 40px; color: #808080;">
                    <i class="bi bi-info-circle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
                    <p>Progressive SAC data not available yet. This will show AI-driven predictions and optimal position sizing once the system is trained and connected.</p>
                    <div style="margin-top: 20px; padding: 15px; background: #2a2a2a; border-radius: 8px;">
                        <h6><i class="bi bi-gear"></i> System Status</h6>
                        <p style="color: #ff9500; margin: 0;">Progressive SAC requires market data training before providing predictions. Check back after the system has processed sufficient historical data.</p>
                    </div>
                </div>
                `}
            </div>

            <!-- Continue with remaining sections... -->
            
            <!-- Unified Analysis Summary -->
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border: 2px solid #4a90e2;">
                <h5><i class="bi bi-lightbulb"></i> AI-Enhanced Unified Analysis Summary</h5>
                <div style="margin-top: 15px;">
                    ${(() => {
                        const unifiedAnalysis = calculateUnifiedAnalysis(data);
                        return `
                        <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center;">
                            <div>
                                <p style="font-size: 1.1em; margin-bottom: 10px;">${unifiedAnalysis.summary}</p>
                                <div style="margin-bottom: 15px; padding: 15px; background: #2a2a2a; border-radius: 8px;">
                                    <h6><i class="bi bi-robot"></i> Trading Recommendation</h6>
                                    <p style="margin: 0; color: #ccc;">
                                        ${generateTradingRecommendation(unifiedAnalysis, signalPerformance, marketContext, signalAlerts)}
                                    </p>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                                    ${Object.entries(unifiedAnalysis.confluence).map(([system, aligned]) => {
                                        let systemName = system.replace('_', ' ').toUpperCase();
                                        let color = aligned === null ? '#808080' : aligned ? '#00ff0a' : '#ff1100';
                                        let icon = aligned === null ? '—' : aligned ? '✓' : '✗';
                                        return `<span style="background: ${color}20; color: ${color}; padding: 5px 12px; border-radius: 15px; font-size: 0.9em; border: 1px solid ${color}50;">${systemName} ${icon}</span>`;
                                    }).join('')}
                                </div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 2.5em; font-weight: bold; color: ${determineOverallSignal(
                                    getAnalyzerBState(tickerSummary.currentWT1, tickerSummary.currentWT2, tickerSummary.currentMF, tickerSummary.buySignals, tickerSummary.sellSignals, tickerSummary.goldBuySignals),
                                    getRSI3M3StateInfo(rsi3m3Data.state?.[rsi3m3Data.state.length - 1], 0),
                                    getExhaustionState(exhaustionScore, exhaustionLevel, exhaustionData),
                                    getSACState(sacData.prediction, sacData.confidence, sacData)
                                ).color};">${unifiedAnalysis.score}</div>
                                <div style="color: #ccc; font-size: 0.9em;">Unified Score</div>
                                <div style="color: #FFD700; font-size: 0.8em; margin-top: 5px;">
                                    ${signalAlerts.length > 0 ? '⚡ Fresh Signals!' : 'No Fresh Signals'}
                                </div>
                            </div>
                        </div>
                        `;
                    })()}
                </div>
            </div>
        </div>
    `;
    
    // Find where to insert the detailed content (after the summary)
    const summary = document.getElementById('modalTickerSummary');
    if (summary) {
        summary.insertAdjacentElement('afterend', detailedDiv);
    } else {
        modalContent.appendChild(detailedDiv);
    }
}

// Generate AI-enhanced trading recommendation
function generateTradingRecommendation(unifiedAnalysis, signalPerformance, marketContext, signalAlerts) {
    let recommendation = "";
    
    // Check for fresh signals first
    if (signalAlerts.length > 0) {
        const highPriorityAlerts = signalAlerts.filter(alert => alert.priority === 'High' || alert.priority === 'Critical');
        if (highPriorityAlerts.length > 0) {
            recommendation += "🚨 IMMEDIATE ACTION: Fresh high-priority signals detected. ";
        } else {
            recommendation += "⚡ FRESH SIGNALS: New signals within optimal entry window. ";
        }
    }
    
    // Main recommendation based on unified score and performance
    if (unifiedAnalysis.score >= 80 && signalPerformance.performance !== 'Poor') {
        recommendation += "Strong BUY recommendation. High confluence across systems. ";
    } else if (unifiedAnalysis.score >= 60) {
        recommendation += "Moderate BUY. Good system alignment. ";
    } else if (unifiedAnalysis.score <= 20) {
        recommendation += "AVOID or consider SHORT. Bearish confluence. ";
    } else {
        recommendation += "NEUTRAL. Mixed signals - wait for clarity. ";
    }
    
    // Add context-based modifiers
    if (marketContext.volatility === 'Very High') {
        recommendation += "⚠️ Reduce position size due to extreme volatility. ";
    }
    
    if (signalPerformance.winRate < 40 && signalPerformance.signalCount >= 5) {
        recommendation += "⚠️ Historical signal performance is poor - proceed with caution. ";
    }
    
    if (marketContext.volume === 'Very High') {
        recommendation += "✅ Strong volume confirms price action. ";
    }
    
    // Add timing recommendation
    if (signalAlerts.length > 0) {
        recommendation += `🕒 Optimal entry window: Next 1-2 days.`;
    } else {
        recommendation += "🕒 No immediate entry urgency - monitor for fresh signals.";
    }
    
    return recommendation;
}

// === COMPREHENSIVE OSCILLATOR ANALYSIS FUNCTIONS ===

function calculateUnifiedAnalysis(tickerData) {
    const summary = tickerData.summary || {};
    const rsi3m3Data = tickerData.rsi3m3 || {};
    const exhaustionData = tickerData.trendExhaust || {};
    const sacData = tickerData.progressive_sac || {};
    
    // Analyzer B score (0-25 points)
    let analyzerBScore = 0;
    const wt1 = summary.currentWT1 || 0;
    const wt2 = summary.currentWT2 || 0;
    const mf = summary.currentMF || 0;
    const buySignals = summary.buySignals || 0;
    const goldBuySignals = summary.goldBuySignals || 0;
    const sellSignals = summary.sellSignals || 0;
    
    if (goldBuySignals > 0) analyzerBScore += 25;
    else if (buySignals > 0) analyzerBScore += 20;
    else if (wt1 > wt2 && mf > 0) analyzerBScore += 15;
    else if (sellSignals > 0) analyzerBScore -= 10;
    
    // RSI3M3+ score (0-25 points)
    let rsi3m3Score = 0;
    const rsi3m3State = rsi3m3Data.state ? rsi3m3Data.state[rsi3m3Data.state.length - 1] : 0;
    const rsi3m3Value = rsi3m3Data.rsi3m3 ? rsi3m3Data.rsi3m3[rsi3m3Data.rsi3m3.length - 1] : 50;
    
    switch (rsi3m3State) {
        case 1: rsi3m3Score = 25; break; // Bullish
        case 2: rsi3m3Score = 0; break;  // Bearish
        case 3: rsi3m3Score = 12; break; // Transition
        default: rsi3m3Score = 10; break; // Neutral
    }
    
    // Exhaustion score (0-25 points) - only if data exists
    let exhaustionScore = 12; // Default neutral score
    if (exhaustionData && Object.keys(exhaustionData).length > 0) {
        const exhaustionLevel = getExhaustionLevel(exhaustionData);
        const exhaustionScoreValue = calculateExhaustionScore(exhaustionData);
        
        if (exhaustionLevel === 'Low' && exhaustionScoreValue < 30) exhaustionScore = 25;
        else if (exhaustionLevel === 'Normal') exhaustionScore = 15;
        else if (exhaustionLevel === 'High') exhaustionScore = 5;
        else if (exhaustionLevel === 'Critical') exhaustionScore = 0;
        else exhaustionScore = 10;
    }
    
    // Progressive SAC score (0-25 points) - only if data exists
    let sacScore = 12; // Default neutral score
    if (sacData && Object.keys(sacData).length > 0) {
        const sacPrediction = sacData.prediction || 'Neutral';
        const sacConfidence = sacData.confidence || 0;
        
        if (sacPrediction === 'Bullish' && sacConfidence > 0.7) sacScore = 25;
        else if (sacPrediction === 'Bullish' && sacConfidence > 0.5) sacScore = 20;
        else if (sacPrediction === 'Bearish' && sacConfidence > 0.7) sacScore = 0;
        else if (sacPrediction === 'Bearish' && sacConfidence > 0.5) sacScore = 5;
        else sacScore = 12;
    }
    
    const totalScore = Math.max(0, Math.min(100, analyzerBScore + rsi3m3Score + exhaustionScore + sacScore));
    
    // Generate summary based on available data
    let summaryText = '';
    const availableSystems = [];
    if (goldBuySignals > 0 || buySignals > 0 || sellSignals > 0) availableSystems.push('Analyzer B');
    if (rsi3m3Data && Object.keys(rsi3m3Data).length > 0) availableSystems.push('RSI3M3+');
    if (exhaustionData && Object.keys(exhaustionData).length > 0) availableSystems.push('Exhaustion');
    if (sacData && Object.keys(sacData).length > 0) availableSystems.push('Progressive SAC');
    
    if (totalScore >= 80) {
        summaryText = `Strong bullish confluence across ${availableSystems.length} systems. High probability setup.`;
    } else if (totalScore >= 60) {
        summaryText = `Moderate bullish signals with good confluence. Consider position.`;
    } else if (totalScore >= 40) {
        summaryText = `Mixed signals across systems. Wait for better clarity.`;
    } else if (totalScore >= 20) {
        summaryText = `Bearish bias with some conflicting signals. Caution advised.`;
    } else {
        summaryText = `Strong bearish signals across multiple systems. Avoid or short.`;
    }
    
    // Add info about available systems
    if (availableSystems.length < 4) {
        summaryText += ` (${availableSystems.length}/4 systems active)`;
    }
    
    // Calculate confluence based on available data
    const confluence = {
        analyzer_b: (goldBuySignals > 0 || buySignals > 0 || (wt1 > wt2 && mf > 0)),
        rsi3m3: rsi3m3State === 1,
        exhaustion: exhaustionData && Object.keys(exhaustionData).length > 0 ? 
                   (getExhaustionLevel(exhaustionData) === 'Low') : null,
        sac: sacData && Object.keys(sacData).length > 0 ? 
             (sacData.prediction === 'Bullish' && sacData.confidence > 0.5) : null
    };
    
    return {
        score: Math.round(totalScore),
        summary: summaryText,
        confluence: confluence,
        activeSystems: availableSystems
    };
}

function getAnalyzerBState(wt1, wt2, mf, buySignals, sellSignals, goldBuySignals) {
    if (goldBuySignals > 0) {
        return { color: '#FFD700', label: 'Gold Buy' };
    } else if (buySignals > 0) {
        return { color: '#00ff0a', label: 'Buy Signal' };
    } else if (sellSignals > 0) {
        return { color: '#ff1100', label: 'Sell Signal' };
    } else if (wt1 > wt2 && mf > 0) {
        return { color: '#32CD32', label: 'Bullish Trend' };
    } else if (wt1 < wt2 && mf < 0) {
        return { color: '#FF6347', label: 'Bearish Trend' };
    } else {
        return { color: '#808080', label: 'Neutral' };
    }
}

function getRSI3M3StateInfo(state, value) {
    switch (state) {
        case 1:
            return { color: '#00ff0a', label: 'Bullish' };
        case 2:
            return { color: '#ff1100', label: 'Bearish' };
        case 3:
            return { color: '#ffff00', label: 'Transition' };
        default:
            return { color: '#808080', label: 'Neutral' };
    }
}

function getExhaustionState(score, level, data) {
    if (!data || Object.keys(data).length === 0) {
        return { color: '#808080', label: 'No Data' };
    }
    
    switch (level) {
        case 'Low':
            return { color: '#00ff0a', label: 'Low Exhaustion' };
        case 'High':
            return { color: '#ff1100', label: 'High Exhaustion' };
        case 'Critical':
            return { color: '#ff0066', label: 'Critical Exhaustion' };
        default:
            return { color: '#32CD32', label: 'Normal' };
    }
}

function getSACState(prediction, confidence, data) {
    if (!data || Object.keys(data).length === 0) {
        return { color: '#808080', label: 'No Data' };
    }
    
    if (prediction === 'Bullish' && confidence > 0.7) {
        return { color: '#00ff0a', label: 'Strong Buy' };
    } else if (prediction === 'Bullish' && confidence > 0.5) {
        return { color: '#32CD32', label: 'Buy' };
    } else if (prediction === 'Bearish' && confidence > 0.7) {
        return { color: '#ff1100', label: 'Strong Sell' };
    } else if (prediction === 'Bearish' && confidence > 0.5) {
        return { color: '#FF6347', label: 'Sell' };
    } else {
        return { color: '#808080', label: 'Neutral' };
    }
}

function determineOverallSignal(analyzerB, rsi3m3, exhaustion, sac) {
    const signals = [analyzerB, rsi3m3, exhaustion, sac];
    const bullishCount = signals.filter(s => s.color === '#00ff0a' || s.color === '#32CD32' || s.color === '#FFD700').length;
    const bearishCount = signals.filter(s => s.color === '#ff1100' || s.color === '#FF6347' || s.color === '#ff0066').length;
    
    if (bullishCount >= 3) {
        return { color: '#00ff0a', label: 'Strong Buy' };
    } else if (bullishCount >= 2) {
        return { color: '#32CD32', label: 'Buy' };
    } else if (bearishCount >= 3) {
        return { color: '#ff1100', label: 'Strong Sell' };
    } else if (bearishCount >= 2) {
        return { color: '#FF6347', label: 'Sell' };
    } else {
        return { color: '#808080', label: 'Neutral' };
    }
}

function getTagClass(tickerType) {
    switch (tickerType) {
        case 'crypto': return 'tag-crypto';
        case 'forex': return 'tag-forex';
        case 'commodity': return 'tag-commodity';
        default: return 'tag-stock';
    }
}

function getTagLabel(tickerType) {
    switch (tickerType) {
        case 'crypto': return 'Crypto';
        case 'forex': return 'Forex';
        case 'commodity': return 'Commodity';
        default: return 'Stock';
    }
}

function createEnhancedMiniChart(containerId, data) {
    const canvas = document.getElementById(containerId);
    if (!canvas || !data || !data.dates || !data.price) return;
    
    const ctx = canvas.getContext('2d');
    
    // Enhanced chart with multiple indicators
    const chartData = {
        labels: data.dates.slice(-30),
        datasets: [
            {
                label: 'Price',
                data: data.price.slice(-30),
                borderColor: data.price[data.price.length - 1] > data.price[data.price.length - 2] ? '#4ade80' : '#f87171',
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1
            },
            {
                label: 'RSI3M3',
                data: data.rsi3m3?.rsi3m3?.slice(-30) || [],
                borderColor: '#ff6b6b',
                backgroundColor: 'transparent',
                borderWidth: 1,
                pointRadius: 0,
                yAxisID: 'y1',
                hidden: true
            }
        ]
    };
    
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: { display: false },
                y1: { display: false, min: 0, max: 100 }
            },
            elements: {
                point: { radius: 0 }
            }
        }
    };
    
    if (charts[containerId]) {
        charts[containerId].destroy();
    }
    
    charts[containerId] = new Chart(ctx, config);
}

function showSACAnalysis(ticker) {
    console.log('showSACAnalysis called for ticker:', ticker);
    
    const data = tickersData?.results?.[ticker];
    if (!data) {
        showAlert(`No data available for ${ticker}`, 'error');
        return;
    }
    
    const sacData = data.progressive_sac || {};
    const prediction = sacData.prediction || 'Neutral';
    const confidence = (sacData.confidence || 0) * 100;
    const recommendation = sacData.recommendation || 'Hold';
    const positionSize = (sacData.position_size || 0) * 100;
    
    const analysisText = `
        Progressive SAC Analysis for ${ticker}:
        
        Prediction: ${prediction}
        Confidence: ${confidence.toFixed(1)}%
        Recommendation: ${recommendation}
        Suggested Position Size: ${positionSize.toFixed(1)}%
        
        The Progressive SAC model uses reinforcement learning to analyze market patterns and predict optimal trading decisions based on your historical data and current market conditions.
    `;
    
    showAlert(analysisText, 'info');
}

// === RSI3M3 STATE CHANGE DETECTION ===
function findLastRSI3M3StateChange(rsi3m3Data) {
    if (!rsi3m3Data || !rsi3m3Data.state || !rsi3m3Data.dates) {
        return { 
            lastChange: null, 
            daysSinceChange: null, 
            changeType: 'Unknown',
            currentState: 0,
            previousState: 0,
            signalStrength: 'None',
            trendDuration: 0
        };
    }
    
    const states = rsi3m3Data.state;
    const dates = rsi3m3Data.dates;
    const rsiValues = rsi3m3Data.rsi3m3 || [];
    const currentDate = new Date();
    
    // Find the last state change
    let lastChangeIndex = -1;
    let currentState = states[states.length - 1];
    let previousState = currentState;
    
    // Look backwards to find when state changed
    for (let i = states.length - 2; i >= 0; i--) {
        if (states[i] !== currentState) {
            lastChangeIndex = i + 1; // The index where change occurred
            previousState = states[i];
            break;
        }
    }
    
    // Calculate trend duration (how long in current state)
    let trendDuration = 0;
    if (lastChangeIndex > -1) {
        trendDuration = states.length - lastChangeIndex;
    } else {
        trendDuration = states.length; // Been in same state for entire dataset
    }
    
    // Determine signal strength based on RSI value and trend duration
    let signalStrength = 'Weak';
    if (rsiValues.length > 0) {
        const currentRSI = rsiValues[rsiValues.length - 1];
        if (currentState === 1 && currentRSI > 60 && trendDuration >= 3) signalStrength = 'Strong';
        else if (currentState === 1 && currentRSI > 50) signalStrength = 'Moderate';
        else if (currentState === 2 && currentRSI < 40 && trendDuration >= 3) signalStrength = 'Strong';
        else if (currentState === 2 && currentRSI < 50) signalStrength = 'Moderate';
        else if (currentState === 3) signalStrength = 'Transition';
    }
    
    const lastChangeDate = lastChangeIndex > -1 ? dates[lastChangeIndex] : dates[0];
    const changeDate = new Date(lastChangeDate);
    const daysSinceChange = Math.floor((currentDate - changeDate) / (1000 * 60 * 60 * 24));
    
    // Enhanced change type determination
    let changeType = 'Neutral';
    if (currentState === 1 && previousState !== 1) changeType = 'Bullish Entry';
    else if (currentState === 2 && previousState !== 2) changeType = 'Bearish Entry';
    else if (currentState === 3) changeType = 'Transition Phase';
    else if (currentState === 0) changeType = 'Neutral Zone';
    
    return {
        lastChange: lastChangeDate,
        daysSinceChange: daysSinceChange,
        changeType: changeType,
        currentState: currentState,
        previousState: previousState,
        signalStrength: signalStrength,
        trendDuration: trendDuration,
        isValidSignal: trendDuration >= 2 && signalStrength !== 'Weak'
    };
}

// === EXHAUSTION VISUAL INDICATORS ===
function getExhaustionVisualIndicators(trendExhaustData) {
    if (!trendExhaustData || Object.keys(trendExhaustData).length === 0) {
        return { rectangles: 0, triangles: 0, signals: [] };
    }
    
    const signals = trendExhaustData.signals || {};
    let rectangles = 0; // Exhaustion zones
    let triangles = 0;  // Reversal signals
    let signalsList = [];
    
    // Count exhaustion zones (rectangles) - when price is in overbought/oversold territory
    if (trendExhaustData.avgPercentR) {
        const recentValues = trendExhaustData.avgPercentR.slice(-10);
        const exhaustedCount = recentValues.filter(val => val <= -80 || val >= -20).length;
        rectangles = exhaustedCount;
    }
    
    // Count reversal signals (triangles)
    if (signals.obReversal) {
        triangles += signals.obReversal.length;
        signalsList.push(...signals.obReversal.map(s => ({ type: 'Overbought Reversal', value: s })));
    }
    if (signals.osReversal) {
        triangles += signals.osReversal.length;
        signalsList.push(...signals.osReversal.map(s => ({ type: 'Oversold Reversal', value: s })));
    }
    if (signals.bullCross) {
        triangles += signals.bullCross.length;
        signalsList.push(...signals.bullCross.map(s => ({ type: 'Bullish Cross', value: s })));
    }
    if (signals.bearCross) {
        triangles += signals.bearCross.length;
        signalsList.push(...signals.bearCross.map(s => ({ type: 'Bearish Cross', value: s })));
    }
    
    return { rectangles, triangles, signals: signalsList };
}

// === ENHANCED TIMING AND SIGNAL DETECTION FUNCTIONS ===

// Find last Analyzer B signal dates
function findLastAnalyzerBSignals(tickerData) {
    const dates = tickerData.dates || [];
    const summary = tickerData.summary || {};
    
    // Use actual signal data from API if available
    const buySignalIndices = tickerData.buySignals || [];
    const goldBuySignalIndices = tickerData.goldBuySignals || [];
    const sellSignalIndices = tickerData.sellSignals || [];
    const fastMoneySellIndices = tickerData.fastMoneySellSignals || [];
    const bullishDivIndices = tickerData.bullishDivergenceSignals || [];
    const bearishDivIndices = tickerData.bearishDivergenceSignals || [];
    
    const wt1 = tickerData.WT1 || [];
    const wt2 = tickerData.WT2 || [];
    const mf = tickerData.moneyFlow || [];
    
    const currentDate = new Date();
    
    // Enhanced signal structure
    let signals = {
        // Basic signal info
        lastBuySignal: null,
        lastGoldBuySignal: null,
        lastSellSignal: null,
        lastFastMoneySellSignal: null,
        lastBullishDivergence: null,
        lastBearishDivergence: null,
        
        // Days since signals
        daysSinceLastBuy: null,
        daysSinceLastGoldBuy: null,
        daysSinceLastSell: null,
        daysSinceLastFastSell: null,
        daysSinceLastBullDiv: null,
        daysSinceLastBearDiv: null,
        
        // Signal counts
        totalBuySignals: buySignalIndices.length,
        totalGoldBuySignals: goldBuySignalIndices.length,
        totalSellSignals: sellSignalIndices.length,
        totalBullishDivs: bullishDivIndices.length,
        totalBearishDivs: bearishDivIndices.length,
        
        // Current state analysis
        currentTrend: 'Neutral',
        curvature: 'Flat',
        momentum: 'Normal',
        signalQuality: 'Unknown',
        
        // Most recent signal info
        mostRecentSignal: null,
        mostRecentSignalType: 'None',
        daysSinceMostRecent: null,
        signalStrength: 'None',
        
        // Signal frequency analysis
        signalFrequency: 'Low',
        averageDaysBetweenSignals: null,
        
        // All recent signals (last 30 days)
        recentSignals: []
    };
    
    if (dates.length === 0) return signals;
    
    // Function to get signal date and calculate days since
    const getSignalInfo = (signalIndices, signalType) => {
        if (signalIndices.length === 0) return null;
        
        const lastIndex = signalIndices[signalIndices.length - 1];
        if (lastIndex >= 0 && lastIndex < dates.length) {
            const signalDate = new Date(dates[lastIndex]);
            const daysSince = Math.floor((currentDate - signalDate) / (1000 * 60 * 60 * 24));
            return {
                date: dates[lastIndex],
                daysSince: daysSince,
                index: lastIndex,
                type: signalType,
                strength: calculateSignalStrength(signalType, lastIndex, wt1, wt2, mf)
            };
        }
        return null;
    };
    
    // Get all signal types
    const buyInfo = getSignalInfo(buySignalIndices, 'Buy');
    const goldBuyInfo = getSignalInfo(goldBuySignalIndices, 'Gold Buy');
    const sellInfo = getSignalInfo(sellSignalIndices, 'Sell');
    const fastSellInfo = getSignalInfo(fastMoneySellIndices, 'Fast Money Sell');
    const bullDivInfo = getSignalInfo(bullishDivIndices, 'Bullish Divergence');
    const bearDivInfo = getSignalInfo(bearishDivIndices, 'Bearish Divergence');
    
    // Populate signal data
    if (buyInfo) {
        signals.lastBuySignal = buyInfo.date;
        signals.daysSinceLastBuy = buyInfo.daysSince;
    }
    if (goldBuyInfo) {
        signals.lastGoldBuySignal = goldBuyInfo.date;
        signals.daysSinceLastGoldBuy = goldBuyInfo.daysSince;
    }
    if (sellInfo) {
        signals.lastSellSignal = sellInfo.date;
        signals.daysSinceLastSell = sellInfo.daysSince;
    }
    if (fastSellInfo) {
        signals.lastFastMoneySellSignal = fastSellInfo.date;
        signals.daysSinceLastFastSell = fastSellInfo.daysSince;
    }
    if (bullDivInfo) {
        signals.lastBullishDivergence = bullDivInfo.date;
        signals.daysSinceLastBullDiv = bullDivInfo.daysSince;
    }
    if (bearDivInfo) {
        signals.lastBearishDivergence = bearDivInfo.date;
        signals.daysSinceLastBearDiv = bearDivInfo.daysSince;
    }
    
    // Find most recent signal of any type
    const allSignals = [buyInfo, goldBuyInfo, sellInfo, fastSellInfo, bullDivInfo, bearDivInfo]
        .filter(sig => sig !== null)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (allSignals.length > 0) {
        const mostRecent = allSignals[0];
        signals.mostRecentSignal = mostRecent.date;
        signals.mostRecentSignalType = mostRecent.type;
        signals.daysSinceMostRecent = mostRecent.daysSince;
        signals.signalStrength = mostRecent.strength;
    }
    
    // Collect recent signals (last 30 days)
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    signals.recentSignals = allSignals.filter(sig => new Date(sig.date) >= thirtyDaysAgo);
    
    // Calculate signal frequency
    if (allSignals.length >= 2) {
        const timeSpan = new Date(allSignals[0].date) - new Date(allSignals[allSignals.length - 1].date);
        const daySpan = timeSpan / (1000 * 60 * 60 * 24);
        signals.averageDaysBetweenSignals = Math.round(daySpan / (allSignals.length - 1));
        
        if (signals.averageDaysBetweenSignals <= 5) signals.signalFrequency = 'Very High';
        else if (signals.averageDaysBetweenSignals <= 10) signals.signalFrequency = 'High';
        else if (signals.averageDaysBetweenSignals <= 20) signals.signalFrequency = 'Medium';
        else if (signals.averageDaysBetweenSignals <= 40) signals.signalFrequency = 'Low';
        else signals.signalFrequency = 'Very Low';
    }
    
    // Enhanced current state analysis using actual data
    if (wt1.length >= 3 && wt2.length >= 3) {
        const currentWT1 = wt1[wt1.length - 1];
        const currentWT2 = wt2[wt2.length - 1];
        const currentMF = mf.length > 0 ? mf[mf.length - 1] : 0;
        
        // Trend analysis
        if (currentWT1 > currentWT2 + 2 && currentMF > 0) signals.currentTrend = 'Strong Bullish';
        else if (currentWT1 > currentWT2 && currentMF > 0) signals.currentTrend = 'Bullish';
        else if (currentWT1 < currentWT2 - 2 && currentMF < 0) signals.currentTrend = 'Strong Bearish';
        else if (currentWT1 < currentWT2 && currentMF < 0) signals.currentTrend = 'Bearish';
        else signals.currentTrend = 'Neutral';
        
        // Curvature analysis (acceleration/deceleration)
        const wt1_slope1 = wt1[wt1.length - 1] - wt1[wt1.length - 2];
        const wt1_slope2 = wt1[wt1.length - 2] - wt1[wt1.length - 3];
        const curvatureValue = wt1_slope1 - wt1_slope2;
        
        if (curvatureValue > 1) signals.curvature = 'Strong Acceleration Up';
        else if (curvatureValue > 0.3) signals.curvature = 'Accelerating Up';
        else if (curvatureValue < -1) signals.curvature = 'Strong Acceleration Down';
        else if (curvatureValue < -0.3) signals.curvature = 'Accelerating Down';
        else if (wt1_slope1 > 0.5) signals.curvature = 'Rising';
        else if (wt1_slope1 < -0.5) signals.curvature = 'Falling';
        else signals.curvature = 'Flat';
        
        // Momentum analysis
        const recentWT1 = wt1.slice(-10);
        const avgWT1 = recentWT1.reduce((a, b) => a + b, 0) / recentWT1.length;
        const momentum = currentWT1 - avgWT1;
        
        if (momentum > 5) signals.momentum = 'Very Strong Bullish';
        else if (momentum > 2) signals.momentum = 'Strong Bullish';
        else if (momentum > 0.5) signals.momentum = 'Moderate Bullish';
        else if (momentum < -5) signals.momentum = 'Very Strong Bearish';
        else if (momentum < -2) signals.momentum = 'Strong Bearish';
        else if (momentum < -0.5) signals.momentum = 'Moderate Bearish';
        else signals.momentum = 'Normal';
    }
    
    // Overall signal quality assessment
    let qualityScore = 0;
    if (signals.mostRecentSignal) {
        if (signals.daysSinceMostRecent <= 3) qualityScore += 3;
        else if (signals.daysSinceMostRecent <= 7) qualityScore += 2;
        else if (signals.daysSinceMostRecent <= 14) qualityScore += 1;
        
        if (signals.mostRecentSignalType === 'Gold Buy') qualityScore += 3;
        else if (signals.mostRecentSignalType === 'Buy') qualityScore += 2;
        else if (signals.mostRecentSignalType.includes('Divergence')) qualityScore += 2;
        
        if (signals.signalFrequency === 'Medium' || signals.signalFrequency === 'High') qualityScore += 1;
    }
    
    if (qualityScore >= 6) signals.signalQuality = 'Excellent';
    else if (qualityScore >= 4) signals.signalQuality = 'Good';
    else if (qualityScore >= 2) signals.signalQuality = 'Fair';
    else if (qualityScore >= 1) signals.signalQuality = 'Poor';
    else signals.signalQuality = 'None';
    
    return signals;
}

// Calculate signal strength based on context
function calculateSignalStrength(signalType, index, wt1, wt2, mf) {
    if (!wt1 || !wt2 || index >= wt1.length) return 'Unknown';
    
    const currentWT1 = wt1[index];
    const currentWT2 = wt2[index];
    const currentMF = mf && mf[index] ? mf[index] : 0;
    
    let strength = 1; // Base strength
    
    // Signal type multipliers
    if (signalType === 'Gold Buy') strength *= 2;
    else if (signalType.includes('Divergence')) strength *= 1.5;
    
    // WT1/WT2 relationship
    const wtDiff = Math.abs(currentWT1 - currentWT2);
    if (wtDiff > 5) strength *= 1.5;
    else if (wtDiff > 2) strength *= 1.2;
    
    // Money Flow confirmation
    if (signalType.includes('Buy') && currentMF > 0) strength *= 1.3;
    else if (signalType.includes('Sell') && currentMF < 0) strength *= 1.3;
    
    // Position in cycle (oversold/overbought)
    if (signalType.includes('Buy') && currentWT1 < -50) strength *= 1.4;
    else if (signalType.includes('Sell') && currentWT1 > 50) strength *= 1.4;
    
    if (strength >= 3) return 'Very Strong';
    else if (strength >= 2.2) return 'Strong';
    else if (strength >= 1.5) return 'Moderate';
    else return 'Weak';
}

// Enhanced exhaustion signal detection with proper date mapping
function findLastExhaustionSignals(exhaustionData) {
    if (!exhaustionData || Object.keys(exhaustionData).length === 0) {
        return {
            lastOverboughtSignal: null,
            lastOversoldSignal: null,
            lastReversalSignal: null,
            lastCrossoverSignal: null,
            daysSinceLastSignal: null,
            exhaustionType: 'None',
            severity: 'Normal',
            signalCount: 0,
            signalFrequency: 'None',
            recentSignals: [],
            signalStrength: 'None'
        };
    }
    
    const signals = exhaustionData.signals || {};
    const avgPercentR = exhaustionData.avgPercentR || [];
    const dates = exhaustionData.dates || [];
    const currentDate = new Date();
    
    let result = {
        lastOverboughtSignal: null,
        lastOversoldSignal: null,
        lastReversalSignal: null,
        lastCrossoverSignal: null,
        daysSinceLastSignal: null,
        exhaustionType: 'None',
        severity: 'Normal',
        signalCount: 0,
        signalFrequency: 'None',
        recentSignals: [],
        signalStrength: 'None',
        mostRecentSignal: null,
        mostRecentSignalType: 'None'
    };
    
    // Collect all signals with proper date mapping
    let allSignals = [];
    
    // Overbought reversal signals
    if (signals.obReversal && signals.obReversal.length > 0) {
        signals.obReversal.forEach(index => {
            if (dates[index]) {
                const signalDate = new Date(dates[index]);
                const daysSince = Math.floor((currentDate - signalDate) / (1000 * 60 * 60 * 24));
                allSignals.push({
                    date: dates[index],
                    daysSince: daysSince,
                    type: 'Overbought Reversal',
                    index: index,
                    strength: calculateExhaustionStrength('overbought', index, avgPercentR)
                });
            }
        });
    }
    
    // Oversold reversal signals
    if (signals.osReversal && signals.osReversal.length > 0) {
        signals.osReversal.forEach(index => {
            if (dates[index]) {
                const signalDate = new Date(dates[index]);
                const daysSince = Math.floor((currentDate - signalDate) / (1000 * 60 * 60 * 24));
                allSignals.push({
                    date: dates[index],
                    daysSince: daysSince,
                    type: 'Oversold Reversal',
                    index: index,
                    strength: calculateExhaustionStrength('oversold', index, avgPercentR)
                });
            }
        });
    }
    
    // Bullish crossover signals
    if (signals.bullCross && signals.bullCross.length > 0) {
        signals.bullCross.forEach(index => {
            if (dates[index]) {
                const signalDate = new Date(dates[index]);
                const daysSince = Math.floor((currentDate - signalDate) / (1000 * 60 * 60 * 24));
                allSignals.push({
                    date: dates[index],
                    daysSince: daysSince,
                    type: 'Bullish Crossover',
                    index: index,
                    strength: calculateExhaustionStrength('bullish_cross', index, avgPercentR)
                });
            }
        });
    }
    
    // Bearish crossover signals
    if (signals.bearCross && signals.bearCross.length > 0) {
        signals.bearCross.forEach(index => {
            if (dates[index]) {
                const signalDate = new Date(dates[index]);
                const daysSince = Math.floor((currentDate - signalDate) / (1000 * 60 * 60 * 24));
                allSignals.push({
                    date: dates[index],
                    daysSince: daysSince,
                    type: 'Bearish Crossover',
                    index: index,
                    strength: calculateExhaustionStrength('bearish_cross', index, avgPercentR)
                });
            }
        });
    }
    
    // Sort signals by date (most recent first)
    allSignals.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Update result with signal information
    result.signalCount = allSignals.length;
    result.recentSignals = allSignals.slice(0, 10); // Last 10 signals
    
    if (allSignals.length > 0) {
        const mostRecent = allSignals[0];
        result.mostRecentSignal = mostRecent.date;
        result.mostRecentSignalType = mostRecent.type;
        result.daysSinceLastSignal = mostRecent.daysSince;
        result.signalStrength = mostRecent.strength;
        result.exhaustionType = mostRecent.type;
        
        // Set specific signal dates
        const obSignals = allSignals.filter(s => s.type === 'Overbought Reversal');
        const osSignals = allSignals.filter(s => s.type === 'Oversold Reversal');
        const bullCrossSignals = allSignals.filter(s => s.type === 'Bullish Crossover');
        const bearCrossSignals = allSignals.filter(s => s.type === 'Bearish Crossover');
        
        if (obSignals.length > 0) result.lastOverboughtSignal = obSignals[0].date;
        if (osSignals.length > 0) result.lastOversoldSignal = osSignals[0].date;
        if (bullCrossSignals.length > 0) result.lastCrossoverSignal = bullCrossSignals[0].date;
        if (bearCrossSignals.length > 0 && !result.lastCrossoverSignal) result.lastCrossoverSignal = bearCrossSignals[0].date;
    }
    
    // Calculate signal frequency
    if (allSignals.length >= 2) {
        const timeSpan = new Date(allSignals[0].date) - new Date(allSignals[allSignals.length - 1].date);
        const daySpan = timeSpan / (1000 * 60 * 60 * 24);
        const avgDaysBetween = daySpan / (allSignals.length - 1);
        
        if (avgDaysBetween <= 7) result.signalFrequency = 'Very High';
        else if (avgDaysBetween <= 14) result.signalFrequency = 'High';
        else if (avgDaysBetween <= 30) result.signalFrequency = 'Medium';
        else if (avgDaysBetween <= 60) result.signalFrequency = 'Low';
        else result.signalFrequency = 'Very Low';
    }
    
    // Determine severity based on current exhaustion level
    if (avgPercentR.length > 0) {
        const current = avgPercentR[avgPercentR.length - 1];
        if (current <= -95 || current >= -5) result.severity = 'Extreme';
        else if (current <= -90 || current >= -10) result.severity = 'Critical';
        else if (current <= -80 || current >= -20) result.severity = 'High';
        else if (current <= -70 || current >= -30) result.severity = 'Moderate';
        else result.severity = 'Normal';
    }
    
    return result;
}

// Calculate exhaustion signal strength
function calculateExhaustionStrength(signalType, index, avgPercentR) {
    if (!avgPercentR || index >= avgPercentR.length) return 'Unknown';
    
    const value = avgPercentR[index];
    let strength = 1;
    
    // Base strength from Williams %R value
    if (signalType === 'overbought' && value >= -10) strength += 2;
    else if (signalType === 'overbought' && value >= -20) strength += 1;
    else if (signalType === 'oversold' && value <= -90) strength += 2;
    else if (signalType === 'oversold' && value <= -80) strength += 1;
    
    // Additional strength for extreme readings
    if (value <= -95 || value >= -5) strength += 1;
    
    if (strength >= 3.5) return 'Extreme';
    else if (strength >= 2.5) return 'Strong';
    else if (strength >= 1.5) return 'Moderate';
    else return 'Weak';
}

// === ENHANCED SIGNAL HISTORY AND VISUALIZATION ===

// Create comprehensive signal timeline for detailed view with enhanced debugging
function createSignalTimeline(tickerData) {
    console.log('=== Creating Signal Timeline ===');
    console.log('Input tickerData keys:', Object.keys(tickerData));
    
    const analyzerBSignals = findLastAnalyzerBSignals(tickerData);
    const rsi3m3StateChange = findLastRSI3M3StateChange(tickerData.rsi3m3 || {});
    const exhaustionSignals = findLastExhaustionSignals(tickerData.trendExhaust || {});
    
    console.log('Signal detection results:');
    console.log('- Analyzer B signals:', analyzerBSignals);
    console.log('- RSI3M3 state change:', rsi3m3StateChange);
    console.log('- Exhaustion signals:', exhaustionSignals);
    
    // Combine all signals into timeline
    let timelineSignals = [];
    
    // Add Analyzer B signals
    if (analyzerBSignals.recentSignals && analyzerBSignals.recentSignals.length > 0) {
        analyzerBSignals.recentSignals.forEach(signal => {
            timelineSignals.push({
                date: signal.date,
                type: signal.type,
                system: 'Analyzer B',
                strength: signal.strength,
                daysSince: signal.daysSince,
                color: getSignalColor(signal.type),
                icon: getSignalIcon(signal.type)
            });
        });
        console.log('Added', analyzerBSignals.recentSignals.length, 'Analyzer B signals');
    } else {
        console.log('No Analyzer B signals found');
    }
    
    // Add RSI3M3 state change
    if (rsi3m3StateChange.lastChange) {
        timelineSignals.push({
            date: rsi3m3StateChange.lastChange,
            type: rsi3m3StateChange.changeType,
            system: 'RSI3M3+',
            strength: rsi3m3StateChange.signalStrength,
            daysSince: rsi3m3StateChange.daysSinceChange,
            color: getRSI3M3StateInfo(rsi3m3StateChange.currentState, 0).color,
            icon: getRSI3M3Icon(rsi3m3StateChange.currentState)
        });
        console.log('Added RSI3M3 state change signal');
    } else {
        console.log('No RSI3M3 state change found');
    }
    
    // Add Exhaustion signals
    if (exhaustionSignals.recentSignals && exhaustionSignals.recentSignals.length > 0) {
        exhaustionSignals.recentSignals.forEach(signal => {
            timelineSignals.push({
                date: signal.date,
                type: signal.type,
                system: 'Exhaustion',
                strength: signal.strength,
                daysSince: signal.daysSince,
                color: getExhaustionSignalColor(signal.type),
                icon: getExhaustionSignalIcon(signal.type)
            });
        });
        console.log('Added', exhaustionSignals.recentSignals.length, 'Exhaustion signals');
    } else {
        console.log('No Exhaustion signals found');
    }
    
    // Sort by date (most recent first)
    timelineSignals.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log('Total timeline signals created:', timelineSignals.length);
    console.log('Timeline signals:', timelineSignals);
    
    // If we have very few signals, extend the search to all available data
    if (timelineSignals.length < 5) {
        console.log('Few signals found, attempting to create synthetic timeline from available data...');
        
        // Try to extract more signal information from raw data
        const dates = tickerData.dates || [];
        const prices = tickerData.price || [];
        const volumes = tickerData.volume || [];
        
        if (dates.length > 20 && prices.length > 20) {
            // Look for significant price movements as proxy signals
            for (let i = 10; i < Math.min(dates.length, prices.length) && timelineSignals.length < 10; i++) {
                const currentPrice = prices[i];
                const prevPrice = prices[i - 1];
                const priceChange = (currentPrice - prevPrice) / prevPrice * 100;
                
                // Significant price movements (>3% or <-3%)
                if (Math.abs(priceChange) > 3) {
                    const signalDate = dates[i];
                    const daysSince = Math.floor((new Date() - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                    
                    timelineSignals.push({
                        date: signalDate,
                        type: priceChange > 0 ? 'Price Breakout' : 'Price Breakdown',
                        system: 'Price Action',
                        strength: Math.abs(priceChange) > 5 ? 'Strong' : 'Moderate',
                        daysSince: daysSince,
                        color: priceChange > 0 ? '#00ff0a' : '#ff1100',
                        icon: priceChange > 0 ? '⬆️' : '⬇️'
                    });
                }
            }
            
            // Re-sort after adding synthetic signals
            timelineSignals.sort((a, b) => new Date(b.date) - new Date(a.date));
            console.log('Added synthetic signals from price action. Total:', timelineSignals.length);
        }
    }
    
    const finalSignals = timelineSignals.slice(0, 20); // Last 20 signals
    console.log('Final timeline signals to return:', finalSignals.length);
    return finalSignals;
}

// Signal color mapping
function getSignalColor(signalType) {
    const colorMap = {
        'Gold Buy': '#FFD700',
        'Buy': '#00ff0a',
        'Sell': '#ff1100',
        'Fast Money Sell': '#ff0066',
        'Bullish Divergence': '#32CD32',
        'Bearish Divergence': '#FF6347'
    };
    return colorMap[signalType] || '#808080';
}

// Signal icon mapping
function getSignalIcon(signalType) {
    const iconMap = {
        'Gold Buy': '⭐',
        'Buy': '📈',
        'Sell': '📉',
        'Fast Money Sell': '⚡',
        'Bullish Divergence': '↗️',
        'Bearish Divergence': '↘️'
    };
    return iconMap[signalType] || '●';
}

// RSI3M3 icon mapping
function getRSI3M3Icon(state) {
    switch (state) {
        case 1: return '🟢';
        case 2: return '🔴';
        case 3: return '🟡';
        default: return '⚪';
    }
}

// Exhaustion signal colors
function getExhaustionSignalColor(signalType) {
    const colorMap = {
        'Overbought Reversal': '#ff4444',
        'Oversold Reversal': '#44ff44',
        'Bullish Crossover': '#00ff88',
        'Bearish Crossover': '#ff8800'
    };
    return colorMap[signalType] || '#808080';
}

// Exhaustion signal icons
function getExhaustionSignalIcon(signalType) {
    const iconMap = {
        'Overbought Reversal': '🔻',
        'Oversold Reversal': '🔺',
        'Bullish Crossover': '✅',
        'Bearish Crossover': '❌'
    };
    return iconMap[signalType] || '●';
}

// Enhanced signal performance analysis
function analyzeSignalPerformance(tickerData) {
    const prices = tickerData.price || [];
    const dates = tickerData.dates || [];
    const analyzerBSignals = findLastAnalyzerBSignals(tickerData);
    
    if (prices.length === 0 || dates.length === 0) {
        return {
            avgReturn: 0,
            winRate: 0,
            bestSignal: 'None',
            signalCount: 0,
            performance: 'No Data'
        };
    }
    
    let signalPerformance = [];
    
    // Analyze buy signal performance
    const allBuySignals = [
        ...(tickerData.buySignals || []),
        ...(tickerData.goldBuySignals || [])
    ].sort((a, b) => a - b);
    
    allBuySignals.forEach((signalIndex, i) => {
        if (signalIndex < prices.length - 10) { // Need at least 10 days after signal
            const entryPrice = prices[signalIndex];
            const exitIndex = Math.min(signalIndex + 10, prices.length - 1); // 10-day holding period
            const exitPrice = prices[exitIndex];
            const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;
            
            signalPerformance.push({
                type: (tickerData.goldBuySignals || []).includes(signalIndex) ? 'Gold Buy' : 'Buy',
                return: returnPct,
                entryDate: dates[signalIndex],
                entryPrice: entryPrice,
                exitPrice: exitPrice
            });
        }
    });
    
    if (signalPerformance.length === 0) {
        return {
            avgReturn: 0,
            winRate: 0,
            bestSignal: 'None',
            signalCount: 0,
            performance: 'Insufficient Data'
        };
    }
    
    const avgReturn = signalPerformance.reduce((sum, perf) => sum + perf.return, 0) / signalPerformance.length;
    const winningSignals = signalPerformance.filter(perf => perf.return > 0);
    const winRate = (winningSignals.length / signalPerformance.length) * 100;
    
    const bestSignal = signalPerformance.reduce((best, current) => 
        current.return > best.return ? current : best
    );
    
    let performance = 'Poor';
    if (avgReturn > 5 && winRate > 70) performance = 'Excellent';
    else if (avgReturn > 3 && winRate > 60) performance = 'Good';
    else if (avgReturn > 1 && winRate > 50) performance = 'Fair';
    else if (avgReturn > 0) performance = 'Weak';
    
    return {
        avgReturn: avgReturn,
        winRate: winRate,
        bestSignal: bestSignal.type,
        signalCount: signalPerformance.length,
        performance: performance,
        recentSignals: signalPerformance.slice(-5)
    };
}

// Create enhanced signal alerts system
function createSignalAlert(ticker, signalData) {
    const freshSignals = [];
    
    // Check for fresh signals (≤ 2 days old)
    if (signalData.analyzer_b && signalData.analyzer_b.daysSinceMostRecent !== null && signalData.analyzer_b.daysSinceMostRecent <= 2) {
        freshSignals.push({
            system: 'Analyzer B',
            type: signalData.analyzer_b.mostRecentSignalType,
            daysSince: signalData.analyzer_b.daysSinceMostRecent,
            strength: signalData.analyzer_b.signalStrength,
            priority: signalData.analyzer_b.mostRecentSignalType === 'Gold Buy' ? 'High' : 'Medium'
        });
    }
    
    if (signalData.rsi3m3 && signalData.rsi3m3.daysSinceChange !== null && signalData.rsi3m3.daysSinceChange <= 2) {
        freshSignals.push({
            system: 'RSI3M3+',
            type: signalData.rsi3m3.changeType,
            daysSince: signalData.rsi3m3.daysSinceChange,
            strength: signalData.rsi3m3.signalStrength,
            priority: signalData.rsi3m3.signalStrength === 'Strong' ? 'High' : 'Medium'
        });
    }
    
    if (signalData.exhaustion && signalData.exhaustion.daysSinceLastSignal !== null && signalData.exhaustion.daysSinceLastSignal <= 2) {
        freshSignals.push({
            system: 'Exhaustion',
            type: signalData.exhaustion.mostRecentSignalType,
            daysSince: signalData.exhaustion.daysSinceLastSignal,
            strength: signalData.exhaustion.signalStrength,
            priority: signalData.exhaustion.signalStrength === 'Extreme' ? 'Critical' : 'Medium'
        });
    }
    
    return freshSignals;
}

// Enhanced market context analysis
function analyzeMarketContext(tickerData) {
    const prices = tickerData.price || [];
    const volumes = tickerData.volume || [];
    const dates = tickerData.dates || [];
    
    if (prices.length < 20) {
        return {
            trend: 'Unknown',
            volatility: 'Unknown',
            volume: 'Unknown',
            momentum: 'Unknown',
            context: 'Insufficient data for market context analysis'
        };
    }
    
    const recent20 = prices.slice(-20);
    const recent5 = prices.slice(-5);
    const recentVolumes = volumes.slice(-20);
    
    // Trend analysis
    const sma20 = recent20.reduce((a, b) => a + b, 0) / 20;
    const sma5 = recent5.reduce((a, b) => a + b, 0) / 5;
    const currentPrice = prices[prices.length - 1];
    
    let trend = 'Neutral';
    if (currentPrice > sma5 && sma5 > sma20) trend = 'Strong Uptrend';
    else if (currentPrice > sma20) trend = 'Uptrend';
    else if (currentPrice < sma5 && sma5 < sma20) trend = 'Strong Downtrend';
    else if (currentPrice < sma20) trend = 'Downtrend';
    
    // Volatility analysis
    const returns = [];
    for (let i = 1; i < recent20.length; i++) {
        returns.push((recent20[i] - recent20[i-1]) / recent20[i-1]);
    }
    const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length) * Math.sqrt(252) * 100;
    
    let volatilityLevel = 'Low';
    if (volatility > 40) volatilityLevel = 'Very High';
    else if (volatility > 25) volatilityLevel = 'High';
    else if (volatility > 15) volatilityLevel = 'Medium';
    
    // Volume analysis
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeRatio = currentVolume / avgVolume;
    
    let volumeLevel = 'Normal';
    if (volumeRatio > 2) volumeLevel = 'Very High';
    else if (volumeRatio > 1.5) volumeLevel = 'High';
    else if (volumeRatio < 0.5) volumeLevel = 'Low';
    
    // Momentum analysis
    const momentum = (currentPrice - sma20) / sma20 * 100;
    let momentumLevel = 'Neutral';
    if (momentum > 10) momentumLevel = 'Very Strong';
    else if (momentum > 5) momentumLevel = 'Strong';
    else if (momentum > 2) momentumLevel = 'Moderate';
    else if (momentum < -10) momentumLevel = 'Very Weak';
    else if (momentum < -5) momentumLevel = 'Weak';
    
    // Generate context summary
    let context = `${trend} market with ${volatilityLevel.toLowerCase()} volatility. `;
    context += `Volume is ${volumeLevel.toLowerCase()} and momentum is ${momentumLevel.toLowerCase()}. `;
    
    if (volatilityLevel === 'Very High') {
        context += 'Use smaller position sizes due to high volatility. ';
    }
    if (volumeLevel === 'High' || volumeLevel === 'Very High') {
        context += 'Strong volume confirms price movement. ';
    }
    if (trend.includes('Strong') && momentumLevel.includes('Strong')) {
        context += 'Strong trending conditions favor momentum strategies. ';
    }
    
    return {
        trend: trend,
        volatility: volatilityLevel,
        volume: volumeLevel,
        momentum: momentumLevel,
        context: context,
        volatilityValue: volatility.toFixed(1),
        volumeRatio: volumeRatio.toFixed(2),
        momentumValue: momentum.toFixed(2)
    };
}

// Enhanced RSI3M3 curve and trend analysis
function analyzeRSI3M3Curve(rsi3m3Data) {
    const values = rsi3m3Data.rsi3m3 || [];
    const states = rsi3m3Data.state || [];
    const dates = rsi3m3Data.dates || [];
    
    let analysis = {
        trend: 'Neutral',
        curvature: 'Flat',
        momentum: 'Normal',
        volatility: 'Low',
        cyclicality: 'Normal',
        divergence: 'None'
    };
    
    if (values.length < 5) return analysis;
    
    const recent = values.slice(-10);
    const recentStates = states.slice(-10);
    
    // Trend analysis
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (avgSecond > avgFirst + 5) analysis.trend = 'Rising';
    else if (avgSecond < avgFirst - 5) analysis.trend = 'Falling';
    else analysis.trend = 'Sideways';
    
    // Curvature (acceleration/deceleration)
    if (recent.length >= 3) {
        const slopes = [];
        for (let i = 1; i < recent.length - 1; i++) {
            slopes.push(recent[i + 1] - recent[i]);
        }
        
        if (slopes.length >= 2) {
            const curvatureChange = slopes[slopes.length - 1] - slopes[slopes.length - 2];
            if (curvatureChange > 2) analysis.curvature = 'Accelerating';
            else if (curvatureChange < -2) analysis.curvature = 'Decelerating';
            else analysis.curvature = 'Steady';
        }
    }
    
    // Momentum
    const current = recent[recent.length - 1];
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (current > avg + 10) analysis.momentum = 'Strong';
    else if (current > avg + 3) analysis.momentum = 'Moderate';
    else if (current < avg - 10) analysis.momentum = 'Weak';
    else analysis.momentum = 'Normal';
    
    // Volatility
    const variance = recent.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 15) analysis.volatility = 'High';
    else if (stdDev > 8) analysis.volatility = 'Medium';
    else analysis.volatility = 'Low';
    
    return analysis;
}

// Enhanced Analyzer B signal detection using actual API signal data
function findLastAnalyzerBSignals(tickerData) {
    const dates = tickerData.dates || [];
    const summary = tickerData.summary || {};
    
    // DEBUG: Log the actual structure to see what's available
    console.log('findLastAnalyzerBSignals - tickerData keys:', Object.keys(tickerData));
    console.log('findLastAnalyzerBSignals - summary:', summary);
    
    // Try different possible property names for signal data
    const buySignalIndices = tickerData.buySignals || tickerData.buy_signals || summary.buySignals || [];
    const goldBuySignalIndices = tickerData.goldBuySignals || tickerData.gold_buy_signals || summary.goldBuySignals || [];
    const sellSignalIndices = tickerData.sellSignals || tickerData.sell_signals || summary.sellSignals || [];
    const fastMoneySellIndices = tickerData.fastMoneySellSignals || tickerData.fast_money_sell_signals || summary.fastMoneySellSignals || [];
    const bullishDivIndices = tickerData.bullishDivergenceSignals || tickerData.bullish_divergence_signals || summary.bullishDivergenceSignals || [];
    const bearishDivIndices = tickerData.bearishDivergenceSignals || tickerData.bearish_divergence_signals || summary.bearishDivergenceSignals || [];
    
    // DEBUG: Log what we found
    console.log('Signal indices found:', {
        buySignals: buySignalIndices,
        goldBuySignals: goldBuySignalIndices,
        sellSignals: sellSignalIndices,
        bullishDiv: bullishDivIndices,
        bearishDiv: bearishDivIndices
    });
    
    // If we have summary data with signal counts but no indices, try to find signals by analyzing the oscillator data
    if (buySignalIndices.length === 0 && goldBuySignalIndices.length === 0 && sellSignalIndices.length === 0) {
        console.log('No signal indices found, attempting to detect from oscillator data...');
        return findSignalsFromOscillatorData(tickerData);
    }
    
    const wt1 = tickerData.WT1 || tickerData.wt1 || [];
    const wt2 = tickerData.WT2 || tickerData.wt2 || [];
    const mf = tickerData.moneyFlow || tickerData.money_flow || [];
    
    const currentDate = new Date();
    
    // Enhanced signal structure
    let signals = {
        // Basic signal info
        lastBuySignal: null,
        lastGoldBuySignal: null,
        lastSellSignal: null,
        lastFastMoneySellSignal: null,
        lastBullishDivergence: null,
        lastBearishDivergence: null,
        
        // Days since signals
        daysSinceLastBuy: null,
        daysSinceLastGoldBuy: null,
        daysSinceLastSell: null,
        daysSinceLastFastSell: null,
        daysSinceLastBullDiv: null,
        daysSinceLastBearDiv: null,
        
        // Signal counts
        totalBuySignals: buySignalIndices.length,
        totalGoldBuySignals: goldBuySignalIndices.length,
        totalSellSignals: sellSignalIndices.length,
        totalBullishDivs: bullishDivIndices.length,
        totalBearishDivs: bearishDivIndices.length,
        
        // Current state analysis
        currentTrend: 'Neutral',
        curvature: 'Flat',
        momentum: 'Normal',
        signalQuality: 'Unknown',
        
        // Most recent signal info
        mostRecentSignal: null,
        mostRecentSignalType: 'None',
        daysSinceMostRecent: null,
        signalStrength: 'None',
        
        // Signal frequency analysis
        signalFrequency: 'Low',
        averageDaysBetweenSignals: null,
        
        // All recent signals (last 90 days instead of 30)
        recentSignals: []
    };
    
    if (dates.length === 0) return signals;
    
    // Function to get signal date and calculate days since
    const getSignalInfo = (signalIndices, signalType) => {
        if (!signalIndices || signalIndices.length === 0) return null;
        
        const lastIndex = signalIndices[signalIndices.length - 1];
        if (lastIndex >= 0 && lastIndex < dates.length) {
            const signalDate = new Date(dates[lastIndex]);
            const daysSince = Math.floor((currentDate - signalDate) / (1000 * 60 * 60 * 24));
            return {
                date: dates[lastIndex],
                daysSince: daysSince,
                index: lastIndex,
                type: signalType,
                strength: calculateSignalStrength(signalType, lastIndex, wt1, wt2, mf)
            };
        }
        return null;
    };
    
    // Get all signal types
    const buyInfo = getSignalInfo(buySignalIndices, 'Buy');
    const goldBuyInfo = getSignalInfo(goldBuySignalIndices, 'Gold Buy');
    const sellInfo = getSignalInfo(sellSignalIndices, 'Sell');
    const fastSellInfo = getSignalInfo(fastMoneySellIndices, 'Fast Money Sell');
    const bullDivInfo = getSignalInfo(bullishDivIndices, 'Bullish Divergence');
    const bearDivInfo = getSignalInfo(bearishDivIndices, 'Bearish Divergence');
    
    // Populate signal data
    if (buyInfo) {
        signals.lastBuySignal = buyInfo.date;
        signals.daysSinceLastBuy = buyInfo.daysSince;
    }
    if (goldBuyInfo) {
        signals.lastGoldBuySignal = goldBuyInfo.date;
        signals.daysSinceLastGoldBuy = goldBuyInfo.daysSince;
    }
    if (sellInfo) {
        signals.lastSellSignal = sellInfo.date;
        signals.daysSinceLastSell = sellInfo.daysSince;
    }
    if (fastSellInfo) {
        signals.lastFastMoneySellSignal = fastSellInfo.date;
        signals.daysSinceLastFastSell = fastSellInfo.daysSince;
    }
    if (bullDivInfo) {
        signals.lastBullishDivergence = bullDivInfo.date;
        signals.daysSinceLastBullDiv = bullDivInfo.daysSince;
    }
    if (bearDivInfo) {
        signals.lastBearishDivergence = bearDivInfo.date;
        signals.daysSinceLastBearDiv = bearDivInfo.daysSince;
    }
    
    // Find most recent signal of any type
    const allSignals = [buyInfo, goldBuyInfo, sellInfo, fastSellInfo, bullDivInfo, bearDivInfo]
        .filter(sig => sig !== null)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (allSignals.length > 0) {
        const mostRecent = allSignals[0];
        signals.mostRecentSignal = mostRecent.date;
        signals.mostRecentSignalType = mostRecent.type;
        signals.daysSinceMostRecent = mostRecent.daysSince;
        signals.signalStrength = mostRecent.strength;
    }
    
    // Collect recent signals (last 90 days instead of 30)
    const ninetyDaysAgo = new Date(currentDate);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    signals.recentSignals = allSignals.filter(sig => new Date(sig.date) >= ninetyDaysAgo);
    
    // If still no recent signals, include ALL available signals
    if (signals.recentSignals.length === 0) {
        signals.recentSignals = allSignals;
        console.log('No signals in last 90 days, showing all available:', allSignals.length);
    }
    
    // Calculate signal frequency
    if (allSignals.length >= 2) {
        const timeSpan = new Date(allSignals[0].date) - new Date(allSignals[allSignals.length - 1].date);
        const daySpan = timeSpan / (1000 * 60 * 60 * 24);
        signals.averageDaysBetweenSignals = Math.round(daySpan / (allSignals.length - 1));
        
        if (signals.averageDaysBetweenSignals <= 5) signals.signalFrequency = 'Very High';
        else if (signals.averageDaysBetweenSignals <= 10) signals.signalFrequency = 'High';
        else if (signals.averageDaysBetweenSignals <= 20) signals.signalFrequency = 'Medium';
        else if (signals.averageDaysBetweenSignals <= 40) signals.signalFrequency = 'Low';
        else signals.signalFrequency = 'Very Low';
    }
    
    // Enhanced current state analysis using actual data
    if (wt1.length >= 3 && wt2.length >= 3) {
        const currentWT1 = wt1[wt1.length - 1];
        const currentWT2 = wt2[wt2.length - 1];
        const currentMF = mf.length > 0 ? mf[mf.length - 1] : 0;
        
        // Trend analysis
        if (currentWT1 > currentWT2 + 2 && currentMF > 0) signals.currentTrend = 'Strong Bullish';
        else if (currentWT1 > currentWT2 && currentMF > 0) signals.currentTrend = 'Bullish';
        else if (currentWT1 < currentWT2 - 2 && currentMF < 0) signals.currentTrend = 'Strong Bearish';
        else if (currentWT1 < currentWT2 && currentMF < 0) signals.currentTrend = 'Bearish';
        else signals.currentTrend = 'Neutral';
        
        // Curvature analysis (acceleration/deceleration)
        const wt1_slope1 = wt1[wt1.length - 1] - wt1[wt1.length - 2];
        const wt1_slope2 = wt1[wt1.length - 2] - wt1[wt1.length - 3];
        const curvatureValue = wt1_slope1 - wt1_slope2;
        
        if (curvatureValue > 1) signals.curvature = 'Strong Acceleration Up';
        else if (curvatureValue > 0.3) signals.curvature = 'Accelerating Up';
        else if (curvatureValue < -1) signals.curvature = 'Strong Acceleration Down';
        else if (curvatureValue < -0.3) signals.curvature = 'Accelerating Down';
        else if (wt1_slope1 > 0.5) signals.curvature = 'Rising';
        else if (wt1_slope1 < -0.5) signals.curvature = 'Falling';
        else signals.curvature = 'Flat';
        
        // Momentum analysis
        const recentWT1 = wt1.slice(-10);
        const avgWT1 = recentWT1.reduce((a, b) => a + b, 0) / recentWT1.length;
        const momentum = currentWT1 - avgWT1;
        
        if (momentum > 5) signals.momentum = 'Very Strong Bullish';
        else if (momentum > 2) signals.momentum = 'Strong Bullish';
        else if (momentum > 0.5) signals.momentum = 'Moderate Bullish';
        else if (momentum < -5) signals.momentum = 'Very Strong Bearish';
        else if (momentum < -2) signals.momentum = 'Strong Bearish';
        else if (momentum < -0.5) signals.momentum = 'Moderate Bearish';
        else signals.momentum = 'Normal';
    }
    
    // Overall signal quality assessment
    let qualityScore = 0;
    if (signals.mostRecentSignal) {
        if (signals.daysSinceMostRecent <= 3) qualityScore += 3;
        else if (signals.daysSinceMostRecent <= 7) qualityScore += 2;
        else if (signals.daysSinceMostRecent <= 14) qualityScore += 1;
        
        if (signals.mostRecentSignalType === 'Gold Buy') qualityScore += 3;
        else if (signals.mostRecentSignalType === 'Buy') qualityScore += 2;
        else if (signals.mostRecentSignalType.includes('Divergence')) qualityScore += 2;
        
        if (signals.signalFrequency === 'Medium' || signals.signalFrequency === 'High') qualityScore += 1;
    }
    
    if (qualityScore >= 6) signals.signalQuality = 'Excellent';
    else if (qualityScore >= 4) signals.signalQuality = 'Good';
    else if (qualityScore >= 2) signals.signalQuality = 'Fair';
    else if (qualityScore >= 1) signals.signalQuality = 'Poor';
    else signals.signalQuality = 'None';
    
    console.log('Final signals result:', signals);
    return signals;
}

// Fallback function to detect signals from oscillator data when indices are not available
function findSignalsFromOscillatorData(tickerData) {
    const dates = tickerData.dates || [];
    const wt1 = tickerData.WT1 || tickerData.wt1 || [];
    const wt2 = tickerData.WT2 || tickerData.wt2 || [];
    const mf = tickerData.moneyFlow || tickerData.money_flow || [];
    
    console.log('Attempting to find signals from oscillator data...');
    console.log('Data lengths - WT1:', wt1.length, 'WT2:', wt2.length, 'MF:', mf.length, 'Dates:', dates.length);
    
    if (wt1.length === 0 || wt2.length === 0 || dates.length === 0) {
        console.log('Insufficient oscillator data for signal detection');
        return getEmptySignalsObject();
    }
    
    const currentDate = new Date();
    let signals = getEmptySignalsObject();
    let detectedSignals = [];
    
    // Look for WT1/WT2 crossovers to identify potential signals
    for (let i = 1; i < Math.min(wt1.length, wt2.length, dates.length); i++) {
        const prevWT1 = wt1[i - 1];
        const prevWT2 = wt2[i - 1];
        const currWT1 = wt1[i];
        const currWT2 = wt2[i];
        const currMF = mf[i] || 0;
        
        // Buy signal: WT1 crosses above WT2
        if (prevWT1 <= prevWT2 && currWT1 > currWT2) {
            const signalDate = dates[i];
            const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
            
            detectedSignals.push({
                date: signalDate,
                daysSince: daysSince,
                type: currMF > 0 && currWT1 < -50 ? 'Gold Buy' : 'Buy',
                index: i,
                strength: calculateSignalStrength(currMF > 0 && currWT1 < -50 ? 'Gold Buy' : 'Buy', i, wt1, wt2, mf)
            });
        }
        
        // Sell signal: WT1 crosses below WT2
        if (prevWT1 >= prevWT2 && currWT1 < currWT2) {
            const signalDate = dates[i];
            const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
            
            detectedSignals.push({
                date: signalDate,
                daysSince: daysSince,
                type: 'Sell',
                index: i,
                strength: calculateSignalStrength('Sell', i, wt1, wt2, mf)
            });
        }
    }
    
    // Sort by date (most recent first)
    detectedSignals.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log('Detected', detectedSignals.length, 'signals from oscillator analysis');
    
    if (detectedSignals.length > 0) {
        const mostRecent = detectedSignals[0];
        signals.mostRecentSignal = mostRecent.date;
        signals.mostRecentSignalType = mostRecent.type;
        signals.daysSinceMostRecent = mostRecent.daysSince;
        signals.signalStrength = mostRecent.strength;
        
        // Categorize signals
        const buySignals = detectedSignals.filter(s => s.type === 'Buy');
        const goldBuySignals = detectedSignals.filter(s => s.type === 'Gold Buy');
        const sellSignals = detectedSignals.filter(s => s.type === 'Sell');
        
        if (buySignals.length > 0) {
            signals.lastBuySignal = buySignals[0].date;
            signals.daysSinceLastBuy = buySignals[0].daysSince;
        }
        if (goldBuySignals.length > 0) {
            signals.lastGoldBuySignal = goldBuySignals[0].date;
            signals.daysSinceLastGoldBuy = goldBuySignals[0].daysSince;
        }
        if (sellSignals.length > 0) {
            signals.lastSellSignal = sellSignals[0].date;
            signals.daysSinceLastSell = sellSignals[0].daysSince;
        }
        
        signals.totalBuySignals = buySignals.length;
        signals.totalGoldBuySignals = goldBuySignals.length;
        signals.totalSellSignals = sellSignals.length;
        
        signals.recentSignals = detectedSignals;
        signals.signalQuality = detectedSignals.length > 5 ? 'Good' : 'Fair';
        
        // Calculate frequency
        if (detectedSignals.length >= 2) {
            const timeSpan = new Date(detectedSignals[0].date) - new Date(detectedSignals[detectedSignals.length - 1].date);
            const daySpan = timeSpan / (1000 * 60 * 60 * 24);
            signals.averageDaysBetweenSignals = Math.round(daySpan / (detectedSignals.length - 1));
            
            if (signals.averageDaysBetweenSignals <= 10) signals.signalFrequency = 'High';
            else if (signals.averageDaysBetweenSignals <= 20) signals.signalFrequency = 'Medium';
            else signals.signalFrequency = 'Low';
        }
    }
    
    return signals;
}

function getEmptySignalsObject() {
    return {
        lastBuySignal: null,
        lastGoldBuySignal: null,
        lastSellSignal: null,
        lastFastMoneySellSignal: null,
        lastBullishDivergence: null,
        lastBearishDivergence: null,
        daysSinceLastBuy: null,
        daysSinceLastGoldBuy: null,
        daysSinceLastSell: null,
        daysSinceLastFastSell: null,
        daysSinceLastBullDiv: null,
        daysSinceLastBearDiv: null,
        totalBuySignals: 0,
        totalGoldBuySignals: 0,
        totalSellSignals: 0,
        totalBullishDivs: 0,
        totalBearishDivs: 0,
        currentTrend: 'Neutral',
        curvature: 'Flat',
        momentum: 'Normal',
        signalQuality: 'Unknown',
        mostRecentSignal: null,
        mostRecentSignalType: 'None',
        daysSinceMostRecent: null,
        signalStrength: 'None',
        signalFrequency: 'Low',
        averageDaysBetweenSignals: null,
        recentSignals: []
    };
}

// Enhanced signal detection that works with ACTUAL indicator data from API
function findAllIndicatorSignals(tickerData) {
    const dates = tickerData.dates || [];
    const currentDate = new Date();
    let allSignals = [];
    
    console.log('=== Finding All Indicator Signals ===');
    console.log('Available data keys:', Object.keys(tickerData));
    
    // 1. RSI3M3+ State Change Signals - Show ALL historical changes for complete timeline
    if (tickerData.rsi3m3 && tickerData.rsi3m3.state && tickerData.rsi3m3.state.length > 1) {
        const states = tickerData.rsi3m3.state;
        const rsiValues = tickerData.rsi3m3.rsi3m3 || [];
        
        // Show ALL state changes in timeline (complete signal history)
        for (let i = 1; i < states.length; i++) {
            if (states[i] !== states[i-1]) {
                const signalDate = dates[i];
                if (signalDate) {
                    const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                    let signalType = 'State Change';
                    let strength = 'Moderate';
                    
                    if (states[i] === 1) {
                        signalType = 'RSI3M3 Bullish Entry';
                        strength = rsiValues[i] && rsiValues[i] < 40 ? 'Strong' : 'Moderate';
                    } else if (states[i] === 2) {
                        signalType = 'RSI3M3 Bearish Entry';
                        strength = rsiValues[i] && rsiValues[i] > 60 ? 'Strong' : 'Moderate';
                    } else if (states[i] === 3) {
                        signalType = 'RSI3M3 Transition';
                        strength = 'Weak';
                    }
                    
                    allSignals.push({
                        date: signalDate,
                        type: signalType,
                        system: 'RSI3M3+',
                        strength: strength,
                        daysSince: daysSince,
                        value: rsiValues[i] || 0,
                        color: states[i] === 1 ? '#00ff0a' : states[i] === 2 ? '#ff1100' : '#ffff00',
                        icon: states[i] === 1 ? '🟢' : states[i] === 2 ? '🔴' : '🟡'
                    });
                }
            }
        }
        console.log('Found', allSignals.filter(s => s.system === 'RSI3M3+').length, 'RSI3M3+ signals for timeline');
    }
    
    // 2. Wave Trend (WT1/WT2) Crossover Signals
    if (tickerData.WT1 && tickerData.WT2 && tickerData.WT1.length > 1) {
        const wt1 = tickerData.WT1;
        const wt2 = tickerData.WT2;
        const mf = tickerData.moneyFlow || [];
        
        for (let i = 1; i < Math.min(wt1.length, wt2.length, dates.length); i++) {
            const prevWT1 = wt1[i-1];
            const prevWT2 = wt2[i-1];
            const currWT1 = wt1[i];
            const currWT2 = wt2[i];
            const currMF = mf[i] || 0;
            
            // Bullish crossover: WT1 crosses above WT2
            if (prevWT1 <= prevWT2 && currWT1 > currWT2) {
                const signalDate = dates[i];
                if (signalDate) {
                    const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                    let signalType = 'WT Buy Signal';
                    let strength = 'Moderate';
                    let color = '#00ff0a';
                    
                    // Gold buy conditions
                    if (currMF > 0 && currWT1 < -50) {
                        signalType = 'WT Gold Buy Signal';
                        strength = 'Very Strong';
                        color = '#FFD700';
                    } else if (currWT1 < -30) {
                        strength = 'Strong';
                    }
                    
                    allSignals.push({
                        date: signalDate,
                        type: signalType,
                        system: 'Wave Trend',
                        strength: strength,
                        daysSince: daysSince,
                        value: currWT1,
                        color: color,
                        icon: signalType.includes('Gold') ? '⭐' : '📈'
                    });
                }
            }
            
            // Bearish crossover: WT1 crosses below WT2
            if (prevWT1 >= prevWT2 && currWT1 < currWT2) {
                const signalDate = dates[i];
                if (signalDate) {
                    const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                    let strength = currWT1 > 30 ? 'Strong' : 'Moderate';
                    
                    allSignals.push({
                        date: signalDate,
                        type: 'WT Sell Signal',
                        system: 'Wave Trend',
                        strength: strength,
                        daysSince: daysSince,
                        value: currWT1,
                        color: '#ff1100',
                        icon: '📉'
                    });
                }
            }
        }
        console.log('Found', allSignals.filter(s => s.system === 'Wave Trend').length, 'Wave Trend signals');
    }
    
    // 3. Exhaustion Signals (if available)
    if (tickerData.trendExhaust && tickerData.trendExhaust.avgPercentR) {
        const percentR = tickerData.trendExhaust.avgPercentR;
        const exhaustDates = tickerData.trendExhaust.dates || dates;
        
        for (let i = 1; i < Math.min(percentR.length, exhaustDates.length); i++) {
            const prev = percentR[i-1];
            const curr = percentR[i];
            const signalDate = exhaustDates[i];
            
            if (signalDate) {
                const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                
                // Oversold reversal (Williams %R crosses above -80)
                if (prev <= -80 && curr > -80) {
                    allSignals.push({
                        date: signalDate,
                        type: 'Oversold Reversal',
                        system: 'Exhaustion',
                        strength: curr > -70 ? 'Strong' : 'Moderate',
                        daysSince: daysSince,
                        value: curr,
                        color: '#44ff44',
                        icon: '🔺'
                    });
                }
                
                // Overbought reversal (Williams %R crosses below -20)
                if (prev >= -20 && curr < -20) {
                    allSignals.push({
                        date: signalDate,
                        type: 'Overbought Reversal',
                        system: 'Exhaustion',
                        strength: curr < -30 ? 'Strong' : 'Moderate',
                        daysSince: daysSince,
                        value: curr,
                        color: '#ff4444',
                        icon: '🔻'
                    });
                }
            }
        }
        console.log('Found', allSignals.filter(s => s.system === 'Exhaustion').length, 'Exhaustion signals');
    }
    
    // 4. Money Flow Divergence Signals
    if (tickerData.moneyFlow && tickerData.price && tickerData.moneyFlow.length > 5) {
        const mf = tickerData.moneyFlow;
        const prices = tickerData.price;
        
        for (let i = 5; i < Math.min(mf.length, prices.length, dates.length); i++) {
            const signalDate = dates[i];
            if (signalDate) {
                const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                
                // Look for divergences between price and money flow
                const priceSlope = (prices[i] - prices[i-3]) / prices[i-3];
                const mfSlope = (mf[i] - mf[i-3]) / Math.abs(mf[i-3] || 1);
                
                // Bullish divergence: price making lower lows, MF making higher lows
                if (priceSlope < -0.02 && mfSlope > 0.1) {
                    allSignals.push({
                        date: signalDate,
                        type: 'Bullish MF Divergence',
                        system: 'Money Flow',
                        strength: Math.abs(mfSlope) > 0.3 ? 'Strong' : 'Moderate',
                        daysSince: daysSince,
                        value: mf[i],
                        color: '#32CD32',
                        icon: '↗️'
                    });
                }
                
                // Bearish divergence: price making higher highs, MF making lower highs
                if (priceSlope > 0.02 && mfSlope < -0.1) {
                    allSignals.push({
                        date: signalDate,
                        type: 'Bearish MF Divergence',
                        system: 'Money Flow',
                        strength: Math.abs(mfSlope) > 0.3 ? 'Strong' : 'Moderate',
                        daysSince: daysSince,
                        value: mf[i],
                        color: '#FF6347',
                        icon: '↘️'
                    });
                }
            }
        }
        console.log('Found', allSignals.filter(s => s.system === 'Money Flow').length, 'Money Flow signals');
    }
    
    // 5. Volume Breakout Signals
    if (tickerData.volume && tickerData.volume.length > 20) {
        const volumes = tickerData.volume;
        const prices = tickerData.price || [];
        
        // Calculate average volume over last 20 periods
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        
        for (let i = 20; i < Math.min(volumes.length, dates.length); i++) {
            const volume = volumes[i];
            const signalDate = dates[i];
            
            if (signalDate && volume > avgVolume * 2) { // Volume spike > 2x average
                const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                const priceChange = prices[i] && prices[i-1] ? (prices[i] - prices[i-1]) / prices[i-1] * 100 : 0;
                
                allSignals.push({
                    date: signalDate,
                    type: volume > avgVolume * 3 ? 'Volume Explosion' : 'Volume Breakout',
                    system: 'Volume',
                    strength: volume > avgVolume * 3 ? 'Very Strong' : 'Strong',
                    daysSince: daysSince,
                    value: volume / avgVolume,
                    color: priceChange > 0 ? '#00ff88' : '#ff8800',
                    icon: volume > avgVolume * 3 ? '💥' : '📊'
                });
            }
        }
        console.log('Found', allSignals.filter(s => s.system === 'Volume').length, 'Volume signals');
    }
    
    // 6. Price Action Signals (significant moves)
    if (tickerData.price && tickerData.price.length > 10) {
        const prices = tickerData.price;
        
        for (let i = 5; i < Math.min(prices.length, dates.length); i++) {
            const signalDate = dates[i];
            if (signalDate) {
                const daysSince = Math.floor((currentDate - new Date(signalDate)) / (1000 * 60 * 60 * 24));
                
                // Daily change
                const dailyChange = prices[i-1] ? (prices[i] - prices[i-1]) / prices[i-1] * 100 : 0;
                
                // 5-day change
                const weeklyChange = prices[i-5] ? (prices[i] - prices[i-5]) / prices[i-5] * 100 : 0;
                
                // Significant daily moves (>5%)
                if (Math.abs(dailyChange) > 5) {
                    allSignals.push({
                        date: signalDate,
                        type: dailyChange > 0 ? 'Price Breakout' : 'Price Breakdown',
                        system: 'Price Action',
                        strength: Math.abs(dailyChange) > 8 ? 'Very Strong' : 'Strong',
                        daysSince: daysSince,
                        value: dailyChange,
                        color: dailyChange > 0 ? '#00ff0a' : '#ff1100',
                        icon: dailyChange > 0 ? '⬆️' : '⬇️'
                    });
                }
                
                // Significant weekly moves (>15%)
                if (Math.abs(weeklyChange) > 15 && i % 5 === 0) { // Only check every 5 days to avoid duplicates
                    allSignals.push({
                        date: signalDate,
                        type: weeklyChange > 0 ? 'Weekly Surge' : 'Weekly Decline',
                        system: 'Price Action',
                        strength: Math.abs(weeklyChange) > 25 ? 'Very Strong' : 'Strong',
                        daysSince: daysSince,
                        value: weeklyChange,
                        color: weeklyChange > 0 ? '#32CD32' : '#FF6347',
                        icon: weeklyChange > 0 ? '🚀' : '📉'
                    });
                }
            }
        }
        console.log('Found', allSignals.filter(s => s.system === 'Price Action').length, 'Price Action signals');
    }
    
    // Sort all signals by date (most recent first)
    allSignals.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log('=== Total Signals Found ===');
    console.log('RSI3M3+:', allSignals.filter(s => s.system === 'RSI3M3+').length);
    console.log('Wave Trend:', allSignals.filter(s => s.system === 'Wave Trend').length);
    console.log('Exhaustion:', allSignals.filter(s => s.system === 'Exhaustion').length);
    console.log('Money Flow:', allSignals.filter(s => s.system === 'Money Flow').length);
    console.log('Volume:', allSignals.filter(s => s.system === 'Volume').length);
    console.log('Price Action:', allSignals.filter(s => s.system === 'Price Action').length);
    console.log('Total signals:', allSignals.length);
    
    return allSignals;
}

// Updated signal timeline using comprehensive indicator signals
function createSignalTimeline(tickerData) {
    console.log('=== Creating Comprehensive Signal Timeline ===');
    
    // Get all signals from actual indicators
    const allSignals = findAllIndicatorSignals(tickerData);
    
    // Filter to recent signals (last 60 days) but keep some older ones for context
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const recentSignals = allSignals.filter(signal => new Date(signal.date) >= sixtyDaysAgo);
    
    // If we have few recent signals, include older ones
    let finalSignals = recentSignals;
    if (recentSignals.length < 10) {
        finalSignals = allSignals.slice(0, 20); // Take the 20 most recent regardless of age
    }
    
    console.log('Timeline: Using', finalSignals.length, 'signals out of', allSignals.length, 'total found');
    
    return finalSignals;
}
