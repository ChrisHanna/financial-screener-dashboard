// dashboard-detail.js - Functionality for the detailed view modal of the dashboard

// Chart instances for detailed view
let detailedPriceChart, detailedWtChart, detailedMfChart, detailedTrendExhaustChart;
let currentDetailedTicker = null;
let tickerAlerts = {};

// Load alerts from localStorage
function loadAlerts() {
    const savedAlerts = localStorage.getItem('tickerAlerts');
    if (savedAlerts) {
        try {
            tickerAlerts = JSON.parse(savedAlerts);
        } catch (e) {
            console.error('Error parsing saved alerts:', e);
            tickerAlerts = {};
        }
    }
}

// Save alerts to localStorage
function saveAlerts() {
    localStorage.setItem('tickerAlerts', JSON.stringify(tickerAlerts));
}

// Open detailed view modal for a specific ticker
function openDetailedView(ticker, detailedData) {
    const modal = document.getElementById('detailedViewModal');
    if (!modal) return;
    
    // Set current ticker
    currentDetailedTicker = ticker;
    
    // Set modal title
    const companyName = detailedData.companyName || ticker;
    document.getElementById('modalTickerTitle').textContent = `${ticker} - ${companyName}`;
    
    // Render the detailed charts
    renderDetailedCharts(detailedData);
    
    // Initialize time range slider
    addTimeRangeSlider(detailedData);
    
    // Add oscillator legend for signal reference
    addOscillatorLegend(detailedData);
    
    // Add TrendExhaust oscillator legend
    addTrendExhaustLegend();
    
    if (detailedData.recommendations) {
        displayTradingRecommendations(detailedData.recommendations);
    }
    
    // Populate historical signals table
    populateSignalsTable(detailedData);
    
    // Load and display active alerts for this ticker
    loadAlerts();
    displayActiveAlerts(ticker);
    
    // Setup alert form event listener
    setupAlertForm(ticker, detailedData);
    
    // Show the modal
    modal.style.display = 'block';
    
    // Add body class to prevent scrolling
    document.body.classList.add('modal-open');
}

// Close the detailed view modal
function closeDetailedView() {
    const modal = document.getElementById('detailedViewModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Clean up chart instances
        if (detailedPriceChart) {
            detailedPriceChart.destroy();
            detailedPriceChart = null;
        }
        
        if (detailedWtChart) {
            detailedWtChart.destroy();
            detailedWtChart = null;
        }
        
        if (detailedMfChart) {
            detailedMfChart.destroy();
            detailedMfChart = null;
        }
        
        if (detailedTrendExhaustChart) {
            detailedTrendExhaustChart.destroy();
            detailedTrendExhaustChart = null;
        }
        
        if (detailedMACDChart) {
            detailedMACDChart.destroy();
            detailedMACDChart = null;
        }
        
        if (detailedBollingerChart) {
            detailedBollingerChart.destroy();
            detailedBollingerChart = null;
        }
        
        if (detailedADXChart) {
            detailedADXChart.destroy();
            detailedADXChart = null;
        }
        
        // Reset current ticker
        currentDetailedTicker = null;
        
        // Remove body class
        document.body.classList.remove('modal-open');
    }
}

// Initialize detailed view event listeners
function initDetailedView() {
    // Attach click event to close modal button
    const closeButton = document.querySelector('.close-modal');
    if (closeButton) {
        closeButton.addEventListener('click', closeDetailedView);
    }

    // Attach click event on backdrop to close modal
    const modal = document.getElementById('detailedViewModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeDetailedView();
            }
        });
    }
    
    // Load existing alerts
    loadAlerts();
}

