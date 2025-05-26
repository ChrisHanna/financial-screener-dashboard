function displayTradingRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('tradingRecommendationsContainer');
    if (!recommendationsContainer) return;
    
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
