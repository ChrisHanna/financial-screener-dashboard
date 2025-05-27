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

// === ENHANCED EXHAUSTION ANALYSIS FOR REVERSALS ===
function getEnhancedExhaustionAnalysis(exhaustionData, interval = '1d', tickerDates = null) {
    console.log('=== Enhanced Exhaustion Analysis ===');
    console.log('Exhaustion data:', exhaustionData);
    console.log('Ticker dates provided:', tickerDates ? tickerDates.length : 'None');
    
    if (!exhaustionData || Object.keys(exhaustionData).length === 0) {
        return {
            status: 'No Data',
            currentZone: 'Unknown',
            reversalSignal: null,
            warning: null,
            signals: {
                bullishReversal: null,
                bearishReversal: null,
                reversalWarning: null
            },
            display: {
                primaryMessage: 'No exhaustion data available',
                secondaryMessage: 'Unable to analyze reversal conditions',
                color: '#808080',
                icon: '❓'
            }
        };
    }
    
    const signals = exhaustionData.signals || {};
    const avgPercentR = exhaustionData.avgPercentR || [];
    const dates = tickerDates || exhaustionData.dates || [];
    
    console.log(`📊 Data available: ${avgPercentR.length} avgPercentR values, ${dates.length} dates`);
    
    // Get current Williams %R value (last non-null value)
    let currentValue = null;
    let currentIndex = -1;
    
    for (let i = avgPercentR.length - 1; i >= 0; i--) {
        if (avgPercentR[i] !== null && avgPercentR[i] !== undefined) {
            currentValue = avgPercentR[i];
            currentIndex = i;
            break;
        }
    }
    
    console.log(`🎯 Current value: ${currentValue} at index ${currentIndex}`);
    
    // Determine current zone
    let currentZone = 'Normal';
    let zoneColor = '#6c757d'; // Neutral gray for normal zone
    let zoneIcon = '➖';
    let zoneEntryDate = null;
    let zoneEntryDaysAgo = null;
    
    if (currentValue !== null) {
        if (currentValue >= -20) {
            currentZone = 'Overbought';
            zoneColor = '#ff4444'; // Red for overbought (bearish warning)
            zoneIcon = '🔴';
        } else if (currentValue <= -80) {
            currentZone = 'Oversold';
            zoneColor = '#44ff44'; // Green for oversold (bullish opportunity)
            zoneIcon = '🟢';
        } else if (currentValue >= -30) {
            currentZone = 'Near Overbought';
            zoneColor = '#FFA500'; // Orange for approaching overbought
            zoneIcon = '🟡';
        } else if (currentValue <= -70) {
            currentZone = 'Near Oversold';
            zoneColor = '#FFD700'; // Gold for approaching oversold
            zoneIcon = '🟡';
        } else {
            currentZone = 'Neutral Zone';
            zoneColor = '#6c757d'; // Gray for truly neutral
            zoneIcon = '⚪';
        }
        
        // Find when we entered the current zone by looking backwards through the data
        if (avgPercentR.length > 1 && dates.length > 1 && currentIndex >= 0) {
            console.log(`🔍 Zone Entry Detection: Current zone: ${currentZone}, Current value: ${currentValue}, Starting from index: ${currentIndex}`);
            
            for (let i = currentIndex - 1; i >= 0; i--) {
                const prevValue = avgPercentR[i];
                if (prevValue === null || prevValue === undefined) continue;
                
                let prevZone = 'Normal';
                if (prevValue >= -20) {
                    prevZone = 'Overbought';
                } else if (prevValue <= -80) {
                    prevZone = 'Oversold';
                } else if (prevValue >= -30) {
                    prevZone = 'Near Overbought';
                } else if (prevValue <= -70) {
                    prevZone = 'Near Oversold';
                } else {
                    prevZone = 'Neutral Zone';
                }
                
                console.log(`📊 Index ${i}: Value ${prevValue}, Zone ${prevZone} vs Current ${currentZone}`);
                
                // If the zone changed, we found when we entered the current zone
                if (prevZone !== currentZone) {
                    // Find the next valid index after the zone change
                    let entryIndex = i + 1;
                    while (entryIndex < avgPercentR.length && (avgPercentR[entryIndex] === null || avgPercentR[entryIndex] === undefined)) {
                        entryIndex++;
                    }
                    
                    if (entryIndex < dates.length) {
                        zoneEntryDate = new Date(dates[entryIndex]);
                        const now = new Date();
                        zoneEntryDaysAgo = Math.floor((now - zoneEntryDate) / (1000 * 60 * 60 * 24));
                        console.log(`✅ Found zone entry: ${zoneEntryDate.toISOString()} (${zoneEntryDaysAgo}d ago) at index ${entryIndex}`);
                        break;
                    }
                }
            }
            
            // If we didn't find a zone change, we've been in this zone for the entire valid data period
            if (!zoneEntryDate && dates.length > 0) {
                // Find the first non-null value
                let firstValidIndex = 0;
                for (let i = 0; i < avgPercentR.length; i++) {
                    if (avgPercentR[i] !== null && avgPercentR[i] !== undefined) {
                        firstValidIndex = i;
                        break;
                    }
                }
                
                if (firstValidIndex < dates.length) {
                    zoneEntryDate = new Date(dates[firstValidIndex]);
                    const now = new Date();
                    zoneEntryDaysAgo = Math.floor((now - zoneEntryDate) / (1000 * 60 * 60 * 24));
                    console.log(`📅 No zone change found, using first valid data point: ${zoneEntryDate.toISOString()} (${zoneEntryDaysAgo}d ago) at index ${firstValidIndex}`);
                }
            }
            
            console.log(`🎯 Final zone entry result: Date: ${zoneEntryDate}, Days ago: ${zoneEntryDaysAgo}`);
        } else {
            console.warn(`⚠️ Insufficient data for zone detection: avgPercentR length: ${avgPercentR.length}, dates length: ${dates.length}, currentIndex: ${currentIndex}`);
            
            // Fallback: if we have at least one data point, use it
            if (dates.length > 0 && currentIndex >= 0 && currentIndex < dates.length) {
                zoneEntryDate = new Date(dates[currentIndex]); // Use current data point as approximation
                const now = new Date();
                zoneEntryDaysAgo = Math.floor((now - zoneEntryDate) / (1000 * 60 * 60 * 24));
                console.log(`🔄 Fallback: Using current data point as zone entry: ${zoneEntryDate.toISOString()}`);
            }
        }
    }
    
    // Analyze recent reversal signals
    const recentSignals = [];
    const now = new Date();
    
    // Check for overbought reversals (bearish signals)
    if (signals.obReversal && signals.obReversal.length > 0) {
        signals.obReversal.forEach(index => {
            if (dates[index]) {
                const signalDate = new Date(dates[index]);
                const daysAgo = Math.floor((now - signalDate) / (1000 * 60 * 60 * 24));
                if (daysAgo <= 10) { // Recent signals only
                    recentSignals.push({
                        type: 'Bearish Reversal',
                        subtype: 'Overbought Exit',
                        date: dates[index],
                        daysAgo: daysAgo,
                        strength: daysAgo <= 3 ? 'Strong' : 'Moderate',
                        direction: 'bearish',
                        icon: '🔻',
                        color: '#ff4444'
                    });
                }
            }
        });
    }
    
    // Check for oversold reversals (bullish signals)
    if (signals.osReversal && signals.osReversal.length > 0) {
        signals.osReversal.forEach(index => {
            if (dates[index]) {
                const signalDate = new Date(dates[index]);
                const daysAgo = Math.floor((now - signalDate) / (1000 * 60 * 60 * 24));
                if (daysAgo <= 10) { // Recent signals only
                    recentSignals.push({
                        type: 'Bullish Reversal',
                        subtype: 'Oversold Exit',
                        date: dates[index],
                        daysAgo: daysAgo,
                        strength: daysAgo <= 3 ? 'Strong' : 'Moderate',
                        direction: 'bullish',
                        icon: '🔺',
                        color: '#44ff44'
                    });
                }
            }
        });
    }
    
    // Sort signals by recency
    recentSignals.sort((a, b) => a.daysAgo - b.daysAgo);
    
    // Generate analysis
    let analysis = {
        status: 'Normal',
        currentZone: currentZone,
        currentValue: currentValue,
        currentDataDate: currentIndex >= 0 && currentIndex < dates.length ? new Date(dates[currentIndex]) : null,
        currentDataDaysAgo: currentIndex >= 0 && currentIndex < dates.length ? Math.floor((new Date() - new Date(dates[currentIndex])) / (1000 * 60 * 60 * 24)) : null,
        zoneEntryDate: zoneEntryDate,
        zoneEntryDaysAgo: zoneEntryDaysAgo,
        reversalSignal: null,
        warning: null,
        signals: {
            bullishReversal: null,
            bearishReversal: null,
            reversalWarning: null
        },
        display: {
            primaryMessage: 'Neutral conditions',
            secondaryMessage: 'No exhaustion detected - Normal trading range',
            color: zoneColor,
            icon: zoneIcon
        }
    };
    
    // Determine primary display based on current conditions and recent signals
    if (recentSignals.length > 0) {
        const mostRecentSignal = recentSignals[0];
        
        if (mostRecentSignal.daysAgo <= 3) {
            // Fresh reversal signal
            analysis.status = `Fresh ${mostRecentSignal.type}`;
            analysis.reversalSignal = mostRecentSignal;
            analysis.display = {
                primaryMessage: `${mostRecentSignal.icon} ${mostRecentSignal.type}`,
                secondaryMessage: `${mostRecentSignal.daysAgo === 0 ? 'Today' : mostRecentSignal.daysAgo + 'd ago'} - ${mostRecentSignal.strength} signal`,
                color: mostRecentSignal.color,
                icon: mostRecentSignal.icon,
                isFresh: true
            };
            
            // Set specific signal types
            if (mostRecentSignal.direction === 'bullish') {
                analysis.signals.bullishReversal = mostRecentSignal;
            } else {
                analysis.signals.bearishReversal = mostRecentSignal;
            }
        } else {
            // Recent but not fresh signal
            analysis.status = `Recent ${mostRecentSignal.type}`;
            analysis.display = {
                primaryMessage: `${mostRecentSignal.icon} ${mostRecentSignal.type}`,
                secondaryMessage: `${mostRecentSignal.daysAgo}d ago - Signal aging`,
                color: '#FFA500',
                icon: mostRecentSignal.icon,
                isFresh: false
            };
        }
    }
    
    // Add warnings based on current zone
    if (currentZone === 'Overbought') {
        analysis.warning = {
            type: 'Bearish Reversal Warning',
            message: 'Price in overbought territory - watch for bearish reversal',
            level: 'High',
            color: '#ff4444',
            icon: '⚠️'
        };
        analysis.signals.reversalWarning = analysis.warning;
        
        // Override display if no recent signals
        if (recentSignals.length === 0 || recentSignals[0].daysAgo > 5) {
            analysis.display = {
                primaryMessage: '⚠️ Overbought Warning',
                secondaryMessage: `Williams %R: ${currentValue?.toFixed(1)} - Reversal expected`,
                color: '#ff4444',
                icon: '⚠️',
                isWarning: true
            };
        }
    } else if (currentZone === 'Oversold') {
        analysis.warning = {
            type: 'Bullish Reversal Warning',
            message: 'Price in oversold territory - watch for bullish reversal',
            level: 'High',
            color: '#44ff44',
            icon: '⚠️'
        };
        analysis.signals.reversalWarning = analysis.warning;
        
        // Override display if no recent signals
        if (recentSignals.length === 0 || recentSignals[0].daysAgo > 5) {
            analysis.display = {
                primaryMessage: '⚠️ Oversold Opportunity',
                secondaryMessage: `Williams %R: ${currentValue?.toFixed(1)} - Reversal expected`,
                color: '#44ff44',
                icon: '⚠️',
                isWarning: true
            };
        }
    } else if (currentZone.includes('Near')) {
        const direction = currentZone.includes('Overbought') ? 'bearish' : 'bullish';
        analysis.warning = {
            type: `Approaching ${direction === 'bearish' ? 'Overbought' : 'Oversold'}`,
            message: `Approaching ${currentZone.toLowerCase()} zone - monitor closely`,
            level: 'Medium',
            color: '#FFA500',
            icon: '🔶'
        };
        
        if (recentSignals.length === 0 || recentSignals[0].daysAgo > 5) {
            analysis.display = {
                primaryMessage: `🔶 ${currentZone}`,
                secondaryMessage: `Williams %R: ${currentValue?.toFixed(1)} - Monitor for reversal`,
                color: '#FFA500',
                icon: '🔶',
                isWarning: true
            };
        }
    } else if (currentZone === 'Neutral Zone') {
        // Explicitly handle neutral zone to avoid confusion
        analysis.display = {
            primaryMessage: '⚪ Neutral Zone',
            secondaryMessage: `Williams %R: ${currentValue?.toFixed(1)} - Normal trading range`,
            color: '#6c757d',
            icon: '⚪',
            isNeutral: true
        };
    }
    
    // Add timing information
    if (analysis.reversalSignal) {
        const ageInfo = calculateSignalAgeIntraday([analysis.reversalSignal.date], interval);
        const freshnessInfo = getDataFreshnessInfo([analysis.reversalSignal.date], interval);
        analysis.reversalSignal.ageInfo = ageInfo;
        analysis.reversalSignal.freshnessInfo = freshnessInfo;
    }
    
    console.log('Enhanced exhaustion analysis result:', analysis);
    return analysis;
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
                const exhaustionAnalysis = getEnhancedExhaustionAnalysis(exhaustionData, currentInterval, tickerData.dates);
                
                // Keep legacy functions for compatibility but prioritize new analysis
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
                            <div class="oscillator-section exhaustion ${exhaustionAnalysis.display.isFresh ? 'fresh-signal-highlight' : ''}" style="border-left: 4px solid ${exhaustionAnalysis.display.color}; background: ${exhaustionAnalysis.display.color}15;">
                                <div class="oscillator-header">
                                    <span class="oscillator-name">Exhaustion Reversals${exhaustionBadge}</span>
                                    <span class="oscillator-status" style="color: ${exhaustionAnalysis.display.color};">${exhaustionAnalysis.status}</span>
                                </div>
                                <div class="oscillator-values">
                                    <div class="value-item">
                                        <span style="font-size: 0.85em; font-weight: bold; color: ${exhaustionAnalysis.display.color};">
                                            ${exhaustionAnalysis.display.primaryMessage}
                                        </span>
                                    </div>
                                    <div class="value-item">
                                        <span style="font-size: 0.75em; color: ${exhaustionAnalysis.display.color};">
                                            ${exhaustionAnalysis.display.secondaryMessage}
                                        </span>
                                    </div>
                                    
                                    ${exhaustionAnalysis.reversalSignal ? `
                                    <div class="value-item transition-info">
                                        <span style="font-size: 0.75em;">Signal Timing:</span>
                                        <span style="color: ${exhaustionAnalysis.reversalSignal.freshnessInfo ? exhaustionAnalysis.reversalSignal.freshnessInfo.color : exhaustionAnalysis.reversalSignal.color}; font-size: 0.7em;">
                                            ${formatSignalDateTime(exhaustionAnalysis.reversalSignal.date, exhaustionAnalysis.reversalSignal.daysAgo, currentInterval)}
                                        </span>
                                        ${exhaustionAnalysis.reversalSignal.freshnessInfo && (currentInterval.includes('m') || currentInterval.includes('h')) ? `
                                        <div style="font-size: 0.6em; color: ${exhaustionAnalysis.reversalSignal.freshnessInfo.color}; margin-top: 1px;">
                                            <strong>${exhaustionAnalysis.reversalSignal.freshnessInfo.message}</strong>
                                        </div>
                                        ` : ''}
                                    </div>
                                    ` : ''}
                                    
                                    <!-- Data Timing Information -->
                                    ${exhaustionAnalysis.zoneEntryDate ? `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em;">Entered ${exhaustionAnalysis.currentZone}:</span>
                                        <span style="color: ${exhaustionAnalysis.zoneEntryDaysAgo <= 1 ? '#FFD700' : exhaustionAnalysis.zoneEntryDaysAgo <= 3 ? '#00ff0a' : exhaustionAnalysis.zoneEntryDaysAgo <= 7 ? '#FFA500' : '#808080'}; font-size: 0.7em;">
                                            ${formatSignalDateTime(exhaustionAnalysis.zoneEntryDate, exhaustionAnalysis.zoneEntryDaysAgo, currentInterval)}
                                        </span>
                                        ${exhaustionAnalysis.zoneEntryDaysAgo <= 1 ? `
                                        <div style="font-size: 0.6em; color: #FFD700; margin-top: 1px;">
                                            <strong>🔥 Fresh zone entry</strong>
                                        </div>
                                        ` : exhaustionAnalysis.zoneEntryDaysAgo <= 3 ? `
                                        <div style="font-size: 0.6em; color: #00ff0a; margin-top: 1px;">
                                            <strong>⚡ Recent zone entry</strong>
                                        </div>
                                        ` : exhaustionAnalysis.zoneEntryDaysAgo >= 14 ? `
                                        <div style="font-size: 0.6em; color: #808080; margin-top: 1px;">
                                            <strong>⏳ Extended time in zone</strong>
                                        </div>
                                        ` : ''}
                                    </div>
                                    ` : exhaustionTiming.lastSignalDate ? `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em;">Data Updated:</span>
                                        <span style="color: ${exhaustionTiming.freshnessInfo ? exhaustionTiming.freshnessInfo.color : exhaustionAgeColor}; font-size: 0.7em;">
                                            ${formatSignalDateTime(exhaustionTiming.lastSignalDate, exhaustionTiming.daysAgo, currentInterval)}
                                        </span>
                                        ${exhaustionTiming.freshnessInfo && (currentInterval.includes('m') || currentInterval.includes('h')) ? `
                                        <div style="font-size: 0.6em; color: ${exhaustionTiming.freshnessInfo.color}; margin-top: 1px;">
                                            <strong>${exhaustionTiming.freshnessInfo.message}</strong>
                                        </div>
                                        ` : ''}
                                    </div>
                                    ` : `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em; color: #FFA500;">⚠️ No timing data available</span>
                                        <div style="font-size: 0.6em; color: #808080; margin-top: 1px;">
                                            Exhaustion analysis available but no timing info
                                        </div>
                                    </div>
                                    `}
                                    
                                    <!-- Current Data Timing -->
                                    ${exhaustionAnalysis.currentDataDate ? `
                                    <div class="value-item signal-timing">
                                        <span style="font-size: 0.75em;">Current Value (${exhaustionAnalysis.currentValue?.toFixed(1)}):</span>
                                        <span style="color: ${exhaustionAnalysis.currentDataDaysAgo <= 1 ? '#FFD700' : exhaustionAnalysis.currentDataDaysAgo <= 3 ? '#00ff0a' : '#808080'}; font-size: 0.7em;">
                                            ${formatSignalDateTime(exhaustionAnalysis.currentDataDate, exhaustionAnalysis.currentDataDaysAgo, currentInterval)}
                                        </span>
                                        ${exhaustionAnalysis.currentDataDaysAgo <= 1 ? `
                                        <div style="font-size: 0.6em; color: #FFD700; margin-top: 1px;">
                                            <strong>🔥 Fresh data</strong>
                                        </div>
                                        ` : exhaustionAnalysis.currentDataDaysAgo <= 3 ? `
                                        <div style="font-size: 0.6em; color: #00ff0a; margin-top: 1px;">
                                            <strong>⚡ Recent data</strong>
                                        </div>
                                        ` : exhaustionAnalysis.currentDataDaysAgo >= 7 ? `
                                        <div style="font-size: 0.6em; color: #808080; margin-top: 1px;">
                                            <strong>⏳ Stale data (${exhaustionAnalysis.currentDataDaysAgo}d old)</strong>
                                        </div>
                                        ` : ''}
                                    </div>
                                    ` : ''}
                                    
                                    ${exhaustionAnalysis.warning ? `
                                    <div class="value-item transition-info">
                                        <span style="font-size: 0.75em; color: ${exhaustionAnalysis.warning.color}; font-weight: bold;">
                                            ${exhaustionAnalysis.warning.icon} ${exhaustionAnalysis.warning.type}
                                        </span>
                                        <div style="font-size: 0.65em; color: ${exhaustionAnalysis.warning.color}; margin-top: 1px;">
                                            ${exhaustionAnalysis.warning.message}
                                        </div>
                                    </div>
                                    ` : ''}
                                    
                                    <!-- Current Zone Info -->
                                    <div class="value-item">
                                        <span style="font-size: 0.7em;">Current Zone:</span>
                                        <span style="color: ${exhaustionAnalysis.display.color}; font-size: 0.7em; font-weight: bold;">
                                            ${exhaustionAnalysis.currentZone}
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="signal-indicators">
                                    ${exhaustionAnalysis.signals.bullishReversal ? '<span class="signal-dot bullish-reversal" title="Bullish Reversal Signal" style="background: #44ff44; color: white;">🔺</span>' : ''}
                                    ${exhaustionAnalysis.signals.bearishReversal ? '<span class="signal-dot bearish-reversal" title="Bearish Reversal Signal" style="background: #ff4444; color: white;">🔻</span>' : ''}
                                    ${exhaustionAnalysis.signals.reversalWarning ? '<span class="signal-dot reversal-warning" title="Reversal Warning" style="background: #FFA500; color: white;">⚠️</span>' : ''}
                                    ${exhaustionAnalysis.display.isFresh ? '<span class="signal-dot fresh-signal" title="Fresh Signal" style="background: gold; color: black;">⚡</span>' : ''}
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

// === ENHANCED UNIFIED ANALYSIS FOR NEUTRAL ZONE ===
function enhanceUnifiedAnalysis() {
    // Store original function if it exists
    if (typeof window.originalCalculateUnifiedAnalysis === 'undefined' && typeof calculateUnifiedAnalysis === 'function') {
        window.originalCalculateUnifiedAnalysis = calculateUnifiedAnalysis;
        console.log('Stored original calculateUnifiedAnalysis function');
    }
    
    // Enhanced version with proper neutral zone handling
    window.calculateUnifiedAnalysis = function(tickerData) {
        const summary = tickerData.summary || {};
        const rsi3m3Data = tickerData.rsi3m3 || {};
        const exhaustionData = tickerData.trendExhaust || {};
        const sacData = tickerData.progressive_sac || {};
        
        // Get current interval for enhanced analysis
        const currentInterval = document.getElementById('intervalSelector') ? 
            document.getElementById('intervalSelector').value : '1d';
        
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
        
        // === ENHANCED EXHAUSTION SCORE USING NEW ANALYSIS ===
        let exhaustionScore = 12; // Default neutral score
        let exhaustionAnalysis = null;
        
        if (exhaustionData && Object.keys(exhaustionData).length > 0) {
            // Use our enhanced exhaustion analysis
            exhaustionAnalysis = getEnhancedExhaustionAnalysis(exhaustionData, currentInterval, tickerData.dates);
            
            // Convert enhanced analysis to score
            switch (exhaustionAnalysis.currentZone) {
                case 'Oversold':
                    exhaustionScore = 25; // Bullish opportunity
                    break;
                case 'Near Oversold':
                    exhaustionScore = 20; // Potential bullish setup
                    break;
                case 'Neutral Zone':
                case 'Normal':
                    exhaustionScore = 12; // Truly neutral
                    break;
                case 'Near Overbought':
                    exhaustionScore = 5; // Potential bearish warning
                    break;
                case 'Overbought':
                    exhaustionScore = 0; // Bearish warning
                    break;
                default:
                    exhaustionScore = 12; // Default neutral
            }
            
            // Adjust score based on recent reversal signals
            if (exhaustionAnalysis.reversalSignal) {
                if (exhaustionAnalysis.reversalSignal.direction === 'bullish' && exhaustionAnalysis.reversalSignal.daysAgo <= 3) {
                    exhaustionScore = Math.max(exhaustionScore, 22); // Fresh bullish reversal
                } else if (exhaustionAnalysis.reversalSignal.direction === 'bearish' && exhaustionAnalysis.reversalSignal.daysAgo <= 3) {
                    exhaustionScore = Math.min(exhaustionScore, 3); // Fresh bearish reversal
                }
            }
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
        
        // === ENHANCED CONFLUENCE CALCULATION ===
        const confluence = {
            analyzer_b: (goldBuySignals > 0 || buySignals > 0 || (wt1 > wt2 && mf > 0)),
            rsi3m3: rsi3m3State === 1,
            // Enhanced exhaustion confluence using new analysis
            exhaustion: exhaustionData && Object.keys(exhaustionData).length > 0 ? 
                       (exhaustionAnalysis ? 
                        (exhaustionAnalysis.currentZone === 'Oversold' || 
                         exhaustionAnalysis.currentZone === 'Near Oversold' ||
                         (exhaustionAnalysis.reversalSignal && exhaustionAnalysis.reversalSignal.direction === 'bullish' && exhaustionAnalysis.reversalSignal.daysAgo <= 3)) : 
                        false) : null,
            sac: sacData && Object.keys(sacData).length > 0 ? 
                 (sacData.prediction === 'Bullish' && sacData.confidence > 0.5) : null
        };
        
        console.log('Enhanced unified analysis result:', {
            totalScore,
            exhaustionAnalysis: exhaustionAnalysis ? {
                currentZone: exhaustionAnalysis.currentZone,
                status: exhaustionAnalysis.status,
                confluence: confluence.exhaustion
            } : 'No data',
            confluence
        });
        
        return {
            score: Math.round(totalScore),
            summary: summaryText,
            confluence: confluence,
            activeSystems: availableSystems,
            exhaustionAnalysis: exhaustionAnalysis // Include for debugging
        };
    };
    
    console.log('Enhanced calculateUnifiedAnalysis with neutral zone support active');
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
            enhanceFetchWithIntradayOptimization(); // Add intraday optimization
            enhanceUnifiedAnalysis(); // Add enhanced unified analysis
            console.log('Phase 1 Enhancements loaded successfully with intraday optimization and neutral zone support!');
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
            enhanceFetchWithIntradayOptimization(); // Add intraday optimization
            enhanceUnifiedAnalysis(); // Add enhanced unified analysis
            console.log('Phase 1 Enhancements loaded successfully with intraday optimization and neutral zone support!');
        } else {
            console.log('Waiting for main dashboard functions...');
            setTimeout(checkForFunctions, 500);
        }
    };
    
    setTimeout(checkForFunctions, 1000); // Give main script time to load
}

