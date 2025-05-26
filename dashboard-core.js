// dashboard-core.js - Core functionality for the multi-ticker dashboard

// Global variables
let tickerWatchlist = [];
let currentTickerData = {};
let currentFilters = {
    category: 'all',
    signal: 'all'
};
let currentSort = 'alphabetical';
let chartInstances = {};

// Load tickers from localStorage
function loadWatchlist() {
    const savedWatchlist = localStorage.getItem('tickerWatchlist');
    if (savedWatchlist) {
        try {
            tickerWatchlist = JSON.parse(savedWatchlist);
        } catch (e) {
            console.error('Error parsing saved watchlist:', e);
            tickerWatchlist = [];
        }
    }
}

// Save tickers to localStorage
function saveWatchlist() {
    localStorage.setItem('tickerWatchlist', JSON.stringify(tickerWatchlist));
}

// Load dashboard preferences from localStorage
function loadDashboardPreferences() {
    const savedPreferences = localStorage.getItem('dashboardPreferences');
    if (savedPreferences) {
        try {
            const prefs = JSON.parse(savedPreferences);
            if (prefs.sort) currentSort = prefs.sort;
            if (prefs.filters) currentFilters = prefs.filters;
            
            // Update UI based on loaded preferences
            document.querySelectorAll('.filter-badge[data-category]').forEach(badge => {
                badge.classList.toggle('active', badge.dataset.category === currentFilters.category);
            });
            
            document.querySelectorAll('.filter-badge[data-signal]').forEach(badge => {
                badge.classList.toggle('active', badge.dataset.signal === currentFilters.signal);
            });
            
            if (document.getElementById('sortSelector')) {
                document.getElementById('sortSelector').value = currentSort;
            }
        } catch (e) {
            console.error('Error parsing saved preferences:', e);
        }
    }
}

// Save dashboard preferences to localStorage
function saveDashboardPreferences() {
    const preferences = {
        sort: currentSort,
        filters: currentFilters
    };
    localStorage.setItem('dashboardPreferences', JSON.stringify(preferences));
}

// Function to clear the server cache
function clearServerCache() {
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }

    fetch('http://localhost:5000/api/clear-cache')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Cache cleared successfully. Refreshing data...');
                // Reload the ticker data
                fetchTickersData();
            } else {
                alert('Error clearing cache: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error clearing cache:', error);
            alert('Error clearing cache: ' + error.message);
        })
        .finally(() => {
            if (loadingIndicator && !tickerWatchlist.length) {
                loadingIndicator.style.display = 'none';
            }
        });
}

