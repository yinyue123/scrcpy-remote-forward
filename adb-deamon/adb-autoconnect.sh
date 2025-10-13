#!/bin/bash
###############################################
# ADB Auto-Connect and Port Forwarding Script
# Features:
# 1. Check ADB device connection status
# 2. Automatically attempt to reconnect devices that are not properly connected
# 3. Configure ADB TCP/IP mode (port 6666)
# 4. Set up port forwarding (local 6666 -> device 6666)
###############################################

# Configuration Variables
ADB_PORT=6666
LOCAL_PORT=6666
DEVICE_PORT=6666
LOG_FILE="/var/log/adb-autoconnect.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if ADB is installed
check_adb() {
    if ! command -v adb &> /dev/null; then
        log "Error: ADB is not installed. Please install ADB first."
        exit 1
    fi
}

# Get list of devices
get_devices() {
    adb devices | grep -v "List of devices" | grep -v "^$" | awk '{print $1}'
}

# Check device status
check_device_status() {
    local device=$1
    local status=$(adb -s "$device" get-state 2>/dev/null)
    echo "$status"
}

# Restart ADB server
restart_adb_server() {
    log "Restarting ADB server..."
    adb kill-server
    sleep 2
    adb start-server
    sleep 2
}

# Configure TCP/IP mode
setup_tcpip() {
    local device=$1
    log "Configuring device $device for TCP/IP mode (port $ADB_PORT)..."

    # Ensure device is connected via USB
    local status=$(check_device_status "$device")
    if [ "$status" != "device" ]; then
        log "Warning: Device $device status is abnormal ($status), attempting to reconnect..."
        return 1
    fi

    # Set TCP/IP port
    adb -s "$device" tcpip "$ADB_PORT" 2>&1 | tee -a "$LOG_FILE"
    sleep 3

    # Get device IP (try multiple methods)
    local device_ip=$(adb -s "$device" shell ip addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)

    if [ -z "$device_ip" ]; then
        device_ip=$(adb -s "$device" shell ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
    fi

    if [ -n "$device_ip" ]; then
        log "Device IP: $device_ip"
        log "Can connect via Wi-Fi using command: adb connect $device_ip:$ADB_PORT"
    else
        log "Warning: Could not get device IP address"
    fi

    return 0
}

# Check and set up port forwarding
setup_port_forward() {
    local device=$1

    # Check current port forwarding
    local existing_forward=$(adb -s "$device" forward --list 2>/dev/null | grep "tcp:$LOCAL_PORT")

    if [ -n "$existing_forward" ]; then
        log "Port forward already exists: $existing_forward"

        # Check if it points to the correct device port
        if echo "$existing_forward" | grep -q "tcp:$DEVICE_PORT"; then
            log "Port forwarding configuration is correct, no changes needed."
            return 0
        else
            log "Port forwarding configuration is incorrect, reconfiguring..."
            adb -s "$device" forward --remove tcp:$LOCAL_PORT 2>&1 | tee -a "$LOG_FILE"
        fi
    fi

    # Set up new port forwarding
    log "Configuring port forwarding: localhost:$LOCAL_PORT -> device:$DEVICE_PORT"
    adb -s "$device" forward tcp:$LOCAL_PORT tcp:$DEVICE_PORT 2>&1 | tee -a "$LOG_FILE"

    if [ $? -eq 0 ]; then
        log "Port forwarding configured successfully"
        return 0
    else
        log "Error: Port forwarding configuration failed"
        return 1
    fi
}

# Process a single device
process_device() {
    local device=$1
    local status=$(check_device_status "$device")

    log "=========================================="
    log "Processing device: $device"
    log "Device status: $status"

    case "$status" in
        device)
            log "Device connected normally"

            # Configure TCP/IP
            if setup_tcpip "$device"; then
                # Configure port forwarding
                setup_port_forward "$device"
            fi
            ;;
        unauthorized)
            log "Error: Device unauthorized. Please allow USB debugging on the device."
            return 1
            ;;
        offline)
            log "Error: Device offline, attempting to reconnect..."
            restart_adb_server
            sleep 3
            status=$(check_device_status "$device")
            if [ "$status" = "device" ]; then
                log "Device reconnected successfully"
                setup_tcpip "$device"
                setup_port_forward "$device"
            else
                log "Error: Device failed to reconnect"
                return 1
            fi
            ;;
        *)
            log "Error: Device status abnormal ($status)"
            return 1
            ;;
    esac

    return 0
}

# Main function
main() {
    log "=========================================="
    log "ADB Auto-Connect Script Starting"
    log "=========================================="

    # Check ADB
    check_adb

    # Start ADB service
    adb start-server 2>&1 | tee -a "$LOG_FILE"
    sleep 2

    # Get device list
    devices=($(get_devices))

    if [ ${#devices[@]} -eq 0 ]; then
        log "Warning: No ADB devices detected"
        log "Please check:"
        log "1. If the device is connected via USB"
        log "2. If USB debugging is enabled on the device"
        log "3. If the device has authorized this computer"
        exit 1
    fi

    log "Detected ${#devices[@]} device(s)"

    # Process each device
    success_count=0
    for device in "${devices[@]}"; do
        if process_device "$device"; then
            ((success_count++))
        fi
    done

    log "=========================================="
    log "Processing complete: $success_count/${#devices[@]} device(s) successful"
    log "=========================================="

    # Display port forwarding list
    log ""
    log "Current Port Forwarding List:"
    adb forward --list | tee -a "$LOG_FILE"

    exit 0
}

# Execute main function
main "$@"

