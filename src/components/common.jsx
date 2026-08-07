import {
  Video, Thermometer, Camera, Flame, Wifi, Globe, RefreshCw, Cpu, Maximize2, Grid, User, Battery, Square, Minus
} from 'lucide-react';


// ============================================
// COMPONENTS
// ============================================

export const Logo = () => (
  <div className="flex items-center gap-2">
    <div className="h-8 w-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
      <Flame className="w-5 h-5 text-white" />
    </div>
    <span className="font-bold text-xl"><span className="text-orange-500">Watch</span><span className="text-slate-100">tower</span></span>
  </div>
);

// Device Icon Component
export const DeviceIcon = ({ deviceType, className = "w-5 h-5" }) => {
  if (deviceType === 'drone') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" />
        <path d="M2 12h4M18 12h4M12 2v4M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83M16.24 7.76l2.83-2.83M4.93 19.07l2.83-2.83M16.24 16.24l2.83 2.83" />
      </svg>
    );
  }
  if (deviceType === 'camera') return <Camera className={className} />;
  if (deviceType === 'sensor') return <Thermometer className={className} />;
  return <Video className={className} />;
};

export const getDeviceColor = (deviceType) => {
  if (deviceType === 'drone') return 'text-purple-400';
  if (deviceType === 'camera') return 'text-blue-400';
  if (deviceType === 'sensor') return 'text-orange-400';
  return 'text-slate-400';
};

export const getDeviceBgColor = (deviceType, status) => {
  if (status !== 'active') return 'bg-slate-700';
  if (deviceType === 'drone') return 'bg-purple-500/20';
  if (deviceType === 'camera') return 'bg-blue-500/20';
  if (deviceType === 'sensor') return 'bg-orange-500/20';
  return 'bg-slate-700';
};

export const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>{status}</span>;
};

export const RoleBadge = ({ role }) => {
  const styles = { admin: 'bg-purple-500/20 text-purple-400', operator: 'bg-blue-500/20 text-blue-400', viewer: 'bg-slate-500/20 text-slate-400' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[role]}`}>{role}</span>;
};

export const HealthBar = ({ value }) => {
  const color = value >= 90 ? 'bg-green-500' : value >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8">{value}%</span>
    </div>
  );
};

// Connection Type Icon
export const ConnectionIcon = ({ type, className = "w-4 h-4" }) => {
  switch(type) {
    case '4G LTE':
    case '5G':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 20h.01M7 20v-4M12 20v-8M17 20v-12M22 20v-16" />
        </svg>
      );
    case 'WiFi':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
        </svg>
      );
    case 'LAN':
    case 'Fiber':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" />
          <path d="M6 6h.01M6 18h.01" />
        </svg>
      );
    default:
      return <Wifi className={className} />;
  }
};

// Signal Strength Indicator
export const SignalStrength = ({ strength, showLabel = true }) => {
  const bars = 4;
  const activeBars = Math.ceil((strength / 100) * bars);
  const color = strength >= 70 ? 'bg-green-500' : strength >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-end gap-0.5 h-4">
        {[1, 2, 3, 4].map(bar => (
          <div
            key={bar}
            className={`w-1 rounded-sm ${bar <= activeBars ? color : 'bg-slate-600'}`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </div>
      {showLabel && <span className="text-xs text-slate-400">{strength}%</span>}
    </div>
  );
};

// Processing Location Badge
export const ProcessingBadge = ({ location, edgeBoxId }) => {
  if (location === 'edge') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
        <Cpu className="w-3 h-3" />
        Edge {edgeBoxId ? `(${edgeBoxId})` : ''}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
      <Globe className="w-3 h-3" />
      Cloud
    </span>
  );
};

// Connection Type Badge
export const ConnectionBadge = ({ type, strength }) => {
  const colors = {
    '5G': 'bg-green-500/20 text-green-400',
    '4G LTE': 'bg-blue-500/20 text-blue-400',
    'WiFi': 'bg-yellow-500/20 text-yellow-400',
    'LAN': 'bg-slate-500/20 text-slate-400',
    'Fiber': 'bg-purple-500/20 text-purple-400',
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[type] || colors['LAN']}`}>
        <ConnectionIcon type={type} className="w-3 h-3" />
        {type}
      </span>
      {strength > 0 && <SignalStrength strength={strength} showLabel={false} />}
    </div>
  );
};