// Initialize the dashboard: set up event listeners, load persisted tickers and options
function initDashboard() {
    // Load saved watchlist and preferences
    loadWatchlist();
    loadDashboardPreferences();
    
    // Set up event listener for Add Tickers button
    const addTickersBtn = document.getElementById('addTickers');
    if (addTickersBtn) {
        addTickersBtn.addEventListener('click', function() {
            const tickerInput = document.getElementById('tickerInput');
            if (tickerInput && tickerInput.value.trim()) {
                const newTickers = tickerInput.value.trim().split(',')
                    .map(t => t.trim().toUpperCase())
                    .filter(t => t);
                
                // Add new tickers to watchlist without duplicates
                newTickers.forEach(ticker => {
                    if (!tickerWatchlist.includes(ticker)) {
                        tickerWatchlist.push(ticker);
                    }
                });
                
                saveWatchlist();
                fetchTickersData();
                
                // Clear the input field
                tickerInput.value = '';
            }
        });
    }
    
    // Set up event listeners for period and interval selectors
    const periodSelector = document.getElementById('periodSelector');
    const intervalSelector = document.getElementById('intervalSelector');
    
    if (periodSelector) {
        periodSelector.addEventListener('change', fetchTickersData);
    }
    
    if (intervalSelector) {
        intervalSelector.addEventListener('change', fetchTickersData);
    }
    
    // Set up event listeners for filter badges
    document.querySelectorAll('.filter-badge[data-category]').forEach(badge => {
        badge.addEventListener('click', function() {
            const category = this.dataset.category;
            currentFilters.category = category;
            
            // Update active state of category badges
            document.querySelectorAll('.filter-badge[data-category]').forEach(b => {
                b.classList.toggle('active', b.dataset.category === category);
            });
            
            applyFiltersAndSort();
            saveDashboardPreferences();
        });
    });
    
    document.querySelectorAll('.filter-badge[data-signal]').forEach(badge => {
        badge.addEventListener('click', function() {
            const signal = this.dataset.signal;
            currentFilters.signal = signal;
            
            // Update active state of signal badges
            document.querySelectorAll('.filter-badge[data-signal]').forEach(b => {
                b.classList.toggle('active', b.dataset.signal === signal);
            });
            
            applyFiltersAndSort();
            saveDashboardPreferences();
        });
    });
    
    // Set up event listener for sort dropdown
    const sortSelector = document.getElementById('sortSelector');
    if (sortSelector) {
        sortSelector.addEventListener('change', function() {
            currentSort = this.value;
            applyFiltersAndSort();
            saveDashboardPreferences();
        });
    }
    
    // Set up event listener for Save Dashboard button
    const saveDashboardBtn = document.getElementById('saveDashboardBtn');
    if (saveDashboardBtn) {
        saveDashboardBtn.addEventListener('click', function() {
            saveWatchlist();
            saveDashboardPreferences();
            alert('Dashboard configuration saved successfully!');
        });
    }
    
    // Set up batch upload functionality
    const showBatchUploadBtn = document.getElementById('showBatchUploadBtn');
    const batchUploadForm = document.getElementById('batchUploadForm');
    
    if (showBatchUploadBtn && batchUploadForm) {
        showBatchUploadBtn.addEventListener('click', function() {
            const isVisible = batchUploadForm.style.display === 'block';
            batchUploadForm.style.display = isVisible ? 'none' : 'block';
            showBatchUploadBtn.textContent = isVisible ? 'Batch Upload' : 'Cancel Upload';
        });
        
        batchUploadForm.addEventListener('submit', handleBatchUpload);
    }
    
    // Set up event listener for Clear Cache button
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', function() {
            clearServerCache();
        });
    }
    
    // If we have tickers in watchlist, fetch their data
    if (tickerWatchlist.length > 0) {
        fetchTickersData();
    } else {
        // Add some default tickers for first-time users
        tickerWatchlist = ['AAPL', 'MSFT', 'BTC-USD', 'SPY', 'EUR=X'];
        saveWatchlist();
        fetchTickersData();
    }
}

