// === PHASE 1 ENHANCEMENTS FOR ENHANCED DASHBOARD ===
// This script adds timestamps, signal age color coding, momentum arrows, and fresh signal badges

console.log('Loading Phase 1 Enhancements...');

// Enhanced Signal Timing and Visual Functions
function formatSignalDateTime(dateString, daysAgo = null, interval = '1d') {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        
        // For intraday data, show more precise timing
        if (interval.includes('m') || interval.includes('h')) {
            const ageInfo = calculateSignalAgeIntraday([dateString], interval);
            const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
            const dateStr = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric'
            });
            
            // For same day, just show time and age
            if (date.toDateString() === now.toDateString()) {
                return `Today at ${timeStr} (${ageInfo.value} ${ageInfo.unit} ago)`;
            } else {
                return `${dateStr} at ${timeStr} (${ageInfo.value} ${ageInfo.unit} ago)`;
            }
        } else {
            // Daily or longer - use original format
            const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
            const dateStr = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric'
            });
            
            const ageInfo = daysAgo !== null ? `${daysAgo}d ago` : `${daysAgo || 0}d ago`;
            return `${dateStr} at ${timeStr} (${ageInfo})`;
        }
    } catch (e) {
        return daysAgo !== null ? `${daysAgo}d ago` : 'Recent';
    }
}

function getSignalAgeColor(daysAgo) {
    if (daysAgo === null || daysAgo === undefined) return '#808080';
    if (daysAgo <= 1) return '#FFD700'; // Fresh - Gold
    if (daysAgo <= 3) return '#00ff0a'; // Recent - Green  
    if (daysAgo <= 7) return '#32CD32'; // Moderate - Light Green
    return '#808080'; // Old - Gray
}

function getMomentumArrow(current, previous) {
    if (!current || !previous) return '➡️';
    if (current > previous) return '↗️';
    if (current < previous) return '↘️';
    return '➡️';
}

function getFreshSignalBadge(daysAgo) {
    if (daysAgo === null || daysAgo === undefined) return '';
    if (daysAgo <= 0.5) return ' 🔥'; // Less than 12 hours
    if (daysAgo <= 1) return ' ⚡'; // Less than 24 hours  
    if (daysAgo <= 3) return ' ✨'; // Less than 3 days
    return '';
}

function calculateSignalAge(dates) {
    if (!dates || dates.length === 0) return null;
    
    const now = new Date();
    const signalDate = new Date(dates[dates.length - 1]);
    return Math.max(0, Math.floor((now - signalDate) / (1000 * 60 * 60 * 24)));
}

function calculateSignalAgeIntraday(dates, interval = '1d') {
    if (!dates || dates.length === 0) return null;
    
    const now = new Date();
    const signalDate = new Date(dates[dates.length - 1]);
    const diffMs = now - signalDate;
    
    // For intraday timeframes, return more granular timing
    if (interval.includes('m') || interval.includes('h')) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours === 0) {
            return { value: minutes, unit: 'minutes', totalHours: 0 };
        } else if (hours < 24) {
            return { value: hours, unit: 'hours', totalHours: hours };
        } else {
            const days = Math.floor(hours / 24);
            return { value: days, unit: 'days', totalHours: hours };
        }
    }
    
    // For daily and longer timeframes, return days
    return { value: Math.floor(diffMs / (1000 * 60 * 60 * 24)), unit: 'days', totalHours: Math.floor(diffMs / (1000 * 60 * 60)) };
}

function getDataFreshnessInfo(dates, interval = '1d') {
    if (!dates || dates.length === 0) {
        return { isFresh: false, message: 'No data available', color: '#808080' };
    }
    
    const lastDataPoint = new Date(dates[dates.length - 1]);
    const now = new Date();
    const ageInfo = calculateSignalAgeIntraday(dates, interval);
    
    // Determine freshness based on interval
    let expectedFreshness, warningThreshold, staleThreshold;
    
    if (interval === '1m') {
        expectedFreshness = 5; // minutes
        warningThreshold = 15;
        staleThreshold = 60;
    } else if (interval === '5m') {
        expectedFreshness = 10; // minutes
        warningThreshold = 30;
        staleThreshold = 120;
    } else if (interval === '15m') {
        expectedFreshness = 30; // minutes
        warningThreshold = 60;
        staleThreshold = 240;
    } else if (interval === '30m') {
        expectedFreshness = 60; // minutes
        warningThreshold = 120;
        staleThreshold = 360;
    } else if (interval === '1h') {
        expectedFreshness = 2; // hours
        warningThreshold = 6;
        staleThreshold = 24;
    } else {
        // Daily or longer - use days
        expectedFreshness = 1; // days
        warningThreshold = 2;
        staleThreshold = 7;
    }
    
    // Convert thresholds to minutes for comparison
    const isIntraday = interval.includes('m') || interval.includes('h');
    const ageInMinutes = isIntraday ? 
        (ageInfo.unit === 'minutes' ? ageInfo.value : 
         ageInfo.unit === 'hours' ? ageInfo.value * 60 : 
         ageInfo.value * 24 * 60) : ageInfo.value * 24 * 60;
    
    const expectedFreshnessMinutes = isIntraday && (interval.includes('h') && expectedFreshness > 1) ? 
        expectedFreshness * 60 : expectedFreshness;
    const warningThresholdMinutes = isIntraday && (interval.includes('h') && warningThreshold > 1) ? 
        warningThreshold * 60 : warningThreshold;
    const staleThresholdMinutes = isIntraday && (interval.includes('h') && staleThreshold > 1) ? 
        staleThreshold * 60 : staleThreshold;
    
    if (ageInMinutes <= expectedFreshnessMinutes) {
        return { 
            isFresh: true, 
            message: `Fresh data (${ageInfo.value} ${ageInfo.unit} ago)`, 
            color: '#00ff0a',
            ageInfo
        };
    } else if (ageInMinutes <= warningThresholdMinutes) {
        return { 
            isFresh: true, 
            message: `Recent data (${ageInfo.value} ${ageInfo.unit} ago)`, 
            color: '#FFD700',
            ageInfo
        };
    } else if (ageInMinutes <= staleThresholdMinutes) {
        return { 
            isFresh: false, 
            message: `Delayed data (${ageInfo.value} ${ageInfo.unit} ago)`, 
            color: '#FFA500',
            ageInfo
        };
    } else {
        return { 
            isFresh: false, 
            message: `Stale data (${ageInfo.value} ${ageInfo.unit} ago)`, 
            color: '#ff1100',
            ageInfo
        };
    }
}

