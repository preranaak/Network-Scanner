#!/usr/bin/env python3
"""
NetScan Web Interface
A Flask web application for the network scanner
"""

from flask import Flask, render_template, request, jsonify
import json
from datetime import datetime
import threading
import time
import os

# Import our existing scanner functions
from netscan import scan_network, parse_network, get_local_ip_and_mask

app = Flask(__name__)

# Store scan results and status
scan_results = []
scan_status = {
    "running": False, 
    "progress": 0, 
    "current_scan": None,
    "total_hosts": 0,
    "scanned_hosts": 0,
    "found_hosts": 0
}

@app.route('/')
def index():
    """Main dashboard page"""
    try:
        local_ip, local_mask = get_local_ip_and_mask()
        network = parse_network()
        suggested_network = str(network)
    except:
        local_ip = "Unknown"
        local_mask = "Unknown"
        suggested_network = "192.168.1.0/24"
    
    return render_template('index.html', 
                         local_ip=local_ip, 
                         local_mask=local_mask,
                         suggested_network=suggested_network,
                         scan_status=scan_status,
                         recent_scans=scan_results[-5:])

@app.route('/api/scan', methods=['POST'])
def start_scan():
    """Start a network scan"""
    if scan_status["running"]:
        return jsonify({"error": "Scan already in progress"}), 400
    
    data = request.get_json()
    network_input = data.get('network', '').strip()
    
    try:
        # Parse the network
        if not network_input:
            network = parse_network()
        else:
            network = parse_network(network_input)
        
        # Start scan in background thread
        scan_thread = threading.Thread(target=run_scan, args=(network,))
        scan_thread.daemon = True
        scan_thread.start()
        
        return jsonify({
            "success": True,
            "message": f"Scan started for {network}", 
            "network": str(network)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

def run_scan(network):
    """Run the actual scan in background with progress tracking"""
    scan_status["running"] = True
    scan_status["current_scan"] = str(network)
    scan_status["progress"] = 0
    scan_status["scanned_hosts"] = 0
    scan_status["found_hosts"] = 0
    
    # Calculate total hosts
    total_hosts = network.num_addresses - 2  # Exclude network and broadcast
    scan_status["total_hosts"] = total_hosts
    
    start_time = datetime.now()
    
    try:
        # Modified scan_network function with progress tracking
        online_hosts = []
        
        import concurrent.futures
        from netscan import ping
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            futures = {executor.submit(ping, ip): ip for ip in network.hosts()}
            
            for future in concurrent.futures.as_completed(futures):
                try:
                    result = future.result()
                    scan_status["scanned_hosts"] += 1
                    scan_status["progress"] = int((scan_status["scanned_hosts"] / total_hosts) * 100)
                    
                    if result:
                        online_hosts.append(result)
                        scan_status["found_hosts"] += 1
                        
                except Exception:
                    scan_status["scanned_hosts"] += 1
                    scan_status["progress"] = int((scan_status["scanned_hosts"] / total_hosts) * 100)
                    continue
        
        # Store results
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        scan_result = {
            "id": len(scan_results) + 1,
            "network": str(network),
            "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration": f"{duration:.1f}s",
            "hosts": sorted(online_hosts, key=lambda x: tuple(map(int, x.split('.')))),
            "total_found": len(online_hosts),
            "total_scanned": total_hosts
        }
        
        scan_results.append(scan_result)
        
    except Exception as e:
        error_result = {
            "id": len(scan_results) + 1,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "network": str(network)
        }
        scan_results.append(error_result)
    
    finally:
        scan_status["running"] = False
        scan_status["current_scan"] = None
        scan_status["progress"] = 100

@app.route('/api/status')
def get_status():
    """Get current scan status"""
    return jsonify(scan_status)

@app.route('/api/results')
def get_results():
    """Get all scan results"""
    return jsonify(scan_results)

@app.route('/api/results/<int:scan_id>')
def get_scan_result(scan_id):
    """Get specific scan result"""
    for result in scan_results:
        if result.get('id') == scan_id:
            return jsonify(result)
    return jsonify({"error": "Scan not found"}), 404

@app.route('/api/clear', methods=['POST'])
def clear_results():
    """Clear all scan results"""
    global scan_results
    scan_results = []
    return jsonify({"success": True, "message": "Results cleared"})

@app.route('/api/export/<int:scan_id>')
def export_result(scan_id):
    """Export scan result as JSON"""
    for result in scan_results:
        if result.get('id') == scan_id:
            from flask import Response
            return Response(
                json.dumps(result, indent=2),
                mimetype='application/json',
                headers={'Content-Disposition': f'attachment; filename=netscan_{scan_id}.json'}
            )
    return jsonify({"error": "Scan not found"}), 404

if __name__ == '__main__':
    # Create templates and static directories if they don't exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    
    print("=" * 50)
    print("🌐 NetScan Web Interface Starting...")
    print("=" * 50)
    print("📍 Access the web interface at: http://localhost:5000")
    print("🔍 Ready to scan your network!")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)