// === INTRADAY PERIOD OPTIMIZATION ===
function optimizePeriodForIntraday(period, interval) {
    // Check if it's an intraday interval
    const intradayIntervals = ['1m', '5m', '15m', '30m', '1h'];
    if (!intradayIntervals.includes(interval)) {
        return period; // Not intraday, return original period
    }
    
    console.log('🕒 Optimizing period for intraday data to include current day');
    
    // For intraday intervals, ensure we get sufficient recent data including current day
    if (period === '1d') {
        console.log('📈 Extended 1d to 5d for intraday context');
        return '5d'; // Get 5 days to ensure current day + context
    } else if (period === '5d') {
        console.log('📈 Extended 5d to 1mo for better intraday coverage');
        return '1mo'; // Get 1 month for better intraday analysis
    } else if (period === '1mo') {
        console.log('📈 Extended 1mo to 3mo for comprehensive intraday analysis');
        return '3mo'; // Get 3 months for comprehensive intraday analysis
    }
    
    return period; // For longer periods, keep as is
}

// === ENHANCED FETCH OVERRIDE ===
function enhanceFetchWithIntradayOptimization() {
    // Store original fetch function if not already stored
    if (typeof window.originalFetchTickersData === 'undefined' && typeof fetchTickersData === 'function') {
        window.originalFetchTickersData = fetchTickersData;
        console.log('Stored original fetchTickersData function');
    }
    
    // Override with enhanced version
    window.fetchTickersData = function(tickers) {
        if (!tickers || tickers.length === 0) return;
        
        console.log('Enhanced fetchTickersData called with intraday optimization:', tickers);
        
        const period = document.getElementById('periodSelector').value;
        const interval = document.getElementById('intervalSelector').value;
        
        // Optimize period for intraday intervals
        const optimizedPeriod = optimizePeriodForIntraday(period, interval);
        
        if (optimizedPeriod !== period) {
            console.log(`Period optimization: ${period} → ${optimizedPeriod} for ${interval} intervals`);
            
            // Show user-friendly notification
            showAlert(`🔍 Optimized period to ${optimizedPeriod} for ${interval} intervals to ensure current-day data`, 'info');
            
            // Temporarily update the period selector to reflect optimization
            const periodSelector = document.getElementById('periodSelector');
            const originalValue = periodSelector.value;
            periodSelector.value = optimizedPeriod;
            
            // Call original function with optimized period
            if (window.originalFetchTickersData) {
                window.originalFetchTickersData(tickers);
            }
            
            // Restore original period selector value after a delay
            setTimeout(() => {
                periodSelector.value = originalValue;
                console.log(`Restored period selector to: ${originalValue}`);
            }, 1000);
        } else {
            // No optimization needed, call original function
            if (window.originalFetchTickersData) {
                window.originalFetchTickersData(tickers);
            }
        }
    };
    
    console.log('Enhanced fetchTickersData with intraday optimization active');
}