// Function to render detailed charts using Chart.js
function renderDetailedCharts(detailedData) {
    // Make sure to properly destroy any existing chart instances first
    if (detailedPriceChart) {
        detailedPriceChart.destroy();
        detailedPriceChart = null;
    }
    
    if (detailedWtChart) {
        detailedWtChart.destroy();
        detailedWtChart = null;
    }
    
    if (detailedMfChart) {
        detailedMfChart.destroy();
        detailedMfChart = null;
    }
    
    if (detailedTrendExhaustChart) {
        detailedTrendExhaustChart.destroy();
        detailedTrendExhaustChart = null;
    }
    
    // Continue with the rest of the function
    const dates = detailedData.dates.map(d => new Date(d));
    
    // Collect all important signal dates for vertical line alignment
    const signalDates = new Set();
    
    // Collect buy/sell signals for vertical alignment
    if (detailedData.signals) {
        if (detailedData.signals.buy) {
            detailedData.signals.buy.forEach(d => signalDates.add(new Date(d).getTime()));
        }
        if (detailedData.signals.goldBuy) {
            detailedData.signals.goldBuy.forEach(d => signalDates.add(new Date(d).getTime()));
        }
        if (detailedData.signals.sell) {
            detailedData.signals.sell.forEach(d => signalDates.add(new Date(d).getTime()));
        }
    }
    
    // Collect divergence signals
    if (detailedData.divergences) {
        ['bullish', 'bearish', 'hiddenBullish', 'hiddenBearish'].forEach(type => {
            if (detailedData.divergences[type]) {
                detailedData.divergences[type].forEach(d => signalDates.add(new Date(d).getTime()));
            }
        });
    }
    
    if (detailedData.regimes) {
        ['combinedPrice', 'combinedWT'].forEach(type => {
            if (detailedData.regimes[type]) {
                detailedData.regimes[type].forEach(d => signalDates.add(new Date(d).getTime()));
            }
        });
    }
    
    // Collect pattern signals
    if (detailedData.patterns) {
        ['fastMoneyBuy', 'fastMoneySell', 'zeroLineRejectBuy', 'zeroLineRejectSell'].forEach(type => {
            if (detailedData.patterns[type]) {
                detailedData.patterns[type].forEach(d => signalDates.add(new Date(d).getTime()));
            }
        });
    }
    
    // Convert back to Date objects for chart annotations
    const alignedSignalDates = Array.from(signalDates).map(ts => new Date(ts));
    
    // Create vertical line annotations for each signal date
    const verticalLineAnnotations = {};
    alignedSignalDates.forEach((date, i) => {
        verticalLineAnnotations[`signal_line_${i}`] = {
            type: 'line',
            xMin: date,
            xMax: date,
            borderColor: 'rgba(255, 255, 255, 0.3)',
            borderWidth: 1,
            borderDash: [3, 3],
            drawTime: 'beforeDatasetsDraw'
        };
    });
    
    // 1. Price Chart - Enhanced line chart with area fill and proper styling
    const priceCtx = document.getElementById('detailedPriceChart').getContext('2d');
    
    // Format data for line chart
    const priceData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.close ? detailedData.close[i] : detailedData.price[i]
    }));

    const timeUnit = determineTimeUnit(detailedData.interval, priceData);
    const initialScale = calculateInitialScale(priceData, detailedData.interval);
    
    // Create gradient fill
    const gradient = priceCtx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(41, 98, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(41, 98, 255, 0.0)');

    detailedPriceChart = new Chart(priceCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: detailedData.ticker,
                data: priceData,
                borderColor: '#2962ff',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 5,
                pointHoverRadius: 5,
                pointHoverBorderWidth: 2,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#2962ff',
                fill: true,
                tension: 0.1,
                segment: {
                    borderColor: function(ctx) {
                        if (!ctx.p0 || !ctx.p1) return '#2962ff';
                        return ctx.p0.parsed.y > ctx.p1.parsed.y ? '#ef5350' : '#26a69a';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            normalized: true,
            animation: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    left: 10,
                    right: 50,
                    top: 20,
                    bottom: 10
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            millisecond: 'HH:mm:ss.SSS',
                            second: 'HH:mm:ss',
                            minute: 'HH:mm',
                            hour: 'dd HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy'
                        },
                        tooltipFormat: 'MMM d, yyyy HH:mm'
                    },
                    distribution: 'linear',
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10,
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    min: initialScale.min,
                    max: initialScale.max,
                    border: {
                        color: 'rgba(255, 255, 255, 0.3)'
                    }
                },
                y: {
                    position: 'right',
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            // Format price values appropriately
                            if (value >= 1000) return value.toLocaleString();
                            if (value >= 1) return value.toFixed(2);
                            if (value >= 0.1) return value.toFixed(4);
                            if (value >= 0.01) return value.toFixed(5);
                            return value.toFixed(8);
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.3)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `${detailedData.ticker} Price Chart`,
                    color: 'white',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 30
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#555555',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].raw.x);
                            return formatTooltipDate(date, detailedData.interval);
                        },
                        label: function(context) {
                            const price = context.raw.y;
                            const precision = getPricePrecision(price);
                            const formattedPrice = price.toFixed(precision);
                            return `Price: ${formattedPrice}`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        ...verticalLineAnnotations
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'ctrl'
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: 'ctrl'
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                        onZoomComplete: function({ chart }) {
                            // Update chart after zoom
                            chart.update('none');
                        }
                    }
                }
            }
        }
    });

    // Add buy/sell signals as annotations
    addSignalAnnotations(detailedPriceChart, detailedData);
    
    // 2. WaveTrend Chart with enhanced visuals
    const wtCtx = document.getElementById('detailedWtChart').getContext('2d');
    
    // Create the WaveTrend chart with proper oscillator visualization and add zoom plugin
    detailedWtChart = new Chart(wtCtx, {
        type: 'line',
        data: {
            datasets: [
                // Background gradient for better visibility of positive/negative zones - grey area around zero
                {
                    label: 'Zero Zone',
                    data: dates.map((date) => ({
                        x: date,
                        y1: 10, // Top of zero zone band
                        y: 0, // Center at zero
                        y0: -10 // Bottom of zero zone band
                    })),
                    yAxisID: 'y',
                    backgroundColor: 'rgba(80, 80, 80, 0.1)', // Grey background for zero zone
                    fill: {
                        target: {
                            value: 0
                        },
                        below: 'rgba(80, 80, 80, 0.1)',  // Color below zero line
                        above: 'rgba(80, 80, 80, 0.1)'   // Color above zero line
                    },
                    borderWidth: 0,
                    pointRadius: 0,
                    order: 10
                },
                // WT1 Line - White line
                {
                    label: 'WT1',
                    data: dates.map((date, i) => ({
                        x: date,
                        y: detailedData.wt1[i] // Using actual values (can be positive or negative)
                    })),
                    yAxisID: 'y',
                    borderColor: '#ffffff', // White
                    backgroundColor: 'rgba(73, 148, 236, 0.25)', // Light blue - semi-transparent
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: {
                        target: 'origin',
                        above: 'rgba(73, 148, 236, 0.25)'
                    },
                    order: 1
                },
                // WT2 Line - Dark blue line
                {
                    label: 'WT2',
                    data: dates.map((date, i) => ({
                        x: date,
                        y: detailedData.wt2[i] // Using actual values (can be positive or negative)
                    })),
                    yAxisID: 'y',
                    borderColor: '#2a2e39', // Dark blue/gray
                    backgroundColor: 'rgba(31, 21, 89, 0.25)', // Purple - semi-transparent
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false, // No fill to avoid occlusion
                    order: 2
                },
                // VWAP Line - Yellow line (fast wave)
                {
                    label: 'VWAP',
                    data: dates.map((date, i) => ({
                        x: date,
                        y: detailedData.wtVwap[i] // Using actual values (can be positive or negative)
                    })),
                    yAxisID: 'y',
                    borderColor: '#ffe500', // Yellow
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    order: 3
                },
                // RSI - Purple/Red/Green line based on value
                {
                    label: 'RSI',
                    data: dates.map((date, i) => ({
                        x: date,
                        y: detailedData.rsi[i] // Using actual RSI values (0-100 range)
                    })),
                    yAxisID: 'y',
                    borderColor: function(context) {
                        if (!context.raw) return '#c33ee1'; // Default purple
                        const value = context.raw.y;
                        if (value === undefined || value === null) return '#c33ee1'; // Default purple
                        if (value <= 30) return '#3ee145'; // Oversold - green
                        if (value >= 60) return '#e13e3e'; // Overbought - red
                        return '#c33ee1'; // In between - purple
                    },
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    order: 4
                },
                // Stochastic - Light blue line
                {
                    label: 'Stochastic',
                    data: dates.map((date, i) => ({
                        x: date,
                        y: detailedData.stoch ? detailedData.stoch[i] : null // Using actual stoch values
                    })),
                    yAxisID: 'y',
                    borderColor: '#21baf3', // Light blue
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                    order: 5,
                    hidden: !detailedData.stoch // Hide if no stoch data
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    bottom: 10 
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: detailedData.interval.includes('d') ? 'day' : 'hour'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' // Subtle grid lines
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)' // Whiter text for labels
                    }
                },
                y: {
                    min: -110, // Make sure we can display the full range including markers
                    max: 110,
                    grid: {
                        color: function(context) {
                            if (context.tick.value === 0) {
                                return 'rgba(255, 255, 255, 0.5)'; // Make zero line more visible
                            }
                            return 'rgba(255, 255, 255, 0.1)'; // Subtle grid lines
                        }
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)', // Whiter text for labels
                        callback: function(value) {
                            if (value === 0 || value === 53 || value === -53 || 
                                value === 60 || value === -60 || value === 100 || 
                                value === -75) {
                                return value; // Show key values used in WaveTrend
                            }
                            return ''; // Hide other values for cleaner look
                        }
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Market Cipher B / WaveTrend Oscillator',
                    color: 'white',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'white',
                        padding: 10,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        filter: function(legendItem) {
                            // Only show main indicators in legend
                            return ['WT1', 'WT2', 'VWAP', 'RSI', 'Stochastic']
                                .includes(legendItem.text);
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        // Custom formatting for values
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label === 'Zero Zone') {
                                return ''; // Hide from tooltip
                            }
                            return `${label}: ${context.parsed.y.toFixed(2)}`;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#555555',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true
                },
                annotation: {
                    annotations: {
                        // Zero Line - solid
                        zeroLine: {
                            type: 'line',
                            yMin: 0,
                            yMax: 0,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1
                        },
                        // Overbought Lines - dashed
                        overbought1: {
                            type: 'line',
                            yMin: 53,
                            yMax: 53,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1,
                            borderDash: [3, 3]
                        },
                        overbought2: {
                            type: 'line',
                            yMin: 60,
                            yMax: 60,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5]
                        },
                        overbought3: {
                            type: 'line',
                            yMin: 100,
                            yMax: 100,
                            borderColor: 'rgba(255, 255, 255, 0.25)', // More subtle
                            borderWidth: 1,
                            borderDash: [2, 2]
                        },
                        // Oversold Lines - dashed
                        oversold1: {
                            type: 'line',
                            yMin: -53,
                            yMax: -53,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1,
                            borderDash: [3, 3]
                        },
                        oversold2: {
                            type: 'line',
                            yMin: -60,
                            yMax: -60,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5]
                        },
                        oversold3: {
                            type: 'line',
                            yMin: -75,
                            yMax: -75,
                            borderColor: 'rgba(255, 255, 255, 0.25)', // More subtle
                            borderWidth: 1,
                            borderDash: [2, 2]
                        },
                        // Include signal vertical lines
                        ...verticalLineAnnotations
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            }
        }
    });
    
    // Add all Market Cipher B patterns (signals, divergences, etc.)
    addAdvancedPatternsToChart(detailedWtChart, detailedData);
    
    // 3. Money Flow Chart with zoom plugin added
    const mfCtx = document.getElementById('detailedMfChart').getContext('2d');
    
    detailedMfChart = new Chart(mfCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Money Flow',
                data: dates.map((date, i) => {
                    const mfValue = detailedData.moneyFlow[i];
                    return {
                        x: date,
                        y: (typeof mfValue === 'number' && !isNaN(mfValue)) ? mfValue : 0,
                        raw: mfValue
                    };
                }),
                borderColor: function(context) {
                    const value = context.raw?.y;
                    return (value !== undefined && value >= 0) ? '#3cff00' : '#ff1100';
                },
                backgroundColor: function(context) {
                    const value = context.raw?.y;
                    return (value !== undefined && value >= 0) ? 'rgba(60, 255, 0, 0.3)' : 'rgba(255, 17, 0, 0.3)';
                },
                segment: {
                    borderColor: function(context) {
                        const value = context.p1?.parsed?.y;
                        return (value !== undefined && value >= 0) ? '#3cff00' : '#ff1100';
                    }
                },
                borderWidth: 2,
                pointRadius: 0,
                fill: 'origin'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: detailedData.interval.includes('d') ? 'day' : 'hour'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Money Flow',
                    color: 'white',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    labels: {
                        color: 'white'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                annotation: {
                    annotations: {
                        zeroLine: {
                            type: 'line',
                            yMin: 0,
                            yMax: 0,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1
                        },
                        ...verticalLineAnnotations
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            }
        }
    });
    
    // 4. Try to render TrendExhaust chart if we have the data
    try {
        // Check if we have TrendExhaust data from API or the required OHLC data for calculation
        const hasTrendExhaustApiData = detailedData && detailedData.trendExhaust;
        const hasOhlcDataForTrendExhaust = detailedData && 
            detailedData.high && Array.isArray(detailedData.high) && 
            detailedData.low && Array.isArray(detailedData.low) && 
            detailedData.close && Array.isArray(detailedData.close);
            
        if (hasTrendExhaustApiData || hasOhlcDataForTrendExhaust) {
            renderTrendExhaustChart(detailedData);
        } else {
            console.log("Skipping TrendExhaust chart - insufficient data");
        }
    } catch (error) {
        console.error("Error rendering TrendExhaust chart:", error);
    }
    
    try {
        renderMACDChart(detailedData);
    } catch (error) {
        console.error("Error rendering MACD chart:", error);
    }
    
    try {
        renderBollingerChart(detailedData);
    } catch (error) {
        console.error("Error rendering Bollinger Bands chart:", error);
    }
    
    try {
        renderADXChart(detailedData);
    } catch (error) {
        console.error("Error rendering ADX chart:", error);
    }
}
function renderMACDChart(detailedData) {
    if (!detailedData.macd || !detailedData.macdSignal || !detailedData.macdHistogram) {
        console.log("Skipping MACD chart - insufficient data");
        return;
    }
    
    const ctx = document.getElementById('detailedMACDChart').getContext('2d');
    
    const macdData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.macd[i]
    }));
    
    const signalData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.macdSignal[i]
    }));
    
    const histogramData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.macdHistogram[i]
    }));
    
    const timeUnit = determineTimeUnit(detailedData.interval);
    const initialScale = calculateInitialScale(macdData, detailedData.interval);
    
    detailedMACDChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'MACD',
                    data: macdData,
                    borderColor: '#2962ff',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    order: 1
                },
                {
                    label: 'Signal',
                    data: signalData,
                    borderColor: '#ff5252',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    order: 2
                },
                {
                    label: 'Histogram',
                    data: histogramData,
                    type: 'bar',
                    backgroundColor: function(context) {
                        const value = context.dataset.data[context.dataIndex].y;
                        return value >= 0 ? 'rgba(41, 98, 255, 0.3)' : 'rgba(255, 82, 82, 0.3)';
                    },
                    borderColor: function(context) {
                        const value = context.dataset.data[context.dataIndex].y;
                        return value >= 0 ? 'rgba(41, 98, 255, 0.7)' : 'rgba(255, 82, 82, 0.7)';
                    },
                    borderWidth: 1,
                    order: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            normalized: true,
            animation: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            return formatTooltipDate(tooltipItems[0].parsed.x);
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'MACD (Moving Average Convergence Divergence)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    font: {
                        size: 14
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            millisecond: 'HH:mm:ss.SSS',
                            second: 'HH:mm:ss',
                            minute: 'HH:mm',
                            hour: 'dd HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy'
                        },
                        tooltipFormat: 'MMM d, yyyy HH:mm'
                    },
                    distribution: 'linear',
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10,
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    min: initialScale.min,
                    max: initialScale.max
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x'
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    mode: 'x'
                }
            }
        }
    });
}

function renderBollingerChart(detailedData) {
    if (!detailedData.bollingerUpper || !detailedData.bollingerMiddle || !detailedData.bollingerLower) {
        console.log("Skipping Bollinger Bands chart - insufficient data");
        return;
    }
    
    const ctx = document.getElementById('detailedBollingerChart').getContext('2d');
    
    const priceData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.close ? detailedData.close[i] : detailedData.price[i]
    }));
    
    const upperData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.bollingerUpper[i]
    }));
    
    const middleData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.bollingerMiddle[i]
    }));
    
    const lowerData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.bollingerLower[i]
    }));
    
    const timeUnit = determineTimeUnit(detailedData.interval);
    const initialScale = calculateInitialScale(priceData, detailedData.interval);
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(38, 166, 154, 0.1)');
    gradient.addColorStop(1, 'rgba(38, 166, 154, 0.05)');
    
    detailedBollingerChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Price',
                    data: priceData,
                    borderColor: '#2962ff',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    order: 1
                },
                {
                    label: 'Upper Band',
                    data: upperData,
                    borderColor: 'rgba(38, 166, 154, 0.7)',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    order: 3
                },
                {
                    label: 'Middle Band (SMA 20)',
                    data: middleData,
                    borderColor: '#26a69a',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    order: 2
                },
                {
                    label: 'Lower Band',
                    data: lowerData,
                    borderColor: 'rgba(38, 166, 154, 0.7)',
                    backgroundColor: gradient,
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: {
                        target: '+1',
                        above: gradient
                    },
                    order: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            normalized: true,
            animation: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            return formatTooltipDate(tooltipItems[0].parsed.x);
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Bollinger Bands (20, 2)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    font: {
                        size: 14
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            millisecond: 'HH:mm:ss.SSS',
                            second: 'HH:mm:ss',
                            minute: 'HH:mm',
                            hour: 'dd HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy'
                        },
                        tooltipFormat: 'MMM d, yyyy HH:mm'
                    },
                    distribution: 'linear',
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10,
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    min: initialScale.min,
                    max: initialScale.max
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x'
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    mode: 'x'
                }
            }
        }
    });
}