// Fetch data for multiple tickers using the multi-ticker API endpoint
function fetchTickersData() {
    if (tickerWatchlist.length === 0) {
        document.getElementById('tickersGrid').innerHTML = '<div class="col-12 text-center mt-5">No tickers in watchlist. Add some tickers to get started!</div>';
        return;
    }
    
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    // Get selected period and interval
    const period = document.getElementById('periodSelector').value || '1y';
    const interval = document.getElementById('intervalSelector').value || '1d';
    
    // Build API URL
    const tickersString = tickerWatchlist.join(',');
    const apiUrl = `http://localhost:5000/api/multi-ticker?tickers=${encodeURIComponent(tickersString)}&period=${period}&interval=${interval}`;
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error ${response.status}: ${text}`);
                });
            }
            return response.text(); // Get response as text first
        })
        .then(text => {
            // Try to parse the JSON, handling any parsing errors
            try {
                return JSON.parse(text);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                console.error('Problematic JSON text:', text.substring(0, 500) + '...');
                throw new Error('Invalid JSON response from server');
            }
        })
        .then(data => {
            if (data.success) {
                // Store ticker data
                currentTickerData = data.results;
                
                // Render the grid
                renderTickersGrid(data);
                
                // Apply current filters and sort
                applyFiltersAndSort();
            } else {
                console.error('API returned error:', data.message);
                document.getElementById('tickersGrid').innerHTML = `<div class="col-12 text-center mt-5 text-danger">Error fetching ticker data: ${data.message}</div>`;
            }
        })
        .catch(error => {
            console.error('Error fetching ticker data:', error);
            document.getElementById('tickersGrid').innerHTML = `<div class="col-12 text-center mt-5 text-danger">Error fetching ticker data: ${error.message}</div>`;
        })
        .finally(() => {
            // Hide loading indicator
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        });
}

// Create a mini chart for ticker cards
function createMiniChart(containerId, data) {
    // Clean up previous chart instance if it exists
    if (chartInstances[containerId]) {
        chartInstances[containerId].destroy();
    }
    
    const ctx = document.getElementById(containerId);
    if (!ctx) return;
    
    const chartContext = ctx.getContext('2d');
    
    // Filter out any null values and limit to last 3 months of data
    const validDataPoints = [];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    for (let i = 0; i < data.dates.length; i++) {
        const currentDate = new Date(data.dates[i]);
        if (currentDate >= threeMonthsAgo && 
            data.price[i] !== null && 
            data.price[i] !== undefined && 
            !isNaN(data.price[i])) {
            validDataPoints.push({
                x: currentDate,
                y: data.price[i]
            });
        }
    }
    
    // Prepare data for the mini chart
    const chartData = {
        datasets: [
            {
                label: 'Price',
                data: validDataPoints,
                borderColor: '#3cff00',
                borderWidth: 1.5,
                backgroundColor: 'rgba(60, 255, 0, 0.1)',
                pointRadius: 0,
                fill: true
            }
        ]
    };
    
    // Create the chart with error handling
    try {
        chartInstances[containerId] = new Chart(chartContext, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                animation: {
                    duration: 0 // Disable animations for better performance
                }
            }
        });
    } catch (error) {
        console.error('Error creating chart for', containerId, error);
    }
}

// Format price for display
function formatPrice(price) {
    if (price < 0.01) {
        return price.toFixed(6);
    } else if (price < 1) {
        return price.toFixed(4);
    } else if (price < 10) {
        return price.toFixed(3);
    } else if (price < 1000) {
        return price.toFixed(2);
    } else {
        return new Intl.NumberFormat().format(price.toFixed(2));
    }
}

// Function to safely get a value with a fallback
function safeValue(value, fallback = 0) {
    return (value === null || value === undefined || isNaN(value)) ? fallback : value;
}

// Render the tickers grid with summary cards for each ticker
function renderTickersGrid(data) {
    const tickersGrid = document.getElementById('tickersGrid');
    
    if (!tickersGrid) return;
    
    // Clear the grid
    tickersGrid.innerHTML = '';
    
    // Process each ticker result
    Object.entries(data.results).forEach(([ticker, tickerData]) => {
        // Extract required data with safe fallbacks
        const companyName = tickerData.companyName || ticker;
        const currentPrice = safeValue(tickerData.summary?.currentPrice, 0);
        const priceChangePct = safeValue(tickerData.summary?.priceChangePct, 0);
        const currentWT1 = safeValue(tickerData.summary?.currentWT1, 0);
        const currentWT2 = safeValue(tickerData.summary?.currentWT2, 0);
        const currentMF = safeValue(tickerData.summary?.currentMF, 0);
        const buySignals = safeValue(tickerData.summary?.buySignals, 0);
        const goldBuySignals = safeValue(tickerData.summary?.goldBuySignals, 0);
        const sellSignals = safeValue(tickerData.summary?.sellSignals, 0);
        const bullishDivs = safeValue(tickerData.summary?.bullishDivergenceSignals, 0);
        const bearishDivs = safeValue(tickerData.summary?.bearishDivergenceSignals, 0);
        const fastMoneyBuySignals = safeValue(tickerData.summary?.fastMoneyBuySignals, 0);
        const fastMoneySellSignals = safeValue(tickerData.summary?.fastMoneySellSignals, 0);
        const lastUpdate = tickerData.summary?.lastUpdate || 'N/A';
        const signalStrength = safeValue(tickerData.summary?.signalStrength, 0);
        const status = tickerData.status || 'Neutral zone';
        const tickerType = tickerData.tickerType || 'stock';
        
        // RSI3M3+ data
        const rsi3m3Data = tickerData.rsi3m3 || {};
        const currentRSI3M3 = rsi3m3Data.rsi3m3 ? safeValue(rsi3m3Data.rsi3m3[rsi3m3Data.rsi3m3.length - 1], 0) : 0;
        const currentRSI3M3State = rsi3m3Data.state ? rsi3m3Data.state[rsi3m3Data.state.length - 1] : 0;
        const rsi3m3BuySignals = rsi3m3Data.signals?.buy?.length || 0;
        const rsi3m3SellSignals = rsi3m3Data.signals?.sell?.length || 0;
        
        // Get RSI3M3 background color based on state
        let rsi3m3BackgroundColor;
        let rsi3m3StateLabel;
        switch (currentRSI3M3State) {
            case 1:
                rsi3m3BackgroundColor = '#00ff0a';
                rsi3m3StateLabel = 'Bullish';
                break;
            case 2:
                rsi3m3BackgroundColor = '#ff1100';
                rsi3m3StateLabel = 'Bearish';
                break;
            case 3:
                rsi3m3BackgroundColor = '#ffff00';
                rsi3m3StateLabel = 'Transition';
                break;
            default:
                rsi3m3BackgroundColor = '#808080';
                rsi3m3StateLabel = 'Neutral';
        }
        
        // Determine signal class and label
        let signalClass, signalLabel;
        if (goldBuySignals > 0) {
            signalClass = 'signal-gold-buy';
            signalLabel = 'Gold Buy';
        } else if (buySignals > 0) {
            signalClass = 'signal-buy';
            signalLabel = 'Buy';
        } else if (fastMoneyBuySignals > 0) {
            signalClass = 'signal-buy';
            signalLabel = 'Fast Money Buy';
        } else if (bullishDivs > 0) {
            signalClass = 'signal-buy';
            signalLabel = 'Bullish Div';
        } else if (sellSignals > 0) {
            signalClass = 'signal-sell';
            signalLabel = 'Sell';
        } else if (fastMoneySellSignals > 0) {
            signalClass = 'signal-sell';
            signalLabel = 'Fast Money Sell';
        } else if (bearishDivs > 0) {
            signalClass = 'signal-sell';
            signalLabel = 'Bearish Div';
        } else {
            signalClass = 'signal-neutral';
            signalLabel = 'Neutral';
        }
        
        // Determine price change color
        const priceChangeClass = priceChangePct > 0 ? 'positive' : (priceChangePct < 0 ? 'negative' : 'neutral');
        
        // Determine signal strength class
        let strengthClass;
        if (signalStrength > 2) {
            strengthClass = 'strength-high';
        } else if (signalStrength > 0) {
            strengthClass = 'strength-medium';
        } else {
            strengthClass = 'strength-low';
        }
        
        // Determine ticker type tag
        let tagClass, tagLabel;
        switch (tickerType) {
            case 'crypto':
                tagClass = 'tag-crypto';
                tagLabel = 'Crypto';
                break;
            case 'forex':
                tagClass = 'tag-forex';
                tagLabel = 'Forex';
                break;
            case 'commodity':
                tagClass = 'tag-commodity';
                tagLabel = 'Commodity';
                break;
            default:
                tagClass = 'tag-stock';
                tagLabel = 'Stock';
        }
        
        // Create card element
        const cardCol = document.createElement('div');
        cardCol.className = 'col-md-4 col-lg-3';
        cardCol.dataset.ticker = ticker;
        cardCol.dataset.tickerType = tickerType;
        cardCol.dataset.signalType = signalLabel.toLowerCase().replace(' ', '');
        cardCol.dataset.signalStrength = signalStrength;
        cardCol.dataset.priceChange = priceChangePct;
        
        // Generate card HTML with additional Market Cipher B information
        cardCol.innerHTML = `
            <div class="ticker-card">
                <div class="ticker-header">
                    <div>
                        <div class="ticker-symbol">
                            ${ticker}
                            <span class="ticker-tag ${tagClass}">${tagLabel}</span>
                        </div>
                        <div class="ticker-company">${companyName}</div>
                    </div>
                    <div class="text-end">
                        <div class="ticker-price">${formatPrice(currentPrice)}</div>
                        <div class="price-change ${priceChangeClass}">
                            ${priceChangePct > 0 ? '+' : ''}${priceChangePct.toFixed(2)}%
                        </div>
                    </div>
                </div>
                
                <div class="chart-container">
                    <canvas id="miniChart-${ticker.replace(/[^a-zA-Z0-9]/g, '_')}"></canvas>
                </div>
                
                <div class="d-flex flex-wrap gap-1 mb-2">
                    <div class="signal-badge ${signalClass}">${signalLabel}</div>
                    ${status !== 'Neutral zone' ? `<div class="signal-badge ${status.includes('buy') ? 'signal-buy' : 'signal-sell'}">${status}</div>` : ''}
                    ${bullishDivs > 0 ? `<div class="signal-badge signal-buy">Div+</div>` : ''}
                    ${bearishDivs > 0 ? `<div class="signal-badge signal-sell">Div-</div>` : ''}
                    ${rsi3m3BuySignals > 0 ? `<div class="signal-badge signal-buy">RSI3M3 Buy</div>` : ''}
                    ${rsi3m3SellSignals > 0 ? `<div class="signal-badge signal-sell">RSI3M3 Sell</div>` : ''}
                </div>
                
                <div class="strength-indicator ${strengthClass}"></div>
                
                <div class="ticker-indicators">
                    <div class="indicator">
                        <div class="indicator-label">WT1</div>
                        <div class="indicator-value ${currentWT1 > currentWT2 ? 'positive' : 'negative'}">${currentWT1.toFixed(2)}</div>
                    </div>
                    <div class="indicator">
                        <div class="indicator-label">WT2</div>
                        <div class="indicator-value ${currentWT2 < currentWT1 ? 'positive' : 'negative'}">${currentWT2.toFixed(2)}</div>
                    </div>
                    <div class="indicator">
                        <div class="indicator-label">MF</div>
                        <div class="indicator-value ${currentMF > 0 ? 'positive' : 'negative'}">${currentMF.toFixed(2)}</div>
                    </div>
                    <div class="indicator rsi3m3-indicator" style="background-color: ${rsi3m3BackgroundColor}20; border: 1px solid ${rsi3m3BackgroundColor};">
                        <div class="indicator-label">RSI3M3</div>
                        <div class="indicator-value" style="color: ${rsi3m3BackgroundColor};">${currentRSI3M3.toFixed(1)}</div>
                        <div class="indicator-state" style="font-size: 0.7rem; color: ${rsi3m3BackgroundColor};">${rsi3m3StateLabel}</div>
                    </div>
                </div>
                
                <div class="timestamp">Last updated: ${lastUpdate}</div>
                
                <div class="ticker-actions">
                    <button class="ticker-action-btn view-details" data-ticker="${ticker}">
                        <i class="bi bi-graph-up"></i> Details
                    </button>
                    <button class="ticker-favorite-btn ${tickerWatchlist.includes(ticker) ? 'active' : ''}" data-ticker="${ticker}">
                        <i class="bi bi-star-fill"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Add to the grid
        tickersGrid.appendChild(cardCol);
        
        // Create mini chart
        setTimeout(() => {
            createMiniChart(`miniChart-${ticker.replace(/[^a-zA-Z0-9]/g, '_')}`, tickerData);
        }, 10);
    });
    
    // Display errors if any
    if (Object.keys(data.errors).length > 0) {
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
    
    // Add event listeners for the view details buttons
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', function() {
            const ticker = this.dataset.ticker;
            if (ticker && currentTickerData[ticker]) {
                // Call the detailed view function from dashboard-detail.js
                if (typeof openDetailedView === 'function') {
                    openDetailedView(ticker, currentTickerData[ticker]);
                }
            }
        });
    });
    
    // Add event listeners for the favorite buttons
    document.querySelectorAll('.ticker-favorite-btn').forEach(button => {
        button.addEventListener('click', function() {
            const ticker = this.dataset.ticker;
            const isActive = this.classList.contains('active');
            
            if (isActive) {
                // Remove from watchlist
                updateWatchlist(ticker, false);
                this.classList.remove('active');
            } else {
                // Add to watchlist
                updateWatchlist(ticker, true);
                this.classList.add('active');
            }
        });
    });
}