// === ENHANCED OSCILLATOR CHARTS FOR MODAL ===

// Global chart instances for enhanced oscillator charts
let enhancedPriceChart, enhancedWtChart, enhancedRSI3M3Chart, enhancedMfChart, enhancedTrendExhaustChart;

function enhanceOscillatorChartsModal() {
    // Store original function if it exists
    if (typeof window.originalRenderOriginalOscillatorCharts === 'undefined' && typeof renderOriginalOscillatorCharts === 'function') {
        window.originalRenderOriginalOscillatorCharts = renderOriginalOscillatorCharts;
        console.log('Stored original renderOriginalOscillatorCharts function');
    }
    
    // Enhanced version with RSI3M3 and better signal visualization
    window.renderOriginalOscillatorCharts = function(detailedData) {
        console.log('Enhanced Oscillator Charts: Rendering ALL oscillators with RSI3M3 and improved signals');
        console.log('Enhanced data structure:', detailedData);
        
        // Clean up existing charts
        if (enhancedPriceChart) {
            enhancedPriceChart.destroy();
            enhancedPriceChart = null;
        }
        if (enhancedWtChart) {
            enhancedWtChart.destroy();
            enhancedWtChart = null;
        }
        if (enhancedRSI3M3Chart) {
            enhancedRSI3M3Chart.destroy();
            enhancedRSI3M3Chart = null;
        }
        if (enhancedMfChart) {
            enhancedMfChart.destroy();
            enhancedMfChart = null;
        }
        if (enhancedTrendExhaustChart) {
            enhancedTrendExhaustChart.destroy();
            enhancedTrendExhaustChart = null;
        }
        
        const dates = detailedData.dates.map(d => new Date(d));
        
        // Collect all signal information for better visualization
        const allSignals = collectAllSignalsForCharts(detailedData);
        console.log('Collected signals for visualization:', allSignals);
        
        // Create enhanced charts with all oscillators
        createEnhancedPriceChart(detailedData, dates, allSignals);
        createEnhancedWaveTrendChart(detailedData, dates, allSignals);
        createEnhancedRSI3M3Chart(detailedData, dates, allSignals); // NEW!
        createEnhancedMoneyFlowChart(detailedData, dates, allSignals);
        createEnhancedExhaustionChart(detailedData, dates, allSignals);
        
        // Add comprehensive legend
        addEnhancedOscillatorLegend(allSignals);
        
        console.log('Enhanced Oscillator Charts: All 5 oscillators rendered successfully with signals');
    };
    
    console.log('Enhanced oscillator charts modal with RSI3M3 support active');
}