function renderADXChart(detailedData) {
    if (!detailedData.adx || !detailedData.plusDI || !detailedData.minusDI) {
        console.log("Skipping ADX chart - insufficient data");
        return;
    }
    
    const ctx = document.getElementById('detailedADXChart').getContext('2d');
    
    const adxData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.adx[i]
    }));
    
    const plusDIData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.plusDI[i]
    }));
    
    const minusDIData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.minusDI[i]
    }));
    
    const timeUnit = determineTimeUnit(detailedData.interval);
    const initialScale = calculateInitialScale(adxData, detailedData.interval);
    
    detailedADXChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'ADX',
                    data: adxData,
                    borderColor: '#e2a400',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    order: 1
                },
                {
                    label: '+DI',
                    data: plusDIData,
                    borderColor: '#26a69a',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    order: 2
                },
                {
                    label: '-DI',
                    data: minusDIData,
                    borderColor: '#ef5350',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    order: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            normalized: true,
            animation: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            return formatTooltipDate(tooltipItems[0].parsed.x);
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'ADX (Average Directional Index)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    font: {
                        size: 14
                    }
                },
                annotation: {
                    annotations: {
                        adx_threshold: {
                            type: 'line',
                            yMin: 25,
                            yMax: 25,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            label: {
                                content: 'Trend Strength',
                                enabled: true,
                                position: 'start',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'white',
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            millisecond: 'HH:mm:ss.SSS',
                            second: 'HH:mm:ss',
                            minute: 'HH:mm',
                            hour: 'dd HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy'
                        },
                        tooltipFormat: 'MMM d, yyyy HH:mm'
                    },
                    distribution: 'linear',
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10,
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    min: initialScale.min,
                    max: initialScale.max
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    min: 0,
                    max: 100
                }
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x'
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    mode: 'x'
                }
            }
        }
    });
}


// Function to calculate candlestick sizing based on interval and data points
function calculateCandleSizing(data, interval) {
    if (!data || data.length === 0) {
        return { barPercentage: 0.6, categoryPercentage: 0.6 };
    }
    
    let sizing;
    switch(interval) {
        case '1m':
        case '2m':  
        case '5m':
        case '15m':
        case '30m':
            sizing = { barPercentage: 0.3, categoryPercentage: 0.3 };
            break;
        case '1h':
        case '4h':
            sizing = { barPercentage: 0.4, categoryPercentage: 0.4 };
            break;
        case '1d':
            sizing = { barPercentage: 0.6, categoryPercentage: 0.6 };
            break;
        case '1wk':
        case '1mo':
            sizing = { barPercentage: 0.8, categoryPercentage: 0.8 };
            break;
        default:
            sizing = { barPercentage: 0.6, categoryPercentage: 0.6 };
    }

    return sizing;
}

// Function to determine time unit based on interval
function determineTimeUnit(interval) {
    if (!interval) return 'day';

    switch (interval) {
        case '1m':
        case '2m':
        case '5m':
            return 'minute';
        case '15m':
        case '30m':
            return 'minute';
        case '1h':
        case '4h':
            return 'hour';
        case '1d':
            return 'day';
        case '1wk':
            return 'week';
        case '1mo':
            return 'month';
        default:
            return 'day';
    }
}

// Calculate initial scale for proper candle sizing
function calculateInitialScale(data, interval) {
    if (!data || data.length === 0) return { min: undefined, max: undefined };
    
    // Get first and last date
    const firstDate = new Date(data[0].x);
    const lastDate = new Date(data[data.length - 1].x);
    
    // Calculate time difference in milliseconds
    const timeDiff = lastDate - firstDate;
    const pointCount = data.length;
    
    // Calculate average time between points
    const avgTimeBetweenPoints = timeDiff / (pointCount - 1);
    
    // Set initial view to last 100 candles or all if less
    const initialPoints = Math.min(100, pointCount);
    const initialTimeWindow = avgTimeBetweenPoints * initialPoints;
    
    return {
        min: new Date(lastDate - initialTimeWindow),
        max: lastDate
    };
}

// Format tooltip date based on interval
function formatTooltipDate(date, interval) {
    if (!date) return '';
    
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    if (interval && (interval.includes('m') || interval.includes('h'))) {
        // For minute or hourly data, include time
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = false;
    }
    
    return date.toLocaleDateString(undefined, options);
}

// Calculate price change percentage for tooltip
function calculatePriceChange(open, close) {
    const change = ((close - open) / open) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

// Get appropriate price precision based on price magnitude
function getPricePrecision(price) {
    if (price >= 1000) return 0;
    if (price >= 100) return 1;
    if (price >= 10) return 2;
    if (price >= 1) return 3;
    if (price >= 0.1) return 4;
    if (price >= 0.01) return 5;
    return 6;
}

// Add buy/sell signal annotations to the price chart
function addSignalAnnotations(chart, data) {
    if (!chart || !chart.options || !chart.options.plugins || !chart.options.plugins.annotation) {
        return;
    }

    // Create point annotations for signals
    if (data.signals) {
        // Buy signals
        if (data.signals.buy && data.signals.buy.length > 0) {
            data.signals.buy.forEach((date, i) => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    const price = data.close ? data.close[index] : data.price[index];
                    chart.options.plugins.annotation.annotations[`buy${i}`] = {
                        type: 'point',
                        xValue: new Date(date),
                        yValue: price,
                        backgroundColor: 'rgba(60, 255, 0, 0.8)',
                        borderColor: 'rgba(60, 255, 0, 1)',
                        borderWidth: 2,
                        radius: 6,
                        label: {
                            content: 'Buy',
                            enabled: true,
                            position: 'top',
                            backgroundColor: 'rgba(60, 255, 0, 0.9)',
                            color: 'black',
                            font: {
                                size: 11,
                                weight: 'bold'
                            },
                            padding: 4
                        }
                    };
                }
            });
        }

        // Gold buy signals
        if (data.signals.goldBuy && data.signals.goldBuy.length > 0) {
            data.signals.goldBuy.forEach((date, i) => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    const price = data.close ? data.close[index] : data.price[index];
                    chart.options.plugins.annotation.annotations[`goldBuy${i}`] = {
                        type: 'point',
                        xValue: new Date(date),
                        yValue: price,
                        backgroundColor: 'rgba(226, 164, 0, 0.8)',
                        borderColor: 'rgba(226, 164, 0, 1)',
                        borderWidth: 2,
                        radius: 8,
                        label: {
                            content: 'Gold Buy',
                            enabled: true,
                            position: 'top',
                            backgroundColor: 'rgba(226, 164, 0, 0.9)',
                            color: 'black',
                            font: {
                                size: 11,
                                weight: 'bold'
                            },
                            padding: 4
                        }
                    };
                }
            });
        }

        // Sell signals
        if (data.signals.sell && data.signals.sell.length > 0) {
            data.signals.sell.forEach((date, i) => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    const price = data.close ? data.close[index] : data.price[index];
                    chart.options.plugins.annotation.annotations[`sell${i}`] = {
                        type: 'point',
                        xValue: new Date(date),
                        yValue: price,
                        backgroundColor: 'rgba(255, 82, 82, 0.8)',
                        borderColor: 'rgba(255, 82, 82, 1)',
                        borderWidth: 2,
                        radius: 6,
                        label: {
                            content: 'Sell',
                            enabled: true,
                            position: 'top',
                            backgroundColor: 'rgba(255, 82, 82, 0.9)',
                            color: 'black',
                            font: {
                                size: 11,
                                weight: 'bold'
                            },
                            padding: 4
                        }
                    };
                }
            });
        }
    }

    // Add divergence annotations if available
    if (data.divergences) {
        Object.entries(data.divergences).forEach(([type, dates]) => {
            if (dates && dates.length > 0) {
                dates.forEach((date, i) => {
                    const index = data.dates.indexOf(date);
                    if (index !== -1) {
                        const price = data.close ? data.close[index] : data.price[index];
                        let color, label;
                        switch(type) {
                            case 'bullish':
                                color = 'rgba(230, 0, 230, 1)';
                                label = 'Bullish Div';
                                break;
                            case 'bearish':
                                color = 'rgba(230, 0, 230, 1)';
                                label = 'Bearish Div';
                                break;
                            case 'hiddenBullish':
                                color = 'rgba(102, 255, 153, 1)';
                                label = 'Hidden Bull';
                                break;
                            case 'hiddenBearish':
                                color = 'rgba(255, 102, 102, 1)';
                                label = 'Hidden Bear';
                                break;
                            default:
                                return;
                        }

                        chart.options.plugins.annotation.annotations[`${type}${i}`] = {
                            type: 'point',
                            xValue: new Date(date),
                            yValue: price,
                            backgroundColor: color.replace('1)', '0.3)'),
                            borderColor: color,
                            borderWidth: 2,
                            radius: 5,
                            label: {
                                content: label,
                                enabled: true,
                                position: 'top',
                                backgroundColor: color.replace('1)', '0.9)'),
                                color: 'white',
                                font: {
                                    size: 10,
                                    weight: 'bold'
                                },
                                padding: 4
                            }
                        };
                    }
                });
            }
        });
    }

    chart.update();
}

// Add stochastic dataset with proper coloring
function addStochasticDataset(chart, data) {
    // Create a dataset for stochastic with dynamic coloring based on RSI comparison
    const stochDataset = {
        label: 'Stoch RSI',
        data: data.dates.map((date, i) => ({
            x: new Date(date),
            y: data.stoch[i],
            rsi: data.rsi[i]
        })),
        segment: {
            borderColor: function(context) {
                const i = context.p1DataIndex;
                const stoch = context.chart.data.datasets[context.datasetIndex].data[i].y;
                const rsi = context.chart.data.datasets[context.datasetIndex].data[i].rsi;
                
                return stoch < rsi ? '#22ff00' : '#ff0000';
            }
        },
        borderWidth: 1,
        pointRadius: 0
    };
    
    chart.data.datasets.push(stochDataset);
    chart.update();
}

