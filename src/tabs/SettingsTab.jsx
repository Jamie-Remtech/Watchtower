import { useState } from 'react';
import {
  Video, Users, CreditCard, Settings, AlertTriangle, Plus, Eye, Play, Pause, Thermometer, Camera, Flame, Bell, CheckCircle, Zap, XCircle, X, FileText, Wifi, Download, Search, Edit, Shield, Key, Globe, Database, RefreshCw, ChevronRight, BarChart3, Activity, Target, Gauge, Timer, Radio, Cpu, Copy, Lock, TrendingUp, Server, User, Navigation, Layers, Wind, Sun, CloudRain, Satellite
} from 'lucide-react';
import { DeviceIcon } from '../components/common';
import { C } from '../data/collaboratorData';
import { customerChannelData, orgData } from '../data/org';
import { aiSoftwareCapabilities, capabilities, customAIModules, edgeBoxCapabilities } from '../data/settingsData';
import { mockStreams } from '../data/streams';
import { DeviceManager } from '../components/DeviceManager';
import { useDevices } from '../hooks/useDevices';


export const SettingsTab = () => {
  const { isLive, devices, createDevice, updateDevice, removeDevice } = useDevices();
  const [activeSection, setActiveSection] = useState('channels');
  const [channelTab, setChannelTab] = useState('overview');
  const [configureDevice, setConfigureDevice] = useState(null);
  const [deviceConfig, setDeviceConfig] = useState({});
  
  // AI Control Panel State
  const [aiProcesses, setAiProcesses] = useState([
    { id: 'fire-detection', name: 'Fire Detection Engine', status: 'running', cpu: 45, memory: 2.4, gpu: 78, fps: 30, devices: 5, alerts: 12, uptime: '4d 12h', priority: 'critical' },
    { id: 'smoke-detection', name: 'Smoke Detection Engine', status: 'running', cpu: 38, memory: 1.8, gpu: 65, fps: 30, devices: 5, alerts: 8, uptime: '4d 12h', priority: 'critical' },
    { id: 'thermal-analysis', name: 'Thermal Analysis Module', status: 'running', cpu: 52, memory: 3.1, gpu: 82, fps: 15, devices: 3, alerts: 3, uptime: '4d 12h', priority: 'high' },
    { id: 'person-detection', name: 'Person Detection Model', status: 'running', cpu: 28, memory: 1.5, gpu: 45, fps: 30, devices: 4, alerts: 45, uptime: '4d 12h', priority: 'medium' },
    { id: 'vehicle-detection', name: 'Vehicle Detection Model', status: 'paused', cpu: 0, memory: 0.2, gpu: 0, fps: 0, devices: 0, alerts: 0, uptime: '0h', priority: 'low' },
    { id: 'wildlife-detection', name: 'Wildlife Detection Model', status: 'running', cpu: 15, memory: 0.8, gpu: 25, fps: 15, devices: 2, alerts: 156, uptime: '4d 12h', priority: 'low' },
    { id: 'anomaly-detection', name: 'Anomaly Detection AI', status: 'running', cpu: 22, memory: 1.2, gpu: 35, fps: 10, devices: 8, alerts: 5, uptime: '4d 12h', priority: 'medium' },
    { id: 'path-planning', name: 'Drone Path Planning AI', status: 'running', cpu: 18, memory: 0.9, gpu: 12, fps: 1, devices: 3, alerts: 0, uptime: '4d 12h', priority: 'high' },
  ]);
  
  const [aiPorts, setAiPorts] = useState([
    { id: 1, port: 8080, service: 'AI Gateway API', status: 'open', protocol: 'HTTPS', connections: 45, bandwidth: '12.5 MB/s', ssl: true },
    { id: 2, port: 8443, service: 'Model Inference Server', status: 'open', protocol: 'gRPC', connections: 120, bandwidth: '45.2 MB/s', ssl: true },
    { id: 3, port: 5000, service: 'Real-time Stream Processor', status: 'open', protocol: 'WebSocket', connections: 35, bandwidth: '156.8 MB/s', ssl: true },
    { id: 4, port: 6379, service: 'Redis Cache (AI State)', status: 'open', protocol: 'TCP', connections: 200, bandwidth: '8.3 MB/s', ssl: false },
    { id: 5, port: 9090, service: 'Prometheus Metrics', status: 'open', protocol: 'HTTP', connections: 5, bandwidth: '0.2 MB/s', ssl: false },
    { id: 6, port: 3000, service: 'Grafana Dashboard', status: 'open', protocol: 'HTTPS', connections: 3, bandwidth: '0.5 MB/s', ssl: true },
    { id: 7, port: 5432, service: 'PostgreSQL (AI Data)', status: 'open', protocol: 'TCP', connections: 50, bandwidth: '2.1 MB/s', ssl: true },
    { id: 8, port: 1883, service: 'MQTT Broker (IoT)', status: 'open', protocol: 'MQTT', connections: 85, bandwidth: '1.8 MB/s', ssl: false },
    { id: 9, port: 8883, service: 'MQTT Secure (IoT)', status: 'open', protocol: 'MQTTS', connections: 42, bandwidth: '1.2 MB/s', ssl: true },
    { id: 10, port: 554, service: 'RTSP Stream Server', status: 'open', protocol: 'RTSP', connections: 10, bandwidth: '285.4 MB/s', ssl: false },
  ]);
  
  const [aiFeatureControls, setAiFeatureControls] = useState({
    autoScaling: true,
    loadBalancing: true,
    failover: true,
    alertAggregation: true,
    smartPrioritization: true,
    predictiveMaintenance: true,
    autoRetrain: false,
    edgeOptimization: true,
    bandwidthThrottling: false,
    nightModeEnhancement: true,
    weatherAdaptation: true,
    crowdDensityAnalysis: false,
  });
  
  const [systemMetrics, setSystemMetrics] = useState({
    totalCpu: 62,
    totalMemory: 78,
    totalGpu: 85,
    networkIn: '485.2 MB/s',
    networkOut: '125.8 MB/s',
    activeModels: 7,
    queuedInferences: 12,
    avgLatency: '45ms',
    uptime: '99.97%',
    lastIncident: '12 days ago',
  });
  
  // Initialize device config when opening modal
  const openDeviceConfig = (device) => {
    setDeviceConfig({
      // Identity
      name: device.name,
      serialNumber: `SN-${device.id.toString().padStart(6, '0')}`,
      macAddress: `00:1A:2B:${device.id.toString(16).padStart(2, '0').toUpperCase()}:CD:EF`,
      firmwareVersion: '2.4.1',
      // Connection
      protocol: device.connectionType === 'Fiber' ? 'rtsp' : device.connectionType === 'LoRa' ? 'mqtt' : 'rtsp',
      ipAddress: `192.168.1.${100 + device.id}`,
      port: device.deviceType === 'sensor' ? '1883' : '554',
      streamPath: device.deviceType === 'camera' || device.deviceType === 'drone' ? '/live/stream1' : '',
      // Authentication
      username: 'admin',
      password: '••••••••',
      authMethod: 'basic',
      // Stream Settings (for cameras/drones)
      resolution: '1920x1080',
      frameRate: device.fps || 30,
      bitrate: '4000',
      codec: 'h265',
      audioEnabled: false,
      // Overlay/OSD
      operatorName: 'SDIS 11 Operations',
      showTimestamp: true,
      showGPS: device.deviceType === 'drone',
      showDeviceName: true,
      timestampFormat: 'DD/MM/YYYY HH:mm:ss',
      // AI Processing
      processingLocation: device.processingLocation || 'edge',
      detectFire: true,
      detectSmoke: true,
      detectHuman: device.deviceType === 'drone',
      detectVehicle: false,
      confidenceThreshold: 75,
      alertSensitivity: 'medium',
      // Sensor specific
      sensorInterval: device.deviceType === 'sensor' ? '30' : '',
      dataFormat: 'json',
      // Alerts
      alertEnabled: true,
      alertRecipients: 'ops@sdis11.fr',
      alertCooldown: '60',
      // Maintenance
      autoUpdate: true,
      healthCheckInterval: '300',
      diagnosticLogging: true,
      // Drone Operators/Pilots (for drones only)
      currentPilot: device.pilot || '',
      controlMode: device.controlMode || 'watchtower',
      authorizedPilots: [
        { id: 1, name: 'Jean Dupont', callsign: 'Alpha-1', license: 'FR-UAS-2024-0451', role: 'primary', status: 'active' },
        { id: 2, name: 'Marie Martin', callsign: 'Alpha-2', license: 'FR-UAS-2024-0892', role: 'backup', status: 'active' },
        { id: 3, name: 'Pierre Bernard', callsign: 'Bravo-1', license: 'FR-UAS-2023-1205', role: 'backup', status: 'inactive' },
      ],
      requirePilotForManual: true,
      autoReturnOnDisconnect: true,
      maxManualDuration: 30, // minutes
    });
    setConfigureDevice(device);
  };
  
  const handleConfigSave = () => {
    // In real app, this would save to backend
    alert(`Configuration saved for ${configureDevice.name}`);
    setConfigureDevice(null);
  };
  
  // Device Configuration Modal

  // Device Configuration Modal - Tabbed Interface
  const DeviceConfigModal = () => {
    const [configTab, setConfigTab] = useState('identity');
    
    if (!configureDevice) return null;
    
    const isCamera = configureDevice.deviceType === 'camera';
    const isDrone = configureDevice.deviceType === 'drone';
    const isSensor = configureDevice.deviceType === 'sensor';
    const hasVideo = isCamera || isDrone;
    
    const tabs = [
      { id: 'identity', label: 'Identity', icon: Key },
      { id: 'connection', label: 'Connection', icon: Globe },
      { id: 'auth', label: 'Authentication', icon: Shield },
      ...(hasVideo ? [{ id: 'video', label: 'Video', icon: Video }] : []),
      ...(isSensor ? [{ id: 'sensor', label: 'Sensor', icon: Thermometer }] : []),
      ...(isDrone ? [{ id: 'operators', label: 'Operators', icon: Users }] : []),
      { id: 'overlay', label: 'OSD', icon: FileText },
      { id: 'ai', label: 'AI Processing', icon: Cpu },
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'maintenance', label: 'Maintenance', icon: RefreshCw },
    ];
    
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl">
          
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDrone ? 'bg-purple-500/20' : isCamera ? 'bg-blue-500/20' : 'bg-orange-500/20'
              }`}>
                <DeviceIcon deviceType={configureDevice.deviceType} className={`w-5 h-5 ${
                  isDrone ? 'text-purple-400' : isCamera ? 'text-blue-400' : 'text-orange-400'
                }`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{configureDevice.name}</h3>
                <p className="text-xs text-slate-400 capitalize">{configureDevice.type} • {configureDevice.channelCost || 1} AI Channels • {configureDevice.status}</p>
              </div>
            </div>
            <button onClick={() => setConfigureDevice(null)} className="p-2 hover:bg-slate-700 rounded-lg">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
          
          {/* Main Content with Sidebar */}
          <div className="flex-1 flex min-h-0">
            
            {/* Sidebar Tabs */}
            <div className="w-44 flex-shrink-0 bg-slate-800/30 border-r border-slate-700 p-3 overflow-y-auto">
              <nav className="space-y-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setConfigTab(tab.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      configTab === tab.id
                        ? 'bg-orange-500 text-white'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
              
              {/* Status Panel */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 uppercase mb-2 px-2">Device Status</p>
                <div className="space-y-2 text-xs px-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className={configureDevice.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                      {configureDevice.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Health</span>
                    <span className={configureDevice.health > 80 ? 'text-green-400' : 'text-yellow-400'}>
                      {configureDevice.health}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Signal</span>
                    <span className="text-white">{configureDevice.signalStrength}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* IDENTITY TAB */}
              {configTab === 'identity' && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">Device Identity</h4><p className="text-sm text-slate-400">Basic identification and hardware information</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs text-slate-400 mb-1">Device Name *</label><input type="text" value={deviceConfig.name} onChange={(e) => setDeviceConfig({...deviceConfig, name: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Device Type</label><input type="text" value={configureDevice.deviceType} readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Serial Number</label><input type="text" value={deviceConfig.serialNumber} readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">MAC Address</label><input type="text" value={deviceConfig.macAddress} readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Manufacturer</label><input type="text" value={isDrone ? 'DJI' : isCamera ? 'AXIS' : 'Bosch'} readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Model</label><input type="text" value={configureDevice.type} readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Firmware</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Current Version</label><div className="flex gap-2"><input type="text" value={deviceConfig.firmwareVersion} readOnly className="flex-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /><button className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">Update</button></div></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Last Updated</label><input type="text" value="2024-01-10" readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Location</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">GPS Coordinates</label><input type="text" value={configureDevice.location} readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Altitude</label><input type="text" value={configureDevice.altitude} readOnly className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-500 text-sm" /></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* CONNECTION TAB */}
              {configTab === 'connection' && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">Connection Settings</h4><p className="text-sm text-slate-400">Network protocols and connectivity configuration</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Protocol *</label>
                      <select value={deviceConfig.protocol} onChange={(e) => setDeviceConfig({...deviceConfig, protocol: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none">
                        <optgroup label="Video Streaming"><option value="rtsp">RTSP</option><option value="rtmp">RTMP</option><option value="hls">HLS</option><option value="webrtc">WebRTC</option><option value="mpeg-dash">MPEG-DASH</option><option value="srt">SRT</option><option value="ndi">NDI</option><option value="mjpeg">MJPEG</option></optgroup>
                        <optgroup label="Camera Standards"><option value="onvif">ONVIF Profile S/T/G</option><option value="psia">PSIA</option><option value="cgi">CGI/HTTP</option><option value="isapi">ISAPI</option></optgroup>
                        <optgroup label="IoT/Sensor"><option value="mqtt">MQTT</option><option value="coap">CoAP</option><option value="http">HTTP/REST</option><option value="websocket">WebSocket</option><option value="lwm2m">LwM2M</option></optgroup>
                        <optgroup label="Industrial"><option value="modbus-tcp">Modbus TCP</option><option value="modbus-rtu">Modbus RTU</option><option value="bacnet">BACnet</option><option value="opcua">OPC-UA</option><option value="profinet">PROFINET</option></optgroup>
                        <optgroup label="Drone/UAV"><option value="mavlink">MAVLink 2.0</option><option value="dji-msdk">DJI Mobile SDK</option><option value="dji-osdk">DJI Onboard SDK</option><option value="px4">PX4</option></optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Network Type *</label>
                      <select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none">
                        <optgroup label="Wired"><option value="fiber">Fiber Optic</option><option value="ethernet">Ethernet 10/100/1000</option><option value="10gbe">10 Gigabit Ethernet</option><option value="poe">PoE (802.3af)</option><option value="poe+">PoE+ (802.3at)</option><option value="poe++">PoE++ (802.3bt)</option></optgroup>
                        <optgroup label="WiFi"><option value="wifi4">WiFi 4 (802.11n)</option><option value="wifi5">WiFi 5 (802.11ac)</option><option value="wifi6">WiFi 6 (802.11ax)</option><option value="wifi6e">WiFi 6E</option></optgroup>
                        <optgroup label="Cellular"><option value="4g">4G LTE</option><option value="lte-a">LTE-Advanced</option><option value="5g">5G NR</option><option value="5g-mmwave">5G mmWave</option></optgroup>
                        <optgroup label="LPWAN"><option value="lora">LoRa</option><option value="lorawan">LoRaWAN</option><option value="sigfox">Sigfox</option><option value="nb-iot">NB-IoT</option><option value="lte-m">LTE-M</option></optgroup>
                        <optgroup label="Satellite"><option value="starlink">Starlink</option><option value="iridium">Iridium</option><option value="vsat">VSAT</option><option value="bgan">BGAN</option></optgroup>
                      </select>
                    </div>
                    <div><label className="block text-xs text-slate-400 mb-1">IP Address *</label><input type="text" value={deviceConfig.ipAddress} onChange={(e) => setDeviceConfig({...deviceConfig, ipAddress: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Port *</label><input type="text" value={deviceConfig.port} onChange={(e) => setDeviceConfig({...deviceConfig, port: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    {hasVideo && <div className="col-span-2"><label className="block text-xs text-slate-400 mb-1">Stream Path</label><input type="text" value={deviceConfig.streamPath} onChange={(e) => setDeviceConfig({...deviceConfig, streamPath: e.target.value})} placeholder="/live/stream1" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono focus:border-orange-500 focus:outline-none" /><p className="text-xs text-slate-500 mt-1">Full URI: rtsp://{deviceConfig.ipAddress}:{deviceConfig.port}{deviceConfig.streamPath}</p></div>}
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Advanced</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Timeout (sec)</label><input type="number" defaultValue="30" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Retry Attempts</label><input type="number" defaultValue="3" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Keep-Alive (sec)</label><input type="number" defaultValue="60" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    </div>
                    <div className="mt-4 flex gap-6">
                      <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500" /><span className="text-sm text-slate-300">Auto-reconnect</span></label>
                      <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500" /><span className="text-sm text-slate-300">NAT Traversal (STUN/TURN)</span></label>
                    </div>
                  </div>
                </div>
              )}
              
              {/* AUTH TAB */}
              {configTab === 'auth' && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">Authentication</h4><p className="text-sm text-slate-400">Security credentials and access control</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Auth Method *</label>
                      <select value={deviceConfig.authMethod} onChange={(e) => setDeviceConfig({...deviceConfig, authMethod: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none">
                        <option value="none">None</option><option value="basic">Basic Auth</option><option value="digest">Digest Auth</option><option value="bearer">Bearer Token</option><option value="certificate">X.509 Certificate</option><option value="oauth2">OAuth 2.0</option><option value="saml">SAML 2.0</option>
                      </select>
                    </div>
                    <div><label className="block text-xs text-slate-400 mb-1">Username</label><input type="text" value={deviceConfig.username} onChange={(e) => setDeviceConfig({...deviceConfig, username: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Password / API Key</label><input type="password" value={deviceConfig.password} onChange={(e) => setDeviceConfig({...deviceConfig, password: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    <div className="flex items-end"><button className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Wifi className="w-4 h-4" />Test Connection</button></div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">TLS / SSL</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">TLS Version</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>Auto (TLS 1.2+)</option><option>TLS 1.3</option><option>TLS 1.2</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Certificate Verification</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>Full</option><option>Hostname Only</option><option>Skip (insecure)</option></select></div>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">VPN / Tunnel</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">VPN Type</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="none">None</option><option>IPSec</option><option>OpenVPN</option><option>WireGuard</option><option>SSH Tunnel</option><option>ZeroTier</option><option>Tailscale</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">VPN Server</label><input type="text" placeholder="vpn.example.com" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* VIDEO TAB */}
              {configTab === 'video' && hasVideo && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">Video Stream Settings</h4><p className="text-sm text-slate-400">Configure video quality, codec, and stream parameters</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs text-slate-400 mb-1">Resolution *</label><select value={deviceConfig.resolution} onChange={(e) => setDeviceConfig({...deviceConfig, resolution: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="4096x2160">4K DCI (4096×2160)</option><option value="3840x2160">4K UHD (3840×2160)</option><option value="2560x1440">2K QHD (2560×1440)</option><option value="1920x1080">Full HD (1920×1080)</option><option value="1280x720">HD (1280×720)</option><option value="640x480">VGA (640×480)</option></select></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Frame Rate *</label><select value={deviceConfig.frameRate} onChange={(e) => setDeviceConfig({...deviceConfig, frameRate: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="120">120 FPS</option><option value="60">60 FPS</option><option value="50">50 FPS (PAL)</option><option value="30">30 FPS (NTSC)</option><option value="25">25 FPS (PAL)</option><option value="24">24 FPS (Cinema)</option><option value="15">15 FPS</option></select></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Video Codec *</label><select value={deviceConfig.codec} onChange={(e) => setDeviceConfig({...deviceConfig, codec: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="h265">H.265 / HEVC</option><option value="h264">H.264 / AVC</option><option value="vp9">VP9</option><option value="av1">AV1</option><option value="mjpeg">MJPEG</option></select></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Bitrate Mode</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>CBR (Constant)</option><option>VBR (Variable)</option><option>ABR (Average)</option></select></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Target Bitrate (kbps)</label><input type="number" value={deviceConfig.bitrate} onChange={(e) => setDeviceConfig({...deviceConfig, bitrate: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">GOP Size (frames)</label><input type="number" defaultValue="30" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Audio</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={deviceConfig.audioEnabled} onChange={(e) => setDeviceConfig({...deviceConfig, audioEnabled: e.target.checked})} className="w-4 h-4 rounded" /><span className="text-sm text-slate-300">Enable Audio</span></label>
                      <div><label className="block text-xs text-slate-400 mb-1">Audio Codec</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>AAC</option><option>Opus</option><option>G.711</option><option>PCM</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Audio Bitrate</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>64 kbps</option><option>128 kbps</option><option>192 kbps</option></select></div>
                    </div>
                  </div>
                  {isCamera && <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">PTZ Control</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">PTZ Protocol</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>None (Fixed)</option><option>ONVIF PTZ</option><option>VISCA</option><option>VISCA over IP</option><option>Pelco-D</option><option>Pelco-P</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">PTZ Speed</label><input type="range" min="1" max="100" defaultValue="50" className="w-full" /></div>
                    </div>
                  </div>}
                </div>
              )}
              
              {/* SENSOR TAB */}
              {configTab === 'sensor' && isSensor && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">Sensor Settings</h4><p className="text-sm text-slate-400">Configure data collection and transmission</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs text-slate-400 mb-1">Collection Interval *</label><div className="flex gap-2"><input type="number" value={deviceConfig.sensorInterval} onChange={(e) => setDeviceConfig({...deviceConfig, sensorInterval: e.target.value})} className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" /><select className="px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>seconds</option><option>minutes</option></select></div></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Data Format *</label><select value={deviceConfig.dataFormat} onChange={(e) => setDeviceConfig({...deviceConfig, dataFormat: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="json">JSON</option><option value="xml">XML</option><option value="csv">CSV</option><option value="protobuf">Protobuf</option><option value="msgpack">MessagePack</option></select></div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Sensor Channels</h5>
                    <div className="space-y-2">
                      {['Temperature (°C)', 'Humidity (%)', 'Pressure (hPa)', 'Wind Speed (km/h)', 'Wind Direction (°)', 'CO Level (ppm)', 'Smoke Density (ppm)'].map((ch, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={i < 4} className="w-4 h-4 rounded" /><span className="text-white">{ch}</span></label>
                          <div className="flex gap-2"><input type="number" placeholder="Min" className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" /><input type="number" placeholder="Max" className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* OPERATORS TAB - Drones Only */}
              {configTab === 'operators' && isDrone && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Drone Operators & Permissions</h4>
                    <p className="text-sm text-slate-400">Manage who can take manual control of this drone</p>
                  </div>
                  
                  {/* Current Control Status */}
                  <div className={`rounded-xl p-4 border ${deviceConfig.controlMode === 'watchtower' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-cyan-500/10 border-cyan-500/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {deviceConfig.controlMode === 'watchtower' ? (
                          <>
                            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                              <Flame className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                              <p className="text-orange-400 font-medium">Watchtower AI Control</p>
                              <p className="text-sm text-slate-400">Autonomous flight mode active</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                              <User className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                              <p className="text-cyan-400 font-medium">Manual Control Active</p>
                              <p className="text-sm text-slate-400">Pilot: <span className="text-white font-medium">{deviceConfig.currentPilot || 'Unknown'}</span></p>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Current Mode:</span>
                        <select 
                          value={deviceConfig.controlMode}
                          onChange={(e) => setDeviceConfig({...deviceConfig, controlMode: e.target.value})}
                          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                        >
                          <option value="watchtower">Watchtower AI</option>
                          <option value="manual">Manual Control</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Authorized Pilots */}
                  <div className="border-t border-slate-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-white font-medium">Authorized Pilots</h5>
                      <button className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Pilot
                      </button>
                    </div>
                    <div className="space-y-2">
                      {deviceConfig.authorizedPilots?.map((pilot) => (
                        <div key={pilot.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pilot.status === 'active' ? 'bg-green-500/20' : 'bg-slate-600/50'}`}>
                              <User className={`w-5 h-5 ${pilot.status === 'active' ? 'text-green-400' : 'text-slate-400'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium">{pilot.name}</p>
                                <span className={`px-2 py-0.5 rounded text-xs ${pilot.role === 'primary' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-600/50 text-slate-400'}`}>
                                  {pilot.role}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${pilot.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {pilot.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                <span>Callsign: <span className="text-white">{pilot.callsign}</span></span>
                                <span>License: <span className="text-white">{pilot.license}</span></span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {deviceConfig.controlMode === 'manual' && deviceConfig.currentPilot === pilot.name ? (
                              <span className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-sm rounded-lg flex items-center gap-2">
                                <Radio className="w-4 h-4" />
                                In Control
                              </span>
                            ) : pilot.status === 'active' ? (
                              <button 
                                onClick={() => setDeviceConfig({...deviceConfig, controlMode: 'manual', currentPilot: pilot.name})}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
                              >
                                Assign Control
                              </button>
                            ) : null}
                            <button className="p-2 hover:bg-slate-700 rounded-lg">
                              <Edit className="w-4 h-4 text-slate-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Manual Control Settings */}
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Manual Control Settings</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={deviceConfig.requirePilotForManual}
                          onChange={(e) => setDeviceConfig({...deviceConfig, requirePilotForManual: e.target.checked})}
                          className="w-4 h-4 rounded"
                        />
                        <div>
                          <span className="text-white">Require Authorized Pilot</span>
                          <p className="text-xs text-slate-500">Only listed pilots can take control</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={deviceConfig.autoReturnOnDisconnect}
                          onChange={(e) => setDeviceConfig({...deviceConfig, autoReturnOnDisconnect: e.target.checked})}
                          className="w-4 h-4 rounded"
                        />
                        <div>
                          <span className="text-white">Auto-Return on Disconnect</span>
                          <p className="text-xs text-slate-500">Return to AI control if pilot disconnects</p>
                        </div>
                      </label>
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs text-slate-400 mb-1">Maximum Manual Control Duration (minutes)</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="number" 
                          value={deviceConfig.maxManualDuration}
                          onChange={(e) => setDeviceConfig({...deviceConfig, maxManualDuration: parseInt(e.target.value)})}
                          className="w-32 px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                        />
                        <span className="text-sm text-slate-400">0 = unlimited</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Control Handover Log */}
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Recent Control Handovers</h5>
                    <div className="space-y-2 text-sm">
                      {[
                        { time: '2024-01-15 14:32', from: 'Watchtower AI', to: 'Jean Dupont (Alpha-1)', reason: 'Manual inspection requested' },
                        { time: '2024-01-15 14:58', from: 'Jean Dupont', to: 'Watchtower AI', reason: 'Inspection complete' },
                        { time: '2024-01-14 09:15', from: 'Watchtower AI', to: 'Marie Martin (Alpha-2)', reason: 'Training exercise' },
                      ].map((log, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                          <div className="flex items-center gap-4">
                            <span className="text-slate-500">{log.time}</span>
                            <span className="text-slate-400">{log.from}</span>
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                            <span className="text-white">{log.to}</span>
                          </div>
                          <span className="text-slate-500">{log.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* OSD TAB */}
              {configTab === 'overlay' && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">On-Screen Display (OSD)</h4><p className="text-sm text-slate-400">Configure text overlays on video feeds</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs text-slate-400 mb-1">Operator Name (shown in feeds) *</label><input type="text" value={deviceConfig.operatorName} onChange={(e) => setDeviceConfig({...deviceConfig, operatorName: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Timestamp Format</label><select value={deviceConfig.timestampFormat} onChange={(e) => setDeviceConfig({...deviceConfig, timestampFormat: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="DD/MM/YYYY HH:mm:ss">DD/MM/YYYY HH:mm:ss (EU)</option><option value="MM/DD/YYYY HH:mm:ss">MM/DD/YYYY HH:mm:ss (US)</option><option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss (ISO)</option></select></div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Display Elements</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {[{k:'showTimestamp',l:'Show Timestamp',d:'Display date/time'},{k:'showDeviceName',l:'Show Device Name',d:'Display device identifier'},{k:'showGPS',l:'Show GPS Coordinates',d:'Display lat/long'},{k:'showOperator',l:'Show Operator Name',d:'Display organization'}].map(el => (
                        <label key={el.k} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                          <input type="checkbox" checked={deviceConfig[el.k]} onChange={(e) => setDeviceConfig({...deviceConfig, [el.k]: e.target.checked})} className="w-4 h-4 rounded" />
                          <div><span className="text-white">{el.l}</span><p className="text-xs text-slate-500">{el.d}</p></div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Appearance</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Font Size</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>Small</option><option>Medium</option><option>Large</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Text Color</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>White</option><option>Yellow</option><option>Green</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Position</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>Top Left</option><option>Top Right</option><option>Bottom Left</option><option>Bottom Right</option></select></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* AI TAB */}
              {configTab === 'ai' && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">AI Processing</h4><p className="text-sm text-slate-400">Configure detection models and parameters</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs text-slate-400 mb-1">Processing Location *</label><select value={deviceConfig.processingLocation} onChange={(e) => setDeviceConfig({...deviceConfig, processingLocation: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="edge">Edge (Local AI Box)</option><option value="cloud">Cloud (Watchtower DC)</option><option value="hybrid">Hybrid</option></select></div>
                    <div><label className="block text-xs text-slate-400 mb-1">AI Model</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>Watchtower AI v3.2 (Latest)</option><option>Watchtower AI v3.1</option></select></div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Detection Types</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {[{k:'detectFire',l:'🔥 Fire Detection',d:'Detect flames'},{k:'detectSmoke',l:'💨 Smoke Detection',d:'Detect smoke plumes'},{k:'detectHuman',l:'👤 Human Detection',d:'Detect people'},{k:'detectVehicle',l:'🚗 Vehicle Detection',d:'Detect vehicles'}].map(det => (
                        <label key={det.k} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800">
                          <input type="checkbox" checked={deviceConfig[det.k]} onChange={(e) => setDeviceConfig({...deviceConfig, [det.k]: e.target.checked})} className="w-4 h-4 rounded" />
                          <div><span className="text-white">{det.l}</span><p className="text-xs text-slate-500">{det.d}</p></div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Parameters</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Confidence Threshold</label><input type="range" min="50" max="99" value={deviceConfig.confidenceThreshold} onChange={(e) => setDeviceConfig({...deviceConfig, confidenceThreshold: parseInt(e.target.value)})} className="w-full" /><div className="flex justify-between text-xs text-slate-500"><span>50%</span><span className="text-orange-400 font-bold">{deviceConfig.confidenceThreshold}%</span><span>99%</span></div></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Alert Sensitivity</label><select value={deviceConfig.alertSensitivity} onChange={(e) => setDeviceConfig({...deviceConfig, alertSensitivity: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ALERTS TAB */}
              {configTab === 'alerts' && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">Alert Configuration</h4><p className="text-sm text-slate-400">Configure alert delivery and timing</p></div>
                  <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg"><input type="checkbox" checked={deviceConfig.alertEnabled} onChange={(e) => setDeviceConfig({...deviceConfig, alertEnabled: e.target.checked})} className="w-5 h-5 rounded" /><span className="text-white font-medium">Alerts Enabled</span></label>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Recipients</h5>
                    <div className="space-y-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Email (comma separated)</label><input type="text" value={deviceConfig.alertRecipients} onChange={(e) => setDeviceConfig({...deviceConfig, alertRecipients: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">SMS (comma separated)</label><input type="text" placeholder="+33 6 12 34 56 78" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Webhook URL</label><input type="text" placeholder="https://..." className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono focus:border-orange-500 focus:outline-none" /></div>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Timing</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Cooldown (sec)</label><input type="number" value={deviceConfig.alertCooldown} onChange={(e) => setDeviceConfig({...deviceConfig, alertCooldown: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Escalation (min)</label><input type="number" defaultValue="5" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Auto-Ack (min)</label><input type="number" defaultValue="0" placeholder="0=never" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" /></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* MAINTENANCE TAB */}
              {configTab === 'maintenance' && (
                <div className="space-y-6">
                  <div><h4 className="text-lg font-semibold text-white">Maintenance & Diagnostics</h4><p className="text-sm text-slate-400">Device health and troubleshooting</p></div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg"><input type="checkbox" checked={deviceConfig.autoUpdate} onChange={(e) => setDeviceConfig({...deviceConfig, autoUpdate: e.target.checked})} className="w-4 h-4 rounded" /><div><span className="text-white">Auto-Update Firmware</span><p className="text-xs text-slate-500">Install security updates automatically</p></div></label>
                    <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg"><input type="checkbox" checked={deviceConfig.diagnosticLogging} onChange={(e) => setDeviceConfig({...deviceConfig, diagnosticLogging: e.target.checked})} className="w-4 h-4 rounded" /><div><span className="text-white">Diagnostic Logging</span><p className="text-xs text-slate-500">Log detailed activity</p></div></label>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Health Monitoring</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Health Check Interval (sec)</label><input type="number" value={deviceConfig.healthCheckInterval} onChange={(e) => setDeviceConfig({...deviceConfig, healthCheckInterval: e.target.value})} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Alert on Health Below (%)</label><input type="number" defaultValue="50" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm" /></div>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Schedule</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs text-slate-400 mb-1">Reboot Schedule</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>Never</option><option>Daily 03:00</option><option>Weekly (Sun)</option><option>Monthly (1st)</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">Maintenance Window</label><select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"><option>Any time</option><option>Night (00-06)</option><option>Weekends</option></select></div>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <h5 className="text-white font-medium mb-4">Actions</h5>
                    <div className="flex flex-wrap gap-3">
                      <button className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" />Reboot</button>
                      <button className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2"><Download className="w-4 h-4" />Download Logs</button>
                      <button className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Run Diagnostics</button>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
            <div className="flex gap-2">
              <button className="px-4 py-2.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm">Delete Device</button>
              <button className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Reset Defaults</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfigureDevice(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleConfigSave} className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">Save Configuration</button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Live mode: real device & channel management against the devices table.
  if (isLive) {
    return (
      <DeviceManager
        devices={devices}
        createDevice={createDevice}
        updateDevice={updateDevice}
        removeDevice={removeDevice}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Device Configuration Modal */}
      <DeviceConfigModal />
      
      <h2 className="text-xl font-bold text-white">Settings & Configuration</h2>
      
      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {['channels', 'aicontrol', 'organization', 'capabilities', 'notifications', 'security'].map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap ${
              activeSection === section ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {section === 'channels' ? 'AI Channels' : section === 'aicontrol' ? '🤖 AI Control' : section.charAt(0).toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>

      {/* AI Channels Section - Tabbed Interface */}
      {activeSection === 'channels' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          {/* Channel Header with Stats */}
          <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">AI Channels</h3>
                    <p className="text-sm text-slate-400">Resource allocation & device management</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{customerChannelData.channelsUsed}<span className="text-slate-500 text-lg">/{customerChannelData.channelsAllocated}</span></p>
                  <p className="text-xs text-slate-400">channels used</p>
                </div>
                <div className="w-24 h-24 relative">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#334155" strokeWidth="8" fill="none" />
                    <circle cx="48" cy="48" r="40" stroke={customerChannelData.channelsUsed / customerChannelData.channelsAllocated > 0.9 ? '#ef4444' : customerChannelData.channelsUsed / customerChannelData.channelsAllocated > 0.7 ? '#eab308' : '#22c55e'} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${(customerChannelData.channelsUsed / customerChannelData.channelsAllocated) * 251.2} 251.2`} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{Math.round((customerChannelData.channelsUsed / customerChannelData.channelsAllocated) * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sub-tabs */}
          <div className="flex border-b border-slate-700 bg-slate-800/30">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'devices', label: 'Devices', icon: Layers },
              { id: 'billing', label: 'Billing', icon: CreditCard },
              { id: 'protocols', label: 'Protocols', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setChannelTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all ${
                  channelTab === tab.id
                    ? 'border-orange-500 text-orange-400 bg-slate-800/50'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/30'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          <div className="p-6">
            
            {/* OVERVIEW TAB */}
            {channelTab === 'overview' && (
              <div className="space-y-6">
                {/* Channel Breakdown Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-purple-400" />
                      </div>
                      <span className="text-xs text-slate-500">×8 ch/unit</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{mockStreams.filter(s => s.deviceType === 'drone').length}</p>
                    <p className="text-sm text-slate-400">Drones</p>
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs text-purple-400">{mockStreams.filter(s => s.deviceType === 'drone').length * 8} channels allocated</p>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Video className="w-5 h-5 text-blue-400" />
                      </div>
                      <span className="text-xs text-slate-500">×2 ch/unit</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{mockStreams.filter(s => s.deviceType === 'camera' && s.isControllable).length}</p>
                    <p className="text-sm text-slate-400">PTZ Cameras</p>
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs text-blue-400">{mockStreams.filter(s => s.deviceType === 'camera' && s.isControllable).length * 2} channels allocated</p>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Camera className="w-5 h-5 text-cyan-400" />
                      </div>
                      <span className="text-xs text-slate-500">×1 ch/unit</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{mockStreams.filter(s => s.deviceType === 'camera' && !s.isControllable).length}</p>
                    <p className="text-sm text-slate-400">Fixed Cameras</p>
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs text-cyan-400">{mockStreams.filter(s => s.deviceType === 'camera' && !s.isControllable).length} channels allocated</p>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Thermometer className="w-5 h-5 text-orange-400" />
                      </div>
                      <span className="text-xs text-slate-500">×1 ch/unit</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{mockStreams.filter(s => s.deviceType === 'sensor').length}</p>
                    <p className="text-sm text-slate-400">Sensors</p>
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs text-orange-400">{mockStreams.filter(s => s.deviceType === 'sensor').length} channels allocated</p>
                    </div>
                  </div>
                </div>
                
                {/* Available Channels */}
                <div className={`rounded-xl p-4 border ${customerChannelData.channelsAvailable > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${customerChannelData.channelsAvailable > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {customerChannelData.channelsAvailable > 0 ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
                      </div>
                      <div>
                        <p className={`font-medium ${customerChannelData.channelsAvailable > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {customerChannelData.channelsAvailable > 0 ? `${customerChannelData.channelsAvailable} channels available` : 'No channels available'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {customerChannelData.channelsAvailable > 0 ? 'You can add more devices' : 'Request more channels to add devices'}
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {customerChannelData.channelsAvailable > 0 ? 'Add Device' : 'Request Channels'}
                    </button>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/30 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-white">{mockStreams.filter(s => s.status === 'active').length}</p>
                    <p className="text-sm text-slate-400">Active Devices</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{mockStreams.filter(s => s.status === 'maintenance').length}</p>
                    <p className="text-sm text-slate-400">In Maintenance</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-400">{mockStreams.filter(s => s.status === 'inactive').length}</p>
                    <p className="text-sm text-slate-400">Inactive</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* DEVICES TAB */}
            {channelTab === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="Search devices..." className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm w-64 focus:border-orange-500 focus:outline-none" />
                    <select className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                      <option value="">All Types</option>
                      <option value="drone">Drones</option>
                      <option value="camera">Cameras</option>
                      <option value="sensor">Sensors</option>
                    </select>
                  </div>
                  <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Device
                  </button>
                </div>
                
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 bg-slate-800/50">
                        <th className="px-4 py-3 font-medium">Device</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Connection</th>
                        <th className="px-4 py-3 font-medium">Channels</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Health</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockStreams.map(stream => (
                        <tr key={stream.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                stream.deviceType === 'drone' ? 'bg-purple-500/20' : 
                                stream.deviceType === 'camera' ? 'bg-blue-500/20' : 'bg-orange-500/20'
                              }`}>
                                <DeviceIcon deviceType={stream.deviceType} className={`w-4 h-4 ${
                                  stream.deviceType === 'drone' ? 'text-purple-400' : 
                                  stream.deviceType === 'camera' ? 'text-blue-400' : 'text-orange-400'
                                }`} />
                              </div>
                              <div>
                                <p className="text-white font-medium">{stream.name}</p>
                                <p className="text-xs text-slate-500">{stream.type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 capitalize">{stream.deviceType}</td>
                          <td className="px-4 py-3 text-slate-400">{stream.connectionType}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                              {stream.channelCost || 1} ch
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              stream.status === 'active' ? 'bg-green-500/20 text-green-400' :
                              stream.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {stream.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${
                                  stream.health > 80 ? 'bg-green-500' : stream.health > 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`} style={{ width: `${stream.health}%` }} />
                              </div>
                              <span className="text-xs text-slate-400">{stream.health}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => openDeviceConfig(stream)}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg flex items-center gap-1 ml-auto"
                            >
                              <Settings className="w-3 h-3" />
                              Configure
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* BILLING TAB */}
            {channelTab === 'billing' && (
              <div className="space-y-6">
                {/* Current Plan */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Rate per Channel</p>
                    <p className="text-3xl font-bold text-white">€{customerChannelData.channelRate}<span className="text-lg text-slate-400">/mo</span></p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Monthly Total</p>
                    <p className="text-3xl font-bold text-green-400">€{customerChannelData.monthlyTotal}</p>
                    <p className="text-xs text-slate-500 mt-1">{customerChannelData.channelsAllocated} channels × €{customerChannelData.channelRate}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Next Billing</p>
                    <p className="text-2xl font-bold text-white">{customerChannelData.nextBilling}</p>
                    <p className="text-xs text-slate-500 mt-1">Auto-renewal enabled</p>
                  </div>
                </div>
                
                {/* Channel Cost Breakdown */}
                <div className="bg-slate-800/30 rounded-xl p-5">
                  <h4 className="text-white font-medium mb-4">Cost Breakdown by Device Type</h4>
                  <div className="space-y-3">
                    {[
                      { type: 'Drones', count: mockStreams.filter(s => s.deviceType === 'drone').length, chPer: 8, color: 'purple' },
                      { type: 'PTZ Cameras', count: mockStreams.filter(s => s.deviceType === 'camera' && s.isControllable).length, chPer: 2, color: 'blue' },
                      { type: 'Fixed Cameras', count: mockStreams.filter(s => s.deviceType === 'camera' && !s.isControllable).length, chPer: 1, color: 'cyan' },
                      { type: 'Sensors', count: mockStreams.filter(s => s.deviceType === 'sensor').length, chPer: 1, color: 'orange' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 bg-${item.color}-500 rounded`} />
                          <span className="text-slate-300">{item.type}</span>
                          <span className="text-xs text-slate-500">({item.count} × {item.chPer} ch)</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-medium">{item.count * item.chPer} ch</span>
                          <span className="text-slate-500 ml-2">€{item.count * item.chPer * customerChannelData.channelRate}/mo</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-600">
                      <span className="text-white font-medium">Total</span>
                      <span className="text-green-400 font-bold text-lg">€{customerChannelData.monthlyTotal}/mo</span>
                    </div>
                  </div>
                </div>
                
                {/* Request More */}
                <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 rounded-xl p-5 border border-orange-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Need More Channels?</h4>
                      <p className="text-sm text-slate-400 mt-1">Contact Watchtower to increase your allocation or discuss volume discounts.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Request Channels
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* PROTOCOLS TAB */}
            {channelTab === 'protocols' && (
              <div className="space-y-6">
                <p className="text-sm text-slate-400">Supported protocols and standards for device configuration. Click on a device in the Devices tab to configure these settings.</p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Video Protocols */}
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Video className="w-5 h-5 text-blue-400" />
                      </div>
                      <h4 className="text-white font-medium">Video & Camera</h4>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div><p className="text-slate-300 font-medium">Streaming</p><p className="text-slate-500">RTSP, RTMP, HLS, WebRTC, MPEG-DASH, SRT, NDI</p></div>
                      <div><p className="text-slate-300 font-medium">Codecs</p><p className="text-slate-500">H.264, H.265/HEVC, VP9, AV1, MJPEG</p></div>
                      <div><p className="text-slate-300 font-medium">Standards</p><p className="text-slate-500">ONVIF S/T/G, PSIA, ISAPI, CGI</p></div>
                      <div><p className="text-slate-300 font-medium">PTZ Control</p><p className="text-slate-500">VISCA, Pelco-D/P, ONVIF PTZ</p></div>
                    </div>
                  </div>
                  
                  {/* Network Protocols */}
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-green-400" />
                      </div>
                      <h4 className="text-white font-medium">Network</h4>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div><p className="text-slate-300 font-medium">Wired</p><p className="text-slate-500">Ethernet, Fiber, PoE/PoE+/PoE++</p></div>
                      <div><p className="text-slate-300 font-medium">WiFi</p><p className="text-slate-500">802.11 a/b/g/n/ac/ax (WiFi 4/5/6/6E)</p></div>
                      <div><p className="text-slate-300 font-medium">Cellular</p><p className="text-slate-500">4G LTE, LTE-A, 5G NR, 5G mmWave</p></div>
                      <div><p className="text-slate-300 font-medium">Satellite</p><p className="text-slate-500">Starlink, Iridium, VSAT, BGAN</p></div>
                    </div>
                  </div>
                  
                  {/* IoT Protocols */}
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Thermometer className="w-5 h-5 text-orange-400" />
                      </div>
                      <h4 className="text-white font-medium">IoT & Sensors</h4>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div><p className="text-slate-300 font-medium">Messaging</p><p className="text-slate-500">MQTT, CoAP, AMQP, WebSocket, LwM2M</p></div>
                      <div><p className="text-slate-300 font-medium">Industrial</p><p className="text-slate-500">Modbus RTU/TCP, BACnet, OPC-UA, PROFINET</p></div>
                      <div><p className="text-slate-300 font-medium">LPWAN</p><p className="text-slate-500">LoRa, LoRaWAN, Sigfox, NB-IoT, LTE-M</p></div>
                      <div><p className="text-slate-300 font-medium">Data Formats</p><p className="text-slate-500">JSON, XML, Protobuf, MessagePack, CBOR</p></div>
                    </div>
                  </div>
                  
                  {/* Drone Protocols */}
                  <div className="bg-slate-800/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-purple-400" />
                      </div>
                      <h4 className="text-white font-medium">Drone & UAV</h4>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div><p className="text-slate-300 font-medium">Flight Control</p><p className="text-slate-500">MAVLink 2.0, DJI SDK, PX4, ArduPilot</p></div>
                      <div><p className="text-slate-300 font-medium">Telemetry</p><p className="text-slate-500">900MHz, 2.4GHz, 5.8GHz, LTE/5G</p></div>
                      <div><p className="text-slate-300 font-medium">Navigation</p><p className="text-slate-500">GPS, GLONASS, Galileo, BeiDou, RTK</p></div>
                      <div><p className="text-slate-300 font-medium">Compliance</p><p className="text-slate-500">FAA Remote ID, EU U-Space, ASTM F3411</p></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* AI Control Panel Section */}
      {activeSection === 'aicontrol' && (
        <div className="space-y-6">
          {/* System Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                <span className={`text-xs px-2 py-0.5 rounded ${systemMetrics.totalCpu > 80 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {systemMetrics.totalCpu > 80 ? 'High' : 'Normal'}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{systemMetrics.totalCpu}%</p>
              <p className="text-xs text-slate-400">CPU Usage</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Database className="w-5 h-5 text-purple-400" />
                <span className={`text-xs px-2 py-0.5 rounded ${systemMetrics.totalMemory > 85 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {systemMetrics.totalMemory > 85 ? 'High' : 'Normal'}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{systemMetrics.totalMemory}%</p>
              <p className="text-xs text-slate-400">Memory Usage</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-green-400" />
                <span className={`text-xs px-2 py-0.5 rounded ${systemMetrics.totalGpu > 90 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {systemMetrics.totalGpu > 90 ? 'High' : 'Normal'}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{systemMetrics.totalGpu}%</p>
              <p className="text-xs text-slate-400">GPU Usage</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-orange-400" />
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Live</span>
              </div>
              <p className="text-2xl font-bold text-white">{systemMetrics.activeModels}</p>
              <p className="text-xs text-slate-400">Active Models</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Timer className="w-5 h-5 text-cyan-400" />
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">{systemMetrics.uptime}</span>
              </div>
              <p className="text-2xl font-bold text-white">{systemMetrics.avgLatency}</p>
              <p className="text-xs text-slate-400">Avg Latency</p>
            </div>
          </div>

          {/* AI Process Monitoring */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">AI Process Monitor</h3>
                  <p className="text-xs text-slate-400">{aiProcesses.filter(p => p.status === 'running').length} of {aiProcesses.length} processes running</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Play className="w-3 h-3" /> Start All
                </button>
                <button className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium flex items-center gap-1">
                  <Pause className="w-3 h-3" /> Pause All
                </button>
                <button className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Restart All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/30 text-xs text-slate-400">
                    <th className="text-left p-3 font-medium">Process</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Priority</th>
                    <th className="text-center p-3 font-medium">CPU</th>
                    <th className="text-center p-3 font-medium">Memory</th>
                    <th className="text-center p-3 font-medium">GPU</th>
                    <th className="text-center p-3 font-medium">FPS</th>
                    <th className="text-center p-3 font-medium">Devices</th>
                    <th className="text-center p-3 font-medium">Alerts</th>
                    <th className="text-left p-3 font-medium">Uptime</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {aiProcesses.map(process => (
                    <tr key={process.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${process.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                          <span className="text-sm text-white font-medium">{process.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          process.status === 'running' ? 'bg-green-500/20 text-green-400' : 
                          process.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' : 
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {process.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          process.priority === 'critical' ? 'bg-red-500/20 text-red-400' : 
                          process.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : 
                          process.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {process.priority}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${process.cpu > 80 ? 'bg-red-500' : process.cpu > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{width: `${process.cpu}%`}} />
                          </div>
                          <span className="text-xs text-slate-400 w-8">{process.cpu}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs text-slate-300">{process.memory} GB</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${process.gpu > 80 ? 'bg-red-500' : process.gpu > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{width: `${process.gpu}%`}} />
                          </div>
                          <span className="text-xs text-slate-400 w-8">{process.gpu}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs text-slate-300">{process.fps}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs text-slate-300">{process.devices}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs ${process.alerts > 10 ? 'text-orange-400' : 'text-slate-300'}`}>{process.alerts}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-slate-400">{process.uptime}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {process.status === 'running' ? (
                            <button className="p-1.5 hover:bg-yellow-500/20 rounded text-yellow-400" title="Pause">
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button className="p-1.5 hover:bg-green-500/20 rounded text-green-400" title="Start">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button className="p-1.5 hover:bg-blue-500/20 rounded text-blue-400" title="Restart">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-slate-600 rounded text-slate-400" title="Configure">
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Port Control Panel */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Port Control Panel</h3>
                  <p className="text-xs text-slate-400">{aiPorts.filter(p => p.status === 'open').length} ports open • Network I/O: {systemMetrics.networkIn} in / {systemMetrics.networkOut} out</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Port
                </button>
                <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Firewall Rules
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/30 text-xs text-slate-400">
                    <th className="text-left p-3 font-medium">Port</th>
                    <th className="text-left p-3 font-medium">Service</th>
                    <th className="text-left p-3 font-medium">Protocol</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">SSL/TLS</th>
                    <th className="text-center p-3 font-medium">Connections</th>
                    <th className="text-right p-3 font-medium">Bandwidth</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {aiPorts.map(port => (
                    <tr key={port.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="p-3">
                        <span className="font-mono text-sm text-orange-400 font-bold">{port.port}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-white">{port.service}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300 font-mono">{port.protocol}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          port.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {port.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {port.ssl ? (
                          <Lock className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-sm text-slate-300">{port.connections}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm text-slate-300 font-mono">{port.bandwidth}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 hover:bg-slate-600 rounded text-slate-400" title="Monitor">
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-slate-600 rounded text-slate-400" title="Configure">
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-red-500/20 rounded text-red-400" title="Close Port">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Feature Controls */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">AI Feature Controls</h3>
                  <p className="text-xs text-slate-400">Enable or disable AI system features</p>
                </div>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(aiFeatureControls).map(([key, enabled]) => {
                const featureInfo = {
                  autoScaling: { name: 'Auto Scaling', desc: 'Automatically scale resources based on load', icon: TrendingUp, category: 'Performance' },
                  loadBalancing: { name: 'Load Balancing', desc: 'Distribute inference across multiple GPUs', icon: Layers, category: 'Performance' },
                  failover: { name: 'Automatic Failover', desc: 'Switch to backup systems on failure', icon: RefreshCw, category: 'Reliability' },
                  alertAggregation: { name: 'Alert Aggregation', desc: 'Group similar alerts to reduce noise', icon: Bell, category: 'Alerts' },
                  smartPrioritization: { name: 'Smart Prioritization', desc: 'AI-driven alert priority assignment', icon: Target, category: 'Alerts' },
                  predictiveMaintenance: { name: 'Predictive Maintenance', desc: 'Predict equipment failures before they occur', icon: Activity, category: 'Maintenance' },
                  autoRetrain: { name: 'Auto Model Retrain', desc: 'Automatically retrain models with new data', icon: Cpu, category: 'Models' },
                  edgeOptimization: { name: 'Edge Optimization', desc: 'Optimize models for edge deployment', icon: Server, category: 'Performance' },
                  bandwidthThrottling: { name: 'Bandwidth Throttling', desc: 'Limit bandwidth during peak hours', icon: Gauge, category: 'Network' },
                  nightModeEnhancement: { name: 'Night Mode Enhancement', desc: 'Enhanced detection in low light', icon: Eye, category: 'Detection' },
                  weatherAdaptation: { name: 'Weather Adaptation', desc: 'Adjust detection for weather conditions', icon: CloudRain, category: 'Detection' },
                  crowdDensityAnalysis: { name: 'Crowd Density Analysis', desc: 'Analyze crowd patterns and density', icon: Users, category: 'Detection' },
                }[key];
                
                const IconComponent = featureInfo?.icon || Settings;
                
                return (
                  <div 
                    key={key}
                    className={`p-4 rounded-xl border transition-all ${
                      enabled 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          enabled ? 'bg-green-500/20' : 'bg-slate-700'
                        }`}>
                          <IconComponent className={`w-5 h-5 ${enabled ? 'text-green-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <p className={`font-medium text-sm ${enabled ? 'text-white' : 'text-slate-300'}`}>
                            {featureInfo?.name || key}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{featureInfo?.desc || ''}</p>
                          <span className="text-[10px] text-slate-600 mt-1 inline-block">{featureInfo?.category}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setAiFeatureControls({...aiFeatureControls, [key]: !enabled})}
                        className={`relative w-11 h-6 rounded-full transition-all ${
                          enabled ? 'bg-green-500' : 'bg-slate-600'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          enabled ? 'left-6' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-orange-500/50 transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-orange-400" />
                </div>
                <span className="text-white font-medium">Restart All AI</span>
              </div>
              <p className="text-xs text-slate-500">Restart all AI processes</p>
            </button>
            <button className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-blue-500/50 transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-white font-medium">Update Models</span>
              </div>
              <p className="text-xs text-slate-500">Download latest model versions</p>
            </button>
            <button className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-green-500/50 transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-white font-medium">Run Diagnostics</span>
              </div>
              <p className="text-xs text-slate-500">Check system health</p>
            </button>
            <button className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-purple-500/50 transition-all text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-white font-medium">Export Logs</span>
              </div>
              <p className="text-xs text-slate-500">Download AI system logs</p>
            </button>
          </div>
        </div>
      )}

      {/* Organization Section */}
      {activeSection === 'organization' && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Organization Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-500">Name</p><p className="text-white">{orgData.name}</p></div>
              <div><p className="text-xs text-slate-500">Region</p><p className="text-white">{orgData.region}</p></div>
              <div><p className="text-xs text-slate-500">Plan</p><p className="text-white">{orgData.tier}</p></div>
              <div><p className="text-xs text-slate-500">Contract End</p><p className="text-white">{orgData.contractEnd}</p></div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Account Manager</h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-xl font-bold">PM</div>
              <div>
                <p className="text-lg font-medium text-white">{orgData.accountManager}</p>
                <p className="text-sm text-slate-400">{orgData.accountManagerEmail}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capabilities Section */}
      {activeSection === 'capabilities' && (
        <div className="space-y-6">
          {/* Product Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Edge AI Box */}
            <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Cpu className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Watchtower AI Box</h3>
                  <p className="text-xs text-slate-400">Hardware + Operations Platform</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 mb-3">Physical edge computing device for on-premise AI processing, drone operations, and flight control.</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-purple-400 font-medium">30 capabilities</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
              </div>
            </div>

            {/* AI Software */}
            <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Watchtower AI Software</h3>
                  <p className="text-xs text-slate-400">Cloud Detection Platform</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 mb-3">AI-powered detection, classification, alerting, and analytics platform accessible via web dashboard.</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-blue-400 font-medium">13 capabilities</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
              </div>
            </div>
          </div>

          {/* Edge AI Box Capabilities */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Cpu className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Watchtower AI Box Capabilities</h3>
                <p className="text-xs text-slate-400">Hardware + Operations Platform</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Operations & Control */}
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Radio className="w-3 h-3" /> Operations & Control
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {edgeBoxCapabilities.filter(c => c.category === 'Operations').map(cap => (
                    <div key={cap.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{cap.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detection & Sensing */}
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Eye className="w-3 h-3" /> Detection & Sensing
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {edgeBoxCapabilities.filter(c => c.category === 'Detection').map(cap => (
                    <div key={cap.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{cap.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flight Control */}
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Target className="w-3 h-3" /> Flight Control
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {edgeBoxCapabilities.filter(c => c.category === 'Flight Control').map(cap => (
                    <div key={cap.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{cap.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety & Tracking */}
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Shield className="w-3 h-3" /> Safety, Security & Tracking
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {edgeBoxCapabilities.filter(c => ['Safety', 'Security', 'Tracking'].includes(c.category)).map(cap => (
                    <div key={cap.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{cap.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI & Maintenance */}
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Activity className="w-3 h-3" /> AI, Maintenance & Data
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {edgeBoxCapabilities.filter(c => ['AI', 'Maintenance', 'Data', 'Connectivity', 'Integration', 'Hardware'].includes(c.category)).map(cap => (
                    <div key={cap.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{cap.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Software Capabilities */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Watchtower AI Software Capabilities</h3>
                <p className="text-xs text-slate-400">Cloud Detection Platform</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {aiSoftwareCapabilities.map(cap => (
                <div key={cap.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">{cap.name}</span>
                  <span className="ml-auto px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">{cap.category}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom AI Modules */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Server className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Custom AI Modules</h3>
                  <p className="text-xs text-slate-400">Industry-specific detection models (Extra Tasks)</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {customAIModules.map(mod => (
                <div key={mod.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Server className="w-4 h-4 text-orange-400" />
                    <div>
                      <span className="text-sm text-slate-300 block">{mod.name}</span>
                      <span className="text-xs text-slate-500">{mod.industry}</span>
                    </div>
                  </div>
                  <button className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded text-xs text-orange-400">
                    Quote
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Section */}
      {activeSection === 'notifications' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4">Alert Channels</h3>
          <p className="text-sm text-slate-400 mb-4">Configure how you receive detection alerts (Multi-channel alerting included)</p>
          <div className="space-y-3">
            {[
              { name: 'Dashboard notifications', enabled: true },
              { name: 'Email alerts', enabled: true },
              { name: 'SMS alerts', enabled: false },
              { name: 'API/Webhook integration', enabled: true },
              { name: 'Critical alerts only', enabled: false },
              { name: 'Daily summary reports', enabled: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm text-slate-300">{item.name}</span>
                <button className={`w-12 h-6 rounded-full relative ${item.enabled ? 'bg-orange-500' : 'bg-slate-600'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${item.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Section */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Security & Encryption</h3>
            <p className="text-sm text-slate-400 mb-4">Secure telemetry and encrypted communications (Included)</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-white">End-to-end encryption</span>
                </div>
                <span className="text-xs text-green-400">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-white">Role-based access control</span>
                </div>
                <span className="text-xs text-green-400">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-white">Two-factor authentication</span>
                </div>
                <span className="text-xs text-green-400">Active</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">API Access</h3>
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <span className="text-sm text-slate-400">API Key:</span>
              <code className="flex-1 text-sm text-slate-300 font-mono">fe_****************************3k9m</code>
              <button className="p-2 hover:bg-slate-700 rounded"><Copy className="w-4 h-4 text-slate-400" /></button>
              <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white">Regenerate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