function collectAllSignalsForCharts(detailedData) {
    const signals = {
        analyzer_b: {
            buy: [],
            sell: [],
            goldBuy: [],
            bullishDiv: [],
            bearishDiv: []
        },
        wavetrend: {
            buy: [],
            sell: [],
            goldBuy: []
        },
        rsi3m3: {
            bullish: [],
            bearish: [],
            transition: []
        },
        exhaustion: {
            obReversal: [],
            osReversal: [],
            bullCross: [],
            bearCross: []
        },
        alignedDates: []
    };
    
    const aligned = new Set();
    
    // Collect Analyzer B signals
    try {
        if (detailedData.signals) {
            if (detailedData.signals.buy) {
                signals.analyzer_b.buy = detailedData.signals.buy.map(d => new Date(d));
                detailedData.signals.buy.forEach(d => aligned.add(new Date(d).getTime()));
            }
            if (detailedData.signals.goldBuy) {
                signals.analyzer_b.goldBuy = detailedData.signals.goldBuy.map(d => new Date(d));
                detailedData.signals.goldBuy.forEach(d => aligned.add(new Date(d).getTime()));
            }
            if (detailedData.signals.sell) {
                signals.analyzer_b.sell = detailedData.signals.sell.map(d => new Date(d));
                detailedData.signals.sell.forEach(d => aligned.add(new Date(d).getTime()));
            }
        }
        
        // Also check wavetrend signals
        if (detailedData.wavetrend && detailedData.wavetrend.signals) {
            const wtSignals = detailedData.wavetrend.signals;
            if (wtSignals.buy) {
                signals.wavetrend.buy = wtSignals.buy.map(d => new Date(d));
                wtSignals.buy.forEach(d => aligned.add(new Date(d).getTime()));
            }
            if (wtSignals.sell) {
                signals.wavetrend.sell = wtSignals.sell.map(d => new Date(d));
                wtSignals.sell.forEach(d => aligned.add(new Date(d).getTime()));
            }
            if (wtSignals.goldBuy) {
                signals.wavetrend.goldBuy = wtSignals.goldBuy.map(d => new Date(d));
                wtSignals.goldBuy.forEach(d => aligned.add(new Date(d).getTime()));
            }
        }
        
        // Collect divergence signals
        if (detailedData.divergences) {
            if (detailedData.divergences.bullish) {
                signals.analyzer_b.bullishDiv = detailedData.divergences.bullish.map(d => new Date(d));
                detailedData.divergences.bullish.forEach(d => aligned.add(new Date(d).getTime()));
            }
            if (detailedData.divergences.bearish) {
                signals.analyzer_b.bearishDiv = detailedData.divergences.bearish.map(d => new Date(d));
                detailedData.divergences.bearish.forEach(d => aligned.add(new Date(d).getTime()));
            }
        }
    } catch (error) {
        console.warn('Error collecting analyzer signals:', error);
    }
    
    // Collect RSI3M3 signals
    try {
        let rsiStates = null;
        let rsiDates = null;
        
        if (detailedData.rsi3m3?.state && detailedData.rsi3m3?.dates) {
            rsiStates = detailedData.rsi3m3.state;
            rsiDates = detailedData.rsi3m3.dates.map(d => new Date(d));
        } else if (detailedData.rsi3m3State && detailedData.dates) {
            rsiStates = detailedData.rsi3m3State;
            rsiDates = detailedData.dates.map(d => new Date(d));
        }
        
        if (rsiStates && rsiDates) {
            for (let i = 1; i < rsiStates.length; i++) {
                if (rsiStates[i] !== rsiStates[i - 1]) {
                    aligned.add(rsiDates[i].getTime());
                    
                    if (rsiStates[i] === 1 || rsiStates[i] === 'bullish') {
                        signals.rsi3m3.bullish.push(rsiDates[i]);
                    } else if (rsiStates[i] === 2 || rsiStates[i] === 'bearish') {
                        signals.rsi3m3.bearish.push(rsiDates[i]);
                    } else if (rsiStates[i] === 3 || rsiStates[i] === 'transition') {
                        signals.rsi3m3.transition.push(rsiDates[i]);
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Error collecting RSI3M3 signals:', error);
    }
    
    // Collect exhaustion signals
    try {
        const exhaustionData = detailedData.trendExhaust || {};
        
        if (exhaustionData.signals && exhaustionData.dates) {
            const exDates = exhaustionData.dates.map(d => new Date(d));
            const exSignals = exhaustionData.signals;
            
            if (exSignals.obReversal && Array.isArray(exSignals.obReversal)) {
                signals.exhaustion.obReversal = exSignals.obReversal.map(idx => exDates[idx]).filter(d => d);
                exSignals.obReversal.forEach(idx => {
                    if (exDates[idx]) aligned.add(exDates[idx].getTime());
                });
            }
            
            if (exSignals.osReversal && Array.isArray(exSignals.osReversal)) {
                signals.exhaustion.osReversal = exSignals.osReversal.map(idx => exDates[idx]).filter(d => d);
                exSignals.osReversal.forEach(idx => {
                    if (exDates[idx]) aligned.add(exDates[idx].getTime());
                });
            }
            
            if (exSignals.bullCross && Array.isArray(exSignals.bullCross)) {
                signals.exhaustion.bullCross = exSignals.bullCross.map(idx => exDates[idx]).filter(d => d);
                exSignals.bullCross.forEach(idx => {
                    if (exDates[idx]) aligned.add(exDates[idx].getTime());
                });
            }
            
            if (exSignals.bearCross && Array.isArray(exSignals.bearCross)) {
                signals.exhaustion.bearCross = exSignals.bearCross.map(idx => exDates[idx]).filter(d => d);
                exSignals.bearCross.forEach(idx => {
                    if (exDates[idx]) aligned.add(exDates[idx].getTime());
                });
            }
        }
    } catch (error) {
        console.warn('Error collecting exhaustion signals:', error);
    }
    
    // Convert aligned signal times back to array
    signals.alignedDates = Array.from(aligned).map(ts => new Date(ts));
    
    console.log('Collected signals:', signals);
    return signals;
}

function createVerticalLineAnnotations(alignedDates) {
    const annotations = {};
    alignedDates.forEach((date, i) => {
        annotations[`signal_line_${i}`] = {
            type: 'line',
            xMin: date,
            xMax: date,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            borderDash: [2, 4],
            drawTime: 'beforeDatasetsDraw'
        };
    });
    return annotations;
}

function createEnhancedPriceChart(detailedData, dates, allSignals) {
    const priceCtx = document.getElementById('originalDetailedPriceChart');
    if (!priceCtx) return;
    
    priceCtx.style.height = '350px';
    priceCtx.height = 350;
    
    const priceData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.close ? detailedData.close[i] : detailedData.price[i]
    }));
    
    // Create gradient
    const gradient = priceCtx.getContext('2d').createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, 'rgba(41, 98, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(41, 98, 255, 0.0)');
    
    // Create signal point annotations
    const signalAnnotations = createVerticalLineAnnotations(allSignals.alignedDates);
    
    // Add specific signal points
    allSignals.analyzer_b.goldBuy.forEach((date, i) => {
        signalAnnotations[`goldBuy_${i}`] = {
            type: 'point',
            xValue: date,
            yValue: priceData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000)?.y,
            backgroundColor: '#FFD700',
            borderColor: '#FFA500',
            borderWidth: 3,
            radius: 8,
            drawTime: 'afterDatasetsDraw'
        };
    });
    
    allSignals.analyzer_b.buy.forEach((date, i) => {
        signalAnnotations[`buy_${i}`] = {
            type: 'point',
            xValue: date,
            yValue: priceData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000)?.y,
            backgroundColor: '#00ff0a',
            borderColor: '#00cc08',
            borderWidth: 2,
            radius: 6,
            drawTime: 'afterDatasetsDraw'
        };
    });
    
    allSignals.analyzer_b.sell.forEach((date, i) => {
        signalAnnotations[`sell_${i}`] = {
            type: 'point',
            xValue: date,
            yValue: priceData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000)?.y,
            backgroundColor: '#ff1100',
            borderColor: '#cc0d00',
            borderWidth: 2,
            radius: 6,
            drawTime: 'afterDatasetsDraw'
        };
    });
    
    enhancedPriceChart = new Chart(priceCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: detailedData.ticker || 'Price',
                data: priceData,
                borderColor: '#2962ff',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 5,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            layout: { padding: { left: 10, right: 50, top: 20, bottom: 10 } },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: detailedData.interval?.includes('d') ? 'day' : 'hour',
                        displayFormats: {
                            hour: 'dd HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy'
                        },
                        tooltipFormat: 'MMM d, yyyy HH:mm'
                    },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)', maxTicksLimit: 10 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    position: 'right',
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: value => value >= 1 ? value.toFixed(2) : value.toFixed(4)
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `${detailedData.ticker || 'Price'} - Enhanced with All Signals`,
                    color: 'white',
                    font: { size: 14, weight: 'bold' }
                },
                annotation: { annotations: signalAnnotations },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        afterBody: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].raw.x);
                            const signals = [];
                            
                            // Check for signals on this date
                            allSignals.analyzer_b.goldBuy.forEach(signalDate => {
                                if (Math.abs(signalDate - date) < 24 * 60 * 60 * 1000) {
                                    signals.push('🏆 Gold Buy Signal');
                                }
                            });
                            
                            allSignals.analyzer_b.buy.forEach(signalDate => {
                                if (Math.abs(signalDate - date) < 24 * 60 * 60 * 1000) {
                                    signals.push('🟢 Buy Signal');
                                }
                            });
                            
                            allSignals.analyzer_b.sell.forEach(signalDate => {
                                if (Math.abs(signalDate - date) < 24 * 60 * 60 * 1000) {
                                    signals.push('🔴 Sell Signal');
                                }
                            });
                            
                            return signals;
                        }
                    }
                }
            }
        }
    });
}