// Add signal points to the WaveTrend chart
function addSignalPoints(chart, data) {
    // Add buy signals
    if (data.signals.buy && data.signals.buy.length > 0) {
        chart.data.datasets.push({
            label: 'Buy Signals',
            data: data.signals.buy.map(date => ({
                x: new Date(date),
                y: -107
            })),
            backgroundColor: '#3fff00',
            borderColor: '#3fff00',
            pointRadius: 5,
            pointStyle: 'circle',
            showLine: false
        });
    }
    
    // Add gold buy signals
    if (data.signals.goldBuy && data.signals.goldBuy.length > 0) {
        chart.data.datasets.push({
            label: 'Gold Buy Signals',
            data: data.signals.goldBuy.map(date => ({
                x: new Date(date),
                y: -107
            })),
            backgroundColor: '#e2a400',
            borderColor: '#e2a400',
            pointRadius: 7,
            pointStyle: 'circle',
            showLine: false
        });
    }
    
    // Add sell signals
    if (data.signals.sell && data.signals.sell.length > 0) {
        chart.data.datasets.push({
            label: 'Sell Signals',
            data: data.signals.sell.map(date => ({
                x: new Date(date),
                y: 107
            })),
            backgroundColor: '#ff5252',
            borderColor: '#ff5252',
            pointRadius: 5,
            pointStyle: 'circle',
            showLine: false
        });
    }
    
    // Add cross points
    if (data.signals.cross && data.signals.cross.length > 0) {
        // Group cross points by color (red vs green)
        const redCrosses = data.signals.cross
            .filter(point => point.isRed)
            .map(point => ({
                x: new Date(point.date),
                y: point.value
            }));
            
        const greenCrosses = data.signals.cross
            .filter(point => !point.isRed)
            .map(point => ({
                x: new Date(point.date),
                y: point.value
            }));
        
        // Add red crosses
        if (redCrosses.length > 0) {
            chart.data.datasets.push({
                label: 'Cross Points (Sell)',
                data: redCrosses,
                backgroundColor: '#ff5252',
                borderColor: '#ff5252',
                pointRadius: 4,
                pointStyle: 'circle',
                showLine: false
            });
        }
        
        // Add green crosses
        if (greenCrosses.length > 0) {
            chart.data.datasets.push({
                label: 'Cross Points (Buy)',
                data: greenCrosses,
                backgroundColor: '#3fff00',
                borderColor: '#3fff00',
                pointRadius: 4,
                pointStyle: 'circle',
                showLine: false
            });
        }
    }
    
    chart.update();
}

// Add all advanced Market Cipher B patterns to the WaveTrend chart with improved visuals and enhanced signals
function addAdvancedPatternsToChart(chart, data) {
    // Add cross points - small dots at every WT1-WT2 cross
    if (data.signals.cross && data.signals.cross.length > 0) {
        // Group cross points by color (red vs green)
        const redCrosses = data.signals.cross
            .filter(point => point.isRed)
            .map(point => ({
                x: new Date(point.date),
                y: point.value
            }));
            
        const greenCrosses = data.signals.cross
            .filter(point => !point.isRed)
            .map(point => ({
                x: new Date(point.date),
                y: point.value
            }));
        
        // Add red crosses - small red dots (bearish)
        if (redCrosses.length > 0) {
            chart.data.datasets.push({
                label: 'Cross Points (Sell)',
                data: redCrosses,
                backgroundColor: '#ff5252',
                borderColor: '#ff5252',
                borderWidth: 1,
                pointRadius: 3,
                pointStyle: 'circle',
                showLine: false,
                order: 1
            });
        }
        
        // Add green crosses - small green dots (bullish)
        if (greenCrosses.length > 0) {
            chart.data.datasets.push({
                label: 'Cross Points (Buy)',
                data: greenCrosses,
                backgroundColor: '#3fff00',
                borderColor: '#3fff00',
                borderWidth: 1,
                pointRadius: 3,
                pointStyle: 'circle',
                showLine: false,
                order: 1
            });
        }
    }

    // Add buy signals - larger green dots at oversold zone (position at bottom of chart)
    if (data.signals.buy && data.signals.buy.length > 0) {
        chart.data.datasets.push({
            label: 'Buy Signals',
            data: data.signals.buy.map(date => ({
                x: new Date(date),
                y: -107
            })),
            backgroundColor: '#3fff00',
            borderColor: '#3fff00',
            borderWidth: 1.5,
            pointRadius: 5,
            pointStyle: 'circle',
            showLine: false,
            order: 1
        });
    }
    
    // Add gold buy signals - large gold/orange dots for strongest buy signals
    if (data.signals.goldBuy && data.signals.goldBuy.length > 0) {
        chart.data.datasets.push({
            label: 'Gold Buy Signals',
            data: data.signals.goldBuy.map(date => ({
                x: new Date(date),
                y: -106
            })),
            backgroundColor: '#e2a400',
            borderColor: '#e2a400',
            borderWidth: 1.5,
            pointRadius: 7,
            pointStyle: 'circle',
            showLine: false,
            order: 1
        });
    }
    
    // Add sell signals - large red dots at overbought zone (position at top of chart)
    if (data.signals.sell && data.signals.sell.length > 0) {
        chart.data.datasets.push({
            label: 'Sell Signals',
            data: data.signals.sell.map(date => ({
                x: new Date(date),
                y: 105
            })),
            backgroundColor: '#ff5252',
            borderColor: '#ff5252',
            borderWidth: 1.5,
            pointRadius: 5,
            pointStyle: 'circle',
            showLine: false,
            order: 1
        });
    }
    
    // Add divergences with enhanced visual cues for easier identification
    if (data.divergences) {
        // Regular bullish divergences - purple triangles at the bottom
        if (data.divergences.bullish && data.divergences.bullish.length > 0) {
            chart.data.datasets.push({
                label: 'Bullish Divergence',
                data: data.divergences.bullish.map(date => ({
                    x: new Date(date),
                    y: -106
                })),
                backgroundColor: '#e600e6', // Purple - matching PineScript
                borderColor: '#e600e6',
                borderWidth: 1,
                pointRadius: 6,
                pointStyle: 'triangle',
                showLine: false,
                order: 1
            });
        }
        
        // Regular bearish divergences - purple triangles at the top
        if (data.divergences.bearish && data.divergences.bearish.length > 0) {
            chart.data.datasets.push({
                label: 'Bearish Divergence',
                data: data.divergences.bearish.map(date => ({
                    x: new Date(date),
                    y: 106
                })),
                backgroundColor: '#e600e6', // Purple - matching PineScript
                borderColor: '#e600e6',
                borderWidth: 1,
                pointRadius: 6,
                pointStyle: 'triangle',
                showLine: false,
                order: 1
            });
        }
        
        // Strong bullish divergences - double strength signals (larger triangles)
        if (data.divergences.strongBullish && data.divergences.strongBullish.length > 0) {
            chart.data.datasets.push({
                label: 'Strong Bullish Div.',
                data: data.divergences.strongBullish.map(date => ({
                    x: new Date(date),
                    y: -106
                })),
                backgroundColor: '#bf00ff', // Brighter purple
                borderColor: '#bf00ff',
                borderWidth: 2,
                pointRadius: 8,
                pointStyle: 'triangle',
                showLine: false,
                order: 1
            });
        }
        
        // Strong bearish divergences - double strength signals (larger triangles)
        if (data.divergences.strongBearish && data.divergences.strongBearish.length > 0) {
            chart.data.datasets.push({
                label: 'Strong Bearish Div.',
                data: data.divergences.strongBearish.map(date => ({
                    x: new Date(date),
                    y: 106
                })),
                backgroundColor: '#bf00ff', // Brighter purple
                borderColor: '#bf00ff',
                borderWidth: 2,
                pointRadius: 8,
                pointStyle: 'triangle',
                showLine: false,
                order: 1
            });
        }
        
        // Hidden bullish divergences - diamond shape
        if (data.divergences.hiddenBullish && data.divergences.hiddenBullish.length > 0) {
            chart.data.datasets.push({
                label: 'Hidden Bullish Div.',
                data: data.divergences.hiddenBullish.map(date => ({
                    x: new Date(date),
                    y: -95
                })),
                backgroundColor: '#66ff99', // Light green 
                borderColor: '#66ff99',
                borderWidth: 1,
                pointRadius: 5,
                pointStyle: 'rectRot', // Diamond shape
                showLine: false,
                order: 1
            });
        }
        
        // Hidden bearish divergences - diamond shape
        if (data.divergences.hiddenBearish && data.divergences.hiddenBearish.length > 0) {
            chart.data.datasets.push({
                label: 'Hidden Bearish Div.',
                data: data.divergences.hiddenBearish.map(date => ({
                    x: new Date(date),
                    y: 95
                })),
                backgroundColor: '#ff6666', // Light red
                borderColor: '#ff6666',
                borderWidth: 1,
                pointRadius: 5,
                pointStyle: 'rectRot', // Diamond shape
                showLine: false,
                order: 1
            });
        }
    }
    
    // Add Money Flow Divergences - special signals for when price and money flow show divergence
    if (data.moneyFlowDivergences) {
        // Bullish Money Flow Divergence - price down, money flow up
        if (data.moneyFlowDivergences.bullish && data.moneyFlowDivergences.bullish.length > 0) {
            chart.data.datasets.push({
                label: 'MF Bullish Divergence',
                data: data.moneyFlowDivergences.bullish.map(date => ({
                    x: new Date(date),
                    y: -85
                })),
                backgroundColor: '#00ffcc', // Teal
                borderColor: '#00ffcc',
                borderWidth: 1,
                pointRadius: 6,
                pointStyle: 'crossRot', // X shape
                showLine: false,
                order: 1
            });
        }
        
        // Bearish Money Flow Divergence - price up, money flow down
        if (data.moneyFlowDivergences.bearish && data.moneyFlowDivergences.bearish.length > 0) {
            chart.data.datasets.push({
                label: 'MF Bearish Divergence',
                data: data.moneyFlowDivergences.bearish.map(date => ({
                    x: new Date(date),
                    y: 85
                })),
                backgroundColor: '#ff6600', // Orange
                borderColor: '#ff6600',
                borderWidth: 1,
                pointRadius: 6,
                pointStyle: 'crossRot', // X shape
                showLine: false,
                order: 1
            });
        }
    }
    
    // Add additional patterns matching the Market Cipher B visuals
    if (data.patterns) {
        // Fast Money Buy signals - cyan stars
        if (data.patterns.fastMoneyBuy && data.patterns.fastMoneyBuy.length > 0) {
            chart.data.datasets.push({
                label: 'Fast Money Buy',
                data: data.patterns.fastMoneyBuy.map(date => ({
                    x: new Date(date),
                    y: -80
                })),
                backgroundColor: '#31c0ff', // Light blue/cyan
                borderColor: '#31c0ff',
                borderWidth: 1,
                pointRadius: 6,
                pointStyle: 'star',
                showLine: false,
                order: 1
            });
        }
        
        // Fast Money Sell signals - magenta stars
        if (data.patterns.fastMoneySell && data.patterns.fastMoneySell.length > 0) {
            chart.data.datasets.push({
                label: 'Fast Money Sell',
                data: data.patterns.fastMoneySell.map(date => ({
                    x: new Date(date),
                    y: 80
                })),
                backgroundColor: '#ff00f0', // Magenta
                borderColor: '#ff00f0',
                borderWidth: 1,
                pointRadius: 6,
                pointStyle: 'star',
                showLine: false,
                order: 1
            });
        }
        
        // Zero Line Reject Buy - circles near zero line
        if (data.patterns.zeroLineRejectBuy && data.patterns.zeroLineRejectBuy.length > 0) {
            chart.data.datasets.push({
                label: 'Zero Line Buy',
                data: data.patterns.zeroLineRejectBuy.map(date => ({
                    x: new Date(date),
                    y: -20
                })),
                backgroundColor: '#31c0ff', // Light blue/cyan
                borderColor: '#31c0ff',
                borderWidth: 1,
                pointRadius: 4,
                pointStyle: 'circle',
                showLine: false,
                order: 1
            });
        }
        
        // Zero Line Reject Sell - circles near zero line
        if (data.patterns.zeroLineRejectSell && data.patterns.zeroLineRejectSell.length > 0) {
            chart.data.datasets.push({
                label: 'Zero Line Sell',
                data: data.patterns.zeroLineRejectSell.map(date => ({
                    x: new Date(date),
                    y: 20
                })),
                backgroundColor: '#ff9900', // Orange
                borderColor: '#ff9900',
                borderWidth: 1,
                pointRadius: 4,
                pointStyle: 'circle',
                showLine: false,
                order: 1
            });
        }
        
        // RSI Trend Break - Key RSI trend breaks that can signal reversals
        if (data.patterns.rsiTrendBreak) {
            if (data.patterns.rsiTrendBreak.bullish && data.patterns.rsiTrendBreak.bullish.length > 0) {
                chart.data.datasets.push({
                    label: 'RSI Trend Break (Buy)',
                    data: data.patterns.rsiTrendBreak.bullish.map(date => ({
                        x: new Date(date),
                        y: -70
                    })),
                    backgroundColor: '#00ff66', // Bright green
                    borderColor: '#00ff66',
                    borderWidth: 1,
                    pointRadius: 5,
                    pointStyle: 'rect', // Square
                    showLine: false,
                    order: 1
                });
            }
            
            if (data.patterns.rsiTrendBreak.bearish && data.patterns.rsiTrendBreak.bearish.length > 0) {
                chart.data.datasets.push({
                    label: 'RSI Trend Break (Sell)',
                    data: data.patterns.rsiTrendBreak.bearish.map(date => ({
                        x: new Date(date),
                        y: 70
                    })),
                    backgroundColor: '#ff4d4d', // Bright red
                    borderColor: '#ff4d4d',
                    borderWidth: 1,
                    pointRadius: 5,
                    pointStyle: 'rect', // Square
                    showLine: false,
                    order: 1
                });
            }
        }
    }
    
    if (data.regimes) {
        if (data.regimes.combinedPrice && data.regimes.combinedPrice.length > 0) {
            chart.data.datasets.push({
                label: 'Price Regime Change',
                data: data.regimes.combinedPrice.map(date => ({
                    x: new Date(date),
                    y: 0  // Center of chart
                })),
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderColor: 'rgba(255, 255, 255, 0.7)',
                borderWidth: 1,
                pointRadius: 8,
                pointStyle: 'rectRot',  // Diamond shape
                showLine: false,
                order: 0
            });
            
            data.regimes.combinedPrice.forEach((date, i) => {
                const dateObj = new Date(date);
                chart.options.plugins.annotation.annotations[`regime_price_${i}`] = {
                    type: 'line',
                    xMin: dateObj,
                    xMax: dateObj,
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        content: 'Regime Change',
                        enabled: true,
                        position: 'top',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        font: {
                            weight: 'bold'
                        }
                    }
                };
            });
        }
        
        if (data.regimes.combinedWT && data.regimes.combinedWT.length > 0) {
            chart.data.datasets.push({
                label: 'WT Regime Change',
                data: data.regimes.combinedWT.map(date => ({
                    x: new Date(date),
                    y: -5  // Slightly below center
                })),
                backgroundColor: 'rgba(255, 215, 0, 0.7)',  // Gold
                borderColor: 'rgba(255, 215, 0, 0.7)',
                borderWidth: 1,
                pointRadius: 8,
                pointStyle: 'star',
                showLine: false,
                order: 0
            });
        }
    }
    
    chart.update('none'); // Update without animation for better performance
}

