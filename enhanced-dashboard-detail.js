/**
 * Enhanced Dashboard Detail View JavaScript
 * Implements advanced features for the detailed view in the enhanced trading dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
    setupDetailedViewEventListeners();
});

function setupDetailedViewEventListeners() {
    document.querySelectorAll('.chart-control-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.dataset.control !== 'indicators' && !this.classList.contains('dropdown-toggle')) {
                document.querySelectorAll('.chart-control-btn:not(.dropdown-toggle)').forEach(b => {
                    if (b.dataset.control !== 'indicators') {
                        b.classList.remove('active');
                    }
                });
                this.classList.add('active');
            }
            
            handleChartControl(this.dataset.control);
        });
    });
    
    document.querySelectorAll('.chart-layout-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.chart-layout-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            applyChartLayout(this.dataset.layout);
        });
    });
    
    document.querySelectorAll('[data-drawing-tool]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            activateDrawingTool(this.dataset.drawingTool);
        });
    });
}

function handleChartControl(control) {
    const priceChart = detailedCharts.price;
    if (!priceChart) return;
    
    switch (control) {
        case 'zoom':
            priceChart.options.plugins.zoom.pan.enabled = false;
            priceChart.options.plugins.zoom.zoom.wheel.enabled = true;
            break;
        case 'pan':
            priceChart.options.plugins.zoom.pan.enabled = true;
            priceChart.options.plugins.zoom.zoom.wheel.enabled = false;
            break;
        case 'reset':
            priceChart.resetZoom();
            break;
        case 'indicators':
            showIndicatorsModal();
            break;
        case 'save':
            saveChartLayout();
            break;
    }
    
    priceChart.update();
}

function applyChartLayout(layout) {
    document.querySelectorAll('.indicator-chart-container').forEach(container => {
        container.style.display = 'none';
    });
    
    switch (layout) {
        case 'default':
            document.getElementById('detailedWtChartContainer').style.display = 'block';
            document.getElementById('detailedMfChartContainer').style.display = 'block';
            break;
        case 'technical':
            document.getElementById('detailedMACDChartContainer').style.display = 'block';
            document.getElementById('detailedBollingerChartContainer').style.display = 'block';
            document.getElementById('detailedADXChartContainer').style.display = 'block';
            break;
        case 'momentum':
            document.getElementById('detailedWtChartContainer').style.display = 'block';
            document.getElementById('detailedMACDChartContainer').style.display = 'block';
            document.getElementById('detailedRSIChartContainer').style.display = 'block';
            break;
        case 'volatility':
            document.getElementById('detailedBollingerChartContainer').style.display = 'block';
            document.getElementById('detailedATRChartContainer').style.display = 'block';
            break;
        case 'volume':
            document.getElementById('detailedMfChartContainer').style.display = 'block';
            document.getElementById('detailedVolumeProfileContainer').style.display = 'block';
            break;
        case 'custom':
            showCustomLayoutModal();
            break;
    }
}

function renderMACDChart(data) {
    const canvas = document.getElementById('detailedMACDChart');
    if (!canvas) return;
    
    if (!data.macd) {
        calculateMACD(data);
    }
    
    const ctx = canvas.getContext('2d');
    
    const chartData = {
        labels: data.dates.map(d => new Date(d)),
        datasets: [
            {
                label: 'MACD Line',
                data: data.macd.line,
                borderColor: 'rgba(41, 98, 255, 0.8)',
                backgroundColor: 'rgba(41, 98, 255, 0)',
                borderWidth: 1.5,
                pointRadius: 0,
                type: 'line'
            },
            {
                label: 'Signal Line',
                data: data.macd.signal,
                borderColor: 'rgba(255, 82, 82, 0.8)',
                backgroundColor: 'rgba(255, 82, 82, 0)',
                borderWidth: 1.5,
                pointRadius: 0,
                type: 'line'
            },
            {
                label: 'Histogram',
                data: data.macd.histogram,
                borderColor: 'rgba(0, 0, 0, 0)',
                backgroundColor: function(context) {
                    const index = context.dataIndex;
                    const value = context.dataset.data[index];
                    
                    if (value >= 0) {
                        return 'rgba(41, 98, 255, 0.3)';
                    } else {
                        return 'rgba(255, 82, 82, 0.3)';
                    }
                },
                borderWidth: 0,
                pointRadius: 0,
                type: 'bar'
            }
        ]
    };
    
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                annotation: {
                    annotations: {
                        zeroLine: {
                            type: 'line',
                            yMin: 0,
                            yMax: 0,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderWidth: 1
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'MACD'
                    }
                }
            }
        }
    };
    
    if (detailedCharts.macd) {
        detailedCharts.macd.destroy();
    }
    
    detailedCharts.macd = new Chart(ctx, config);
}

function calculateMACD(data) {
    const prices = data.close || data.price;
    const fastPeriod = 12;
    const slowPeriod = 26;
    const signalPeriod = 9;
    
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    
    const macdLine = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < slowPeriod - 1) {
            macdLine.push(null);
        } else {
            macdLine.push(fastEMA[i] - slowEMA[i]);
        }
    }
    
    const validMacdLine = macdLine.filter(val => val !== null);
    const signalLine = calculateEMA(validMacdLine, signalPeriod);
    
    const paddedSignalLine = [];
    for (let i = 0; i < macdLine.length; i++) {
        if (i < (slowPeriod - 1) + (signalPeriod - 1)) {
            paddedSignalLine.push(null);
        } else {
            paddedSignalLine.push(signalLine[i - (slowPeriod - 1)]);
        }
    }
    
    const histogram = [];
    for (let i = 0; i < macdLine.length; i++) {
        if (macdLine[i] === null || paddedSignalLine[i] === null) {
            histogram.push(null);
        } else {
            histogram.push(macdLine[i] - paddedSignalLine[i]);
        }
    }
    
    data.macd = {
        line: macdLine,
        signal: paddedSignalLine,
        histogram: histogram
    };
}

function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const ema = [];
    
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    const sma = sum / period;
    
    ema.push(sma);
    
    for (let i = 1; i < data.length - period + 1; i++) {
        ema.push(data[i + period - 1] * k + ema[i - 1] * (1 - k));
    }
    
    const paddedEMA = Array(period - 1).fill(null).concat(ema);
    
    return paddedEMA;
}

function renderBollingerChart(data) {
    const canvas = document.getElementById('detailedBollingerChart');
    if (!canvas) return;
    
    if (!data.bollinger) {
        calculateBollingerBands(data);
    }
    
    const ctx = canvas.getContext('2d');
    
    const chartData = {
        labels: data.dates.map(d => new Date(d)),
        datasets: [
            {
                label: 'Price',
                data: data.close || data.price,
                borderColor: 'rgba(255, 255, 255, 0.8)',
                backgroundColor: 'rgba(255, 255, 255, 0)',
                borderWidth: 1.5,
                pointRadius: 0,
                type: 'line'
            },
            {
                label: 'Middle Band (SMA)',
                data: data.bollinger.middle,
                borderColor: 'rgba(38, 166, 154, 0.8)',
                backgroundColor: 'rgba(38, 166, 154, 0)',
                borderWidth: 1.5,
                pointRadius: 0,
                type: 'line'
            },
            {
                label: 'Upper Band',
                data: data.bollinger.upper,
                borderColor: 'rgba(38, 166, 154, 0.5)',
                backgroundColor: 'rgba(38, 166, 154, 0)',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                type: 'line'
            },
            {
                label: 'Lower Band',
                data: data.bollinger.lower,
                borderColor: 'rgba(38, 166, 154, 0.5)',
                backgroundColor: 'rgba(38, 166, 154, 0.1)',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: {
                    target: '+1',
                    above: 'rgba(38, 166, 154, 0.1)'
                },
                type: 'line'
            }
        ]
    };
    
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Bollinger Bands'
                    }
                }
            }
        }
    };
    
    if (detailedCharts.bollinger) {
        detailedCharts.bollinger.destroy();
    }
    
    detailedCharts.bollinger = new Chart(ctx, config);
}

function calculateBollingerBands(data) {
    const prices = data.close || data.price;
    const period = 20;
    const stdDevMultiplier = 2;
    
    const middle = [];
    const upper = [];
    const lower = [];
    
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            middle.push(null);
            upper.push(null);
            lower.push(null);
        } else {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sum += prices[j];
            }
            const sma = sum / period;
            
            let sumSquaredDiff = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sumSquaredDiff += Math.pow(prices[j] - sma, 2);
            }
            const stdDev = Math.sqrt(sumSquaredDiff / period);
            
            middle.push(sma);
            upper.push(sma + stdDevMultiplier * stdDev);
            lower.push(sma - stdDevMultiplier * stdDev);
        }
    }
    
    data.bollinger = {
        middle: middle,
        upper: upper,
        lower: lower
    };
}

function renderADXChart(data) {
    const canvas = document.getElementById('detailedADXChart');
    if (!canvas) return;
    
    if (!data.adx) {
        calculateADX(data);
    }
    
    const ctx = canvas.getContext('2d');
    
    const chartData = {
        labels: data.dates.map(d => new Date(d)),
        datasets: [
            {
                label: 'ADX',
                data: data.adx.adx,
                borderColor: 'rgba(226, 164, 0, 0.8)',
                backgroundColor: 'rgba(226, 164, 0, 0)',
                borderWidth: 1.5,
                pointRadius: 0,
                type: 'line'
            },
            {
                label: '+DI',
                data: data.adx.plusDI,
                borderColor: 'rgba(38, 166, 154, 0.8)',
                backgroundColor: 'rgba(38, 166, 154, 0)',
                borderWidth: 1.5,
                pointRadius: 0,
                type: 'line'
            },
            {
                label: '-DI',
                data: data.adx.minusDI,
                borderColor: 'rgba(239, 83, 80, 0.8)',
                backgroundColor: 'rgba(239, 83, 80, 0)',
                borderWidth: 1.5,
                pointRadius: 0,
                type: 'line'
            }
        ]
    };
    
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                annotation: {
                    annotations: {
                        strongTrendLine: {
                            type: 'line',
                            yMin: 25,
                            yMax: 25,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            label: {
                                content: 'Strong Trend',
                                enabled: true,
                                position: 'right',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'white'
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'ADX'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    };
    
    if (detailedCharts.adx) {
        detailedCharts.adx.destroy();
    }
    
    detailedCharts.adx = new Chart(ctx, config);
}

function generateRecommendations(data) {
    let recommendation = 'HOLD';
    let confidence = 50;
    let buyScore = 0;
    let sellScore = 0;
    let holdScore = 0;
    let reasons = [];
    
    const buySignals = (data.buy ? data.buy.length : 0) + 
                      (data.goldbuy ? data.goldbuy.length : 0) + 
                      (data.bullishDivergence ? data.bullishDivergence.length : 0) +
                      (data.fastMoneyBuy ? data.fastMoneyBuy.length : 0);
                      
    const sellSignals = (data.sell ? data.sell.length : 0) + 
                       (data.bearishDivergence ? data.bearishDivergence.length : 0) +
                       (data.fastMoneySell ? data.fastMoneySell.length : 0);
    
    buyScore = Math.min(100, buySignals * 25);
    sellScore = Math.min(100, sellSignals * 25);
    holdScore = 100 - Math.max(buyScore, sellScore);
    
    let trendDirection = 'neutral';
    if (data.wt1 && data.wt2) {
        const lastWt1 = data.wt1[data.wt1.length - 1];
        const lastWt2 = data.wt2[data.wt2.length - 1];
        const prevWt1 = data.wt1[data.wt1.length - 2];
        const prevWt2 = data.wt2[data.wt2.length - 2];
        
        if (lastWt1 > lastWt2 && prevWt1 <= prevWt2) {
            trendDirection = 'bullish';
            reasons.push('WaveTrend shows bullish crossover');
            buyScore += 15;
        } else if (lastWt1 < lastWt2 && prevWt1 >= prevWt2) {
            trendDirection = 'bearish';
            reasons.push('WaveTrend shows bearish crossover');
            sellScore += 15;
        }
    }
    
    if (data.wt1) {
        const lastWt1 = data.wt1[data.wt1.length - 1];
        
        if (lastWt1 > 60) {
            reasons.push('WaveTrend is in overbought territory');
            sellScore += 10;
        } else if (lastWt1 < -60) {
            reasons.push('WaveTrend is in oversold territory');
            buyScore += 10;
        }
    }
    
    if (data.regimes && data.regimes.combinedPrice && data.regimes.combinedPrice.length > 0) {
        const lastRegimeChange = new Date(data.regimes.combinedPrice[data.regimes.combinedPrice.length - 1]);
        const lastDataPoint = new Date(data.dates[data.dates.length - 1]);
        
        const daysDiff = Math.abs(lastDataPoint - lastRegimeChange) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 10) {
            reasons.push('Recent market regime change detected');
            holdScore += 20;
            buyScore = Math.max(0, buyScore - 10);
            sellScore = Math.max(0, sellScore - 10);
        }
    }
    
    if (buyScore > sellScore && buyScore > holdScore) {
        recommendation = 'BUY';
        confidence = buyScore;
        
        if (data.goldbuy && data.goldbuy.length > 0) {
            reasons.push('Gold Buy signal detected');
        }
        
        if (data.bullishDivergence && data.bullishDivergence.length > 0) {
            reasons.push('Bullish divergence detected');
        }
    } else if (sellScore > buyScore && sellScore > holdScore) {
        recommendation = 'SELL';
        confidence = sellScore;
        
        if (data.bearishDivergence && data.bearishDivergence.length > 0) {
            reasons.push('Bearish divergence detected');
        }
    } else {
        recommendation = 'HOLD';
        confidence = holdScore;
        reasons.push('No strong directional signals present');
    }
    
    if (trendDirection !== 'neutral' && !reasons.find(r => r.includes('WaveTrend'))) {
        reasons.push(`Overall trend direction is ${trendDirection}`);
    }
    
    return {
        recommendation,
        confidence,
        buyScore,
        sellScore,
        holdScore,
        reasons
    };
}

function populateSignalsTable(data) {
    const container = document.getElementById('signalsTableContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const signals = [];
    
    if (data.buy && data.buy.length > 0) {
        data.buy.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                signals.push({
                    date: new Date(date),
                    type: 'Buy',
                    subType: 'Regular',
                    price: data.close ? data.close[index] : data.price[index],
                    index: index,
                    priority: 3
                });
            }
        });
    }
    
    if (data.goldbuy && data.goldbuy.length > 0) {
        data.goldbuy.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                signals.push({
                    date: new Date(date),
                    type: 'Buy',
                    subType: 'Gold',
                    price: data.close ? data.close[index] : data.price[index],
                    index: index,
                    priority: 5
                });
            }
        });
    }
    
    if (data.sell && data.sell.length > 0) {
        data.sell.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                signals.push({
                    date: new Date(date),
                    type: 'Sell',
                    subType: 'Regular',
                    price: data.close ? data.close[index] : data.price[index],
                    index: index,
                    priority: 3
                });
            }
        });
    }
    
    if (data.bullishDivergence && data.bullishDivergence.length > 0) {
        data.bullishDivergence.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                signals.push({
                    date: new Date(date),
                    type: 'Buy',
                    subType: 'Bullish Divergence',
                    price: data.close ? data.close[index] : data.price[index],
                    index: index,
                    priority: 4
                });
            }
        });
    }
    
    if (data.bearishDivergence && data.bearishDivergence.length > 0) {
        data.bearishDivergence.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                signals.push({
                    date: new Date(date),
                    type: 'Sell',
                    subType: 'Bearish Divergence',
                    price: data.close ? data.close[index] : data.price[index],
                    index: index,
                    priority: 4
                });
            }
        });
    }
    
    if (data.regimes && data.regimes.combinedPrice) {
        data.regimes.combinedPrice.forEach(date => {
            const index = data.dates.indexOf(date);
            if (index !== -1) {
                signals.push({
                    date: new Date(date),
                    type: 'Regime Change',
                    subType: 'Price',
                    price: data.close ? data.close[index] : data.price[index],
                    index: index,
                    priority: 5
                });
            }
        });
    }
    
    signals.sort((a, b) => b.date - a.date);
    
    const table = document.createElement('table');
    table.className = 'signals-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Subtype</th>
            <th>Price</th>
            <th>Actions</th>
        </tr>
    `;
    
    const tbody = document.createElement('tbody');
    
    signals.forEach(signal => {
        const tr = document.createElement('tr');
        
        let typeClass = '';
        if (signal.type === 'Buy') {
            typeClass = 'signal-type-buy';
        } else if (signal.type === 'Sell') {
            typeClass = 'signal-type-sell';
        } else if (signal.type === 'Regime Change') {
            typeClass = 'signal-type-regime';
        }
        
        tr.innerHTML = `
            <td>${signal.date.toLocaleDateString()}</td>
            <td class="${typeClass}">${signal.type}</td>
            <td>${signal.subType}</td>
            <td>${signal.price.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary zoom-to-signal" data-index="${signal.index}">
                    <i class="bi bi-zoom-in"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(thead);
    table.appendChild(tbody);
    
    const card = document.createElement('div');
    card.className = 'card bg-dark mb-3';
    
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.innerHTML = '<h5 class="mb-0 text-white">Signal History</h5>';
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    cardBody.appendChild(table);
    
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    
    container.appendChild(card);
    
    document.querySelectorAll('.zoom-to-signal').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            zoomToSignal(index, data);
        });
    });
}

function zoomToSignal(index, data) {
    const chart = detailedCharts.price;
    if (!chart) return;
    
    const date = new Date(data.dates[index]);
    
    const startIndex = Math.max(0, index - 10);
    const endIndex = Math.min(data.dates.length - 1, index + 10);
    
    const startDate = new Date(data.dates[startIndex]);
    const endDate = new Date(data.dates[endIndex]);
    
    chart.zoomScale('x', {min: startDate, max: endDate}, 'default');
}
