#!/usr/bin/env python3
"""Watchtower MAVLink bridge — live drone position/altitude from an ArduPilot or
PX4 drone (via its ground station, telemetry radio or companion computer).

    pip install pymavlink requests
    WATCHTOWER_KEY=<link key> python3 mavlink-bridge.py udpin:0.0.0.0:14550

The connection string is any pymavlink one: udpin:0.0.0.0:14550 (Mission Planner /
QGroundControl MAVLink forwarding), /dev/ttyUSB0 (telemetry radio, baud 57600), tcp:host:5760.
Sends once per second: position, altitude above sea level (and above takeoff),
heading, ground speed, climb rate, battery.
"""
import json, math, os, sys, time
import requests
from pymavlink import mavutil

KEY = os.environ.get('WATCHTOWER_KEY') or sys.exit('set WATCHTOWER_KEY to the key Watchtower showed you')
ENDPOINT = os.environ.get('WATCHTOWER_ENDPOINT', 'https://lamezbfkdnzztpmwimoz.supabase.co/functions/v1/air-ingest')
ANON = os.environ.get('WATCHTOWER_ANON', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbWV6YmZrZG56enRwbXdpbW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTcyNzUsImV4cCI6MjEwMTU5MzI3NX0.n79p2rk0w_TQUU2QTLnM5s3sJvpAHExNz4rkPCo6D20')
LABEL = os.environ.get('DRONE_LABEL')
conn_str = sys.argv[1] if len(sys.argv) > 1 else 'udpin:0.0.0.0:14550'
baud = int(os.environ.get('BAUD', '57600'))

print(f'Watchtower MAVLink bridge: listening on {conn_str}')
m = mavutil.mavlink_connection(conn_str, baud=baud)
m.wait_heartbeat()
print(f'Heartbeat from system {m.target_system} — sending to Watchtower')
battery = None
last_sent = 0
session = requests.Session()
session.headers.update({'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': f'Bearer {ANON}', 'x-watchtower-key': KEY})

while True:
    msg = m.recv_match(type=['GLOBAL_POSITION_INT', 'SYS_STATUS', 'BATTERY_STATUS'], blocking=True, timeout=5)
    if msg is None:
        continue
    t = msg.get_type()
    if t == 'SYS_STATUS' and msg.battery_remaining >= 0:
        battery = msg.battery_remaining
    elif t == 'BATTERY_STATUS' and msg.battery_remaining >= 0:
        battery = msg.battery_remaining
    elif t == 'GLOBAL_POSITION_INT' and time.time() - last_sent >= 1:
        if msg.lat == 0 and msg.lon == 0:
            continue
        speed = math.hypot(msg.vx, msg.vy) / 100.0  # cm/s → m/s
        body = {'telemetry': {
            'lat': msg.lat / 1e7, 'lng': msg.lon / 1e7,
            'alt_msl_m': msg.alt / 1000.0, 'alt_rel_m': msg.relative_alt / 1000.0,
            'heading': (msg.hdg / 100.0) if msg.hdg != 65535 else None,
            'speed_ms': round(speed, 1), 'vrate_mps': round(-msg.vz / 100.0, 1),
            'battery': battery, 'label': LABEL,
        }}
        try:
            r = session.post(ENDPOINT, data=json.dumps(body), timeout=8)
            if r.status_code != 200:
                print('Watchtower said', r.status_code, r.text[:160])
        except requests.RequestException as e:
            print('send failed (will retry):', e)
        last_sent = time.time()
