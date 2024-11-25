import os
import subprocess
import socket
import nmap


def get_local_subnet():
    """
    Detect the local subnet for the active network interface.
    """
    try:
        if os.name == "posix":  # Linux/Mac
            # Get the subnet using the `ip` command
            result = subprocess.check_output(
                "ip -o -f inet addr show | awk '/scope global/ {print $4}'", shell=True
            )
            subnet = result.decode().strip()
        elif os.name == "nt":  # Windows
            # Parse `ipconfig` output for IP and subnet mask
            result = subprocess.check_output("ipconfig", shell=True)
            subnet = None
            for line in result.decode().splitlines():
                if "IPv4" in line:
                    local_ip = line.split(":")[1].strip()
                if "Subnet Mask" in line:
                    netmask = line.split(":")[1].strip()
                    cidr = sum(bin(int(octet)).count("1")
                               for octet in netmask.split("."))
                    subnet = f"{local_ip}/{cidr}"
            if not subnet:
                raise ValueError("Could not determine subnet")
        else:
            raise NotImplementedError("Unsupported OS")
        print(f"Local subnet: {subnet}")  # Debugging line
        return subnet
    except Exception as e:
        print(f"Error detecting subnet: {e}")
        return None


def subnet_scan():
    # Initialize the nmap scanner
    nm = nmap.PortScanner()

    # Define the subnet you want to scan
    subnet = get_local_subnet()

    # Scan the subnet
    print(f"Scanning subnet {subnet}...")
    # -sn: Ping scan to identify active hosts
    nm.scan(hosts=subnet, arguments='-sn')

    # Process and print the results
    print("\nActive hosts:")
    for host in nm.all_hosts():
        mac_address = None
        vendor = None

        # Retrieve MAC address and vendor if available
        if 'addresses' in nm[host] and 'mac' in nm[host]['addresses']:
            mac_address = nm[host]['addresses']['mac']
            vendor = nm[host].get('vendor', {}).get(
                mac_address, "Unknown Vendor")

        # Retrieve hostnames if available
        hostnames = nm[host].get('hostnames', [])
        name = hostnames[0]['name'] if hostnames else "Unknown"

        # Print details
        print(f"- Host: {host}")
        print(f"  Hostname: {name}")
        print(f"  MAC Address: {mac_address if mac_address else 'N/A'}")
        print(f"  Vendor: {vendor if vendor else 'N/A'}")

    return nm.all_hosts()


print(subnet_scan())
