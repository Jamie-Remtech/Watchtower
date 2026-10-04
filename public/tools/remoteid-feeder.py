#!/usr/bin/env python3
"""Watchtower Remote ID feeder — forwards drones heard by a Remote ID receiver.

Remote ID drones broadcast their serial, position, altitude and the pilot's
position over Bluetooth / Wi-Fi. A receiver (an ESP32 Remote ID scanner, a phone
app that exports, or a Linux box decoding Open Drone ID) prints one JSON object
per line. Pipe that output into this script:

    WATCHTOWER_KEY=<link key> receiver-command | python3 remoteid-feeder.py
    WATCHTOWER_KEY=<link key> python3 remoteid-feeder.py /dev/ttyUSB0     (serial, 115200)

Accepted fields (common Open Drone ID names are mapped automatically):
  id / serial / uas_id / BasicID     drone identity
  lat, lng / lon / Latitude, Longitude
  alt_geo_m / AltitudeGeo / geodetic_altitude     height above sea level (WGS84)
  height_m / Height, height_ref "takeoff"|"ground"
  speed_ms / SpeedHorizontal, heading / Direction
  op_lat, op_lng / OperatorLatitude, OperatorLongitude
  operator_id / OperatorID, ua_type / UAType
Untested against specific hardware until a receiver is on hand — check
Watchtower → Settings → Air links for the "last heard" time after starting.
"""
import json, os, sys, time
import requests

KEY = os.environ.get('WATCHTOWER_KEY') or sys.exit('set WATCHTOWER_KEY to the key Watchtower showed you')
ENDPOINT = os.environ.get('WATCHTOWER_ENDPOINT', 'https://lamezbfkdnzztpmwimoz.supabase.co/functions/v1/air-ingest')
ANON = os.environ.get('WATCHTOWER_ANON', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbWV6YmZrZG56enRwbXdpbW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTcyNzUsImV4cCI6MjEwMTU5MzI3NX0.n79p2rk0w_TQUU2QTLnM5s3sJvpAHExNz4rkPCo6D20')
ALIASES = {
    'id': ['id', 'serial', 'uas_id', 'BasicID', 'UASID', 'mac'],
    'lat': ['lat', 'Latitude', 'latitude'], 'lng': ['lng', 'lon', 'Longitude', 'longitude'],
    'alt_geo_m': ['alt_geo_m', 'AltitudeGeo', 'geodetic_altitude', 'alt_geo'],
    'height_m': ['height_m', 'Height', 'height'], 'height_ref': ['height_ref', 'HeightType'],
    'speed_ms': ['speed_ms', 'SpeedHorizontal', 'speed'], 'heading': ['heading', 'Direction', 'direction'],
    'op_lat': ['op_lat', 'OperatorLatitude', 'operator_lat'], 'op_lng': ['op_lng', 'OperatorLongitude', 'operator_lon'],
    'operator_id': ['operator_id', 'OperatorID'], 'ua_type': ['ua_type', 'UAType'],
}

def normalise(o):
    out = {}
    for k, names in ALIASES.items():
        for n in names:
            if n in o and o[n] not in (None, ''):
                out[k] = o[n]
                break
    if 'height_ref' in out and str(out['height_ref']).lower() in ('0', 'takeoff', 'above takeoff'):
        out['height_ref'] = 'takeoff'
    elif 'height_ref' in out:
        out['height_ref'] = 'ground'
    return out if 'id' in out and 'lat' in out and 'lng' in out else None

def lines():
    if len(sys.argv) > 1:
        import serial  # pip install pyserial
        with serial.Serial(sys.argv[1], int(os.environ.get('BAUD', '115200')), timeout=1) as s:
            while True:
                yield s.readline().decode('utf-8', 'ignore')
    else:
        for line in sys.stdin:
            yield line

session = requests.Session()
session.headers.update({'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': f'Bearer {ANON}', 'x-watchtower-key': KEY})
seen, last = {}, 0
print('Watchtower Remote ID feeder running')
for line in lines():
    line = line.strip()
    if line.startswith('{'):
        try:
            d = normalise(json.loads(line))
            if d:
                seen[str(d['id'])] = d
        except ValueError:
            pass
    if seen and time.time() - last >= 1:
        try:
            r = session.post(ENDPOINT, data=json.dumps({'remoteid': list(seen.values())}), timeout=8)
            if r.status_code != 200:
                print('Watchtower said', r.status_code, r.text[:160])
        except requests.RequestException as e:
            print('send failed (will retry):', e)
        seen, last = {}, time.time()