function getEnhancedSignalTiming(tickerData) {
    const dates = tickerData.dates || [];
    const summary = tickerData.summary || {};
    
    let lastSignalDate = null;
    let lastSignalType = 'None';
    let daysAgo = null;
    
    if (dates.length > 0) {
        lastSignalDate = dates[dates.length - 1];
        daysAgo = calculateSignalAge(dates);
        
        if (summary.goldBuySignals > 0) lastSignalType = 'Gold Buy';
        else if (summary.buySignals > 0) lastSignalType = 'Buy';
        else if (summary.sellSignals > 0) lastSignalType = 'Sell';
        else lastSignalType = 'Update';
    }
    
    return { lastSignalDate, lastSignalType, daysAgo };
}

// === ENHANCED RSI3M3 TIMING (FIXED VERSION) ===
function getEnhancedRSI3M3Timing(rsi3m3Data, interval = '1d', tickerData) {
    console.log('=== RSI3M3 Timing Debug ===');
    console.log('Input data:', rsi3m3Data);
    console.log('Data keys:', Object.keys(rsi3m3Data || {}));
    console.log('Ticker data keys:', Object.keys(tickerData || {}));
    console.log('Interval:', interval);
    console.log('Function available?', typeof window.findLastRSI3M3StateChange);
    
    // DEEP DATA STRUCTURE EXPLORATION
    console.log('=== DEEP DATA EXPLORATION ===');
    if (rsi3m3Data && typeof rsi3m3Data === 'object') {
        Object.keys(rsi3m3Data).forEach(key => {
            const value = rsi3m3Data[key];
            console.log(`RSI3M3.${key}:`, {
                type: typeof value,
                isArray: Array.isArray(value),
                length: Array.isArray(value) ? value.length : 'N/A',
                sample: Array.isArray(value) && value.length > 0 ? 
                    `[${value[0]}, ..., ${value[value.length - 1]}]` : 
                    value,
                lastValues: Array.isArray(value) && value.length > 0 ?
                    value.slice(-3) : 'N/A'
            });
        });
    }
    
    // Also check ticker-level timing data
    if (tickerData && typeof tickerData === 'object') {
        console.log('=== TICKER LEVEL DATA EXPLORATION ===');
        Object.keys(tickerData).forEach(key => {
            if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time') || key === 'summary') {
                const value = tickerData[key];
                console.log(`Ticker.${key}:`, {
                    type: typeof value,
                    isArray: Array.isArray(value),
                    value: typeof value === 'object' ? Object.keys(value) : value
                });
            }
        });
        
        // Check if ticker has summary with lastUpdate
        if (tickerData.summary && tickerData.summary.lastUpdate) {
            console.log('Found ticker lastUpdate:', tickerData.summary.lastUpdate);
        }
        
        // Check if ticker has dates array
        if (tickerData.dates) {
            console.log('Found ticker dates:', {
                type: typeof tickerData.dates,
                isArray: Array.isArray(tickerData.dates),
                length: Array.isArray(tickerData.dates) ? tickerData.dates.length : 'N/A',
                last: Array.isArray(tickerData.dates) && tickerData.dates.length > 0 ? 
                    tickerData.dates[tickerData.dates.length - 1] : 'N/A'
            });
        }
    }
    
    // Always try both approaches to ensure we get timing data
    let timingResult = { lastSignalDate: null, lastSignalType: 'No Data', daysAgo: null, ageInfo: null, freshnessInfo: null };
    
    // Method 1: Use existing function if available
    if (typeof window.findLastRSI3M3StateChange === 'function') {
        try {
            console.log('Trying Method 1: findLastRSI3M3StateChange');
            const stateChange = window.findLastRSI3M3StateChange(rsi3m3Data);
            console.log('State change result:', stateChange);
            
            if (stateChange && stateChange.lastChange && stateChange.lastChange !== null) {
                timingResult = {
                    lastSignalDate: stateChange.lastChange,
                    lastSignalType: stateChange.changeType || 'State Change',
                    daysAgo: stateChange.daysSinceChange,
                    ageInfo: calculateSignalAgeIntraday([stateChange.lastChange], interval),
                    freshnessInfo: getDataFreshnessInfo([stateChange.lastChange], interval)
                };
                console.log('Method 1 SUCCESS:', timingResult);
                return timingResult;
            } else {
                console.log('Method 1 returned no valid data:', stateChange);
            }
        } catch (error) {
            console.warn('Method 1 Error:', error);
        }
    } else {
        console.log('Method 1 not available - function missing');
    }
    
    // Method 2: COMPREHENSIVE data analysis
    if (rsi3m3Data && typeof rsi3m3Data === 'object') {
        console.log('Trying Method 2: Comprehensive data analysis');
        
        // Try to find ANY date information in the data
        let lastDate = null;
        let currentState = null;
        let currentRSI = null;
        let dateSource = 'unknown';
        
        // Check multiple possible date sources in RSI3M3 data
        const possibleDateFields = ['dates', 'timestamps', 'time', 'date', 'datetime', 'last_update'];
        for (const field of possibleDateFields) {
            if (rsi3m3Data[field] && Array.isArray(rsi3m3Data[field]) && rsi3m3Data[field].length > 0) {
                lastDate = rsi3m3Data[field][rsi3m3Data[field].length - 1];
                dateSource = `rsi3m3.${field}`;
                console.log(`Found date from RSI3M3.${field}:`, lastDate);
                break;
            }
        }
        
        // If no date in RSI3M3 data, check ticker-level data
        if (!lastDate && tickerData) {
            console.log('No date in RSI3M3 data, checking ticker-level data...');
            
            // Check ticker summary lastUpdate
            if (tickerData.summary && tickerData.summary.lastUpdate) {
                lastDate = new Date(tickerData.summary.lastUpdate);
                dateSource = 'ticker.summary.lastUpdate';
                console.log('Found date from ticker summary:', lastDate);
            }
            
            // Check ticker dates array
            if (!lastDate && tickerData.dates && Array.isArray(tickerData.dates) && tickerData.dates.length > 0) {
                lastDate = new Date(tickerData.dates[tickerData.dates.length - 1]);
                dateSource = 'ticker.dates';
                console.log('Found date from ticker dates:', lastDate);
            }
            
            // Check other ticker-level date fields
            if (!lastDate) {
                for (const field of possibleDateFields) {
                    if (tickerData[field] && Array.isArray(tickerData[field]) && tickerData[field].length > 0) {
                        lastDate = new Date(tickerData[field][tickerData[field].length - 1]);
                        dateSource = `ticker.${field}`;
                        console.log(`Found date from ticker.${field}:`, lastDate);
                        break;
                    }
                }
            }
        }
        
        // Check for state information
        if (rsi3m3Data.state && Array.isArray(rsi3m3Data.state) && rsi3m3Data.state.length > 0) {
            currentState = rsi3m3Data.state[rsi3m3Data.state.length - 1];
            console.log('Found current state:', currentState);
        }
        
        // Check for RSI values
        if (rsi3m3Data.rsi3m3 && Array.isArray(rsi3m3Data.rsi3m3) && rsi3m3Data.rsi3m3.length > 0) {
            currentRSI = rsi3m3Data.rsi3m3[rsi3m3Data.rsi3m3.length - 1];
            console.log('Found current RSI:', currentRSI);
        }
        
        // If still no date, try to use current timestamp with warning
        if (!lastDate && (currentState !== null || currentRSI !== null)) {
            console.log('No explicit date found, but data exists - using current time');
            lastDate = new Date(); // Current time since data exists
            dateSource = 'estimated_current';
        }
        
        // If STILL no date, estimate based on data freshness
        if (!lastDate) {
            console.log('No date found at all, estimating recent date');
            lastDate = new Date(Date.now() - (60 * 60 * 1000)); // 1 hour ago estimate
            dateSource = 'estimated_fallback';
        }
        
        const ageInfo = calculateSignalAgeIntraday([lastDate], interval);
        const freshnessInfo = getDataFreshnessInfo([lastDate], interval);
        
        // Enhanced signal type detection
        let signalType = 'RSI Update';
        let isStateChange = false;
        
        // Determine signal type based on current state
        if (currentState !== null) {
            switch (currentState) {
                case 1:
                    signalType = 'Bullish State';
                    break;
                case 2:
                    signalType = 'Bearish State';
                    break;
                case 3:
                    signalType = 'Transition State';
                    break;
                default:
                    signalType = 'Neutral State';
            }
            
            // Check for state changes if we have enough data
            if (rsi3m3Data.state && rsi3m3Data.state.length > 1) {
                const previousState = rsi3m3Data.state[rsi3m3Data.state.length - 2];
                console.log('Previous state:', previousState, 'Current state:', currentState);
                
                if (currentState !== previousState) {
                    isStateChange = true;
                    signalType = currentState === 1 ? 'Bullish Entry' : 
                                currentState === 2 ? 'Bearish Entry' : 
                                currentState === 3 ? 'Transition Entry' : 'State Change';
                }
            }
        }
        
        // Add RSI value if available
        if (currentRSI !== null) {
            signalType += ` (RSI: ${currentRSI.toFixed(1)})`;
        }
        
        // Add date source info for debugging
        signalType += ` [${dateSource}]`;
        
        timingResult = {
            lastSignalDate: lastDate,
            lastSignalType: signalType,
            daysAgo: Math.floor(ageInfo.totalHours / 24),
            ageInfo: ageInfo,
            freshnessInfo: freshnessInfo,
            isStateChange: isStateChange,
            dataAvailable: currentState !== null || currentRSI !== null,
            dateSource: dateSource
        };
        
        console.log('Method 2 SUCCESS:', timingResult);
        return timingResult;
    }
    
    console.log('No RSI3M3 data structure found');
    return timingResult;
}