// Apply sorting and filtering to the ticker cards based on user selection
function applyFiltersAndSort() {
    const tickersGrid = document.getElementById('tickersGrid');
    if (!tickersGrid) return;
    
    const cards = Array.from(tickersGrid.querySelectorAll('.col-md-4, .col-lg-3'));
    if (cards.length === 0) return;
    
    // Apply filters first
    cards.forEach(card => {
        let show = true;
        
        // Category filter
        if (currentFilters.category !== 'all' && card.dataset.tickerType !== currentFilters.category) {
            show = false;
        }
        
        // Signal filter
        if (currentFilters.signal !== 'all' && card.dataset.signalType !== currentFilters.signal) {
            show = false;
        }
        
        card.style.display = show ? '' : 'none';
    });
    
    // Then apply sorting
    const visibleCards = cards.filter(card => card.style.display !== 'none');
    
    visibleCards.sort((a, b) => {
        switch (currentSort) {
            case 'alphabetical':
                return a.dataset.ticker.localeCompare(b.dataset.ticker);
                
            case 'signal':
                return parseFloat(b.dataset.signalStrength) - parseFloat(a.dataset.signalStrength);
                
            case 'recent': 
                // Use signal first, then price change as secondary sort
                if (b.dataset.signalType !== a.dataset.signalType) {
                    // Gold buy > buy > sell > neutral
                    const signalOrder = { 'goldbuy': 3, 'buy': 2, 'sell': 1, 'neutral': 0 };
                    return signalOrder[b.dataset.signalType] - signalOrder[a.dataset.signalType];
                } else {
                    return parseFloat(b.dataset.signalStrength) - parseFloat(a.dataset.signalStrength);
                }
                
            case 'price':
                return parseFloat(b.dataset.priceChange) - parseFloat(a.dataset.priceChange);
                
            default:
                return 0;
        }
    });
    
    // Reorder the cards in the DOM
    visibleCards.forEach(card => tickersGrid.appendChild(card));
}

