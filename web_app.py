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
import socket
import subprocess
import re

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

@app.route('/test')
def test():
    """Test page with simple interface"""
    return render_template('test.html')

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

def get_device_info(ip):
    """
    Get device information including hostname, MAC address, and device type
    """
    device_info = {
        'hostname': 'Unknown',
        'mac_address': 'Unknown',
        'device_type': 'Unknown Device',
        'vendor': 'Unknown'
    }
    
    try:
        # Get hostname
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            device_info['hostname'] = hostname
        except:
            device_info['hostname'] = 'Unknown'
        
        # Get MAC address and vendor info
        mac_info = get_mac_address(ip)
        if mac_info:
            device_info['mac_address'] = mac_info['mac']
            device_info['vendor'] = mac_info['vendor']
        
        # Determine device type based on various factors
        device_info['device_type'] = determine_device_type(ip, device_info['hostname'], device_info['vendor'])
        
    except Exception as e:
        print(f"Error getting device info for {ip}: {e}")
    
    return device_info

def get_mac_address(ip):
    """
    Get MAC address using ARP table
    """
    try:
        import platform
        system = platform.system().lower()
        
        if system == "windows":
            # Use arp command on Windows
            result = subprocess.run(['arp', '-a', ip], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                # Parse Windows ARP output
                lines = result.stdout.split('\n')
                for line in lines:
                    if ip in line:
                        # Extract MAC address (format: xx-xx-xx-xx-xx-xx)
                        mac_match = re.search(r'([0-9a-fA-F]{2}[-:]){5}[0-9a-fA-F]{2}', line)
                        if mac_match:
                            mac = mac_match.group(0).replace('-', ':').upper()
                            vendor = get_vendor_from_mac(mac)
                            return {'mac': mac, 'vendor': vendor}
        else:
            # Use arp command on Unix/Linux
            result = subprocess.run(['arp', '-n', ip], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                # Parse Unix ARP output
                lines = result.stdout.split('\n')
                for line in lines:
                    if ip in line:
                        # Extract MAC address
                        mac_match = re.search(r'([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}', line)
                        if mac_match:
                            mac = mac_match.group(0).replace('-', ':').upper()
                            vendor = get_vendor_from_mac(mac)
                            return {'mac': mac, 'vendor': vendor}
    except Exception as e:
        print(f"Error getting MAC for {ip}: {e}")
    
    return None

def get_vendor_from_mac(mac):
    """
    Get vendor information from MAC address OUI (first 3 octets)
    """
    # Common vendor OUI mappings (first 6 characters of MAC)
    vendor_map = {
        '00:50:56': 'VMware',
        '08:00:27': 'VirtualBox',
        '52:54:00': 'QEMU/KVM',
        '00:0C:29': 'VMware',
        '00:1C:42': 'Parallels',
        '00:03:FF': 'Microsoft',
        '00:15:5D': 'Microsoft Hyper-V',
        '28:CD:C1': 'Apple',
        '3C:07:54': 'Apple',
        '88:E9:FE': 'Apple',
        'DC:A6:32': 'Raspberry Pi',
        'B8:27:EB': 'Raspberry Pi',
        'E4:5F:01': 'Raspberry Pi',
        '00:16:3E': 'Xen',
        '00:1B:21': 'Intel',
        '00:1F:16': 'Dell',
        '00:14:22': 'Dell',
        '70:B3:D5': 'TP-Link',
        'EC:08:6B': 'TP-Link',
        '50:C7:BF': 'TP-Link',
        '00:1D:7E': 'Netgear',
        '28:C6:8E': 'Netgear',
        'A0:04:60': 'Netgear',
        '00:26:F2': 'Netgear',
        '00:90:A9': 'Western Digital',
        '00:11:32': 'Synology',
        '00:0D:B9': 'Netgear',
        '20:4E:7F': 'Netgear',
        '84:16:F9': 'TP-Link',
        'C4:E9:84': 'TP-Link',
        '98:DA:C4': 'TP-Link',
        '00:23:CD': 'TP-Link',
        '14:CC:20': 'TP-Link',
        '50:D4:F7': 'TP-Link',
        '74:DA:38': 'TP-Link',
        '10:FE:ED': 'TP-Link',
        '00:1E:58': 'WD My Book',
        '00:90:A9': 'Western Digital',
        '00:04:ED': 'Linksys',
        '68:7F:74': 'Linksys',
        '20:AA:4B': 'Linksys',
        '48:F8:B3': 'Linksys',
        '00:18:39': 'Cisco',
        '00:1B:0D': 'Cisco',
        '00:1C:58': 'Cisco',
        '00:21:A0': 'Cisco',
        '00:23:04': 'Cisco',
        '00:25:45': 'Cisco',
        '00:26:98': 'Cisco',
        '00:30:F2': 'Cisco',
        '00:40:96': 'Cisco',
        '00:50:0F': 'Cisco',
        '00:50:73': 'Cisco',
        '00:60:2F': 'Cisco',
        '00:60:3E': 'Cisco',
        '00:60:47': 'Cisco',
        '00:60:5C': 'Cisco',
        '00:60:70': 'Cisco',
        '00:60:83': 'Cisco',
        '00:90:0C': 'Cisco',
        '00:90:21': 'Cisco',
        '00:90:2B': 'Cisco',
        '00:90:86': 'Cisco',
        '00:90:92': 'Cisco',
        '00:90:AB': 'Cisco',
        '00:90:B1': 'Cisco',
        '00:90:F2': 'Cisco',
        '00:A0:C9': 'Cisco',
        '00:B0:64': 'Cisco',
        '00:C0:1D': 'Cisco',
        '00:D0:06': 'Cisco',
        '00:D0:58': 'Cisco',
        '00:D0:79': 'Cisco',
        '00:D0:90': 'Cisco',
        '00:D0:97': 'Cisco',
        '00:D0:BA': 'Cisco',
        '00:D0:BB': 'Cisco',
        '00:D0:BC': 'Cisco',
        '00:D0:C0': 'Cisco',
        '00:D0:D3': 'Cisco',
        '00:D0:E4': 'Cisco',
        '00:D0:FF': 'Cisco',
        '00:E0:14': 'Cisco',
        '00:E0:1E': 'Cisco',
        '00:E0:34': 'Cisco',
        '00:E0:4F': 'Cisco',
        '00:E0:A3': 'Cisco',
        '00:E0:B0': 'Cisco',
        '00:E0:F7': 'Cisco',
        '00:E0:F9': 'Cisco',
        '00:E0:FE': 'Cisco',
        '08:CC:68': 'Cisco',
        '10:8C:CF': 'Cisco',
        '18:8B:45': 'Cisco',
        '1C:DF:0F': 'Cisco',
        '20:37:06': 'Cisco',
        '28:C7:CE': 'Cisco',
        '2C:36:F8': 'Cisco',
        '34:A8:4E': 'Cisco',
        '34:BD:C8': 'Cisco',
        '38:ED:18': 'Cisco',
        '3C:CE:73': 'Cisco',
        '40:55:39': 'Cisco',
        '44:AD:D9': 'Cisco',
        '48:44:F7': 'Cisco',
        '4C:4E:35': 'Cisco',
        '50:06:04': 'Cisco',
        '50:17:FF': 'Cisco',
        '50:3D:E5': 'Cisco',
        '54:78:1A': 'Cisco',
        '58:97:1E': 'Cisco',
        '5C:50:15': 'Cisco',
        '60:73:5C': 'Cisco',
        '64:00:F1': 'Cisco',
        '64:16:8D': 'Cisco',
        '64:A0:E7': 'Cisco',
        '68:BC:0C': 'Cisco',
        '6C:20:56': 'Cisco',
        '6C:41:6A': 'Cisco',
        '6C:9C:ED': 'Cisco',
        '70:CA:9B': 'Cisco',
        '74:26:AC': 'Cisco',
        '78:BA:F9': 'Cisco',
        '7C:95:F3': 'Cisco',
        '80:E0:1D': 'Cisco',
        '84:78:AC': 'Cisco',
        '88:43:E1': 'Cisco',
        '88:F0:31': 'Cisco',
        '8C:60:4F': 'Cisco',
        '90:E2:BA': 'Cisco',
        '94:F4:3E': 'Cisco',
        '98:FC:11': 'Cisco',
        '9C:AF:CA': 'Cisco',
        'A0:E0:AF': 'Cisco',
        'A0:F8:49': 'Cisco',
        'A4:0C:C3': 'Cisco',
        'A4:6C:2A': 'Cisco',
        'A4:93:4C': 'Cisco',
        'A8:9D:21': 'Cisco',
        'AC:A0:16': 'Cisco',
        'B0:7D:47': 'Cisco',
        'B4:14:89': 'Cisco',
        'B8:38:61': 'Cisco',
        'B8:BE:BF': 'Cisco',
        'BC:16:65': 'Cisco',
        'BC:67:1C': 'Cisco',
        'C0:62:6B': 'Cisco',
        'C4:0A:CB': 'Cisco',
        'C4:64:13': 'Cisco',
        'C8:00:84': 'Cisco',
        'C8:9C:1D': 'Cisco',
        'CC:EF:48': 'Cisco',
        'D0:57:4C': 'Cisco',
        'D4:8C:B5': 'Cisco',
        'D4:A0:2A': 'Cisco',
        'D8:B1:90': 'Cisco',
        'DC:7B:94': 'Cisco',
        'E0:2F:6D': 'Cisco',
        'E4:AA:5D': 'Cisco',
        'E8:04:0B': 'Cisco',
        'E8:B7:48': 'Cisco',
        'EC:44:76': 'Cisco',
        'F0:25:72': 'Cisco',
        'F0:29:29': 'Cisco',
        'F4:4E:05': 'Cisco',
        'F8:C2:88': 'Cisco',
        'FC:99:47': 'Cisco'
    }
    
    if mac and len(mac) >= 8:
        oui = mac[:8]  # First 3 octets (XX:XX:XX)
        return vendor_map.get(oui, 'Unknown Vendor')
    
    return 'Unknown Vendor'

def determine_device_type(ip, hostname, vendor):
    """
    Determine device type based on IP, hostname, and vendor information
    """
    hostname_lower = hostname.lower() if hostname != 'Unknown' else ''
    vendor_lower = vendor.lower() if vendor != 'Unknown Vendor' else ''
    
    # Check if it's likely a router/gateway (usually .1 or .254)
    ip_parts = ip.split('.')
    last_octet = int(ip_parts[-1]) if ip_parts[-1].isdigit() else 0
    
    if last_octet in [1, 254]:
        return '🌐 Router/Gateway'
    
    # Check by vendor
    if any(x in vendor_lower for x in ['cisco', 'netgear', 'tp-link', 'linksys', 'd-link', 'asus']):
        return '📡 Network Equipment'
    
    if any(x in vendor_lower for x in ['apple']):
        if any(x in hostname_lower for x in ['iphone', 'ipad', 'ipod']):
            return '📱 Mobile Device (iOS)'
        elif any(x in hostname_lower for x in ['macbook', 'imac', 'mac']):
            return '💻 Computer (Mac)'
        else:
            return '🍎 Apple Device'
    
    if any(x in vendor_lower for x in ['raspberry', 'pi']):
        return '🥧 Raspberry Pi'
    
    if any(x in vendor_lower for x in ['vmware', 'virtualbox', 'qemu', 'parallels', 'hyper-v']):
        return '🖥️ Virtual Machine'
    
    if any(x in vendor_lower for x in ['western digital', 'wd', 'synology', 'qnap']):
        return '💾 Network Storage'
    
    # Check by hostname patterns
    if any(x in hostname_lower for x in ['router', 'gateway', 'modem']):
        return '🌐 Router/Gateway'
    
    if any(x in hostname_lower for x in ['printer', 'print', 'hp-', 'canon-', 'epson-']):
        return '🖨️ Printer'
    
    if any(x in hostname_lower for x in ['camera', 'cam', 'security', 'nvr', 'dvr']):
        return '📹 Security Camera'
    
    if any(x in hostname_lower for x in ['tv', 'roku', 'chromecast', 'firestick', 'appletv']):
        return '📺 Smart TV/Streaming'
    
    if any(x in hostname_lower for x in ['phone', 'mobile', 'android', 'iphone', 'samsung']):
        return '📱 Mobile Device'
    
    if any(x in hostname_lower for x in ['laptop', 'desktop', 'pc', 'computer', 'workstation']):
        return '💻 Computer'
    
    if any(x in hostname_lower for x in ['server', 'srv', 'nas', 'storage']):
        return '🖥️ Server'
    
    if any(x in hostname_lower for x in ['switch', 'hub', 'access-point', 'ap-']):
        return '📡 Network Equipment'
    
    if any(x in hostname_lower for x in ['iot', 'smart', 'alexa', 'google-home', 'nest']):
        return '🏠 Smart Home Device'
    
    # Default based on common IP ranges
    if last_octet < 50:
        return '🌐 Network Infrastructure'
    elif last_octet > 200:
        return '📱 Mobile/Temporary Device'
    else:
        return '💻 Computer/Device'

def run_scan(network):
    """Run the actual scan in background with progress tracking and hostname resolution"""
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
        # Scan with hostname resolution
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
                        # Get hostname for the IP
                        hostname = get_hostname(result)
                        
                        # Get MAC address
                        mac_address = get_mac_address_simple(result)
                        
                        # Get basic device info
                        device_type = determine_basic_device_type(result, hostname)
                        
                        host_data = {
                            'ip': result,
                            'hostname': hostname,
                            'mac_address': mac_address,
                            'device_type': device_type,
                            'vendor': 'Unknown'
                        }
                        online_hosts.append(host_data)
                        scan_status["found_hosts"] += 1
                        print(f"Found device: {result} ({hostname}) - {device_type}")
                        
                except Exception as e:
                    print(f"Error scanning host: {e}")
                    scan_status["scanned_hosts"] += 1
                    scan_status["progress"] = int((scan_status["scanned_hosts"] / total_hosts) * 100)
                    continue
        
        # Store results
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Sort by IP address
        online_hosts.sort(key=lambda x: tuple(map(int, x['ip'].split('.'))))
        
        scan_result = {
            "id": len(scan_results) + 1,
            "network": str(network),
            "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration": f"{duration:.1f}s",
            "hosts": online_hosts,
            "total_found": len(online_hosts),
            "total_scanned": total_hosts
        }
        
        scan_results.append(scan_result)
        print(f"Scan completed: {len(online_hosts)} hosts found")
        
    except Exception as e:
        print(f"Scan error: {e}")
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

def get_mac_address_simple(ip):
    """Get MAC address using ARP table - simplified version"""
    try:
        import platform
        system = platform.system().lower()
        
        if system == "windows":
            # Use arp command on Windows
            result = subprocess.run(['arp', '-a', ip], capture_output=True, text=True, timeout=3)
            if result.returncode == 0:
                # Parse Windows ARP output
                lines = result.stdout.split('\n')
                for line in lines:
                    if ip in line:
                        # Extract MAC address (format: xx-xx-xx-xx-xx-xx)
                        mac_match = re.search(r'([0-9a-fA-F]{2}[-:]){5}[0-9a-fA-F]{2}', line)
                        if mac_match:
                            return mac_match.group(0).replace('-', ':').upper()
        else:
            # Use arp command on Unix/Linux
            result = subprocess.run(['arp', '-n', ip], capture_output=True, text=True, timeout=3)
            if result.returncode == 0:
                # Parse Unix ARP output
                lines = result.stdout.split('\n')
                for line in lines:
                    if ip in line:
                        # Extract MAC address
                        mac_match = re.search(r'([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}', line)
                        if mac_match:
                            return mac_match.group(0).replace('-', ':').upper()
    except Exception as e:
        print(f"Error getting MAC for {ip}: {e}")
    
    return 'Unknown'

def get_hostname(ip):
    """Get hostname for an IP address"""
    try:
        hostname = socket.gethostbyaddr(ip)[0]
        return hostname if hostname != ip else 'Unknown'
    except:
        return 'Unknown'

def determine_basic_device_type(ip, hostname):
    """Determine basic device type based on IP and hostname"""
    hostname_lower = hostname.lower() if hostname != 'Unknown' else ''
    
    # Check if it's likely a router/gateway (usually .1 or .254)
    ip_parts = ip.split('.')
    last_octet = int(ip_parts[-1]) if ip_parts[-1].isdigit() else 0
    
    if last_octet in [1, 254]:
        return '🌐 Router/Gateway'
    
    # Check by hostname patterns
    if any(x in hostname_lower for x in ['router', 'gateway', 'modem']):
        return '🌐 Router/Gateway'
    
    if any(x in hostname_lower for x in ['printer', 'print', 'hp-', 'canon-', 'epson-']):
        return '🖨️ Printer'
    
    if any(x in hostname_lower for x in ['camera', 'cam', 'security', 'nvr', 'dvr']):
        return '📹 Security Camera'
    
    if any(x in hostname_lower for x in ['tv', 'roku', 'chromecast', 'firestick', 'appletv']):
        return '📺 Smart TV/Streaming'
    
    if any(x in hostname_lower for x in ['phone', 'mobile', 'android', 'iphone', 'samsung']):
        return '📱 Mobile Device'
    
    if any(x in hostname_lower for x in ['laptop', 'desktop', 'pc', 'computer', 'workstation']):
        return '💻 Computer'
    
    if any(x in hostname_lower for x in ['server', 'srv', 'nas', 'storage']):
        return '🖥️ Server'
    
    if any(x in hostname_lower for x in ['switch', 'hub', 'access-point', 'ap-']):
        return '📡 Network Equipment'
    
    if any(x in hostname_lower for x in ['iot', 'smart', 'alexa', 'google-home', 'nest']):
        return '🏠 Smart Home Device'
    
    # Check for common hostname patterns
    if 'win' in hostname_lower or 'windows' in hostname_lower:
        return '💻 Windows Computer'
    
    if 'mac' in hostname_lower or 'apple' in hostname_lower:
        return '💻 Mac Computer'
    
    if 'ubuntu' in hostname_lower or 'linux' in hostname_lower:
        return '💻 Linux Computer'
    
    # Default based on common IP ranges
    if last_octet < 50:
        return '🌐 Network Infrastructure'
    elif last_octet > 200:
        return '📱 Mobile/Temporary Device'
    else:
        return '💻 Computer/Device'

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