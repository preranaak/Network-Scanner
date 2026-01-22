// NetScan Web Interface JavaScript

class NetScanApp {
    constructor() {
        this.isScanning = false;
        this.statusCheckInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
    }

    bindEvents() {
        // Scan controls
        document.getElementById('start-scan').addEventListener('click', () => this.startScan());
        document.getElementById('stop-scan').addEventListener('click', () => this.stopScan());
        document.getElementById('clear-results').addEventListener('click', () => this.clearResults());
        document.getElementById('refresh-results').addEventListener('click', () => this.refreshResults());

        // Enter key in network input
        document.getElementById('network-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isScanning) {
                this.startScan();
            }
        });
    }

    async startScan() {
        const networkInput = document.getElementById('network-input').value.trim();
        const startBtn = document.getElementById('start-scan');
        const stopBtn = document.getElementById('stop-scan');

        try {
            startBtn.disabled = true;
            this.showLoading(true);

            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ network: networkInput })
            });

            const result = await response.json();

            if (response.ok) {
                this.isScanning = true;
                startBtn.disabled = true;
                stopBtn.disabled = false;
                
                this.showProgressSection(true);
                this.startStatusChecking();
                
                this.showNotification('Scan started successfully!', 'success');
            } else {
                throw new Error(result.error || 'Failed to start scan');
            }
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
            startBtn.disabled = false;
        } finally {
            this.showLoading(false);
        }
    }

    stopScan() {
        // Note: The backend doesn't have a stop endpoint yet, but we can simulate it
        this.isScanning = false;
        this.stopStatusChecking();
        this.resetScanControls();
        this.showNotification('Scan stopped', 'info');
    }

    async clearResults() {
        try {
            this.showLoading(true);
            
            const response = await fetch('/api/clear', {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                this.clearResultsDisplay();
                this.clearHistoryDisplay();
                this.showNotification('Results cleared successfully!', 'success');
            } else {
                throw new Error(result.error || 'Failed to clear results');
            }
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async refreshResults() {
        try {
            const response = await fetch('/api/results');
            const results = await response.json();
            
            if (results.length > 0) {
                const latestResult = results[results.length - 1];
                this.displayScanResult(latestResult);
                this.updateHistory(results);
            }
        } catch (error) {
            console.error('Failed to refresh results:', error);
        }
    }

    startStatusChecking() {
        this.statusCheckInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/status');
                const status = await response.json();
                
                this.updateProgress(status);
                
                if (!status.running && this.isScanning) {
                    // Scan completed
                    this.isScanning = false;
                    this.stopStatusChecking();
                    this.resetScanControls();
                    this.showProgressSection(false);
                    
                    // Load the latest results
                    await this.refreshResults();
                    this.showNotification('Scan completed!', 'success');
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
        }
    }

    updateProgress(status) {
        const progressSection = document.getElementById('progress-section');
        const progressText = document.getElementById('progress-text');
        const progressStats = document.getElementById('progress-stats');
        const progressFill = document.getElementById('progress-fill');

        if (status.running) {
            progressText.textContent = `Scanning ${status.current_scan || 'network'}...`;
            progressStats.textContent = `${status.scanned_hosts}/${status.total_hosts} hosts scanned, ${status.found_hosts} devices found`;
            progressFill.style.width = `${status.progress}%`;
        }
    }

    displayScanResult(result) {
        const resultsContainer = document.getElementById('current-results');
        
        if (result.error) {
            resultsContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Scan Error: ${result.error}</p>
                </div>
            `;
            return;
        }

        if (!result.hosts || result.hosts.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>No devices found on network ${result.network}</p>
                    <small>Scanned ${result.total_scanned} addresses in ${result.duration}</small>
                </div>
            `;
            return;
        }

        const hostsHtml = result.hosts.map((host, index) => {
            // Handle both old format (string) and new format (object)
            const ip = typeof host === 'string' ? host : host.ip;
            const hostname = typeof host === 'object' ? host.hostname : 'Unknown';
            const deviceType = typeof host === 'object' ? host.device_type : 'Unknown Device';
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

        // Create IP list for copying
        const ipList = result.hosts.map(host => typeof host === 'string' ? host : host.ip);

        resultsContainer.innerHTML = `
            <div class="scan-summary">
                <h3>Scan Results for ${result.network}</h3>
                <div class="summary-stats">
                    <span class="stat-item">
                        <i class="fas fa-check-circle"></i>
                        <strong>${result.total_found}</strong> devices found
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-clock"></i>
                        Completed in <strong>${result.duration}</strong>
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-search"></i>
                        <strong>${result.total_scanned}</strong> addresses scanned
                    </span>
                </div>
            </div>
            
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
            
            <div class="export-actions">
                <button class="btn btn-outline btn-small" onclick="app.exportResults(${result.id})">
                    <i class="fas fa-download"></i> Export JSON
                </button>
                <button class="btn btn-outline btn-small" onclick="app.copyToClipboard('${ipList.join('\\n')}')">
                    <i class="fas fa-copy"></i> Copy IPs
                </button>
                <button class="btn btn-outline btn-small" onclick="app.exportCSV(${result.id})">
                    <i class="fas fa-file-csv"></i> Export CSV
                </button>
            </div>
        `;
    }

    updateHistory(results) {
        const historyContainer = document.getElementById('scan-history');
        
        if (results.length === 0) {
            historyContainer.innerHTML = `
                <div class="no-history">
                    <p>No previous scans found.</p>
                </div>
            `;
            return;
        }

        const recentScans = results.slice(-5).reverse();
        const historyHtml = recentScans.map(scan => `
            <div class="history-item">
                <div class="history-info">
                    <strong>${scan.network}</strong>
                    <span class="timestamp">${scan.timestamp}</span>
                </div>
                <div class="history-stats">
                    ${scan.hosts ? `
                        <span class="found-count">${scan.total_found} devices found</span>
                        <button class="btn btn-small" onclick="app.loadScanResult(${scan.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                    ` : `
                        <span class="error">Error occurred</span>
                    `}
                </div>
            </div>
        `).join('');

        historyContainer.innerHTML = historyHtml;
    }

    async loadScanResult(scanId) {
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/results/${scanId}`);
            const result = await response.json();
            
            if (response.ok) {
                this.displayScanResult(result);
            } else {
                throw new Error(result.error || 'Failed to load scan result');
            }
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async exportResults(scanId) {
        try {
            const response = await fetch(`/api/export/${scanId}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `netscan_${scanId}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showNotification('Results exported successfully!', 'success');
            } else {
                throw new Error('Failed to export results');
            }
        } catch (error) {
            this.showNotification(`Export error: ${error.message}`, 'error');
        }
    }

    exportCSV(scanId) {
        try {
            // Find the scan result
            const response = fetch(`/api/results/${scanId}`)
                .then(response => response.json())
                .then(result => {
                    if (result.hosts) {
                        // Create CSV content
                        let csvContent = "IP Address,Hostname,Device Type,MAC Address,Vendor,Status\n";
                        
                        result.hosts.forEach(host => {
                            const ip = typeof host === 'string' ? host : host.ip;
                            const hostname = typeof host === 'object' ? host.hostname : 'Unknown';
                            const deviceType = typeof host === 'object' ? host.device_type : 'Unknown Device';
                            const macAddress = typeof host === 'object' ? host.mac_address : 'Unknown';
                            const vendor = typeof host === 'object' ? host.vendor : 'Unknown';
                            
                            csvContent += `"${ip}","${hostname}","${deviceType}","${macAddress}","${vendor}","Online"\n`;
                        });
                        
                        // Create and download file
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `netscan_${scanId}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        
                        this.showNotification('CSV exported successfully!', 'success');
                    }
                })
                .catch(error => {
                    this.showNotification(`Export error: ${error.message}`, 'error');
                });
        } catch (error) {
            this.showNotification(`Export error: ${error.message}`, 'error');
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('IP addresses copied to clipboard!', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy to clipboard', 'error');
        });
    }

    resetScanControls() {
        document.getElementById('start-scan').disabled = false;
        document.getElementById('stop-scan').disabled = true;
    }

    showProgressSection(show) {
        const progressSection = document.getElementById('progress-section');
        progressSection.style.display = show ? 'block' : 'none';
        
        if (!show) {
            document.getElementById('progress-fill').style.width = '0%';
        }
    }

    clearResultsDisplay() {
        document.getElementById('current-results').innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No scan results yet. Start a scan to discover devices on your network.</p>
            </div>
        `;
    }

    clearHistoryDisplay() {
        document.getElementById('scan-history').innerHTML = `
            <div class="no-history">
                <p>No previous scans found.</p>
            </div>
        `;
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    async loadInitialData() {
        try {
            const response = await fetch('/api/results');
            const results = await response.json();
            
            if (results.length > 0) {
                this.updateHistory(results);
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }
}

// Add notification styles dynamically
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .notification-success { background: #10b981; }
    .notification-error { background: #ef4444; }
    .notification-warning { background: #f59e0b; }
    .notification-info { background: #3b82f6; }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .scan-summary {
        margin-bottom: 20px;
        padding: 20px;
        background: #f8fafc;
        border-radius: 8px;
        border-left: 4px solid var(--success-color);
    }
    
    .summary-stats {
        display: flex;
        gap: 20px;
        margin-top: 15px;
        flex-wrap: wrap;
    }
    
    .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-secondary);
        font-size: 0.9rem;
    }
    
    .stat-item i {
        color: var(--success-color);
    }
    
    .export-actions {
        margin-top: 20px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }
    
    .error-message {
        text-align: center;
        padding: 40px 20px;
        color: var(--danger-color);
        background: #fef2f2;
        border-radius: 8px;
        border-left: 4px solid var(--danger-color);
    }
    
    .error-message i {
        font-size: 2rem;
        margin-bottom: 15px;
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new NetScanApp();
});

// Make loadScanResult available globally for onclick handlers
window.loadScanResult = (scanId) => app.loadScanResult(scanId);