// Add or remove a ticker from the watchlist (persist via localStorage)
function updateWatchlist(ticker, add = true) {
    if (add) {
        if (!tickerWatchlist.includes(ticker)) {
            tickerWatchlist.push(ticker);
        }
    } else {
        const index = tickerWatchlist.indexOf(ticker);
        if (index > -1) {
            tickerWatchlist.splice(index, 1);
        }
    }
    
    saveWatchlist();
}

// Handle batch upload file: parse CSV or text file to extract ticker symbols
function handleBatchUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('batchFileInput');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        alert('Please select a file to upload.');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const contents = e.target.result;
        let tickers = [];
        
        if (file.name.toLowerCase().endsWith('.csv')) {
            // Parse CSV - split by new lines and commas
            const lines = contents.split(/\r\n|\n/);
            lines.forEach(line => {
                if (line.trim()) {
                    const values = line.split(',');
                    values.forEach(val => {
                        const ticker = val.trim().toUpperCase();
                        if (ticker && !tickers.includes(ticker)) {
                            tickers.push(ticker);
                        }
                    });
                }
            });
        } else {
            // Parse as plain text, split by commas, spaces, tabs, and new lines
            tickers = contents.split(/[ ,\t\r\n]+/)
                .map(t => t.trim().toUpperCase())
                .filter(t => t && !tickerWatchlist.includes(t));
        }
        
        // Add unique tickers to watchlist
        if (tickers.length > 0) {
            tickers.forEach(ticker => {
                if (!tickerWatchlist.includes(ticker)) {
                    tickerWatchlist.push(ticker);
                }
            });
            
            saveWatchlist();
            fetchTickersData();
            
            // Close batch upload form and reset it
            document.getElementById('batchUploadForm').style.display = 'none';
            document.getElementById('showBatchUploadBtn').textContent = 'Batch Upload';
            document.getElementById('batchFileInput').value = '';
            
            alert(`Added ${tickers.length} ticker(s) to watchlist.`);
        } else {
            alert('No valid ticker symbols found in the file.');
        }
    };
    
    reader.onerror = function() {
        alert('Error reading the file.');
    };
    
    reader.readAsText(file);
}

// Persist dashboard configuration to preserve user settings
function saveDashboardConfiguration() {
    saveWatchlist();
    saveDashboardPreferences();
}

// Initialize the core dashboard functionality when the page is loaded
document.addEventListener('DOMContentLoaded', function() {
    initDashboard();
});

// Expose functions for dashboard-detail.js to access
window.currentTickerData = currentTickerData;