// Control Mode Badge - Watchtower Autonomous vs Manual Human Control
export const ControlModeBadge = ({ mode, pilot, showToggle = false, onToggle }) => {
  if (mode === null) return null; // Not applicable for cameras/sensors
  
  const isAutonomous = mode === 'watchtower';
  
  return (
    <div className="flex items-center gap-2">
      {showToggle ? (
        <button
          onClick={onToggle}
          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            isAutonomous 
              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
              : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
          }`}
        >
          {isAutonomous ? (
            <>
              <Flame className="w-4 h-4" />
              <span className="text-xs font-medium">Watchtower Auto</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">Manual Control</span>
                {pilot && <span className="text-[10px] opacity-75">Pilot: {pilot}</span>}
              </div>
            </>
          )}
          <div className="w-px h-4 bg-current opacity-30 mx-1" />
          <RefreshCw className="w-3 h-3 opacity-60" />
        </button>
      ) : (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
          isAutonomous 
            ? 'bg-orange-500/20 text-orange-400' 
            : 'bg-cyan-500/20 text-cyan-400'
        }`}>
          {isAutonomous ? (
            <>
              <Flame className="w-3 h-3" />
              <span>Watchtower AI</span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              <div className="flex flex-col">
                <span>Manual</span>
                {pilot && <span className="text-[10px] opacity-75">{pilot}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Battery Indicator
export const BatteryIndicator = ({ level }) => {
  if (level === null) return null;
  const color = level > 50 ? 'text-green-400' : level > 20 ? 'text-yellow-400' : 'text-red-400';
  const bgColor = level > 50 ? 'bg-green-500' : level > 20 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-6 h-3 border border-current rounded-sm flex items-center p-0.5">
        <div className={`h-full rounded-sm ${bgColor}`} style={{ width: `${level}%` }} />
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0.5 h-1.5 bg-current rounded-r-sm" />
      </div>
      <span className={`text-xs font-medium ${color}`}>{level}%</span>
    </div>
  );
};

// ============================================
// VIEW SIZE CONFIGURATIONS
// ============================================

export const VIEW_SIZES = {
  minimized: {
    name: 'Minimized',
    icon: 'Minus',
    width: 200,
    height: 40,
    showVideo: false,
    showStats: false,
    description: 'Title bar only - saves resources'
  },
  thumbnail: {
    name: 'Thumbnail',
    icon: 'Grid',
    width: 240,
    height: 180,
    showVideo: true,
    showStats: false,
    description: 'Small preview - low resources'
  },
  small: {
    name: 'Small',
    icon: 'Square',
    width: 320,
    height: 240,
    showVideo: true,
    showStats: true,
    description: 'Compact view with stats'
  },
  medium: {
    name: 'Medium',
    icon: 'RectangleHorizontal',
    width: 480,
    height: 360,
    showVideo: true,
    showStats: true,
    description: 'Balanced view'
  },
  large: {
    name: 'Large',
    icon: 'Maximize',
    width: 720,
    height: 540,
    showVideo: true,
    showStats: true,
    description: 'Detailed view'
  },
  fullscreen: {
    name: 'Fullscreen',
    icon: 'Maximize2',
    width: '100%',
    height: '100%',
    showVideo: true,
    showStats: true,
    description: 'Full screen - maximum detail'
  }
};

// View Size Selector Component
export const ViewSizeSelector = ({ currentSize, onSizeChange, compact = false }) => {
  const sizes = ['minimized', 'thumbnail', 'small', 'medium', 'large'];
  
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {sizes.map((size, index) => (
          <button
            key={size}
            onClick={() => onSizeChange(size)}
            className={`w-5 h-3 rounded-sm transition-all ${
              currentSize === size 
                ? 'bg-orange-500' 
                : 'bg-slate-600 hover:bg-slate-500'
            }`}
            style={{ transform: `scale(${0.6 + (index * 0.1)})` }}
            title={VIEW_SIZES[size].name}
          />
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
      {sizes.map(size => (
        <button
          key={size}
          onClick={() => onSizeChange(size)}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            currentSize === size 
              ? 'bg-orange-500 text-white' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
          title={VIEW_SIZES[size].description}
        >
          {VIEW_SIZES[size].name}
        </button>
      ))}
    </div>
  );
};
