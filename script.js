document.addEventListener('DOMContentLoaded', function() {
    // Chart instances
    let priceChart, wtChart, mfChart;
    
    // Initialize charts with empty data
    initCharts();
    
    // Initialize UI elements
    initUI();
    
    function initUI() {
        // Set up event listener for the load data button
        document.getElementById('loadData').addEventListener('click', fetchData);
        
        // Set up tab navigation
        const tabLinks = document.querySelectorAll('.tab-link');
        tabLinks.forEach(link => {
            link.addEventListener('click', function() {
                // Remove active class from all tabs
                tabLinks.forEach(l => l.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Hide all tab panes
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.style.display = 'none';
                });
                
                // Show selected tab pane
                const tabId = this.getAttribute('data-tab') + '-tab';
                document.getElementById(tabId).style.display = 'block';
            });
        });
        
        // Fetch available intervals and periods from the API
        fetchAvailableOptions();
    }
    
    async function fetchAvailableOptions() {
        try {
            const response = await fetch('http://localhost:5000/api/available-options');
            if (!response.ok) {
                console.error('Failed to fetch available options');
                return;
            }
            
            const data = await response.json();
            
            // Populate interval dropdown
            const intervalSelect = document.getElementById('interval');
            intervalSelect.innerHTML = '';
            
            // Helper function to display interval nicely
            const displayInterval = (interval) => {
                if (interval.includes('m') && !interval.includes('mo')) return `${interval.replace('m', '')} Minutes`;
                if (interval === '1h') return `1 Hour`;
                if (interval === '4h') return `4 Hours`;
                if (interval === '8h') return `8 Hours`;
                if (interval === '12h') return `12 Hours`;
                if (interval === '1d') return 'Daily';
                if (interval === '5d') return '5 Days';
                if (interval === '1wk') return 'Weekly';
                if (interval === '1mo') return 'Monthly';
                if (interval === '3mo') return '3 Months';
                return interval;
            };
            
            // Group intervals for better organization
            const minuteIntervals = data.intervals.filter(i => i.includes('m') && !i.includes('mo'));
            const hourIntervals = data.intervals.filter(i => i.includes('h'));
            const dayIntervals = data.intervals.filter(i => i.includes('d'));
            const weekIntervals = data.intervals.filter(i => i.includes('wk'));
            const monthIntervals = data.intervals.filter(i => i.includes('mo'));
            
            // Function to add an optgroup with options
            const addIntervalGroup = (label, intervals) => {
                if (intervals.length === 0) return;
                
                const group = document.createElement('optgroup');
                group.label = label;
                
                intervals.forEach(interval => {
                    const option = document.createElement('option');
                    option.value = interval;
                    option.textContent = displayInterval(interval);
                    if (interval === '1d') option.selected = true;
                    group.appendChild(option);
                });
                
                intervalSelect.appendChild(group);
            };
            
            // Add interval groups
            addIntervalGroup('Minutes', minuteIntervals);
            addIntervalGroup('Hours', hourIntervals);
            addIntervalGroup('Days', dayIntervals);
            addIntervalGroup('Weeks', weekIntervals);
            addIntervalGroup('Months', monthIntervals);
            
            // Populate period dropdown
            const periodSelect = document.getElementById('period');
            periodSelect.innerHTML = '';
            
            // Helper function to display period nicely
            const displayPeriod = (period) => {
                if (period === '1d') return '1 Day';
                if (period === '5d') return '5 Days';
                if (period === '1mo') return '1 Month';
                if (period === '3mo') return '3 Months';
                if (period === '6mo') return '6 Months';
                if (period === '1y') return '1 Year';
                if (period === '2y') return '2 Years';
                if (period === '5y') return '5 Years';
                if (period === '10y') return '10 Years';
                if (period === 'ytd') return 'Year to Date';
                if (period === 'max') return 'Max';
                return period;
            };
            
            data.periods.forEach(period => {
                const option = document.createElement('option');
                option.value = period;
                option.textContent = displayPeriod(period);
                if (period === '1y') option.selected = true;
                periodSelect.appendChild(option);
            });
            
            // Initial value for selected interval display
            document.getElementById('selected-interval').textContent = displayInterval('1d');
            
            // Add event listeners to update the selected interval display
            intervalSelect.addEventListener('change', function() {
                document.getElementById('selected-interval').textContent = displayInterval(this.value);
            });
            
        } catch (error) {
            console.error('Error fetching available options:', error);
        }
    }
    
    function initCharts() {
        // Price Chart
        const priceCtx = document.getElementById('priceChart').getContext('2d');
        priceChart = new Chart(priceCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1,
                    tension: 0.1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
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
                        text: 'Price Chart',
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
                        annotations: {}
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
        
        // WaveTrend Chart
        const wtCtx = document.getElementById('wtChart').getContext('2d');
        wtChart = new Chart(wtCtx, {
            type: 'line',
            data: {
                datasets: [
                    // Background area dataset (new)
                    {
                        label: 'WT Area',
                        data: [],
                        backgroundColor: 'rgba(42, 46, 57, 0.1)',
                        fill: true,
                        borderWidth: 0,
                        pointRadius: 0,
                        yAxisID: 'y'
                    },
                    {
                        label: 'WT1',
                        data: [],
                        borderColor: 'white',
                        borderWidth: 2,
                        tension: 0.1,
                        pointRadius: 0,
                        yAxisID: 'y'
                    },
                    {
                        label: 'WT2',
                        data: [],
                        borderColor: '#2a2e39',
                        borderWidth: 2,
                        tension: 0.1,
                        pointRadius: 0,
                        yAxisID: 'y'
                    },
                    {
                        label: 'VWAP',
                        data: [],
                        borderColor: '#ffe500',
                        borderWidth: 2,
                        tension: 0.1,
                        pointRadius: 0,
                        yAxisID: 'y'
                    },
                    {
                        label: 'RSI',
                        data: [],
                        borderColor: '#d900ff',
                        borderWidth: 1,
                        tension: 0.1,
                        pointRadius: 0,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Stoch RSI',
                        data: [],
                        borderColor: '#22ff00',
                        borderWidth: 1,
                        tension: 0.1,
                        pointRadius: 0,
                        yAxisID: 'y'
                        // This dataset's color will be dynamically updated
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
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
                        text: 'WaveTrend Oscillator',
                        color: 'white',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        labels: {
                            color: 'white',
                            filter: function(legendItem, chartData) {
                                // Hide the area dataset from legend
                                return legendItem.text !== 'WT Area';
                            }
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
                            overbought1: {
                                type: 'line',
                                yMin: 53,
                                yMax: 53,
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                borderWidth: 1
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
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                borderWidth: 1,
                                borderDash: [2, 2]
                            },
                            oversold1: {
                                type: 'line',
                                yMin: -53,
                                yMax: -53,
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                borderWidth: 1
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
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                borderWidth: 1,
                                borderDash: [2, 2]
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
        
        // Money Flow Chart with area fill
        const mfCtx = document.getElementById('mfChart').getContext('2d');
        mfChart = new Chart(mfCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Money Flow',
                    data: [],
                    borderColor: function(context) {
                        const value = context.raw?.y;
                        return value >= 0 ? '#3cff00' : '#ff1100';
                    },
                    backgroundColor: function(context) {
                        const value = context.raw?.y;
                        return value >= 0 ? 'rgba(60, 255, 0, 0.3)' : 'rgba(255, 17, 0, 0.3)';
                    },
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0,
                    fill: 'origin'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
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
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
    }
    
    async function fetchData() {
        const ticker = document.getElementById('ticker').value || 'AAPL';
        const period = document.getElementById('period').value || '1y';
        const interval = document.getElementById('interval').value || '1d';
        
        if (!ticker) {
            alert('Please enter a ticker symbol');
            return;
        }
        
        // Show loading indicator
        const loadingElement = document.getElementById('loading');
        loadingElement.style.display = 'block';
        
        try {
            const apiUrl = `http://localhost:5000/api/analyzer-b?ticker=${ticker}&period=${period}&interval=${interval}`;
            console.log(`Fetching data from: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            let errorText = '';
            
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Could not extract error details';
            }
            
            if (!response.ok) {
                console.error('API error response:', errorText);
                throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }
            
            // Parse the response as JSON
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {
                throw new Error(`Invalid JSON response: ${errorText.substring(0, 100)}...`);
            }
            
            if (!data.success) {
                alert(data.message || 'Failed to fetch data');
                return;
            }
            
            // Clean the data to handle any null values
            cleanData(data);
            
            // Update charts
            updateCharts(data);
            
            // Update info panel
            updateInfo(data);
            
            // Update parameters display
            if (data.parameters) {
                updateParametersDisplay(data.parameters);
            }
            
            // Update info tab
            document.getElementById('last-update').textContent = data.summary.lastUpdate || 'Unknown';
            document.getElementById('data-points').textContent = data.dates.length;
            
            // Helper function to display interval nicely
            const displayInterval = (interval) => {
                if (interval.includes('m') && !interval.includes('mo')) return `${interval.replace('m', '')} Minutes`;
                if (interval === '1h') return `1 Hour`;
                if (interval === '4h') return `4 Hours`;
                if (interval === '8h') return `8 Hours`;
                if (interval === '12h') return `12 Hours`;
                if (interval === '1d') return 'Daily';
                if (interval === '5d') return '5 Days';
                if (interval === '1wk') return 'Weekly';
                if (interval === '1mo') return 'Monthly';
                if (interval === '3mo') return '3 Months';
                return interval;
            };
            
            document.getElementById('selected-interval').textContent = displayInterval(interval);
            
        } catch (error) {
            console.error('Error fetching data:', error);
            alert(`Error fetching data: ${error.message}`);
        } finally {
            // Hide loading indicator
            loadingElement.style.display = 'none';
        }
    }
    
    function updateParametersDisplay(params) {
        const container = document.getElementById('parameters-badges');
        container.innerHTML = '';
        
        for (const [key, value] of Object.entries(params)) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-param';
            badge.textContent = `${key}: ${value}`;
            container.appendChild(badge);
        }
    }
    
    // Helper function to clean data and handle null/NaN values
    function cleanData(data) {
        // Replace null with NaN for chart.js
        const cleanArray = (arr) => {
            if (!arr) return [];
            return arr.map(val => (val === null || val === undefined) ? NaN : val);
        };
        
        // Clean numerical arrays
        data.price = cleanArray(data.price);
        data.high = cleanArray(data.high);
        data.low = cleanArray(data.low);
        data.open = cleanArray(data.open);
        data.wt1 = cleanArray(data.wt1);
        data.wt2 = cleanArray(data.wt2);
        data.wtVwap = cleanArray(data.wtVwap);
        data.rsi = cleanArray(data.rsi);
        data.stoch = cleanArray(data.stoch);
        data.moneyFlow = cleanArray(data.moneyFlow);
        
        // Ensure summary values are numbers or defaults
        if (data.summary) {
            data.summary.buySignals = data.summary.buySignals || 0;
            data.summary.goldBuySignals = data.summary.goldBuySignals || 0;
            data.summary.sellSignals = data.summary.sellSignals || 0;
            data.summary.currentWT1 = isNaN(data.summary.currentWT1) ? 0 : data.summary.currentWT1;
            data.summary.currentWT2 = isNaN(data.summary.currentWT2) ? 0 : data.summary.currentWT2;
            data.summary.currentMF = isNaN(data.summary.currentMF) ? 0 : data.summary.currentMF;
        }
        
        return data;
    }
    
    function updateCharts(data) {
        // Convert dates to Date objects
        const dates = data.dates.map(d => new Date(d));
        
        // Update price chart
        priceChart.data.labels = dates;
        priceChart.data.datasets[0].data = dates.map((date, i) => ({
            x: date,
            y: data.price[i]
        }));
        
        // Clear existing annotations to prevent memory leak
        priceChart.options.plugins.annotation.annotations = {
            // Keep only the default annotations, clear the dynamic ones
            zeroLine: {
                type: 'line',
                yMin: 0,
                yMax: 0,
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: 1
            }
        };
        
        // Limit the number of annotations to prevent stack overflow
        const maxSignals = 50; // Limiting to 50 signals maximum to prevent performance issues
        
        // Add buy/sell signals as annotations on price chart
        if (data.signals.buy && data.signals.buy.length > 0) {
            const limitedBuys = data.signals.buy.slice(-maxSignals); // Take only the most recent signals
            limitedBuys.forEach((date, i) => {
                priceChart.options.plugins.annotation.annotations[`buy${i}`] = {
                    type: 'line',
                    xMin: new Date(date),
                    xMax: new Date(date),
                    borderColor: '#3fff00',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    label: {
                        content: 'Buy',
                        enabled: true,
                        position: 'top',
                        backgroundColor: '#3fff00',
                        color: 'black',
                        font: {
                            size: 10
                        }
                    }
                };
            });
        }
        
        if (data.signals.goldBuy && data.signals.goldBuy.length > 0) {
            const limitedGoldBuys = data.signals.goldBuy.slice(-maxSignals);
            limitedGoldBuys.forEach((date, i) => {
                priceChart.options.plugins.annotation.annotations[`goldBuy${i}`] = {
                    type: 'line',
                    xMin: new Date(date),
                    xMax: new Date(date),
                    borderColor: '#e2a400',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    label: {
                        content: 'Gold Buy',
                        enabled: true,
                        position: 'top',
                        backgroundColor: '#e2a400',
                        color: 'black',
                        font: {
                            size: 10
                        }
                    }
                };
            });
        }
        
        if (data.signals.sell && data.signals.sell.length > 0) {
            const limitedSells = data.signals.sell.slice(-maxSignals);
            limitedSells.forEach((date, i) => {
                priceChart.options.plugins.annotation.annotations[`sell${i}`] = {
                    type: 'line',
                    xMin: new Date(date),
                    xMax: new Date(date),
                    borderColor: '#ff5252',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    label: {
                        content: 'Sell',
                        enabled: true,
                        position: 'top',
                        backgroundColor: '#ff5252',
                        color: 'black',
                        font: {
                            size: 10
                        }
                    }
                };
            });
        }
        
        // Update WT chart with area fill
        // Setup data for area fill between WT1 and WT2
        const areaData = dates.map((date, i) => ({
            x: date,
            y: data.wt2[i] // Use WT2 as the base for area fill
        }));
        
        wtChart.data.datasets[0].data = areaData;
        
        // Update main datasets
        wtChart.data.datasets[1].data = dates.map((date, i) => ({
            x: date,
            y: data.wt1[i]
        }));
        wtChart.data.datasets[2].data = dates.map((date, i) => ({
            x: date,
            y: data.wt2[i]
        }));
        wtChart.data.datasets[3].data = dates.map((date, i) => ({
            x: date,
            y: data.wtVwap[i]
        }));
        wtChart.data.datasets[4].data = dates.map((date, i) => ({
            x: date,
            y: data.rsi[i]
        }));
        
        // For Stoch RSI, handle the colored segments more efficiently
        // Keep only the base datasets (first 5) and remove any previous segments
        wtChart.data.datasets = wtChart.data.datasets.slice(0, 5);
        
        // Create a single dataset for Stoch with point colors based on RSI comparison
        const stochDataset = {
            label: 'Stoch RSI',
            data: dates.map((date, i) => {
                const stochVal = data.stoch[i];
                const rsiVal = data.rsi[i];
                
                return {
                    x: date,
                    y: stochVal,
                    // Store RSI value for comparison during drawing
                    rsi: rsiVal
                };
            }),
            borderColor: function(context) {
                // Use color callback to dynamically set color based on RSI comparison
                const index = context.dataIndex;
                const datasetData = context.dataset.data;
                if (index > 0) {
                    const point = datasetData[index];
                    const prevPoint = datasetData[index - 1];
                    if (point && prevPoint && !isNaN(point.y) && !isNaN(point.rsi)) {
                        return point.y < point.rsi ? '#22ff00' : '#ff0000';
                    }
                }
                return '#22ff00';
            },
            segment: {
                borderColor: function(context) {
                    const index = context.p1DataIndex;
                    const datasetData = context.chart.data.datasets[context.datasetIndex].data;
                    if (index >= 0 && datasetData[index] && !isNaN(datasetData[index].y) && !isNaN(datasetData[index].rsi)) {
                        return datasetData[index].y < datasetData[index].rsi ? '#22ff00' : '#ff0000';
                    }
                    return '#22ff00';
                }
            },
            borderWidth: 1,
            tension: 0.1,
            pointRadius: 0,
            yAxisID: 'y'
        };
        
        wtChart.data.datasets.push(stochDataset);
        
        // Update Money Flow chart
        mfChart.data.labels = dates;
        mfChart.data.datasets[0].data = dates.map((date, i) => ({
            x: date,
            y: data.moneyFlow[i]
        }));
        
        // Add signals as separate datasets - more efficient than creating many separate point datasets
        // Clear existing signal datasets
        wtChart.data.datasets = wtChart.data.datasets.filter(d => 
            !d.label.includes('Buy Point') && !d.label.includes('Sell Point') && 
            !d.label.includes('Buy Points') && !d.label.includes('Sell Points') && 
            !d.label.includes('Gold Buy') && !d.label.includes('Cross Points'));
        
        // Add buy signals as one dataset
        if (data.signals.buy && data.signals.buy.length > 0) {
            wtChart.data.datasets.push({
                label: 'Buy Points',
                data: data.signals.buy.map(date => ({
                    x: new Date(date),
                    y: -107
                })),
                backgroundColor: '#3fff00',
                borderColor: '#3fff00',
                pointRadius: 5,
                pointStyle: 'circle',
                showLine: false,
                yAxisID: 'y'
            });
        }
        
        // Add gold buy signals as one dataset
        if (data.signals.goldBuy && data.signals.goldBuy.length > 0) {
            wtChart.data.datasets.push({
                label: 'Gold Buy Points',
                data: data.signals.goldBuy.map(date => ({
                    x: new Date(date),
                    y: -107
                })),
                backgroundColor: '#e2a400',
                borderColor: '#e2a400',
                pointRadius: 7,
                pointStyle: 'circle',
                showLine: false,
                yAxisID: 'y'
            });
        }
        
        // Add sell signals as one dataset
        if (data.signals.sell && data.signals.sell.length > 0) {
            wtChart.data.datasets.push({
                label: 'Sell Points',
                data: data.signals.sell.map(date => ({
                    x: new Date(date),
                    y: 107
                })),
                backgroundColor: '#ff5252',
                borderColor: '#ff5252',
                pointRadius: 5,
                pointStyle: 'circle',
                showLine: false,
                yAxisID: 'y'
            });
        }
        
        // Add cross points with correct colors
        if (data.signals.cross && data.signals.cross.length > 0) {
            // Separate red and green cross points
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
                wtChart.data.datasets.push({
                    label: 'Cross Points (Sell)',
                    data: redCrosses,
                    backgroundColor: '#ff5252',
                    borderColor: '#ff5252',
                    pointRadius: 4,
                    pointStyle: 'circle',
                    showLine: false,
                    yAxisID: 'y'
                });
            }
            
            // Add green crosses
            if (greenCrosses.length > 0) {
                wtChart.data.datasets.push({
                    label: 'Cross Points (Buy)',
                    data: greenCrosses,
                    backgroundColor: '#3fff00',
                    borderColor: '#3fff00',
                    pointRadius: 4,
                    pointStyle: 'circle',
                    showLine: false,
                    yAxisID: 'y'
                });
            }
        }
        
        // Force garbage collection by removing references to large arrays
        // This helps prevent memory leaks
        setTimeout(() => {
            // Update all charts
            priceChart.update();
            wtChart.update();
            mfChart.update();
        }, 0);
    }
    
    function updateInfo(data) {
        // Update current values
        document.getElementById('currentWT1').textContent = data.summary.currentWT1.toFixed(2);
        document.getElementById('currentWT2').textContent = data.summary.currentWT2.toFixed(2);
        document.getElementById('currentMF').textContent = data.summary.currentMF.toFixed(2);
        
        // Update signal counts
        document.getElementById('buySignalCount').textContent = data.summary.buySignals;
        document.getElementById('goldBuySignalCount').textContent = data.summary.goldBuySignals;
        document.getElementById('sellSignalCount').textContent = data.summary.sellSignals;
        
        // Update status
        const statusElement = document.getElementById('statusIndicator');
        statusElement.textContent = data.status || 'Neutral zone';
        statusElement.className = 'status-indicator';
        
        if (data.status === 'Potential buy zone') {
            statusElement.classList.add('buy-zone');
        } else if (data.status === 'Potential sell zone') {
            statusElement.classList.add('sell-zone');
        } else {
            statusElement.classList.add('neutral-zone');
        }
    }
    
    // Try to fetch data on page load
    setTimeout(fetchData, 300); // Increased delay to ensure DOM is fully loaded
});