// Populate historical signals table with enhanced signals including divergences
function populateSignalsTable(data) {
    const tableBody = document.getElementById('signalsTableBody');
    if (!tableBody) return;
    
    // Clear the table
    tableBody.innerHTML = '';
    
    // Track signals in chronological order with enhanced information
    const allSignals = [];
    
    // Process standard buy signals
    if (data.signals.buy && data.signals.buy.length > 0) {
        data.signals.buy.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Buy',
                    subType: 'Standard',
                    price: data.price[index],
                    index: index,
                    priority: 3 // Priority for sorting (higher = more important)
                });
            }
        });
    }
    
    // Process gold buy signals (highest priority)
    if (data.signals.goldBuy && data.signals.goldBuy.length > 0) {
        data.signals.goldBuy.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Gold Buy',
                    subType: 'Strong',
                    price: data.price[index],
                    index: index,
                    priority: 5
                });
            }
        });
    }
    
    // Process sell signals
    if (data.signals.sell && data.signals.sell.length > 0) {
        data.signals.sell.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Sell',
                    subType: 'Standard',
                    price: data.price[index],
                    index: index,
                    priority: 3
                });
            }
        });
    }
    
    // Add bullish divergences
    if (data.divergences && data.divergences.bullish && data.divergences.bullish.length > 0) {
        data.divergences.bullish.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Buy',
                    subType: 'Bullish Divergence',
                    price: data.price[index],
                    index: index,
                    priority: 4
                });
            }
        });
    }
    
    // Add hidden bullish divergences
    if (data.divergences && data.divergences.hiddenBullish && data.divergences.hiddenBullish.length > 0) {
        data.divergences.hiddenBullish.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Buy',
                    subType: 'Hidden Bullish Div',
                    price: data.price[index],
                    index: index,
                    priority: 2
                });
            }
        });
    }
    
    // Add bearish divergences
    if (data.divergences && data.divergences.bearish && data.divergences.bearish.length > 0) {
        data.divergences.bearish.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Sell',
                    subType: 'Bearish Divergence',
                    price: data.price[index],
                    index: index,
                    priority: 4
                });
            }
        });
    }
    
    // Add hidden bearish divergences
    if (data.divergences && data.divergences.hiddenBearish && data.divergences.hiddenBearish.length > 0) {
        data.divergences.hiddenBearish.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Sell',
                    subType: 'Hidden Bearish Div',
                    price: data.price[index],
                    index: index,
                    priority: 2
                });
            }
        });
    }
    
    // Add Money Flow bullish divergences
    if (data.divergences && data.divergences.mfBullish && data.divergences.mfBullish.length > 0) {
        data.divergences.mfBullish.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Buy',
                    subType: 'MF Bullish Div',
                    price: data.price[index],
                    index: index,
                    priority: 3
                });
            }
        });
    }
    
    // Add Money Flow bearish divergences
    if (data.divergences && data.divergences.mfBearish && data.divergences.mfBearish.length > 0) {
        data.divergences.mfBearish.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: date,
                    type: 'Sell',
                    subType: 'MF Bearish Div',
                    price: data.price[index],
                    index: index,
                    priority: 3
                });
            }
        });
    }
    
    // Add fast money signals
    if (data.patterns) {
        // RSI Trend Break Buy
        if (data.patterns.rsiTrendBreakBuy && data.patterns.rsiTrendBreakBuy.length > 0) {
            data.patterns.rsiTrendBreakBuy.forEach(date => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    allSignals.push({
                        date: date,
                        type: 'Buy',
                        subType: 'RSI Trend Break',
                        price: data.price[index],
                        index: index,
                        priority: 3
                    });
                }
            });
        }
        
        // RSI Trend Break Sell
        if (data.patterns.rsiTrendBreakSell && data.patterns.rsiTrendBreakSell.length > 0) {
            data.patterns.rsiTrendBreakSell.forEach(date => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    allSignals.push({
                        date: date,
                        type: 'Sell',
                        subType: 'RSI Trend Break',
                        price: data.price[index],
                        index: index,
                        priority: 3
                    });
                }
            });
        }
        
        // Fast Money Buy
        if (data.patterns.fastMoneyBuy && data.patterns.fastMoneyBuy.length > 0) {
            data.patterns.fastMoneyBuy.forEach(date => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    allSignals.push({
                        date: date,
                        type: 'Buy',
                        subType: 'Fast Money',
                        price: data.price[index],
                        index: index,
                        priority: 3
                    });
                }
            });
        }
        
        // Fast Money Sell
        if (data.patterns.fastMoneySell && data.patterns.fastMoneySell.length > 0) {
            data.patterns.fastMoneySell.forEach(date => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    allSignals.push({
                        date: date,
                        type: 'Sell',
                        subType: 'Fast Money',
                        price: data.price[index],
                        index: index,
                        priority: 3
                    });
                }
            });
        }
        
        // Zero Line Reject Buy
        if (data.patterns.zeroLineRejectBuy && data.patterns.zeroLineRejectBuy.length > 0) {
            data.patterns.zeroLineRejectBuy.forEach(date => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    allSignals.push({
                        date: date,
                        type: 'Buy',
                        subType: 'Zero Line Reject',
                        price: data.price[index],
                        index: index,
                        priority: 2
                    });
                }
            });
        }
        
        // Zero Line Reject Sell
        if (data.patterns.zeroLineRejectSell && data.patterns.zeroLineRejectSell.length > 0) {
            data.patterns.zeroLineRejectSell.forEach(date => {
                const index = data.dates.indexOf(date);
                if (index !== -1) {
                    allSignals.push({
                        date: date,
                        type: 'Sell',
                        subType: 'Zero Line Reject',
                        price: data.price[index],
                        index: index,
                        priority: 2
                    });
                }
            });
        }
    }
    
    if (data.regimes && data.regimes.combinedPrice) {
        data.regimes.combinedPrice.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: new Date(date),
                    type: 'Regime Change',
                    subType: 'Price',
                    price: data.price[index],
                    index: index,
                    priority: 5  // High priority for regime changes
                });
            }
        });
    }
    
    if (data.regimes && data.regimes.combinedWT) {
        data.regimes.combinedWT.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                allSignals.push({
                    date: new Date(date),
                    type: 'Regime Change',
                    subType: 'WaveTrend',
                    price: data.price[index],
                    index: index,
                    priority: 5  // High priority for regime changes
                });
            }
        });
    }
    
    // Sort signals by date (newest first)
    allSignals.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate percentage changes and detect confluence signals
    allSignals.forEach((signal, i) => {
        if (i < allSignals.length - 1) {
            const currentPrice = signal.price;
            const prevPrice = allSignals[i + 1].price;
            signal.change = ((currentPrice - prevPrice) / prevPrice) * 100;
        } else {
            signal.change = null;
        }
        
        // Check for signal confluence (multiple signals on the same date)
        if (i > 0 && signal.date === allSignals[i-1].date) {
            signal.hasConfluence = true;
            allSignals[i-1].hasConfluence = true;
        }
    });
    
    // Limit to last 25 signals to keep the table manageable but show enough history
    const displaySignals = allSignals.slice(0, 25);
    
    // Add signals to table
    displaySignals.forEach(signal => {
        const row = document.createElement('tr');
        
        // Format date
        const signalDate = new Date(signal.date);
        const formattedDate = signalDate.toLocaleString();
        
        // Format price
        const formattedPrice = signal.price < 0.01 ? signal.price.toFixed(6) : 
                               signal.price < 1 ? signal.price.toFixed(4) :
                               signal.price < 10 ? signal.price.toFixed(3) :
                               signal.price.toFixed(2);
        
        // Determine signal color class
        let signalClass;
        if (signal.type === 'Buy') {
            signalClass = signal.subType === 'Bullish Divergence' ? 'text-success fw-bold' :
                          signal.subType === 'MF Bullish Div' ? 'text-success fw-bold' :
                          signal.subType === 'Fast Money' ? 'text-info' : 
                          signal.subType === 'RSI Trend Break' ? 'text-success fw-bold' : 'text-success';
        } else { // Sell
            signalClass = signal.subType === 'Bearish Divergence' ? 'text-danger fw-bold' :
                          signal.subType === 'MF Bearish Div' ? 'text-danger fw-bold' :
                          signal.subType === 'Fast Money' ? 'text-pink' : 
                          signal.subType === 'RSI Trend Break' ? 'text-danger fw-bold' : 'text-danger';
        }
        
        // Special case for Gold Buy
        if (signal.type === 'Gold Buy') {
            signalClass = 'text-warning fw-bold';
        }
        
        // Determine change color class
        const changeClass = signal.change > 0 ? 'text-success' : 
                           signal.change < 0 ? 'text-danger' : 
                           'text-muted';
        
        // Format change
        const formattedChange = signal.change !== null ? 
                              `${signal.change > 0 ? '+' : ''}${signal.change.toFixed(2)}%` : 
                              '-';
        
        // Add confluence indicator
        const confluenceIndicator = signal.hasConfluence ? 
            '<span class="ms-1 badge bg-info" title="Multiple signals on same date">+</span>' : '';
            
        // Create the table row content
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td class="${signalClass}">${signal.type} (${signal.subType})${confluenceIndicator}</td>
            <td>${formattedPrice}</td>
            <td class="${changeClass}">${formattedChange}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Display active alerts for a ticker
function displayActiveAlerts(ticker) {
    const alertsList = document.getElementById('activeAlertsList');
    if (!alertsList) return;
    
    // Clear the list
    alertsList.innerHTML = '';
    
    // Get alerts for this ticker
    const alerts = tickerAlerts[ticker] || [];
    
    // If no alerts, show a message
    if (alerts.length === 0) {
        alertsList.innerHTML = '<li class="list-group-item bg-dark text-white">No active alerts</li>';
        return;
    }
    
    // Add each alert to the list
    alerts.forEach((alert, index) => {
        const alertItem = document.createElement('li');
        alertItem.className = 'list-group-item bg-dark text-white d-flex justify-content-between align-items-center';
        
        // Format alert text based on type
        let alertText = '';
        switch (alert.type) {
            case 'price':
                alertText = `Price ${alert.condition} ${alert.value}`;
                break;
            case 'signal':
                alertText = `Any new signal`;
                break;
            case 'wt':
                alertText = `WT Crossover`;
                break;
        }
        
        alertItem.innerHTML = `
            <span>${alertText}</span>
            <button class="btn btn-sm btn-danger" data-index="${index}">Remove</button>
        `;
        
        // Add click event to delete button
        const deleteBtn = alertItem.querySelector('button');
        deleteBtn.addEventListener('click', function() {
            const alertIndex = this.dataset.index;
            alerts.splice(alertIndex, 1);
            tickerAlerts[ticker] = alerts;
            saveAlerts();
            displayActiveAlerts(ticker);
        });
        
        alertsList.appendChild(alertItem);
    });
}

// Set up alert form
function setupAlertForm(ticker, data) {
    const saveAlertBtn = document.getElementById('saveAlertBtn');
    if (!saveAlertBtn) return;
    
    const currentPrice = data.summary?.currentPrice || 0;
    
    // Update price field with current price as placeholder
    const priceThreshold = document.getElementById('priceThreshold');
    if (priceThreshold) {
        priceThreshold.placeholder = `Current: ${currentPrice.toFixed(2)}`;
    }
    
    // Handle alert type change
    const alertType = document.getElementById('alertType');
    if (alertType) {
        alertType.addEventListener('change', function() {
            const priceFields = document.getElementById('priceAlertFields');
            if (priceFields) {
                priceFields.style.display = this.value === 'price' ? 'block' : 'none';
            }
        });
    }
    
    // Handle save alert button
    saveAlertBtn.addEventListener('click', function() {
        const type = document.getElementById('alertType').value;
        
        // Initialize ticker alerts array if needed
        if (!tickerAlerts[ticker]) {
            tickerAlerts[ticker] = [];
        }
        
        let newAlert = { type };
        
        switch (type) {
            case 'price':
                const threshold = parseFloat(document.getElementById('priceThreshold').value);
                if (isNaN(threshold)) {
                    alert('Please enter a valid price threshold');
                    return;
                }
                newAlert.value = threshold;
                newAlert.condition = threshold > currentPrice ? 'above' : 'below';
                break;
            case 'signal':
                newAlert.value = 'Any';
                break;
            case 'wt':
                newAlert.value = 'Crossover';
                break;
        }
        
        // Add the alert
        tickerAlerts[ticker].push(newAlert);
        saveAlerts();
        
        // Refresh the alerts list
        displayActiveAlerts(ticker);
        
        // Reset the form
        document.getElementById('alertsForm').reset();
        
        alert('Alert added successfully!');
    });
}

// Add time range slider functionality to the detailed view
function addTimeRangeSlider(detailedData) {
    const container = document.getElementById('timeRangeSliderContainer');
    if (!container) return;
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Format dates for display
    const dates = detailedData.dates.map(d => new Date(d));
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    // Create slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'time-range-slider mt-3 mb-4';
    
    // Create time range display
    const rangeDisplay = document.createElement('div');
    rangeDisplay.className = 'time-range-display mb-2 d-flex justify-content-between';
    rangeDisplay.innerHTML = `
        <span id="rangeStartDisplay">${startDate.toLocaleDateString()}</span>
        <span id="rangeEndDisplay">${endDate.toLocaleDateString()}</span>
    `;
    
    // Create slider controls
    const sliderControls = document.createElement('div');
    sliderControls.className = 'slider-controls';
    sliderControls.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <input type="range" id="timeRangeStart" min="0" max="${dates.length - 1}" value="0" class="form-range slider-start" style="width: 48%;">
            <input type="range" id="timeRangeEnd" min="0" max="${dates.length - 1}" value="${dates.length - 1}" class="form-range slider-end" style="width: 48%;">
        </div>
        <div class="d-flex justify-content-center mt-2">
            <div class="btn-group">
                <button id="lastWeekBtn" class="btn btn-sm btn-outline-light">Last Week</button>
                <button id="lastMonthBtn" class="btn btn-sm btn-outline-light">Last Month</button>
                <button id="last3MonthsBtn" class="btn btn-sm btn-outline-light">Last 3 Months</button>
                <button id="allDataBtn" class="btn btn-sm btn-outline-light">All Data</button>
            </div>
        </div>
    `;
    
    // Append elements
    sliderContainer.appendChild(rangeDisplay);
    sliderContainer.appendChild(sliderControls);
    container.appendChild(sliderContainer);
    
    // Initialize sliders
    const startSlider = document.getElementById('timeRangeStart');
    const endSlider = document.getElementById('timeRangeEnd');
    const startDisplay = document.getElementById('rangeStartDisplay');
    const endDisplay = document.getElementById('rangeEndDisplay');
    
    // Function to update charts based on selected time range
    function updateTimeRange() {
        const startIdx = parseInt(startSlider.value);
        const endIdx = parseInt(endSlider.value);
        
        // Ensure start is always less than end
        if (startIdx >= endIdx) {
            startSlider.value = Math.max(0, endIdx - 1);
            return;
        }
        
        // Update display labels
        startDisplay.textContent = dates[startIdx].toLocaleDateString();
        endDisplay.textContent = dates[endIdx].toLocaleDateString();
        
        // Update chart ranges
        updateChartTimeRange(startIdx, endIdx);
    }
    
    // Event listeners for sliders
    startSlider.addEventListener('input', updateTimeRange);
    endSlider.addEventListener('input', updateTimeRange);
    
    // Quick selection buttons
    document.getElementById('lastWeekBtn').addEventListener('click', () => {
        setTimeRangeByDays(7);
    });
    
    document.getElementById('lastMonthBtn').addEventListener('click', () => {
        setTimeRangeByDays(30);
    });
    
    document.getElementById('last3MonthsBtn').addEventListener('click', () => {
        setTimeRangeByDays(90);
    });
    
    document.getElementById('allDataBtn').addEventListener('click', () => {
        startSlider.value = 0;
        endSlider.value = dates.length - 1;
        updateTimeRange();
    });
    
    // Helper function to set range by number of days back from the end
    function setTimeRangeByDays(days) {
        const endDate = dates[dates.length - 1];
        const targetDate = new Date(endDate);
        targetDate.setDate(endDate.getDate() - days);
        
        // Find the closest index for the target date
        let startIdx = 0;
        for (let i = 0; i < dates.length; i++) {
            if (dates[i] >= targetDate) {
                startIdx = i;
                break;
            }
        }
        
        startSlider.value = startIdx;
        endSlider.value = dates.length - 1;
        updateTimeRange();
    }
    
    // Initial update
    updateTimeRange();
}

// Update all charts based on selected time range
function updateChartTimeRange(startIdx, endIdx) {
    if (detailedPriceChart && detailedWtChart && detailedMfChart) {
        // Update price chart
        detailedPriceChart.options.scales.x.min = detailedPriceChart.data.datasets[0].data[startIdx].x;
        detailedPriceChart.options.scales.x.max = detailedPriceChart.data.datasets[0].data[endIdx].x;
        detailedPriceChart.update();
        
        // Update WaveTrend chart
        detailedWtChart.options.scales.x.min = detailedWtChart.data.datasets[2].data[startIdx].x;
        detailedWtChart.options.scales.x.max = detailedWtChart.data.datasets[2].data[endIdx].x;
        detailedWtChart.update();
        
        // Update Money Flow chart
        detailedMfChart.options.scales.x.min = detailedMfChart.data.datasets[0].data[startIdx].x;
        detailedMfChart.options.scales.x.max = detailedMfChart.data.datasets[0].data[endIdx].x;
        detailedMfChart.update();
    }
}

// Add a comprehensive legend to the detailed view for the oscillator chart with white text
function addOscillatorLegend(data) {
    const container = document.getElementById('oscillatorLegendContainer');
    if (!container) return;
    
    // Clear the container
    container.innerHTML = '';
    
    // Create a table-based legend with all signal types organized by categories - with white text
    const legendHTML = `
    <div class="card bg-dark mb-3">
        <div class="card-header">
            <h5 class="mb-0 text-white">Market Cipher B Signals Legend</h5>
        </div>
        <div class="card-body">
            <div class="row">
                <!-- Buy Signals -->
                <div class="col-md-6 mb-3">
                    <h6 class="border-bottom border-light pb-1 text-white">Buy Signals</h6>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#3fff00;"></span>
                        <small class="text-white">Regular Buy Signal - WT crosses in oversold zone</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#e2a400;"></span>
                        <small class="text-white">Gold Buy Signal - WT crosses with RSI < 30</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#e600e6;"></span>
                        <small class="text-white">Bullish Divergence - Price lower, WT higher</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#bf00ff;"></span>
                        <small class="text-white">Strong Bullish Div - Multiple timeframe confirmation</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#66ff99;"></span>
                        <small class="text-white">Hidden Bullish Div - Price higher, WT lower (continuation)</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); background:#31c0ff;"></span>
                        <small class="text-white">Fast Money Buy - Quick momentum shift</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#31c0ff;"></span>
                        <small class="text-white">Zero Line Reject Buy - Bounce from zero</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#00ffcc;"></span>
                        <small class="text-white">Money Flow Bullish Div - Price down, MF up</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; background:#00ff66;"></span>
                        <small class="text-white">RSI Trend Break (Buy) - Bullish reversal signal</small>
                    </div>
                </div>
                
                <!-- Sell Signals -->
                <div class="col-md-6 mb-3">
                    <h6 class="border-bottom border-light pb-1 text-white">Sell Signals</h6>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#ff5252;"></span>
                        <small class="text-white">Regular Sell Signal - WT crosses in overbought zone</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#e600e6;"></span>
                        <small class="text-white">Bearish Divergence - Price higher, WT lower</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#bf00ff;"></span>
                        <small class="text-white">Strong Bearish Div - Multiple timeframe confirmation</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#ff6666;"></span>
                        <small class="text-white">Hidden Bearish Div - Price lower, WT higher (continuation)</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); background:#ff00f0;"></span>
                        <small class="text-white">Fast Money Sell - Quick momentum shift</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#ff9900;"></span>
                        <small class="text-white">Zero Line Reject Sell - Drop from zero</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:#ff6600;"></span>
                        <small class="text-white">Money Flow Bearish Div - Price up, MF down</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; background:#ff4d4d;"></span>
                        <small class="text-white">RSI Trend Break (Sell) - Bearish reversal signal</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; transform:rotate(45deg); background:rgba(255, 255, 255, 0.7);"></span>
                        <small class="text-white">Price Regime Change - Market structure shift</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; font-size:14px;">★</span>
                        <small class="text-white">WT Regime Change - Oscillator structure shift</small>
                    </div>
                </div>
            </div>
            
            <!-- Guide Lines -->
            <div class="row mt-2">
                <div class="col-12">
                    <h6 class="border-bottom border-light pb-1 text-white">Indicator Guidelines</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px dashed rgba(255,255,255,0.5);"></span>
                                <small class="text-white">±53: Mild Oversold/Overbought</small>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px dashed rgba(255,255,255,0.5);"></span>
                                <small class="text-white">±60: Moderate Oversold/Overbought</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid rgba(255,255,255,0.5);"></span>
                                <small class="text-white">0: Zero Line - Key Support/Resistance</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid #ffffff;"></span>
                                <small class="text-white">WT1 Line (White) - Fast Wave</small>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid #2a2e39;"></span>
                                <small class="text-white">WT2 Line (Dark Blue) - Slow Wave</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid #c33ee1;"></span>
                                <small class="text-white">RSI Line - Trend Strength</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Trading Tips -->
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="border-bottom border-light pb-1 text-white">Trading Tips</h6>
                    <ul class="list-unstyled small text-white mb-0">
                        <li class="mb-1">• Confluence of multiple signals offers stronger trade probability</li>
                        <li class="mb-1">• Divergences are powerful reversal signals, especially when combined with key levels</li>
                        <li class="mb-1">• Use Money Flow to confirm the strength of a trend</li>
                        <li class="mb-1">• Fast Money signals work best in ranging markets</li>
                        <li>• Wait for confirmations on higher timeframes for important trades</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    `;
    
    // Add the legend to the container
    container.innerHTML = legendHTML;
}

// Add a function to calculate Williams %R
function calculateWilliamsR(high, low, close, period) {
    if (!Array.isArray(high) || !Array.isArray(low) || !Array.isArray(close) || 
        high.length === 0 || low.length === 0 || close.length === 0) {
        return [];
    }

    const length = Math.min(high.length, low.length, close.length);
    const result = new Array(length).fill(null);

    for (let i = period - 1; i < length; i++) {
        let highestHigh = -Infinity;
        let lowestLow = Infinity;

        // Find highest high and lowest low in the lookback period
        for (let j = 0; j < period; j++) {
            const index = i - j;
            if (index < 0) continue;

            const currentHigh = high[index];
            const currentLow = low[index];

            if (!isNaN(currentHigh) && currentHigh > highestHigh) {
                highestHigh = currentHigh;
            }
            if (!isNaN(currentLow) && currentLow < lowestLow) {
                lowestLow = currentLow;
            }
        }

        // Calculate Williams %R only if we have valid high/low values
        if (highestHigh !== -Infinity && lowestLow !== Infinity && highestHigh !== lowestLow) {
            const currentClose = close[i];
            result[i] = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
        }
    }

    return result;
}

// Calculate Exponential Moving Average
function calculateEMA(data, period) {
    const result = [];
    const k = 2 / (period + 1);
    
    // First value is a simple average
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            if (i === period - 1) {
                result.push(ema);
            } else {
                ema = data[i] * k + ema * (1 - k);
                result.push(ema);
            }
        }
    }
    return result;
}

// Function to render a TrendExhaust chart
function renderTrendExhaustChart(detailedData) {
    // Check if we have TrendExhaust data from the API
    if (detailedData.trendExhaust) {
        console.log("Using TrendExhaust data from API");
        
        const trendExhaustCtx = document.getElementById('detailedTrendExhaustChart');
        if (!trendExhaustCtx) {
            console.warn('TrendExhaust chart canvas not found');
            return;
        }

        if (detailedTrendExhaustChart) {
            detailedTrendExhaustChart.destroy();
            detailedTrendExhaustChart = null;
        }
        
        // Get TrendExhaust data from API response
        const teData = detailedData.trendExhaust;
        const dates = detailedData.dates.map(d => new Date(d));
        const threshold = teData.parameters?.threshold || 20;
        
        // Prepare data arrays for plotting
        const shortRData = [];
        const longRData = [];
        const avgRData = [];
        
        for (let i = 0; i < dates.length; i++) {
            if (teData.shortPercentR[i] !== null) {
                shortRData.push({
                    x: dates[i],
                    y: teData.shortPercentR[i]
                });
            }
            
            if (teData.longPercentR[i] !== null) {
                longRData.push({
                    x: dates[i],
                    y: teData.longPercentR[i]
                });
            }
            
            if (teData.avgPercentR[i] !== null) {
                avgRData.push({
                    x: dates[i],
                    y: teData.avgPercentR[i]
                });
            }
        }
        
        // Create signals object from API data
        const signals = {
            overbought: teData.signals.overbought.map(d => new Date(d)),
            oversold: teData.signals.oversold.map(d => new Date(d)),
            obReversal: teData.signals.obReversal.map(d => new Date(d)),
            osReversal: teData.signals.osReversal.map(d => new Date(d)),
            crosses: []
        };
        
        // Debug logging
        console.log("TrendExhaust API signals:", teData.signals);
        
        // Convert bull/bear crosses to the format expected by the chart
        if (teData.signals.bullCross) {
            teData.signals.bullCross.forEach(date => {
                signals.crosses.push({
                    date: new Date(date),
                    type: 'bull'
                });
            });
        }
        
        if (teData.signals.bearCross) {
            teData.signals.bearCross.forEach(date => {
                signals.crosses.push({
                    date: new Date(date),
                    type: 'bear'
                });
            });
        }
        
        // Debug logging
        console.log("Processed TrendExhaust signals:", signals);
        
        // Create TrendExhaust Chart
        detailedTrendExhaustChart = new Chart(trendExhaustCtx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Short %R',
                        data: shortRData,
                        borderColor: '#ffffff',  // White
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Long %R',
                        data: longRData,
                        borderColor: '#ffe500',  // Yellow
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Average %R',
                        data: avgRData,
                        borderColor: '#31c0ff',  // Blue
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: determineTimeUnit(detailedData.interval || '1d')
                        },
                        grid: {
                            display: false,
                            drawBorder: true,
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            maxRotation: 0
                        }
                    },
                    y: {
                        min: -100,
                        max: 0,
                        grid: {
                            color: function(context) {
                                if (context.tick.value === 0 || 
                                    context.tick.value === -50 || 
                                    context.tick.value === -100 ||
                                    context.tick.value === -threshold ||
                                    context.tick.value === -100 + threshold) {
                                    return 'rgba(255, 255, 255, 0.3)';
                                }
                                return 'rgba(255, 255, 255, 0.1)';
                            }
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: function(value) {
                                if (value === 0 || value === -50 || value === -100 || 
                                    value === -threshold || value === -100 + threshold) {
                                    return value;
                                }
                                return '';
                            }
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'TrendExhaust Oscillator',
                        color: 'white',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: 'white',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            topThreshold: {
                                type: 'line',
                                yMin: -threshold,
                                yMax: -threshold,
                                borderColor: 'rgba(202, 0, 23, 0.7)',
                                borderWidth: 1,
                                borderDash: [3, 3],
                                label: {
                                    display: true,
                                    content: 'OB',
                                    position: 'start',
                                    backgroundColor: 'rgba(202, 0, 23, 0.7)',
                                    color: '#ffffff',
                                    font: { size: 10 }
                                }
                            },
                            middleLine: {
                                type: 'line',
                                yMin: -50,
                                yMax: -50,
                                borderColor: 'rgba(128, 128, 128, 0.5)',
                                borderWidth: 1
                            },
                            bottomThreshold: {
                                type: 'line',
                                yMin: -100 + threshold,
                                yMax: -100 + threshold,
                                borderColor: 'rgba(36, 102, 167, 0.7)',
                                borderWidth: 1,
                                borderDash: [3, 3],
                                label: {
                                    display: true,
                                    content: 'OS',
                                    position: 'start',
                                    backgroundColor: 'rgba(36, 102, 167, 0.7)',
                                    color: '#ffffff',
                                    font: { size: 10 }
                                }
                            }
                        }
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x'
                        },
                        zoom: {
                            wheel: {
                                enabled: true
                            },
                            mode: 'x'
                        }
                    }
                }
            }
        });
        
        // Add signals to the chart
        addTrendExhaustSignals(detailedTrendExhaustChart, signals, threshold, avgRData);
        
        // Add legend
        addTrendExhaustLegend();
        
        return;
    }
    
    // If we don't have TrendExhaust data from the API, calculate it locally
    // ... rest of the function remains unchanged
}

// Add TrendExhaust signals to chart
function addTrendExhaustSignals(chart, signals, threshold = 20, avgRData = []) {
    if (!chart || !chart.options || !chart.options.plugins || !chart.options.plugins.annotation) {
        console.error("Chart or annotation plugin not available");
        return;
    }
    
    console.log("Adding TrendExhaust signals to chart with threshold:", threshold);
    console.log("Signals to add:", {
        obReversal: signals.obReversal.length,
        osReversal: signals.osReversal.length,
        overbought: signals.overbought.length,
        oversold: signals.oversold.length,
        crosses: signals.crosses.length
    });
    
    // Helper function to find the y-value (avgR) for a given date
    function findYValueForDate(date) {
        if (!avgRData || avgRData.length === 0) {
            // Fallback to threshold-based positioning if no avgRData
            return null;
        }
        
        // Convert to timestamp for comparison
        const timestamp = date.getTime();
        
        // Find the closest data point
        let closestPoint = null;
        let minDiff = Infinity;
        
        for (const point of avgRData) {
            const pointTime = point.x.getTime();
            const diff = Math.abs(pointTime - timestamp);
            
            if (diff < minDiff) {
                minDiff = diff;
                closestPoint = point;
            }
        }
        
        return closestPoint ? closestPoint.y : null;
    }
    
    // Add oversold to overbought reversal signals (bearish)
    signals.obReversal.forEach((date, i) => {
        // Find the y-value on the average %R line for this date
        const yValue = findYValueForDate(date) || -threshold;
        
        chart.options.plugins.annotation.annotations[`obReversal${i}`] = {
            type: 'point',
            xValue: date,
            yValue: yValue,
            backgroundColor: 'rgba(202, 0, 23, 0.8)',
            borderColor: 'rgba(202, 0, 23, 1)',
            borderWidth: 2,
            radius: 6,
            label: {
                content: '▼',
                enabled: true,
                position: 'top',
                backgroundColor: 'transparent',
                color: 'rgba(202, 0, 23, 1)',
                font: { size: 16, weight: 'bold' }
            }
        };
    });
    
    // Add overbought to oversold reversal signals (bullish)
    signals.osReversal.forEach((date, i) => {
        // Find the y-value on the average %R line for this date
        const yValue = findYValueForDate(date) || -100 + threshold;
        
        chart.options.plugins.annotation.annotations[`osReversal${i}`] = {
            type: 'point',
            xValue: date,
            yValue: yValue,
            backgroundColor: 'rgba(36, 102, 167, 0.8)',
            borderColor: 'rgba(36, 102, 167, 1)',
            borderWidth: 2,
            radius: 6,
            label: {
                content: '▲',
                enabled: true,
                position: 'bottom',
                backgroundColor: 'transparent',
                color: 'rgba(36, 102, 167, 1)',
                font: { size: 16, weight: 'bold' }
            }
        };
    });
    
    // Add overbought warning signals
    signals.overbought.forEach((date, i) => {
        // Find the y-value on the average %R line for this date
        const yValue = findYValueForDate(date) || -threshold;
        
        chart.options.plugins.annotation.annotations[`overbought${i}`] = {
            type: 'point',
            xValue: date,
            yValue: yValue,
            backgroundColor: 'rgba(202, 0, 23, 0.8)',
            borderColor: 'rgba(202, 0, 23, 1)',
            borderWidth: 2,
            radius: 6,
            label: {
                content: '⚠',
                enabled: true,
                position: 'top',
                backgroundColor: 'transparent',
                color: 'rgba(202, 0, 23, 1)',
                font: { size: 12 }
            }
        };
    });
    
    // Add oversold warning signals
    signals.oversold.forEach((date, i) => {
        // Find the y-value on the average %R line for this date
        const yValue = findYValueForDate(date) || -100 + threshold;
        
        chart.options.plugins.annotation.annotations[`oversold${i}`] = {
            type: 'point',
            xValue: date,
            yValue: yValue,
            backgroundColor: 'rgba(36, 102, 167, 0.8)',
            borderColor: 'rgba(36, 102, 167, 1)',
            borderWidth: 2,
            radius: 6,
            label: {
                content: '⚠',
                enabled: true,
                position: 'bottom',
                backgroundColor: 'transparent',
                color: 'rgba(36, 102, 167, 1)',
                font: { size: 12 }
            }
        };
    });
    
    // Add cross signals
    signals.crosses.forEach((cross, i) => {
        // Find the y-value on the average %R line for this date
        const yValue = findYValueForDate(cross.date);
        
        if (cross.type === 'bull') {
            chart.options.plugins.annotation.annotations[`bullCross${i}`] = {
                type: 'point',
                xValue: cross.date,
                yValue: yValue || -60,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: 'rgba(36, 102, 167, 1)',
                borderWidth: 2,
                radius: 6,
                label: {
                    content: '✕',
                    enabled: true,
                    position: 'center',
                    backgroundColor: 'transparent',
                    color: 'rgba(36, 102, 167, 1)',
                    font: { size: 12, weight: 'bold' }
                }
            };
        } else {
            chart.options.plugins.annotation.annotations[`bearCross${i}`] = {
                type: 'point',
                xValue: cross.date,
                yValue: yValue || -40,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: 'rgba(202, 0, 23, 1)',
                borderWidth: 2,
                radius: 6,
                label: {
                    content: '✕',
                    enabled: true,
                    position: 'center',
                    backgroundColor: 'transparent',
                    color: 'rgba(202, 0, 23, 1)',
                    font: { size: 12, weight: 'bold' }
                }
            };
        }
    });
    
    chart.update();
}

function displayTradingRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('tradingRecommendationsContainer');
    if (!recommendationsContainer) return;
    
    // Clear the container
    recommendationsContainer.innerHTML = '';
    
    let badgeClass = 'bg-warning'; // Default for HOLD
    if (recommendations.recommendation === 'BUY') {
        badgeClass = 'bg-success';
    } else if (recommendations.recommendation === 'SELL') {
        badgeClass = 'bg-danger';
    }
    
    let confidenceColor = 'warning';
    if (recommendations.confidence >= 70) {
        confidenceColor = 'success';
    } else if (recommendations.confidence < 40) {
        confidenceColor = 'danger';
    }
    
    let reasonsHTML = '';
    if (recommendations.reasons && recommendations.reasons.length > 0) {
        reasonsHTML = '<ul class="list-group list-group-flush bg-dark">';
        recommendations.reasons.forEach(reason => {
            reasonsHTML += `<li class="list-group-item bg-dark text-white border-secondary">${reason}</li>`;
        });
        reasonsHTML += '</ul>';
    }
    
    const recommendationsHTML = `
        <div class="card bg-dark text-white mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Trading Recommendation</h5>
                <span class="badge ${badgeClass} fs-6">${recommendations.recommendation}</span>
            </div>
            <div class="card-body">
                <div class="d-flex justify-content-between mb-3">
                    <div class="text-center">
                        <h6>Confidence</h6>
                        <div class="progress" style="height: 25px; width: 150px;">
                            <div class="progress-bar bg-${confidenceColor}" 
                                 role="progressbar" 
                                 style="width: ${recommendations.confidence}%;" 
                                 aria-valuenow="${recommendations.confidence}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                ${recommendations.confidence}%
                            </div>
                        </div>
                    </div>
                    <div class="text-center">
                        <h6>Signal Strength</h6>
                        <div class="d-flex justify-content-between">
                            <div class="text-center me-2">
                                <span class="badge bg-success">${recommendations.buyScore}</span>
                                <small class="d-block text-white">Buy</small>
                            </div>
                            <div class="text-center me-2">
                                <span class="badge bg-danger">${recommendations.sellScore}</span>
                                <small class="d-block text-white">Sell</small>
                            </div>
                            <div class="text-center">
                                <span class="badge bg-warning">${recommendations.holdScore}</span>
                                <small class="d-block text-white">Hold</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <h6>Analysis Reasons:</h6>
                    ${reasonsHTML}
                </div>
            </div>
        </div>
    `;
    
    recommendationsContainer.innerHTML = recommendationsHTML;
}

// Add TrendExhaust legend
function addTrendExhaustLegend() {
    const container = document.getElementById('trendExhaustLegendContainer');
    if (!container) return;
    
    // Clear the container
    container.innerHTML = '';
    
    // Create legend HTML
    const legendHTML = `
    <div class="card bg-dark mb-3">
        <div class="card-header">
            <h5 class="mb-0 text-white">TrendExhaust Signals Legend</h5>
        </div>
        <div class="card-body">
            <div class="row">
                <!-- Bullish Signals -->
                <div class="col-md-6 mb-3">
                    <h6 class="border-bottom border-light pb-1 text-white">Bullish Signals</h6>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; clip-path:polygon(50% 0%, 0% 100%, 100% 100%); background:#2466A7;"></span>
                        <small class="text-white">Oversold Trend Reversal - Exhaustion ends</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#2466A7;"></span>
                        <small class="text-white">Oversold Warning - Price reaching extreme levels</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#ffffff;"></span>
                        <small class="text-white">Fast/Slow Bullish Cross</small>
                    </div>
                </div>
                
                <!-- Bearish Signals -->
                <div class="col-md-6 mb-3">
                    <h6 class="border-bottom border-light pb-1 text-white">Bearish Signals</h6>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; clip-path:polygon(50% 100%, 0% 0%, 100% 0%); background:#CA0017;"></span>
                        <small class="text-white">Overbought Trend Reversal - Exhaustion ends</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#CA0017;"></span>
                        <small class="text-white">Overbought Warning - Price reaching extreme levels</small>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <span class="me-2" style="display:inline-block; width:15px; height:15px; border-radius:50%; background:#ffffff;"></span>
                        <small class="text-white">Fast/Slow Bearish Cross</small>
                    </div>
                </div>
            </div>
            
            <!-- Guide Lines -->
            <div class="row mt-2">
                <div class="col-12">
                    <h6 class="border-bottom border-light pb-1 text-white">Indicator Guidelines</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px dashed rgba(202,0,23,0.7);"></span>
                                <small class="text-white">-20: Overbought Threshold</small>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid rgba(128,128,128,0.5);"></span>
                                <small class="text-white">-50: Middle Line</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px dashed rgba(36,102,167,0.7);"></span>
                                <small class="text-white">-80: Oversold Threshold</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid #ffffff;"></span>
                                <small class="text-white">Fast %R (21) - White Line</small>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid #ffe500;"></span>
                                <small class="text-white">Slow %R (112) - Yellow Line</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="me-2" style="display:inline-block; width:20px; border-top:1px solid #31c0ff;"></span>
                                <small class="text-white">Average %R - Blue Line</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Trading Tips -->
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="border-bottom border-light pb-1 text-white">Trading Tips</h6>
                    <ul class="list-unstyled small text-white mb-0">
                        <li class="mb-1">• Watch for reversals after trend exhaustion to identify potential entry points</li>
                        <li class="mb-1">• Combine with WaveTrend signals for higher probability trades</li>
                        <li class="mb-1">• Bull/bear crosses can act as early trend change signals</li>
                        <li>• The longer a trend stays in overbought/oversold, the stronger the reversal may be</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    `;
    
    // Add the legend to the container
    container.innerHTML = legendHTML;
}

// Initialize the detailed view functionality when the page is loaded
document.addEventListener('DOMContentLoaded', function() {
    initDetailedView();
});

// Make the openDetailedView function available globally so dashboard-core.js can call it
window.openDetailedView = openDetailedView;