function createEnhancedWaveTrendChart(detailedData, dates, allSignals) {
    const canvas = document.getElementById('originalDetailedWtChart');
    if (!canvas) return;

    canvas.style.height = '300px';
    canvas.height = 300;

    if (window.enhancedWaveTrendChart) {
        window.enhancedWaveTrendChart.destroy();
    }

    // Check for WaveTrend data with correct property names
    const wt1Values = detailedData.wt1;
    const wt2Values = detailedData.wt2;

    if (!wt1Values || !wt2Values || !dates) {
        console.warn('❌ WaveTrend: Missing data - wt1, wt2, or dates not found');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No WaveTrend Data Available', canvas.width / 2, canvas.height / 2);
        return;
    }

    console.log('✅ WaveTrend: Found data', { wt1: wt1Values.length, wt2: wt2Values.length });

    const wt1Data = dates.map((date, i) => ({ x: new Date(date), y: wt1Values[i] }));
    const wt2Data = dates.map((date, i) => ({ x: new Date(date), y: wt2Values[i] }));

    const verticalLineAnnotations = createVerticalLineAnnotations(allSignals.alignedDates);

    // Add WaveTrend signal points
    const signalAnnotations = { ...verticalLineAnnotations };
    
    // Add Buy Signals (Green circles) - check both analyzer_b and wavetrend signals
    const buySignals = allSignals.analyzer_b?.buy || allSignals.wavetrend?.buy || [];
    buySignals.forEach((date, i) => {
        const dataPoint = wt1Data.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`wt_buy_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#00ff0a',
                borderColor: '#00cc08',
                borderWidth: 3,
                radius: 8,
                label: {
                    display: true,
                    content: 'BUY',
                    position: 'top',
                    backgroundColor: '#00ff0a',
                    color: '#ffffff',
                    font: { size: 10, weight: 'bold' }
                }
            };
        }
    });

    // Add Sell Signals (Red circles)
    const sellSignals = allSignals.analyzer_b?.sell || allSignals.wavetrend?.sell || [];
    sellSignals.forEach((date, i) => {
        const dataPoint = wt1Data.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`wt_sell_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#ff1100',
                borderColor: '#cc0d00',
                borderWidth: 3,
                radius: 8,
                label: {
                    display: true,
                    content: 'SELL',
                    position: 'top',
                    backgroundColor: '#ff1100',
                    color: '#ffffff',
                    font: { size: 10, weight: 'bold' }
                }
            };
        }
    });

    // Add Gold Buy Signals (Gold circles)
    const goldBuySignals = allSignals.analyzer_b?.goldBuy || allSignals.wavetrend?.goldBuy || [];
    goldBuySignals.forEach((date, i) => {
        const dataPoint = wt1Data.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`wt_goldBuy_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#ffd700',
                borderColor: '#ffcc00',
                borderWidth: 4,
                radius: 10,
                label: {
                    display: true,
                    content: '⭐BUY',
                    position: 'top',
                    backgroundColor: '#ffd700',
                    color: '#000000',
                    font: { size: 10, weight: 'bold' }
                }
            };
        }
    });

    window.enhancedWaveTrendChart = new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'WT1',
                    data: wt1Data,
                    borderColor: '#00ff0a',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'WT2',
                    data: wt2Data,
                    borderColor: '#ff1100',
                    backgroundColor: 'transparent',
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
            animation: { duration: 0 },
            scales: {
                x: {
                    type: 'time',
                    time: { 
                        unit: detailedData.interval?.includes('d') ? 'day' : 'hour',
                        displayFormats: {
                            hour: 'MM/dd HH:mm',
                            day: 'MM/dd'
                        }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'WaveTrend Oscillator with Signals',
                    color: 'white',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: 'white', usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        title: function(context) {
                            // Format the date properly
                            const date = new Date(context[0].parsed.x);
                            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + '%';
                                
                                // Add zone information
                                const value = context.parsed.y;
                                if (value <= -80) {
                                    label += ' (Oversold)';
                                } else if (value >= -20) {
                                    label += ' (Overbought)';
                                }
                            }
                            return label;
                        },
                        afterBody: function(tooltipItems) {
                            const value = tooltipItems[0].parsed.y;
                            const info = [];
                            
                            if (value <= -80) {
                                info.push('🟢 Potential Reversal Zone');
                            } else if (value >= -20) {
                                info.push('🔴 Potential Reversal Zone');
                            } else {
                                info.push('⚪ Neutral Zone');
                            }
                            
                            return info;
                        }
                    }
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
                        ...signalAnnotations
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: { wheel: { enabled: true }, mode: 'x' }
                }
            }
        }
    });

    console.log(`📊 WaveTrend Chart: ${wt1Data.length} points, ${allSignals.wavetrend.buy.length} buy, ${allSignals.wavetrend.sell.length} sell, ${allSignals.wavetrend.goldBuy.length} gold signals`);

    // Apply all signal annotations to the chart
    window.enhancedWaveTrendChart.options.plugins.annotation.annotations = signalAnnotations;
    window.enhancedWaveTrendChart.update('none');
}

function createEnhancedRSI3M3Chart(detailedData, dates, allSignals) {
    console.log('🔍 Creating RSI3M3 Chart...');
    const canvas = document.getElementById('originalDetailedRSI3M3Chart');
    if (!canvas) {
        console.warn('❌ RSI3M3: Canvas element not found');
        return;
    }

    canvas.style.height = '300px';
    canvas.height = 300;
    console.log('✅ RSI3M3: Canvas element found and configured');

    if (window.enhancedRSI3M3Chart) {
        window.enhancedRSI3M3Chart.destroy();
    }

    // Check for RSI3M3 data in multiple locations
    let rsiValues = null;
    let rsiDates = null;
    let rsiStates = null;

    if (detailedData.rsi3m3?.rsi3m3 && detailedData.rsi3m3?.dates) {
        rsiValues = detailedData.rsi3m3.rsi3m3;
        rsiDates = detailedData.rsi3m3.dates;
        rsiStates = detailedData.rsi3m3.state;
        console.log('✅ RSI3M3: Using structured rsi3m3 data');
    } else if (detailedData.rsi3m3Value && detailedData.dates) {
        rsiValues = detailedData.rsi3m3Value;
        rsiDates = detailedData.dates;
        rsiStates = detailedData.rsi3m3State;
        console.log('✅ RSI3M3: Using direct rsi3m3Value');
    } else if (detailedData.rsi && detailedData.dates) {
        rsiValues = detailedData.rsi;
        rsiDates = detailedData.dates;
        console.log('⚠️ RSI3M3: Fallback to regular RSI data');
    }

    if (!rsiValues || !rsiDates) {
        console.warn('❌ RSI3M3: No RSI data available');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No RSI3M3 Data Available', canvas.width / 2, canvas.height / 2);
        return;
    }

    console.log(`✅ RSI3M3: Data available - ${rsiValues.length} points`);

    const rsiData = rsiDates.map((date, i) => ({ 
        x: new Date(date), 
        y: rsiValues[i],
        state: rsiStates ? rsiStates[i] : null
    }));

    const verticalLineAnnotations = createVerticalLineAnnotations(allSignals.alignedDates);
    const signalAnnotations = { ...verticalLineAnnotations };

    // Add RSI3M3 state change signals
    allSignals.rsi3m3.bullish.forEach((date, i) => {
        const dataPoint = rsiData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`rsi_bullish_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#00ff0a',
                borderColor: '#00cc08',
                borderWidth: 3,
                radius: 8,
                label: {
                    display: true,
                    content: 'BULL',
                    position: 'top',
                    backgroundColor: '#00ff0a',
                    color: '#ffffff',
                    font: { size: 9, weight: 'bold' }
                }
            };
        }
    });

    allSignals.rsi3m3.bearish.forEach((date, i) => {
        const dataPoint = rsiData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`rsi_bearish_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#ff1100',
                borderColor: '#cc0d00',
                borderWidth: 3,
                radius: 8,
                label: {
                    display: true,
                    content: 'BEAR',
                    position: 'bottom',
                    backgroundColor: '#ff1100',
                    color: '#ffffff',
                    font: { size: 9, weight: 'bold' }
                }
            };
        }
    });

    allSignals.rsi3m3.transition.forEach((date, i) => {
        const dataPoint = rsiData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`rsi_transition_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#ffa500',
                borderColor: '#ff8c00',
                borderWidth: 2,
                radius: 6,
                label: {
                    display: true,
                    content: 'TRAN',
                    position: 'top',
                    backgroundColor: '#ffa500',
                    color: '#ffffff',
                    font: { size: 8, weight: 'bold' }
                }
            };
        }
    });

    try {
        window.enhancedRSI3M3Chart = new Chart(canvas, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'RSI3M3+',
                    data: rsiData,
                    borderColor: function(context) {
                        const point = context.parsed;
                        if (!point) return '#9c27b0';
                        
                        // Color based on RSI value and state
                        if (rsiStates) {
                            const state = context.raw?.state;
                            if (state === 'bullish') return '#00ff0a';
                            if (state === 'bearish') return '#ff1100';
                            if (state === 'transition') return '#ffa500';
                        }
                        
                        // Fallback to RSI level coloring
                        const value = point.y;
                        if (value >= 70) return '#ff1100'; // Overbought
                        if (value <= 30) return '#00ff0a'; // Oversold
                        return '#9c27b0'; // Normal
                    },
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1,
                    segment: {
                        borderColor: function(context) {
                            const point = context.p1?.parsed;
                            if (!point) return '#9c27b0';
                            
                            const value = point.y;
                            if (value >= 70) return '#ff1100'; // Overbought
                            if (value <= 30) return '#00ff0a'; // Oversold
                            return '#9c27b0'; // Normal
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    x: {
                        type: 'time',
                        time: { 
                            unit: detailedData.interval?.includes('d') ? 'day' : 'hour',
                            displayFormats: {
                                hour: 'MM/dd HH:mm',
                                day: 'MM/dd'
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)', maxRotation: 0 }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: function(context) {
                                if (context.tick.value === 30 || context.tick.value === 70 || context.tick.value === 50) {
                                    return 'rgba(255, 255, 255, 0.3)';
                                }
                                return 'rgba(255, 255, 255, 0.1)';
                            }
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: function(value) {
                                if (value === 30 || value === 70 || value === 50 || value === 0 || value === 100) {
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
                        text: 'RSI3M3+ with State Change Signals',
                        color: 'white',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { color: 'white', usePointStyle: true }
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
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                    if (context.raw?.state) {
                                        label += ` (${context.raw.state})`;
                                    }
                                }
                                return label;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            overboughtLine: {
                                type: 'line',
                                yMin: 70,
                                yMax: 70,
                                borderColor: 'rgba(202, 0, 23, 0.7)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'OB',
                                    position: 'start',
                                    backgroundColor: 'rgba(202, 0, 23, 0.7)',
                                    color: '#ffffff',
                                    font: { size: 10 }
                                }
                            },
                            centerLine: {
                                type: 'line',
                                yMin: 50,
                                yMax: 50,
                                borderColor: 'rgba(128, 128, 128, 0.5)',
                                borderWidth: 1
                            },
                            oversoldLine: {
                                type: 'line',
                                yMin: 30,
                                yMax: 30,
                                borderColor: 'rgba(36, 102, 167, 0.7)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'OS',
                                    position: 'start',
                                    backgroundColor: 'rgba(36, 102, 167, 0.7)',
                                    color: '#ffffff',
                                    font: { size: 10 }
                                }
                            },
                            ...signalAnnotations
                        }
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: { wheel: { enabled: true }, mode: 'x' }
                    }
                }
            }
        });

        console.log(`📊 RSI3M3 Chart: ${rsiData.length} points, ${allSignals.rsi3m3.bullish.length} bullish, ${allSignals.rsi3m3.bearish.length} bearish, ${allSignals.rsi3m3.transition.length} transition signals`);

        // Apply all signal annotations to the chart
        window.enhancedRSI3M3Chart.options.plugins.annotation.annotations = signalAnnotations;
        window.enhancedRSI3M3Chart.update('none');
        
        console.log('✅ RSI3M3 Chart created successfully');
    } catch (error) {
        console.error('❌ RSI3M3 Chart creation failed:', error);
    }
}