function getEnhancedExhaustionTiming(exhaustionData, interval = '1d') {
    console.log('Exhaustion timing debug:', exhaustionData);
    
    // Check if the function exists before calling it
    if (typeof findLastExhaustionSignals === 'function') {
        try {
            const exhaustionSignals = findLastExhaustionSignals(exhaustionData);
            if (exhaustionSignals.mostRecentSignal) {
                return {
                    lastSignalDate: exhaustionSignals.mostRecentSignal,
                    lastSignalType: exhaustionSignals.mostRecentSignalType,
                    daysAgo: exhaustionSignals.daysSinceLastSignal,
                    ageInfo: calculateSignalAgeIntraday([exhaustionSignals.mostRecentSignal], interval),
                    freshnessInfo: getDataFreshnessInfo([exhaustionSignals.mostRecentSignal], interval)
                };
            }
        } catch (error) {
            console.warn('Error in findLastExhaustionSignals:', error);
        }
    }
    
    // Fallback: look for any available timing data in exhaustionData
    if (exhaustionData.dates && exhaustionData.dates.length > 0) {
        const lastDate = exhaustionData.dates[exhaustionData.dates.length - 1];
        const ageInfo = calculateSignalAgeIntraday(exhaustionData.dates, interval);
        const freshnessInfo = getDataFreshnessInfo(exhaustionData.dates, interval);
        
        // Check for any signals in the data
        let signalType = 'Exhaustion Update';
        if (exhaustionData.signals) {
            const signals = exhaustionData.signals;
            if (signals.obReversal && signals.obReversal.length > 0) signalType = 'Overbought Reversal';
            else if (signals.osReversal && signals.osReversal.length > 0) signalType = 'Oversold Reversal';
            else if (signals.bullCross && signals.bullCross.length > 0) signalType = 'Bullish Cross';
            else if (signals.bearCross && signals.bearCross.length > 0) signalType = 'Bearish Cross';
        }
        
        return {
            lastSignalDate: lastDate,
            lastSignalType: signalType,
            daysAgo: Math.floor(ageInfo.totalHours / 24),
            ageInfo: ageInfo,
            freshnessInfo: freshnessInfo
        };
    }
    
    // Check if there's any avgPercentR data
    if (exhaustionData.avgPercentR && exhaustionData.avgPercentR.length > 0) {
        // Use the last data point from summary if available
        const currentValue = exhaustionData.avgPercentR[exhaustionData.avgPercentR.length - 1];
        let signalType = 'Normal Zone';
        
        if (currentValue >= -20) signalType = 'Overbought Zone';
        else if (currentValue <= -80) signalType = 'Oversold Zone';
        
        // Estimate age based on data availability (fallback)
        const estimatedDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
        const ageInfo = calculateSignalAgeIntraday([estimatedDate], interval);
        
        return {
            lastSignalDate: estimatedDate,
            lastSignalType: signalType,
            daysAgo: 1,
            ageInfo: ageInfo,
            freshnessInfo: { isFresh: false, message: 'Estimated timing', color: '#FFA500' }
        };
    }
    
    return { lastSignalDate: null, lastSignalType: 'No Data', daysAgo: null, ageInfo: null, freshnessInfo: null };
}

