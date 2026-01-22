// NetScan Enterprise - Fixed JavaScript Application

class NetScanApp {
    constructor() {
        this.isScanning = false;
        this.statusCheckInterval = null;
        this.currentResult = null;
        this.init();
    }

    init() {
        console.log('Initializing NetScan App...');
        this.bindEvents();
        this.loadInitialData();
        this.resetScanControls();
    }

    bindEvents() {
        console.log('Binding events...');
        
        // Start scan button
        const startBtn = document.getElementById('start-scan');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Start scan clicked');
                this.startScan();
            });
        }

        // Stop scan button
        const stopBtn = document.getElementById('stop-scan');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                console.log('Stop scan clicked');
                this.stopScan();
            });
        }

        // Clear results button
        const clearBtn = document.getElementById('clear-results');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                console.log('Clear results clicked');
                this.clearResults();
            });
        }

        // Refresh results button
        const refreshBtn = document.getElementById('refresh-results');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Refresh results clicked');
                this.refreshResults();
            });
        }

        console.log('Events bound successfully');
    }

    async startScan() {
        console.log('Starting scan...');
        
        const networkInput = document.getElementById('network-input');
        const networkValue = networkInput ? networkInput.value.trim() : '';
        
        const startBtn = document.getElementById('start-scan');
        const stopBtn = document.getElementById('stop-scan');

        try {
            if (startBtn) startBtn.disabled = true;
            this.showLoading(true);

            console.log('Sending scan request for network:', networkValue);

            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ network: networkValue })
            });

            const result = await response.json();
            console.log('Scan response:', result);

            if (response.ok) {
                this.isScanning = true;
                
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                
                this.showProgressSection(true);
                this.startStatusChecking();
                
                this.showToast('Scan Started', `Network scan initiated for ${result.network}`, 'success');
            } else {
                throw new Error(result.error || 'Failed to start scan');
            }
        } catch (error) {
            console.error('Scan error:', error);
            this.showToast('Scan Error', error.message, 'error');
            this.resetScanControls();
        } finally {
            this.showLoading(false);
        }
    }

    stopScan() {
        console.log('Stopping scan...');
        this.isScanning = false;
        this.stopStatusChecking();
        this.resetScanControls();
        this.showProgressSection(false);
        this.showToast('Scan Stopped', 'Network scan has been stopped', 'warning');
    }

    async clearResults() {
        console.log('Clearing results...');
        try {
            this.showLoading(true);
            
            const response = await fetch('/api/clear', {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                this.clearResultsDisplay();
                this.hideSummaryCards();
                this.updateHistory([]);
                this.showToast('Results Cleared', 'All scan results have been cleared', 'success');
            } else {
                throw new Error(result.error || 'Failed to clear results');
            }
        } catch (error) {
            console.error('Clear error:', error);
            this.showToast('Clear Error', error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async refreshResults() {
        console.log('Refreshing results...');
        try {
            const response = await fetch('/api/results');
            const results = await response.json();
            console.log('Results fetched:', results);
            
            if (results.length > 0) {
                const latestResult = results[results.length - 1];
                this.displayScanResult(latestResult);
                this.updateHistory(results);
                this.showToast('Results Refreshed', 'Latest scan results loaded', 'success');
            } else {
                this.clearResultsDisplay();
                this.showToast('No Results', 'No scan results found', 'info');
            }
        } catch (error) {
            console.error('Failed to refresh results:', error);
            this.showToast('Refresh Error', 'Failed to refresh results', 'error');
        }
    }

    startStatusChecking() {
        console.log('Starting status checking...');
        this.statusCheckInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/status');
                const status = await response.json();
                
                this.updateProgress(status);
                
                if (!status.running && this.isScanning) {
                    console.log('Scan completed, loading results...');
                    // Scan completed
                    this.isScanning = false;
                    this.stopStatusChecking();
                    this.resetScanControls();
                    this.showProgressSection(false);
                    
                    // Wait a moment then load results
                    setTimeout(async () => {
                        await this.refreshResults();
                        this.showToast('Scan Complete', 'Network scan completed successfully', 'success');
                    }, 1000);
                }
            } catch (error) {
                console.error('Failed to check status:', error);
            }
        }, 1000);
    }

    stopStatusChecking() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
            console.log('Status checking stopped');
        }
    }

    updateProgress(status) {
        if (!status.running) return;

        const progressTitle = document.getElementById('progress-title');
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = document.getElementById('progress-percentage');
        const foundCount = document.getElementById('found-count');
        const scannedCount = document.getElementById('scanned-count');

        if (progressTitle) {
            progressTitle.textContent = `Scanning ${status.current_scan || 'Network'}`;
        }
        
        if (progressFill) {
            progressFill.style.width = `${status.progress}%`;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${status.progress}%`;
        }
        
        if (foundCount) {
            foundCount.textContent = status.found_hosts || 0;
        }
        
        if (scannedCount) {
            scannedCount.textContent = status.scanned_hosts || 0;
        }
    }

    displayScanResult(result) {
        console.log('Displaying scan result:', result);
        const resultsContainer = document.getElementById('results-container');
        
        if (!resultsContainer) {
            console.error('Results container not found');
            return;
        }
        
        if (result.error) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Scan Error</h3>
                    <p>${result.error}</p>
                    <button class="btn btn-primary" onclick="app.startScan()">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
            return;
        }

        if (!result.hosts || result.hosts.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3>No Devices Found</h3>
                    <p>No active devices were discovered on network ${result.network}</p>
                    <small>Scanned ${result.total_scanned} addresses in ${result.duration}</small>
                </div>
            `;
            this.hideSummaryCards();
            return;
        }

        // Show summary cards
        this.showSummaryCards(result);

        // Create results table
        const hostsHtml = result.hosts.map((host, index) => {
            const ip = typeof host === 'string' ? host : host.ip;
            const hostname = typeof host === 'object' ? host.hostname : 'Unknown';
            const deviceType = typeof host === 'object' ? host.device_type : '💻 Computer/Device';
            const macAddress = typeof host === 'object' ? host.mac_address : 'Unknown';
            const vendor = typeof host === 'object' ? host.vendor : 'Unknown';
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="device-ip">${ip}</td>
                    <td>
                        <div class="device-status">
                            <span class="status-indicator"></span>
                            <span class="status-online">Online</span>
                        </div>
                    </td>
                    <td class="device-type">${deviceType}</td>
                    <td class="hostname" title="${hostname}">${hostname.length > 20 ? hostname.substring(0, 20) + '...' : hostname}</td>
                    <td class="mac-address" title="${vendor}">${macAddress}</td>
                </tr>
            `;
        }).join('');

        resultsContainer.innerHTML = `
            <div class="results-table-container">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>IP Address</th>
                            <th>Status</th>
                            <th>Device Type</th>
                            <th>Hostname</th>
                            <th>MAC Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${hostsHtml}
                    </tbody>
                </table>
            </div>
        `;
        
        // Store current result for export
        this.currentResult = result;
        console.log('Results displayed successfully');
    }

    showSummaryCards(result) {
        const summaryCards = document.getElementById('summary-cards');
        const totalDevices = document.getElementById('total-devices');
        const secureDevices = document.getElementById('secure-devices');
        const scanDuration = document.getElementById('scan-duration');
        const coveragePercent = document.getElementById('coverage-percent');
        
        if (summaryCards) {
            summaryCards.style.display = 'grid';
        }
        
        if (totalDevices) {
            totalDevices.textContent = result.total_found || 0;
        }
        
        if (secureDevices) {
            const identifiedCount = result.hosts ? result.hosts.filter(host => 
                typeof host === 'object' && host.device_type !== 'Unknown Device'
            ).length : 0;
            secureDevices.textContent = identifiedCount;
        }
        
        if (scanDuration) {
            scanDuration.textContent = result.duration || '0s';
        }
        
        if (coveragePercent) {
            const coverage = result.total_scanned ? 
                Math.round((result.total_found / result.total_scanned) * 100) : 0;
            coveragePercent.textContent = `${coverage}%`;
        }
    }

    hideSummaryCards() {
        const summaryCards = document.getElementById('summary-cards');
        if (summaryCards) {
            summaryCards.style.display = 'none';
        }
    }

    updateHistory(results) {
        const historyContainer = document.getElementById('history-container');
        
        if (!historyContainer) return;
        
        if (results.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-state small">
                    <div class="empty-icon">
                        <i class="fas fa-history"></i>
                    </div>
                    <p>No scan history available</p>
                </div>
            `;
            return;
        }

        const recentScans = results.slice(-5).reverse();
        const historyHtml = recentScans.map(scan => `
            <div class="history-item">
                <div class="history-icon">
                    <i class="fas fa-network-wired"></i>
                </div>
                <div class="history-content">
                    <div class="history-title">${scan.network}</div>
                    <div class="history-meta">
                        <span class="history-time">
                            <i class="fas fa-clock"></i> ${scan.timestamp}
                        </span>
                        ${scan.hosts ? `
                            <span class="history-count">
                                <i class="fas fa-devices"></i> ${scan.total_found} devices
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="history-actions">
                    ${scan.hosts ? `
                        <button class="btn btn-ghost btn-xs" onclick="app.loadScanResult(${scan.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                    ` : `
                        <span class="status-badge error">Error</span>
                    `}
                </div>
            </div>
        `).join('');

        historyContainer.innerHTML = historyHtml;
    }

    async loadScanResult(scanId) {
        console.log('Loading scan result:', scanId);
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/results/${scanId}`);
            const result = await response.json();
            
            if (response.ok) {
                this.displayScanResult(result);
                this.showToast('Results Loaded', `Loaded scan results for ${result.network}`, 'success');
            } else {
                throw new Error(result.error || 'Failed to load scan result');
            }
        } catch (error) {
            console.error('Load error:', error);
            this.showToast('Load Error', error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    resetScanControls() {
        const startBtn = document.getElementById('start-scan');
        const stopBtn = document.getElementById('stop-scan');
        
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    }

    showProgressSection(show) {
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.style.display = show ? 'block' : 'none';
        }
        
        if (!show) {
            const progressFill = document.getElementById('progress-fill');
            if (progressFill) {
                progressFill.style.width = '0%';
            }
        }
    }

    clearResultsDisplay() {
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3>No Scan Results</h3>
                    <p>Start a network scan to discover devices on your infrastructure</p>
                    <button class="btn btn-primary" onclick="app.startScan()">
                        <i class="fas fa-play"></i> Start First Scan
                    </button>
                </div>
            `;
        }
        this.hideSummaryCards();
        this.currentResult = null;
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('show');
            } else {
                overlay.classList.remove('show');
            }
        }
    }

    showToast(title, message, type = 'info') {
        console.log(`Toast: ${title} - ${message} (${type})`);
        
        // Create toast container if it doesn't exist
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${iconMap[type] || iconMap.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);
    }

    async loadInitialData() {
        console.log('Loading initial data...');
        try {
            const response = await fetch('/api/results');
            const results = await response.json();
            console.log('Initial data loaded:', results);
            
            if (results.length > 0) {
                this.updateHistory(results);
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }
}

// Add required CSS for toasts
const toastStyles = `
    .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1500;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .toast {
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        padding: 16px 20px;
        border-left: 4px solid #3b82f6;
        max-width: 400px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease-out;
    }
    
    .toast.success { border-left-color: #22c55e; }
    .toast.error { border-left-color: #ef4444; }
    .toast.warning { border-left-color: #f59e0b; }
    
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .toast-icon { font-size: 20px; }
    .toast.success .toast-icon { color: #22c55e; }
    .toast.error .toast-icon { color: #ef4444; }
    .toast.warning .toast-icon { color: #f59e0b; }
    .toast.info .toast-icon { color: #3b82f6; }
    
    .toast-content { flex: 1; }
    .toast-title { font-weight: 600; color: #1f2937; margin-bottom: 4px; }
    .toast-message { font-size: 14px; color: #6b7280; }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    app = new NetScanApp();
});

// Make app available globally
window.app = app;