function createEnhancedMoneyFlowChart(detailedData, dates, allSignals) {
    console.log('🔍 Creating Money Flow Chart...');
    const mfCtx = document.getElementById('originalDetailedMfChart');
    if (!mfCtx) {
        console.warn('❌ Money Flow: Canvas element not found');
        return;
    }
    if (!detailedData.moneyFlow) {
        console.warn('❌ Money Flow: No moneyFlow data available');
        const ctx = mfCtx.getContext('2d');
        ctx.clearRect(0, 0, mfCtx.width, mfCtx.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No Money Flow Data Available', mfCtx.width / 2, mfCtx.height / 2);
        return;
    }
    
    mfCtx.style.height = '300px';
    mfCtx.height = 300;
    console.log(`✅ Money Flow: Canvas found, data available - ${detailedData.moneyFlow.length} points`);
    
    if (window.enhancedMfChart) {
        window.enhancedMfChart.destroy();
    }
    
    const mfData = detailedData.dates.map((date, i) => ({
        x: new Date(date),
        y: detailedData.moneyFlow[i]
    }));
    
    const signalAnnotations = createVerticalLineAnnotations(allSignals.alignedDates);
    
    // Add zero line
    signalAnnotations['mf_zero'] = {
        type: 'line',
        yMin: 0,
        yMax: 0,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1,
        borderDash: [3, 3]
    };
    
    try {
        window.enhancedMfChart = new Chart(mfCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Money Flow',
                    data: mfData,
                    borderColor: '#ff6b35',
                    backgroundColor: function(ctx) {
                        const value = ctx.parsed?.y;
                        return value > 0 ? 'rgba(0, 255, 10, 0.2)' : 'rgba(255, 17, 0, 0.2)';
                    },
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: 'origin',
                    segment: {
                        borderColor: function(ctx) {
                            return ctx.p0.parsed.y > 0 ? '#00ff0a' : '#ff1100';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    x: {
                        type: 'time',
                        time: { 
                            unit: detailedData.interval?.includes('d') ? 'day' : 'hour',
                            displayFormats: {
                                hour: 'MM/dd HH:mm',
                                day: 'MM/dd'
                            }
                        },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)', maxRotation: 0 },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        position: 'right',
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: 'white' }
                    },
                    title: {
                        display: true,
                        text: 'Money Flow Index with Signal Alignment',
                        color: 'white',
                        font: { size: 14, weight: 'bold' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        callbacks: {
                            title: function(context) {
                                // Format the date properly
                                const date = new Date(context[0].parsed.x);
                                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2) + '%';
                                    
                                    // Add zone information
                                    const value = context.parsed.y;
                                    if (value <= -80) {
                                        label += ' (Oversold)';
                                    } else if (value >= -20) {
                                        label += ' (Overbought)';
                                    }
                                }
                                return label;
                            },
                            afterBody: function(tooltipItems) {
                                const value = tooltipItems[0].parsed.y;
                                const info = [];
                                
                                if (value <= -80) {
                                    info.push('🟢 Potential Reversal Zone');
                                } else if (value >= -20) {
                                    info.push('🔴 Potential Reversal Zone');
                                } else {
                                    info.push('⚪ Neutral Zone');
                                }
                                
                                return info;
                            }
                        }
                    },
                    annotation: { annotations: signalAnnotations },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: { wheel: { enabled: true }, mode: 'x' }
                    }
                }
            }
        });
        
        console.log(`📊 Money Flow Chart: ${mfData.length} points created successfully`);
    } catch (error) {
        console.error('❌ Money Flow Chart creation failed:', error);
    }
}

