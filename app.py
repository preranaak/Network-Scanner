#!/usr/bin/env python3
"""
NetScan Web Interface
A Flask web application for the network scanner
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
import json
from datetime import datetime
import threading
import time

# Import our existing scanner functions
from netscan import scan_network, parse_network, get_local_ip_and_mask

app = Flask(__name__)

# Store scan results and status
scan_results = {}
scan_status = {"running": False, "progress": 0, "current_scan": None}

@app.route('/')
def index():
    """Main dashboard page"""
    local_ip, local_mask = get_local_ip_and_mask()
    return render_template('index.html', 
                         local_ip=local_ip, 
                         local_mask=local_mask,
                         scan_status=scan_status,
                         recent_scans=list(scan_results.keys())[-5:])

@app.route('/scan', methods=['POST'])
def start_scan():
    """Start a network scan"""
    if scan_status["running"]:
        return jsonify({"error": "Scan already in progress"}), 400
    
    network_input = request.form.get('network', '').strip()
    
    try:
        # Parse the network
        if not network_input:
            network = parse_network()
        else:
            network = parse_network(network_input)
        
        # Start scan in background thread
        scan_thread = threading.Thread(target=run_scan, args=(str(network),))
        scan_thread.daemon = True
        scan_thread.start()
        
        return jsonify({"message": f"Scan started for {network}", "network": str(network)})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

def run_scan(network_str):
    """Run the actual scan in background"""
    scan_status["running"] = True
    scan_status["current_scan"] = network_str
    scan_status["progress"] = 0
    
    try:
        network = parse_network(network_str)
        online_hosts = scan_network(network)
        
        # Store results
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        scan_results[f"{network_str} - {timestamp}"] = {
            "network": network_str,
            "timestamp": timestamp,
            "hosts": sorted(online_hosts, key=lambda x: tuple(map(int, x.split('.')))),
            "total_hosts": len(online_hosts)
        }
        
    except Exception as e:
        scan_results[f"Error - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"] = {
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    
    finally:
        scan_status["running"] = False
        scan_status["current_scan"] = None
        scan_status["progress"] = 100

@app.route('/status')
def get_status():
    """Get current scan status"""
    return jsonify(scan_status)

@app.route('/results')
def get_results():
    """Get all scan results"""
    return jsonify(scan_results)

@app.route('/results/<scan_id>')
def get_scan_result(scan_id):
    """Get specific scan result"""
    if scan_id in scan_results:
        return jsonify(scan_results[scan_id])
    return jsonify({"error": "Scan not found"}), 404

@app.route('/clear')
def clear_results():
    """Clear all scan results"""
    global scan_results
    scan_results = {}
    return redirect(url_for('index'))

if __name__ == '__main__':
    print("Starting NetScan Web Interface...")
    print("Access the web interface at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)