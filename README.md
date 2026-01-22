# NetScan - Network Scanner

A powerful network discovery tool with both command-line and web interfaces for finding active devices on your network.

## Features

### Command Line Interface
- **Auto Network Detection** - Automatically detects your local network
- **Flexible Input** - Supports various network formats (192.168.1.0/24, 192.168.1, etc.)
- **Fast Parallel Scanning** - Uses threading for quick results
- **Cross-Platform** - Works on Windows, Linux, and macOS

### Web Interface
- **Modern Dashboard** - Clean, responsive web interface
- **Real-time Progress** - Live scan progress with statistics
- **Scan History** - View and manage previous scan results
- **Export Options** - Download results as JSON or copy IP lists
- **Mobile Friendly** - Works on phones and tablets

## Installation

1. **Clone or download** this repository
2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Command Line
```bash
# Scan your current network (auto-detect)
python netscan.py

# Scan specific network
python netscan.py 192.168.1.0/24
python netscan.py 192.168.1
python netscan.py 10.0.0.0/16

# Show help
python netscan.py --help
```

### Web Interface
1. **Start the web server**:
   ```bash
   python web_app.py
   ```

2. **Open your browser** and go to:
   ```
   http://localhost:5000
   ```

3. **Start scanning**:
   - Enter a network range or leave empty for auto-detection
   - Click "Start Scan"
   - Watch real-time progress
   - View results in the dashboard

## How It Works

1. **Network Discovery** - Detects your local IP and subnet mask
2. **Address Generation** - Creates list of all possible IP addresses in range
3. **Parallel Ping** - Sends ping requests to multiple IPs simultaneously
4. **Result Collection** - Gathers responses and displays active devices

## Example Output

### Command Line
```
Scanning network: 192.168.1.0/24

Online hosts:
192.168.1.1
192.168.1.15
192.168.1.23
192.168.1.45
```

### Web Interface
- Interactive table showing found devices
- Real-time scan progress
- Export capabilities
- Scan history management

## Network Formats Supported

- **CIDR Notation**: `192.168.1.0/24`
- **IP with implied /24**: `192.168.1.0`
- **Partial IP**: `192.168.1` (becomes 192.168.1.0/24)
- **Auto-detection**: Leave empty to scan your current network

## Requirements

- **Python 3.6+**
- **Flask** (for web interface)
- **Network access** for ping operations

## Security Notes

- This tool only performs ping scans (ICMP)
- No intrusive scanning or port probing
- Respects network timeouts and limits
- Safe for use on corporate networks

## Troubleshooting

### Common Issues

1. **No devices found**:
   - Check if devices respond to ping
   - Some devices have ping disabled
   - Verify network range is correct

2. **Permission errors**:
   - Some systems require admin/root for ping
   - Try running with elevated privileges

3. **Web interface not loading**:
   - Check if port 5000 is available
   - Ensure Flask is installed correctly
   - Check firewall settings

### Platform-Specific Notes

- **Windows**: Uses `ping -n 1 -w 1000`
- **Linux/macOS**: Uses `ping -c 1 -W 1`
- **Network detection**: Uses `ipconfig` (Windows) or `ifconfig` (Unix)

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve NetScan!