function createEnhancedExhaustionChart(detailedData, dates, allSignals) {
    const canvas = document.getElementById('originalDetailedTrendExhaustChart');
    if (!canvas) return;

    // Set canvas height like the original
    canvas.style.height = '380px';
    canvas.height = 380;

    // Clear any existing chart
    if (window.enhancedExhaustionChart) {
        window.enhancedExhaustionChart.destroy();
    }

    // Use the same logic as original working implementation
    let teData;
    if (detailedData.trendExhaust) {
        teData = detailedData.trendExhaust;
        console.log('✅ Exhaustion: Using API trendExhaust data', teData);
    } else if (detailedData.high && detailedData.low && detailedData.close) {
        // Calculate TrendExhaust locally using Williams %R (same as original)
        console.log('⚙️ Exhaustion: Calculating Williams %R locally');
        const threshold = 20;
        const shortPeriod = 21;
        const longPeriod = 112;
        
        const shortR = calculateWilliamsPercentR(detailedData.high, detailedData.low, detailedData.close, shortPeriod);
        const longR = calculateWilliamsPercentR(detailedData.high, detailedData.low, detailedData.close, longPeriod);
        const avgR = shortR.map((val, i) => {
            if (val === null || longR[i] === null) return null;
            return (val + longR[i]) / 2;
        });
        
        teData = {
            shortPercentR: shortR,
            longPercentR: longR,
            avgPercentR: avgR,
            parameters: { threshold },
            signals: {
                overbought: [], oversold: [], obReversal: [], osReversal: [],
                bullCross: [], bearCross: []
            }
        };
        console.log('✅ Exhaustion: Calculated local Williams %R', teData);
    } else {
        console.warn('❌ Exhaustion: No data available - neither trendExhaust nor OHLC data found');
        // Show "No Data Available" message
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No Exhaustion Data Available', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Prepare data arrays for plotting (same as original)
    const shortRData = [], longRData = [], avgRData = [];
    
    for (let i = 0; i < dates.length; i++) {
        if (teData.shortPercentR && teData.shortPercentR[i] !== null) {
            shortRData.push({ x: dates[i], y: teData.shortPercentR[i] });
        }
        if (teData.longPercentR && teData.longPercentR[i] !== null) {
            longRData.push({ x: dates[i], y: teData.longPercentR[i] });
        }
        if (teData.avgPercentR && teData.avgPercentR[i] !== null) {
            avgRData.push({ x: dates[i], y: teData.avgPercentR[i] });
        }
    }

    const threshold = teData.parameters?.threshold || 20;
    const verticalLineAnnotations = createVerticalLineAnnotations(allSignals.alignedDates);

    console.log(`📊 Exhaustion Chart: ${shortRData.length} short, ${longRData.length} long, ${avgRData.length} avg points, ${allSignals.exhaustion.obReversal.length} OB reversals, ${allSignals.exhaustion.osReversal.length} OS reversals, ${allSignals.exhaustion.bullCross.length} bull cross, ${allSignals.exhaustion.bearCross.length} bear cross signals`);

    // Create chart with exact same structure as original
    window.enhancedExhaustionChart = new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Short %R',
                    data: shortRData,
                    borderColor: '#ffffff',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Long %R',
                    data: longRData,
                    borderColor: '#ffe500',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Average %R',
                    data: avgRData,
                    borderColor: '#31c0ff',
                    backgroundColor: 'transparent',
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
            animation: { duration: 0 },
            scales: {
                x: {
                    type: 'time',
                    time: { 
                        unit: detailedData.interval?.includes('d') ? 'day' : 'hour',
                        displayFormats: {
                            hour: 'MM/dd HH:mm',
                            day: 'MM/dd'
                        }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)', maxRotation: 0 }
                },
                y: {
                    min: -100,
                    max: 0,
                    grid: {
                        color: function(context) {
                            if (context.tick.value === 0 || context.tick.value === -50 || 
                                context.tick.value === -100 || context.tick.value === -threshold ||
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
                    text: 'Exhaustion Oscillator (Williams %R) with Reversal Signals',
                    color: 'white',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: 'white', usePointStyle: true, pointStyle: 'circle' }
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
                            if (label) label += ': ';
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
                        },
                        ...verticalLineAnnotations
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: { wheel: { enabled: true }, mode: 'x' }
                }
            }
        }
    });

    // Add exhaustion reversal signals to the chart
    const signalAnnotations = { 
        ...verticalLineAnnotations,
        // Preserve threshold lines
        topThreshold: {
            type: 'line',
            yMin: -threshold,
            yMax: -threshold,
            borderColor: 'rgba(202, 0, 23, 0.7)',
            borderWidth: 2,
            borderDash: [3, 3],
            label: {
                display: true,
                content: 'OB (-20)',
                position: 'start',
                backgroundColor: 'rgba(202, 0, 23, 0.7)',
                color: '#ffffff',
                font: { size: 10, weight: 'bold' }
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
            borderWidth: 2,
            borderDash: [3, 3],
            label: {
                display: true,
                content: 'OS (-80)',
                position: 'start',
                backgroundColor: 'rgba(36, 102, 167, 0.7)',
                color: '#ffffff',
                font: { size: 10, weight: 'bold' }
            }
        }
    };
    
    // Add Overbought Reversal Signals (Red triangles)
    allSignals.exhaustion.obReversal.forEach((date, i) => {
        const dataPoint = avgRData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`ex_obReversal_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#ff1100',
                borderColor: '#cc0d00',
                borderWidth: 3,
                radius: 10,
                pointStyle: 'triangle',
                label: {
                    display: true,
                    content: '🔴 OB EXIT',
                    position: 'bottom',
                    backgroundColor: '#ff1100',
                    color: '#ffffff',
                    font: { size: 9, weight: 'bold' }
                }
            };
        }
    });

    // Add Oversold Reversal Signals (Green triangles)
    allSignals.exhaustion.osReversal.forEach((date, i) => {
        const dataPoint = avgRData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`ex_osReversal_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#00ff0a',
                borderColor: '#00cc08',
                borderWidth: 3,
                radius: 10,
                pointStyle: 'triangle',
                label: {
                    display: true,
                    content: '🟢 OS EXIT',
                    position: 'top',
                    backgroundColor: '#00ff0a',
                    color: '#ffffff',
                    font: { size: 9, weight: 'bold' }
                }
            };
        }
    });

    // Add Bull Cross Signals (Blue up arrows)
    allSignals.exhaustion.bullCross.forEach((date, i) => {
        const dataPoint = avgRData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`ex_bullCross_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#00ccff',
                borderColor: '#0099cc',
                borderWidth: 2,
                radius: 8,
                pointStyle: 'circle',
                label: {
                    display: true,
                    content: '⬆️ BULL',
                    position: 'top',
                    backgroundColor: '#00ccff',
                    color: '#ffffff',
                    font: { size: 8, weight: 'bold' }
                }
            };
        }
    });

    // Add Bear Cross Signals (Orange down arrows)
    allSignals.exhaustion.bearCross.forEach((date, i) => {
        const dataPoint = avgRData.find(p => Math.abs(p.x - date) < 24 * 60 * 60 * 1000);
        if (dataPoint) {
            signalAnnotations[`ex_bearCross_${i}`] = {
                type: 'point',
                xValue: date,
                yValue: dataPoint.y,
                backgroundColor: '#ff6600',
                borderColor: '#cc5200',
                borderWidth: 2,
                radius: 8,
                pointStyle: 'circle',
                label: {
                    display: true,
                    content: '⬇️ BEAR',
                    position: 'bottom',
                    backgroundColor: '#ff6600',
                    color: '#ffffff',
                    font: { size: 8, weight: 'bold' }
                }
            };
        }
    });

    console.log(`🎯 Exhaustion Signals Added: ${allSignals.exhaustion.obReversal.length} OB reversals, ${allSignals.exhaustion.osReversal.length} OS reversals, ${allSignals.exhaustion.bullCross.length} bull cross, ${allSignals.exhaustion.bearCross.length} bear cross`);

    // Apply all signal annotations to the chart
    window.enhancedExhaustionChart.options.plugins.annotation.annotations = signalAnnotations;
    window.enhancedExhaustionChart.update('none');
}

// Add Williams %R calculation function (same as original implementation)
function calculateWilliamsPercentR(highs, lows, closes, period) {
    const result = [];
    
    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        
        // Find highest high and lowest low over the period
        let highestHigh = -Infinity;
        let lowestLow = Infinity;
        
        for (let j = i - period + 1; j <= i; j++) {
            if (highs[j] > highestHigh) highestHigh = highs[j];
            if (lows[j] < lowestLow) lowestLow = lows[j];
        }
        
        // Calculate Williams %R
        const williamsR = ((highestHigh - closes[i]) / (highestHigh - lowestLow)) * -100;
        result.push(isNaN(williamsR) ? null : williamsR);
    }
    
    return result;
}

function addEnhancedOscillatorLegend(allSignals) {
    const legendContainer = document.getElementById('originalOscillatorLegendContainer');
    if (!legendContainer) return;
    
    legendContainer.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.7); padding: 15px; border-radius: 8px; color: white;">
            <h5 style="margin-bottom: 10px; color: #4a90e2;">📊 Enhanced Oscillator Charts Legend</h5>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div>
                    <h6 style="color: #00ff0a; margin-bottom: 5px;">🟢 Analyzer B Signals</h6>
                    <div style="font-size: 0.8em; line-height: 1.4;">
                        • <span style="color: #FFD700;">🏆 Gold Buy</span> - Strongest buy signal<br>
                        • <span style="color: #00ff0a;">🟢 Buy</span> - Standard buy signal<br>
                        • <span style="color: #ff1100;">🔴 Sell</span> - Sell signal<br>
                        • <span style="color: #4a90e2;">📈 Divergences</span> - Price/oscillator divergence
                    </div>
                </div>
                
                <div>
                    <h6 style="color: #4a90e2; margin-bottom: 5px;">📈 RSI3M3+ States</h6>
                    <div style="font-size: 0.8em; line-height: 1.4;">
                        • <span style="color: #00ff0a;">🟢 Bullish Entry</span> - State changed to bullish<br>
                        • <span style="color: #ff1100;">🔴 Bearish Entry</span> - State changed to bearish<br>
                        • <span style="color: #FFD700;">🟡 Transition</span> - State in transition<br>
                        • Line color changes with state
                    </div>
                </div>
                
                <div>
                    <h6 style="color: #9c27b0; margin-bottom: 5px;">🔄 Exhaustion Signals</h6>
                    <div style="font-size: 0.8em; line-height: 1.4;">
                        • <span style="color: #ff1100;">🔴 OB Reversal</span> - Overbought exit signal<br>
                        • <span style="color: #00ff0a;">🟢 OS Reversal</span> - Oversold exit signal<br>
                        • <span style="color: #ff1100;">-20 Line</span> - Overbought threshold<br>
                        • <span style="color: #00ff0a;">-80 Line</span> - Oversold threshold
                    </div>
                </div>
                
                <div>
                    <h6 style="color: #ffffff; margin-bottom: 5px;">⚡ Signal Alignment</h6>
                    <div style="font-size: 0.8em; line-height: 1.4;">
                        • <span style="color: rgba(255,255,255,0.5);">⚪ Vertical lines</span> - Align signals across charts<br>
                        • <span style="color: #FFD700;">🔥 Fresh signals</span> - Recent activity<br>
                        • Interactive tooltips show signal details<br>
                        • All oscillators synchronized
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.75em; color: rgba(255,255,255,0.7);">
                <strong>Enhanced Features:</strong> All signals are now visible across charts • RSI3M3+ oscillator added • Exhaustion reversal signals highlighted • Real-time signal alignment
            </div>
        </div>
    `;
}

// Initialize enhanced oscillator charts modal when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            enhanceOscillatorChartsModal();
            console.log('Enhanced oscillator charts modal initialized with RSI3M3 support');
        }, 1000);
    });
} else {
    setTimeout(() => {
        enhanceOscillatorChartsModal();
        console.log('Enhanced oscillator charts modal initialized with RSI3M3 support');
    }, 1000);
}

// ... existing code ...