// Enhanced CSS for Phase 1 improvements
function addPhase1Styles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Phase 1 Enhancement Styles */
        .enhanced-card {
            position: relative;
        }
        
        .signal-timing {
            font-size: 0.75em;
            margin-top: 2px;
        }
        
        .fresh-signal-badge {
            display: inline-block;
            margin-left: 4px;
            font-size: 0.8em;
        }
        
        .momentum-arrow {
            margin-left: 2px;
            font-size: 0.9em;
        }
        
        .age-indicator {
            font-size: 0.7em;
            opacity: 0.8;
        }
        
        .transition-info {
            background: rgba(255, 215, 0, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
            margin: 1px 0;
        }
        
        .fresh-signal-highlight {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Override the original renderTickersGrid function with enhanced version
function enhanceRenderTickersGrid() {
    // Store original function if it exists
    if (typeof window.originalRenderTickersGrid === 'undefined' && typeof renderTickersGrid === 'function') {
        window.originalRenderTickersGrid = renderTickersGrid;
    }
    
    // Enhanced version with Phase 1 improvements
    window.renderTickersGrid = function(data) {
        console.log('Enhanced renderTickersGrid called with Phase 1 features');
        
        const tickersGrid = document.getElementById('tickersGrid');
        
        if (!tickersGrid) {
            console.error('tickersGrid element not found!');
            return;
        }
        
        tickersGrid.innerHTML = '';
        
        if (!data || !data.results) {
            console.error('Invalid data structure:', data);
            tickersGrid.innerHTML = '<div class="col-12"><div class="alert alert-danger">No data available. Please try refreshing.</div></div>';
            return;
        }
        
        console.log('Processing', Object.keys(data.results).length, 'tickers with enhanced features');
        
        // Get current interval for timeframe-aware calculations
        const currentInterval = document.getElementById('intervalSelector') ? 
            document.getElementById('intervalSelector').value : '1d';
        console.log('Current interval for timing calculations:', currentInterval);
        
        Object.entries(data.results).forEach(([ticker, tickerData]) => {
            // Check if required functions are available before proceeding
            const requiredFunctions = [
                'safeValue', 'findLastRSI3M3StateChange', 'getRSI3M3StateInfo', 
                'calculateExhaustionScore', 'getExhaustionLevel', 'countExhaustionSignals',
                'getExhaustionVisualIndicators', 'calculateUnifiedAnalysis', 'getAnalyzerBState',
                'getExhaustionState', 'getSACState', 'getTickerCategory', 'determineOverallSignal',
                'getTagClass', 'getTagLabel', 'formatPrice'
            ];
            
            const missingFunctions = requiredFunctions.filter(func => typeof window[func] !== 'function');
            if (missingFunctions.length > 0) {
                console.warn(`Missing required functions for enhanced rendering: ${missingFunctions.join(', ')}`);
                // Fall back to basic rendering or skip
                return;
            }
            
            try {
                // Extract comprehensive data
                const companyName = tickerData.companyName || ticker;
                const currentPrice = safeValue(tickerData.summary?.currentPrice, 0);
                const priceChangePct = safeValue(tickerData.summary?.priceChangePct, 0);
                
                // === ENHANCED ANALYZER B DATA WITH TIMING ===
                const currentWT1 = safeValue(tickerData.summary?.currentWT1, 0);
                const currentWT2 = safeValue(tickerData.summary?.currentWT2, 0);
                const currentMF = safeValue(tickerData.summary?.currentMF, 0);
                const buySignals = safeValue(tickerData.summary?.buySignals, 0);
                const goldBuySignals = safeValue(tickerData.summary?.goldBuySignals, 0);
                const sellSignals = safeValue(tickerData.summary?.sellSignals, 0);
                const bullishDivs = safeValue(tickerData.summary?.bullishDivergenceSignals, 0);
                const bearishDivs = safeValue(tickerData.summary?.bearishDivergenceSignals, 0);
                
                // Get enhanced timing for Analyzer B
                const analyzerBTiming = getEnhancedSignalTiming(tickerData);
                const analyzerBAge = analyzerBTiming.daysAgo;
                const analyzerBAgeColor = getSignalAgeColor(analyzerBAge);
                const analyzerBBadge = getFreshSignalBadge(analyzerBAge);
                
                // === ENHANCED RSI3M3+ DATA ===
                const rsi3m3Data = tickerData.rsi3m3 || {};
                
                // Debug timing information
                console.log(`Timing debug for ${ticker}:`, {
                    analyzerB: analyzerBTiming,
                    rsi3m3Data: {
                        hasDates: !!rsi3m3Data.dates,
                        datesLength: rsi3m3Data.dates?.length,
                        hasState: !!rsi3m3Data.state,
                        stateLength: rsi3m3Data.state?.length,
                        hasRSI3M3: !!rsi3m3Data.rsi3m3,
                        rsi3m3Length: rsi3m3Data.rsi3m3?.length,
                        lastDate: rsi3m3Data.dates?.[rsi3m3Data.dates.length - 1],
                        currentState: rsi3m3Data.state?.[rsi3m3Data.state.length - 1],
                        currentRSI: rsi3m3Data.rsi3m3?.[rsi3m3Data.rsi3m3.length - 1]
                    },
                    exhaustionData: {
                        hasDates: !!(tickerData.trendExhaust || {}).dates,
                        datesLength: (tickerData.trendExhaust || {}).dates?.length,
                        hasSignals: !!(tickerData.trendExhaust || {}).signals,
                        hasAvgPercentR: !!(tickerData.trendExhaust || {}).avgPercentR,
                        avgPercentRLength: (tickerData.trendExhaust || {}).avgPercentR?.length,
                        lastDate: (tickerData.trendExhaust || {}).dates?.[(tickerData.trendExhaust || {}).dates?.length - 1]
                    },
                    sacData: Object.keys(tickerData.progressive_sac || {}).length
                });
                
                const currentRSI3M3 = rsi3m3Data.rsi3m3 ? safeValue(rsi3m3Data.rsi3m3[rsi3m3Data.rsi3m3.length - 1], 0) : 0;
                const previousRSI3M3 = rsi3m3Data.rsi3m3 ? safeValue(rsi3m3Data.rsi3m3[rsi3m3Data.rsi3m3.length - 2], currentRSI3M3) : currentRSI3M3;
                const currentRSI3M3State = rsi3m3Data.state ? rsi3m3Data.state[rsi3m3Data.state.length - 1] : 0;
                
                // Safe function calls with error handling
                let rsi3m3StateChange = { lastChange: null, daysSinceChange: null };
                let currentRSI3M3StateInfo = { color: '#808080', label: 'Unknown' };
                let isFreshRSI3M3Signal = false;
                let rsi3m3Timing = { lastSignalDate: null, lastSignalType: 'No Data', daysAgo: null };
                
                try {
                    rsi3m3StateChange = findLastRSI3M3StateChange(rsi3m3Data);
                    currentRSI3M3StateInfo = getRSI3M3StateInfo(currentRSI3M3State, currentRSI3M3);
                    isFreshRSI3M3Signal = rsi3m3StateChange.daysSinceChange !== null && rsi3m3StateChange.daysSinceChange <= 3;
                    
                    // Get enhanced timing information
                    rsi3m3Timing = getEnhancedRSI3M3Timing(rsi3m3Data, currentInterval, tickerData);
                } catch (error) {
                    console.warn(`Error processing RSI3M3 data for ${ticker}:`, error);
                }
                
                const rsi3m3Badge = getFreshSignalBadge(rsi3m3StateChange.daysSinceChange);
                const rsi3m3Momentum = getMomentumArrow(currentRSI3M3, previousRSI3M3);
                
                // === ENHANCED EXHAUSTION DATA ===
                const exhaustionData = tickerData.trendExhaust || {};
                const exhaustionScore = calculateExhaustionScore(exhaustionData);
                const exhaustionLevel = getExhaustionLevel(exhaustionData);
                const exhaustionSignals = countExhaustionSignals(exhaustionData);
                const exhaustionVisuals = getExhaustionVisualIndicators(exhaustionData);
                const exhaustionTiming = getEnhancedExhaustionTiming(exhaustionData, currentInterval);
                const exhaustionAge = exhaustionTiming.daysAgo;
                const exhaustionAgeColor = getSignalAgeColor(exhaustionAge);
                const exhaustionBadge = getFreshSignalBadge(exhaustionAge);
                
                // === ENHANCED PROGRESSIVE SAC DATA ===
                const sacData = tickerData.progressive_sac || {};
                const sacPrediction = sacData.prediction || 'Neutral';
                const sacConfidence = safeValue(sacData.confidence, 0);
                const sacRecommendation = sacData.recommendation || 'Hold';
                const sacPositionSize = safeValue(sacData.position_size, 0);
                
                // Get SAC timing - if data exists, it's current, otherwise show last update time
                let sacTiming = { lastSignalDate: null, lastSignalType: 'Real-time', daysAgo: 0 };
                if (Object.keys(sacData).length > 0) {
                    // SAC data exists - show as current
                    sacTiming = { lastSignalDate: new Date(), lastSignalType: 'Live Update', daysAgo: 0 };
                } else {
                    // No SAC data - show as unavailable
                    sacTiming = { lastSignalDate: null, lastSignalType: 'No Data', daysAgo: null };
                }
                const sacAge = sacTiming.daysAgo;
                const sacBadge = getFreshSignalBadge(sacAge);
                
                // === UNIFIED ANALYSIS ===
                let unifiedAnalysis = { score: 50, summary: 'Analysis pending...' };
                let analyzerBState = { color: '#808080', label: 'Unknown' };
                let exhaustionState = { color: '#808080', label: 'Unknown' };
                let sacState = { color: '#808080', label: 'Unknown' };
                let tickerType = 'unknown';
                let overallSignal = { color: '#808080', label: 'Unknown' };
                
                try {
                    unifiedAnalysis = calculateUnifiedAnalysis(tickerData);
                    analyzerBState = getAnalyzerBState(currentWT1, currentWT2, currentMF, buySignals, sellSignals, goldBuySignals);
                    exhaustionState = getExhaustionState(exhaustionScore, exhaustionLevel, exhaustionData);
                    sacState = getSACState(sacPrediction, sacConfidence, sacData);
                    tickerType = getTickerCategory(ticker);
                    overallSignal = determineOverallSignal(analyzerBState, currentRSI3M3StateInfo, exhaustionState, sacState);
                } catch (error) {
                    console.warn(`Error in unified analysis for ${ticker}:`, error);
                }
                
                // Create enhanced card element
                const cardCol = document.createElement('div');
                cardCol.className = 'col-md-6 col-lg-4 ticker-item';
                cardCol.dataset.ticker = ticker;
                cardCol.dataset.category = tickerType;
                cardCol.dataset.signals = overallSignal.label.toLowerCase().replace(' ', '');
                
                // Generate ENHANCED card HTML with Phase 1 improvements
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
                                    ${priceChangePct > 0 ? '+' : ''}${priceChangePct.toFixed(2)}% ${getMomentumArrow(currentPrice, currentPrice * (1 - priceChangePct/100))}
                                </div>
                            </div>
                            <button class="favorite-btn" onclick="toggleFavorite('${ticker}', this)">
                                <i class="bi bi-star"></i>
                            </button>
                        </div>
                        
                        <!-- ENHANCED Four Oscillators Dashboard -->
                        <div class="oscillators-dashboard">
                            <!-- ENHANCED Analyzer B Section -->
                            <div class="oscillator-section analyzer-b" style="border-left: 4px solid ${analyzerBState.color};">
                                <div class="oscillator-header">
                                    <span class="oscillator-name">Analyzer B${analyzerBBadge}</span>
                                    <span class="oscillator-status" style="color: ${analyzerBState.color};">${analyzerBState.label}</span>
                                </div>
                                <div class="oscillator-values">
                                    <div class="value-item">
                                        <span>WT1:</span> <span style="color: ${currentWT1 > currentWT2 ? '#00ff0a' : '#ff1100'};">${currentWT1.toFixed(2)} ${getMomentumArrow(currentWT1, currentWT1 * 0.98)}</span>
                                    </div>
                                    <div class="value-item">
                                        <span>WT2:</span> <span style="color: ${currentWT2 < currentWT1 ? '#00ff0a' : '#ff1100'};">${currentWT2.toFixed(2)} ${getMomentumArrow(currentWT2, currentWT2 * 0.98)}</span>
                                    </div>
                                    <div class="value-item">
                                        <span>MF:</span> <span style="color: ${currentMF > 0 ? '#00ff0a' : '#ff1100'};">${currentMF.toFixed(2)} ${getMomentumArrow(currentMF, currentMF * 0.95)}</span>
                                    </div>
                                    ${analyzerBTiming.lastSignalDate ? `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em;">Last Signal:</span> 
                                        <span style="color: ${analyzerBAgeColor}; font-size: 0.7em;">
                                            ${formatSignalDateTime(analyzerBTiming.lastSignalDate, analyzerBAge)}
                                        </span>
                                    </div>
                                    ` : ''}
                                </div>
                                <div class="signal-indicators">
                                    ${goldBuySignals > 0 ? '<span class="signal-dot gold-buy" title="Gold Buy">●</span>' : ''}
                                    ${buySignals > 0 ? '<span class="signal-dot buy" title="Buy">●</span>' : ''}
                                    ${sellSignals > 0 ? '<span class="signal-dot sell" title="Sell">●</span>' : ''}
                                    ${bullishDivs > 0 ? '<span class="signal-dot bullish-div" title="Bullish Div">↗</span>' : ''}
                                    ${bearishDivs > 0 ? '<span class="signal-dot bearish-div" title="Bearish Div">↘</span>' : ''}
                                </div>
                            </div>
                            
                            <!-- ENHANCED RSI3M3+ Section -->
                            <div class="oscillator-section rsi3m3 ${isFreshRSI3M3Signal ? 'fresh-signal-highlight' : ''}" style="border-left: 4px solid ${currentRSI3M3StateInfo.color}; background: ${currentRSI3M3StateInfo.color}15;">
                                <div class="oscillator-header">
                                    <span class="oscillator-name">RSI3M3+${rsi3m3Badge}</span>
                                    <span class="oscillator-status" style="color: ${currentRSI3M3StateInfo.color};">${currentRSI3M3StateInfo.label}</span>
                                </div>
                                <div class="oscillator-values">
                                    <div class="value-item">
                                        <span>Value:</span> <span style="color: ${currentRSI3M3StateInfo.color}; font-weight: bold;">${currentRSI3M3.toFixed(1)} ${rsi3m3Momentum}</span>
                                    </div>
                                    <div class="value-item">
                                        <span>State:</span> <span style="color: ${currentRSI3M3StateInfo.color}; font-weight: bold;">${currentRSI3M3StateInfo.label}</span>
                                    </div>
                                    ${rsi3m3Timing.lastSignalDate ? `
                                    <div class="value-item transition-info">
                                        <span style="font-size: 0.75em;">${rsi3m3Timing.lastSignalType}:</span> 
                                        <span style="color: ${rsi3m3Timing.freshnessInfo ? rsi3m3Timing.freshnessInfo.color : getSignalAgeColor(rsi3m3Timing.daysAgo)}; font-size: 0.7em;">
                                            ${formatSignalDateTime(rsi3m3Timing.lastSignalDate, rsi3m3Timing.daysAgo, currentInterval)}
                                        </span>
                                        ${rsi3m3Timing.freshnessInfo && (currentInterval.includes('m') || currentInterval.includes('h')) ? `
                                        <div style="font-size: 0.6em; color: ${rsi3m3Timing.freshnessInfo.color}; margin-top: 1px;">
                                            <strong>${rsi3m3Timing.freshnessInfo.message}</strong>
                                        </div>
                                        ` : ''}
                                        ${rsi3m3Timing.isStateChange ? `
                                        <div style="font-size: 0.6em; color: #FFD700; margin-top: 1px;">
                                            <strong>⚡ STATE CHANGE DETECTED</strong>
                                        </div>
                                        ` : ''}
                                        ${!rsi3m3Timing.dataAvailable ? `
                                        <div style="font-size: 0.6em; color: #FFA500; margin-top: 1px;">
                                            ⚠️ Estimated timing (limited data)
                                        </div>
                                        ` : ''}
                                    </div>
                                    ${isFreshRSI3M3Signal ? `
                                    <div class="value-item transition-info">
                                        <span style="color: #FFD700; font-weight: bold; font-size: 0.8em;">⚡ Fresh ${currentRSI3M3StateInfo.label} Signal!</span>
                                    </div>
                                    ` : ''}
                                    ` : `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em; color: #FFA500;">⚠️ No timing data available</span>
                                        <div style="font-size: 0.6em; color: #808080; margin-top: 1px;">
                                            RSI3M3 value available but no timing info
                                        </div>
                                    </div>
                                    `}
                                </div>
                                <div class="signal-indicators">
                                    ${currentRSI3M3State === 1 ? '<span class="signal-dot rsi-bullish" title="Currently Bullish" style="background: #00ff0a; color: white;">●</span>' : ''}
                                    ${currentRSI3M3State === 2 ? '<span class="signal-dot rsi-bearish" title="Currently Bearish" style="background: #ff1100; color: white;">●</span>' : ''}
                                    ${currentRSI3M3State === 3 ? '<span class="signal-dot rsi-transition" title="In Transition" style="background: #ffff00; color: black;">●</span>' : ''}
                                    ${isFreshRSI3M3Signal ? '<span class="signal-dot fresh-signal" title="Fresh Signal" style="background: gold; color: black;">⚡</span>' : ''}
                                </div>
                            </div>
                            
                            <!-- ENHANCED Exhaustion Section -->
                            <div class="oscillator-section exhaustion" style="border-left: 4px solid ${exhaustionState.color};">
                                <div class="oscillator-header">
                                    <span class="oscillator-name">Exhaustion${exhaustionBadge}</span>
                                    <span class="oscillator-status" style="color: ${exhaustionState.color};">${exhaustionState.label}</span>
                                </div>
                                <div class="oscillator-values">
                                    ${Object.keys(exhaustionData).length > 0 ? `
                                    <div class="value-item">
                                        <span>Score:</span> <span style="color: ${exhaustionState.color};">${exhaustionScore.toFixed(1)}/100 ${getMomentumArrow(exhaustionScore, exhaustionScore * 0.9)}</span>
                                    </div>
                                    <div class="value-item">
                                        <span>Level:</span> <span style="color: ${exhaustionState.color};">${exhaustionLevel}</span>
                                    </div>
                                    <div class="value-item">
                                        <span>Zones:</span> <span style="color: ${exhaustionState.color};">■ ${exhaustionVisuals.rectangles}</span>
                                    </div>
                                    <div class="value-item">
                                        <span>Reversals:</span> <span style="color: ${exhaustionState.color};">▲ ${exhaustionVisuals.triangles}</span>
                                    </div>
                                    ${exhaustionTiming && exhaustionTiming.lastSignalDate ? `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em;">${exhaustionTiming.lastSignalType}:</span>
                                        <span style="color: ${exhaustionTiming.freshnessInfo ? exhaustionTiming.freshnessInfo.color : exhaustionAgeColor}; font-size: 0.7em;">
                                            ${formatSignalDateTime(exhaustionTiming.lastSignalDate, exhaustionAge, currentInterval)}
                                        </span>
                                        ${exhaustionTiming.freshnessInfo && (currentInterval.includes('m') || currentInterval.includes('h')) ? `
                                        <div style="font-size: 0.6em; color: ${exhaustionTiming.freshnessInfo.color}; margin-top: 1px;">
                                            ${exhaustionTiming.freshnessInfo.message}
                                        </div>
                                        ` : ''}
                                    </div>
                                    ` : `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em; color: #808080;">No recent signals detected</span>
                                    </div>
                                    `}
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
                            
                            <!-- ENHANCED Progressive SAC Section -->
                            <div class="oscillator-section progressive-sac" style="border-left: 4px solid ${sacState.color};">
                                <div class="oscillator-header">
                                    <span class="oscillator-name">Progressive SAC${sacBadge}</span>
                                    <span class="oscillator-status" style="color: ${sacState.color};">${sacState.label}</span>
                                </div>
                                <div class="oscillator-values">
                                    ${Object.keys(sacData).length > 0 ? `
                                    <div class="value-item">
                                        <span>Prediction:</span> <span style="color: ${sacState.color};">${sacPrediction} ${getMomentumArrow(sacConfidence, sacConfidence * 0.8)}</span>
                                    </div>
                                    <div class="value-item">
                                        <span>Confidence:</span> <span style="color: ${sacState.color};">${(sacConfidence * 100).toFixed(1)}%</span>
                                    </div>
                                    <div class="value-item">
                                        <span>Position:</span> <span style="color: ${sacState.color};">${(sacPositionSize * 100).toFixed(1)}%</span>
                                    </div>
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em;">Updated:</span>
                                        <span style="color: #FFD700; font-size: 0.7em;">${sacTiming.lastSignalType}</span>
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
                            <button class="action-btn charts" onclick="openOscillatorCharts('${ticker}')">
                                <i class="bi bi-graph-down"></i> Oscillator Charts
                            </button>
                        </div>
                        
                        <div class="timestamp">Last updated: ${tickerData.summary?.lastUpdate || new Date().toLocaleString()}</div>
                    </div>
                `;
                
                // Add the card to the grid
                tickersGrid.appendChild(cardCol);
                
                console.log('Added ENHANCED card for ticker:', ticker);
                
                // Create enhanced mini chart
                setTimeout(() => {
                    createEnhancedMiniChart(`miniChart-${ticker.replace(/[^a-zA-Z0-9]/g, '_')}`, tickerData);
                }, 100);
            } catch (error) {
                console.warn(`Error processing ticker ${ticker}:`, error);
            }
        });
        
        console.log('Finished processing all tickers with Phase 1 enhancements. Total cards:', tickersGrid.children.length);
        
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
    };
}

// Initialize Phase 1 enhancements when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Phase 1 Enhancements...');
    addPhase1Styles();
    
    // Wait for main dashboard functions to be available before enhancing
    const checkForFunctions = () => {
        if (typeof renderTickersGrid === 'function' && 
            typeof findLastRSI3M3StateChange === 'function' &&
            typeof calculateExhaustionScore === 'function') {
            enhanceRenderTickersGrid();
            console.log('Phase 1 Enhancements loaded successfully!');
        } else {
            console.log('Waiting for main dashboard functions...');
            setTimeout(checkForFunctions, 500);
        }
    };
    
    checkForFunctions();
});

// If DOM is already loaded, initialize immediately with delay
if (document.readyState === 'loading') {
    // DOM is still loading
} else {
    // DOM is already loaded
    console.log('DOM already loaded, initializing Phase 1 Enhancements...');
    addPhase1Styles();
    
    // Wait for main dashboard functions to be available before enhancing
    const checkForFunctions = () => {
        if (typeof renderTickersGrid === 'function' && 
            typeof findLastRSI3M3StateChange === 'function' &&
            typeof calculateExhaustionScore === 'function') {
            enhanceRenderTickersGrid();
            console.log('Phase 1 Enhancements loaded successfully!');
        } else {
            console.log('Waiting for main dashboard functions...');
            setTimeout(checkForFunctions, 500);
        }
    };
    
    setTimeout(checkForFunctions, 1000); // Give main script time to load
} 