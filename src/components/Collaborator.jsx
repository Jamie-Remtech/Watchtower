import { useState, useEffect, useRef } from 'react';
import {
  Video, Phone, Radio, Grid, Layers, Map, Wind, Compass, Info
} from 'lucide-react';
import { Logo } from './common';
import { ACTIVE_OPERATION, C, MESSAGES, NAVIGATION_POINTS, QUICK_STATUS, ROLE_OPTIONS, STREAMS, TEAM_POSITIONS } from '../data/collaboratorData';
import { CommsTab } from '../tabs/CommsTab';
import { StreamsTab } from '../tabs/StreamsTab';


// ============================================================================
// MAIN APP
// ============================================================================
export const WatchtowerCollaborator = ({ onJoinOperation, onStatusUpdate, onReportSubmit, onMessageSend, onLocationUpdate, embeddedMode } = {}) => {
  const [screen, setScreen] = useState('onboard'); // onboard | main
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [alertActive, setAlertActive] = useState(true);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [myStatus, setMyStatus] = useState('ok');
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [selectedNavPoint, setSelectedNavPoint] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [activeChannel, setActiveChannel] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState(null);
  const [alertExpanded, setAlertExpanded] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportStep, setReportStep] = useState('type'); // type | capture | confirm
  const [reportType, setReportType] = useState(null);
  const [reportMode, setReportMode] = useState('report'); // 'report' | 'support'
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [reportCaptures, setReportCaptures] = useState([]);
  const [reportNote, setReportNote] = useState('');
  const [reportLocation, setReportLocation] = useState(null);
  const [reportSent, setReportSent] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPanX, setMapPanX] = useState(0);
  const [mapPanY, setMapPanY] = useState(0);
  const [showDpad, setShowDpad] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [mapMode, setMapMode] = useState('satellite');
  const [mapLayers, setMapLayers] = useState({ fire: true, personnel: true, wind: true, grid: true, evac: false });
  const [showMapLayers, setShowMapLayers] = useState(false);
  const [showMapModes, setShowMapModes] = useState(false);
  const [mapMeasure, setMapMeasure] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const compassRef = useRef(null);
  const compassNavRef = useRef(null);
  const compassBearingRef = useRef(0);

  // Animate compass via ref — no state re-renders
  useEffect(() => {
    const interval = setInterval(() => {
      compassBearingRef.current = (compassBearingRef.current + 0.3) % 360;
      const rot = `rotate(${compassBearingRef.current}deg)`;
      if (compassRef.current) compassRef.current.style.transform = rot;
      if (compassNavRef.current) compassNavRef.current.style.transform = rot;
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // ============================================================================
  // ONBOARDING — 2 steps, instant join
  // ============================================================================
  if (screen === 'onboard') {
    return (
      <div style={{
        minHeight: embeddedMode ? '100%' : '100vh', height: embeddedMode ? '100%' : 'auto',
        background: C.bg, color: C.text,
        display: 'flex', flexDirection: 'column', fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        overflow: 'auto', position: 'relative',
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          input { font-family: 'Outfit', sans-serif; }
          @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(249,115,22,0.3); } 50% { box-shadow: 0 0 40px rgba(249,115,22,0.6); } }
          @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes emergencyPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
          @keyframes radarSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes compassNeedle { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        `}</style>

        {/* Emergency header bar */}
        <div style={{
          background: `linear-gradient(135deg, ${C.critical} 0%, #991b1b 100%)`,
          padding: '12px 16px', textAlign: 'center',
          animation: 'none',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, opacity: 0.9, fontFamily: "'JetBrains Mono', monospace" }}>
            ● ACTIVE EMERGENCY OPERATION
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', animation: 'slideUp 0.5s ease-out' }}>
            <div style={{ fontSize: 48, marginBottom: 4 }}>🦅</div>
            <div style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 900,
              background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentGlow} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: -0.5,
            }}>WATCHTOWER</div>
            <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 4, fontWeight: 600, marginTop: 2 }}>
              COLLABORATOR
            </div>
          </div>

          {/* Operation info */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16,
            animation: 'slideUp 0.6s ease-out',
          }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
              ACTIVE OPERATION
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {ACTIVE_OPERATION.name}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: C.textMuted }}>
              <span>📍 {ACTIVE_OPERATION.commandPost.name.split('—')[0]}</span>
              <span>🔥 {ACTIVE_OPERATION.perimeter}</span>
              <span style={{ color: C.critical, fontWeight: 700 }}>● {ACTIVE_OPERATION.fireRiskIndex}</span>
            </div>
          </div>

          {/* Name input */}
          <div style={{ animation: 'slideUp 0.7s ease-out' }}>
            <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              YOUR NAME
            </label>
            <input
              type="text"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: '100%', padding: '16px', background: C.surfaceRaised, border: `2px solid ${C.border}`,
                borderRadius: 12, color: C.text, fontSize: 18, fontWeight: 600, outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          {/* Role selection */}
          <div style={{ animation: 'slideUp 0.8s ease-out' }}>
            <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              YOUR ROLE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ROLE_OPTIONS.map(role => (
                <button key={role.id} onClick={() => setUserRole(role.id)} style={{
                  padding: '14px 12px', background: userRole === role.id ? `${C.accent}22` : C.surfaceRaised,
                  border: `2px solid ${userRole === role.id ? C.accent : C.border}`,
                  borderRadius: 12, color: C.text, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{role.icon}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700 }}>{role.label}</div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{role.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Join button */}
        <div style={{ padding: '16px 20px 32px', animation: 'slideUp 0.9s ease-out' }}>
          <button
            onClick={() => { if (userName.trim() && userRole) { setScreen('main'); if (onJoinOperation) onJoinOperation({ name: userName.trim(), role: userRole, joinedAt: new Date().toLocaleTimeString() }); } }}
            disabled={!userName.trim() || !userRole}
            style={{
              width: '100%', padding: '20px', border: 'none', borderRadius: 14, cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: 1,
              color: '#fff',
              background: userName.trim() && userRole
                ? `linear-gradient(135deg, ${C.accent} 0%, #ea580c 100%)`
                : C.surfaceRaised,
              opacity: userName.trim() && userRole ? 1 : 0.4,
              animation: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            JOIN OPERATION →
          </button>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: C.textDim, letterSpacing: 1 }}>
            YOUR LOCATION WILL BE SHARED WITH THE TEAM
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN APP — 4 tabs: MAP | STREAMS | COMMS | NAVIGATE
  // ============================================================================

  const currentStatus = QUICK_STATUS.find(s => s.id === myStatus);

  // -- ALERT BANNER (compact top bar — never blocks the screen) --
  const AlertBanner = () => {
    if (alertDismissed || !alertActive) return null;
    return (
      <div style={{ flexShrink: 0 }}>
        {/* Compact banner — always visible, tap to expand */}
        <div
          onClick={() => setAlertExpanded(!alertExpanded)}
          style={{
            background: `linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)`,
            padding: '10px 14px', cursor: 'pointer',
            borderBottom: `1px solid ${C.critical}44`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: '#fff' }}>
                  FIRE DETECTED — 94%
                </div>
                <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 1 }}>
                  Drone M3T · 200m NE of perimeter · {ACTIVE_OPERATION.windDir} {ACTIVE_OPERATION.windSpeed}
                </div>
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); setAlertDismissed(true); }} style={{
              padding: '8px 14px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 8, color: '#fff', fontFamily: "'Outfit', sans-serif",
              fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5,
              flexShrink: 0,
            }}>
              ACKNOWLEDGE ✓
            </button>
          </div>
        </div>

        {/* Expanded detail — quick actions without blocking the view */}
        {alertExpanded && (
          <div style={{
            background: C.surface, borderBottom: `1px solid ${C.border}`,
            padding: '10px 14px', display: 'flex', gap: 8,
          }}>
            <button onClick={() => { setAlertDismissed(true); setAlertExpanded(false); setActiveTab('map'); }} style={{
              flex: 1, padding: '14px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: `${C.accent}22`, color: C.accent,
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800,
            }}>
              📍 MAP
            </button>
            <button onClick={() => { setAlertDismissed(true); setAlertExpanded(false); setActiveTab('navigate'); }} style={{
              flex: 1, padding: '14px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: `${C.success}22`, color: C.success,
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800,
            }}>
              🧭 SAFE ZONE
            </button>
            <button onClick={() => { setAlertDismissed(true); setAlertExpanded(false); setActiveTab('comms'); }} style={{
              flex: 1, padding: '14px 8px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: `${C.info}22`, color: C.info,
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800,
            }}>
              📻 COMMS
            </button>
          </div>
        )}
      </div>
    );
  };

  // -- STATUS QUICK-SEND PANEL --
  const StatusPanel = () => {
    if (!showStatusPanel) return null;
    return (
      <div style={{
        position: embeddedMode ? 'absolute' : 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,14,23,0.9)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        alignItems: 'center',
      }} onClick={() => setShowStatusPanel(false)}>
        <div style={{
          background: C.surface, borderTop: `2px solid ${C.border}`,
          borderRadius: '20px 20px 0 0', padding: '16px 14px 24px',
          width: '100%', maxHeight: '60vh', overflowY: 'auto',
        }} onClick={e => e.stopPropagation()}>
          <div style={{
            width: 40, height: 4, background: C.borderLight, borderRadius: 2,
            margin: '0 auto 12px',
          }} />
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700,
            marginBottom: 12, textAlign: 'center',
          }}>
            QUICK STATUS UPDATE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {QUICK_STATUS.map(status => (
              <button key={status.id} onClick={() => { setMyStatus(status.id); setShowStatusPanel(false); if (onStatusUpdate) onStatusUpdate(status.id); }} style={{
                padding: '12px 6px', border: `2px solid ${myStatus === status.id ? status.color : C.border}`,
                borderRadius: 12, background: myStatus === status.id ? `${status.color}22` : C.surfaceRaised,
                color: status.color, cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.15s ease',
              }}>
                <div style={{ fontSize: 28, marginBottom: 3, lineHeight: 1 }}>{status.icon}</div>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700,
                  letterSpacing: status.id === 'emergency' ? 1 : 0, color: C.text,
                }}>{status.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // -- TAB: MAP --
  const toggleLayer = (key) => setMapLayers(prev => ({ ...prev, [key]: !prev[key] }));

  const MAP_MODES = [
    { id: 'satellite', label: 'SATELLITE', bg: '#0f1a12', gridColor: '#22c55e', gridOpacity: 0.08, terrainColor: '#1a3018', waterColor: '#0c2d4a' },
    { id: 'terrain', label: 'TERRAIN', bg: '#2a2518', gridColor: '#a3a355', gridOpacity: 0.15, terrainColor: '#3d3520', waterColor: '#1a3040' },
    { id: 'road', label: 'ROAD', bg: '#1e2438', gridColor: '#4466aa', gridOpacity: 0.12, terrainColor: '#283050', waterColor: '#1a2850' },
    { id: 'hybrid', label: 'HYBRID', bg: '#0d1810', gridColor: '#33aa55', gridOpacity: 0.1, terrainColor: '#14280f', waterColor: '#0a1e35' },
  ];
  const currentMapMode = MAP_MODES.find(m => m.id === mapMode) || MAP_MODES[0];

  const LAYER_OPTIONS = [
    { key: 'fire', icon: '🔥', label: 'Fire Zones', color: C.critical },
    { key: 'personnel', icon: '👥', label: 'Personnel', color: C.success },
    { key: 'wind', icon: '💨', label: 'Wind', color: C.info },
    { key: 'grid', icon: '▦', label: 'Grid Overlay', color: C.textMuted },
    { key: 'evac', icon: '🚪', label: 'Evac Routes', color: C.purple },
  ];

  // Shared button style for map controls
  const mapBtnStyle = (active = false) => ({
    width: 44, height: 44, borderRadius: 10, border: `1px solid ${active ? C.accent : C.borderLight}`,
    background: active ? `${C.accent}33` : 'rgba(10,14,23,0.85)',
    color: active ? C.accent : '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, backdropFilter: 'blur(4px)',
    fontFamily: "'Outfit', sans-serif",
  });

  // Compute dynamic coordinates based on pan
  const coordLat = (43.377 - mapPanY * 0.001).toFixed(3);
  const coordLng = (2.448 + mapPanX * 0.001).toFixed(3);

  const renderMap = () => {
    const handleDragStart = (x, y) => {
      touchStartRef.current = { x, y };
      panStartRef.current = { x: mapPanX, y: mapPanY };
      setIsDragging(true);
    };
    const handleDragMove = (x, y) => {
      if (!touchStartRef.current) return;
      const dx = (x - touchStartRef.current.x) / mapZoom;
      const dy = (y - touchStartRef.current.y) / mapZoom;
      setMapPanX(panStartRef.current.x + dx);
      setMapPanY(panStartRef.current.y + dy);
    };
    const handleDragEnd = () => {
      touchStartRef.current = null;
      setIsDragging(false);
    };

    return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Map canvas — swipe/drag to pan */}
      <div
        onTouchStart={(e) => { const t = e.touches[0]; handleDragStart(t.clientX, t.clientY); }}
        onTouchMove={(e) => { const t = e.touches[0]; handleDragMove(t.clientX, t.clientY); }}
        onTouchEnd={handleDragEnd}
        onMouseDown={(e) => { if (e.button === 0) handleDragStart(e.clientX, e.clientY); }}
        onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          flex: 1, background: currentMapMode.bg,
          position: 'relative', overflow: 'hidden',
          transition: 'background 0.3s ease', touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {/* Zoomable/pannable content wrapper */}
        <div style={{
          position: 'absolute',
          width: '200%', height: '200%',
          left: '-50%', top: '-50%',
          transform: `scale(${mapZoom}) translate(${mapPanX}px, ${mapPanY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          transformOrigin: 'center center',
        }}>

          {/* Terrain features — visible shapes that change with map mode */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {/* Terrain contour lines */}
            <ellipse cx="45%" cy="35%" rx="18%" ry="12%" fill="none" stroke={currentMapMode.terrainColor} strokeWidth="1" opacity="0.5" />
            <ellipse cx="45%" cy="35%" rx="14%" ry="9%" fill="none" stroke={currentMapMode.terrainColor} strokeWidth="1" opacity="0.4" />
            <ellipse cx="45%" cy="35%" rx="10%" ry="6%" fill="none" stroke={currentMapMode.terrainColor} strokeWidth="1" opacity="0.3" />
            {/* Water body */}
            <ellipse cx="25%" cy="70%" rx="8%" ry="4%" fill={currentMapMode.waterColor} stroke={currentMapMode.waterColor} strokeWidth="1" opacity="0.6" />
            <text x="23%" y="71%" fill={C.info} fontSize="6" opacity="0.5" fontFamily="monospace">Lac</text>
            {/* Road/paths */}
            <line x1="10%" y1="80%" x2="90%" y2="20%" stroke={currentMapMode.gridColor} strokeWidth={mapMode === 'road' ? 2 : 0.5} opacity={mapMode === 'road' ? 0.4 : 0.15} />
            <line x1="20%" y1="15%" x2="80%" y2="85%" stroke={currentMapMode.gridColor} strokeWidth={mapMode === 'road' ? 2 : 0.5} opacity={mapMode === 'road' ? 0.4 : 0.15} />
            {mapMode === 'road' && <>
              <line x1="10%" y1="80%" x2="90%" y2="20%" stroke="#fff" strokeWidth="0.5" opacity="0.15" strokeDasharray="4,8" />
              <line x1="20%" y1="15%" x2="80%" y2="85%" stroke="#fff" strokeWidth="0.5" opacity="0.15" strokeDasharray="4,8" />
              <text x="50%" y="48%" fill={C.textDim} fontSize="5" opacity="0.4" fontFamily="monospace" transform="rotate(-25, 250, 240)">D-6113</text>
              <text x="38%" y="55%" fill={C.textDim} fontSize="5" opacity="0.4" fontFamily="monospace" transform="rotate(35, 190, 275)">D-118</text>
            </>}
            {/* Tree clusters for satellite/hybrid */}
            {(mapMode === 'satellite' || mapMode === 'hybrid') && <>
              <circle cx="30%" cy="25%" r="3%" fill="#0a2210" opacity="0.5" />
              <circle cx="32%" cy="27%" r="2.5%" fill="#0c2a12" opacity="0.4" />
              <circle cx="60%" cy="60%" r="4%" fill="#0a2210" opacity="0.5" />
              <circle cx="63%" cy="58%" r="3%" fill="#0c2a12" opacity="0.4" />
              <circle cx="75%" cy="30%" r="2%" fill="#0a2210" opacity="0.4" />
            </>}
            {/* Terrain elevation labels */}
            {mapMode === 'terrain' && <>
              <text x="44%" y="30%" fill="#8a8540" fontSize="5" opacity="0.5" fontFamily="monospace">940m</text>
              <text x="44%" y="36%" fill="#8a8540" fontSize="5" opacity="0.4" fontFamily="monospace">820m</text>
              <text x="44%" y="41%" fill="#8a8540" fontSize="5" opacity="0.3" fontFamily="monospace">710m</text>
            </>}
          </svg>

          {/* Grid overlay */}
          {mapLayers.grid && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: currentMapMode.gridOpacity }}>
              {Array.from({ length: 40 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={`${i * 2.5}%`} x2="100%" y2={`${i * 2.5}%`} stroke={currentMapMode.gridColor} strokeWidth="0.5" />
              ))}
              {Array.from({ length: 40 }).map((_, i) => (
                <line key={`v${i}`} x1={`${i * 2.5}%`} y1="0" x2={`${i * 2.5}%`} y2="100%" stroke={currentMapMode.gridColor} strokeWidth="0.5" />
              ))}
            </svg>
          )}

          {/* Evac routes */}
          {mapLayers.evac && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <line x1="45%" y1="57%" x2="35%" y2="68%" stroke={C.purple} strokeWidth="2.5" strokeDasharray="8,5" opacity="0.7" />
              <line x1="45%" y1="57%" x2="55%" y2="70%" stroke={C.purple} strokeWidth="2.5" strokeDasharray="8,5" opacity="0.7" />
              <line x1="45%" y1="57%" x2="60%" y2="60%" stroke={C.purple} strokeWidth="2.5" strokeDasharray="8,5" opacity="0.7" />
              <circle cx="35%" cy="68%" r="1.2%" fill={C.purple} opacity="0.4" />
              <circle cx="55%" cy="70%" r="1.2%" fill={C.purple} opacity="0.4" />
              <circle cx="60%" cy="60%" r="1.2%" fill={C.purple} opacity="0.4" />
              <text x="32%" y="71%" fill={C.purple} fontSize="6" fontWeight="700" fontFamily="monospace">EVAC-N</text>
              <text x="52%" y="73%" fill={C.purple} fontSize="6" fontWeight="700" fontFamily="monospace">EVAC-S</text>
              <text x="61%" y="62%" fill={C.purple} fontSize="6" fontWeight="700" fontFamily="monospace">EVAC-E</text>
            </svg>
          )}

          {/* Fire zone */}
          {mapLayers.fire && (
            <div style={{
              position: 'absolute', top: '30%', left: '42%', width: 130, height: 100,
              border: `2px dashed ${C.critical}88`, borderRadius: '40% 60% 50% 40%',
              background: `radial-gradient(ellipse, ${C.critical}18 0%, ${C.critical}08 50%, transparent 70%)`,
            }}>
              {/* Inner hotspot */}
              <div style={{
                position: 'absolute', top: '35%', left: '40%', width: 30, height: 25,
                borderRadius: '50%', background: `radial-gradient(circle, ${C.critical}44 0%, transparent 70%)`,
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                fontSize: 10, color: C.critical, fontWeight: 700, whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono', monospace", textAlign: 'center',
              }}>
                🔥 FIRE ZONE<br />
                <span style={{ fontSize: 9, opacity: 0.7 }}>4.2 ha · Spreading NE</span>
              </div>
            </div>
          )}

          {/* Wind direction */}
          {mapLayers.wind && (
            <div style={{
              position: 'absolute', top: '25%', right: '25%', fontSize: 10, color: C.info,
              fontFamily: "'JetBrains Mono', monospace", textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, transform: 'rotate(225deg)' }}>➤</div>
              <div style={{ fontSize: 9 }}>SW {ACTIVE_OPERATION.windSpeed}</div>
            </div>
          )}

          {/* Team positions */}
          {mapLayers.personnel && TEAM_POSITIONS.map((member, i) => {
            const positions = [
              { top: '52%', left: '38%' },
              { top: '34%', left: '50%' },
              { top: '32%', left: '55%' },
              { top: '48%', left: '32%' },
              { top: '28%', left: '62%' },
              { top: '55%', left: '28%' },
            ];
            return (
              <div key={member.id} style={{
                position: 'absolute', ...positions[i],
                display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: member.status === 'active' ? `${C.success}33` : `${C.warning}33`,
                  border: `2px solid ${member.status === 'active' ? C.success : C.warning}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>{member.icon}</div>
                <div style={{
                  marginTop: 1, padding: '1px 5px', background: 'rgba(10,14,23,0.85)',
                  borderRadius: 3, fontSize: 7, fontWeight: 600, whiteSpace: 'nowrap', color: C.textMuted,
                }}>{member.name.split(' ')[0]}</div>
              </div>
            );
          })}

          {/* YOU indicator */}
          <div style={{
            position: 'absolute', top: '57%', left: '45%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {selectedNavPoint && (() => {
              const typeColors = { command: C.accent, resource: C.info, evacuation: C.success, staging: C.purple, hazard: C.critical };
              const point = NAVIGATION_POINTS.find(p => p.id === selectedNavPoint);
              if (!point) return null;
              const color = typeColors[point.type] || C.accent;
              return (
                <div style={{
                  position: 'absolute', top: -65, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10,
                }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: '50%',
                    background: `${color}33`, border: `3px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 20px ${color}44`,
                  }}>
                    <div style={{ fontSize: 28, color: '#fff', fontWeight: 900, transform: `rotate(${point.bearing}deg)`, lineHeight: 1 }}>↑</div>
                  </div>
                  <div style={{
                    marginTop: 3, padding: '2px 8px', background: color, borderRadius: 5, whiteSpace: 'nowrap',
                    fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 800, color: '#fff',
                  }}>{point.distance} → {point.name.split('—')[0].split('Point')[0].trim()}</div>
                </div>
              );
            })()}
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: `${C.accent}44`,
              border: `3px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.accent }} />
            </div>
            <div style={{
              marginTop: 2, padding: '2px 6px', background: C.accent, borderRadius: 5,
              fontSize: 9, fontWeight: 800, color: '#fff', fontFamily: "'Outfit', sans-serif",
            }}>YOU</div>
          </div>
        </div>

        {/* ===== FIXED CONTROLS (outside zoom/pan wrapper) ===== */}

        {/* Compass rose */}
        <div style={{
          position: 'absolute', top: 12, right: 12, width: 52, height: 52,
          borderRadius: '50%', background: 'rgba(10,14,23,0.85)', border: `1px solid ${C.borderLight}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div ref={compassRef} style={{ transition: 'none' }}>
            <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
              borderBottom: `16px solid ${C.critical}`, position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)' }} />
            <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
              borderTop: `12px solid ${C.textDim}`, position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)' }} />
          </div>
          <div style={{ position: 'absolute', top: 2, fontSize: 7, fontWeight: 800, color: C.critical }}>N</div>
          <div style={{ position: 'absolute', bottom: 2, fontSize: 6, fontWeight: 700, color: C.textDim }}>S</div>
          <div style={{ position: 'absolute', left: 4, fontSize: 6, fontWeight: 700, color: C.textDim }}>W</div>
          <div style={{ position: 'absolute', right: 4, fontSize: 6, fontWeight: 700, color: C.textDim }}>E</div>
        </div>

        {/* Right control strip */}
        <div style={{ position: 'absolute', right: 12, top: 74, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <button onClick={() => setMapZoom(z => Math.min(z + 0.5, 4))} style={mapBtnStyle()}>+</button>
          <div style={{ width: 44, textAlign: 'center', fontSize: 10, fontWeight: 800, color: C.accent,
            fontFamily: "'JetBrains Mono', monospace" }}>{mapZoom.toFixed(1)}x</div>
          <button onClick={() => setMapZoom(z => Math.max(z - 0.5, 0.5))} style={mapBtnStyle()}>−</button>
          <div style={{ height: 1, background: C.borderLight, margin: '1px 0' }} />
          <button onClick={() => { setMapPanX(0); setMapPanY(0); setMapZoom(1); }} style={mapBtnStyle()} title="Reset view">◎</button>
          <button onClick={() => { setShowMapLayers(!showMapLayers); setShowMapModes(false); }} style={mapBtnStyle(showMapLayers)}>
            <span style={{ fontSize: 16 }}>◫</span></button>
          <button onClick={() => { setShowMapModes(!showMapModes); setShowMapLayers(false); }} style={mapBtnStyle(showMapModes)}>
            <span style={{ fontSize: 14 }}>🗺️</span></button>
          <button onClick={() => setMapMeasure(!mapMeasure)} style={mapBtnStyle(mapMeasure)}>
            <span style={{ fontSize: 14 }}>📏</span></button>
        </div>

        {/* Layers popup */}
        {showMapLayers && (
          <div style={{ position: 'absolute', top: 74, right: 64, background: 'rgba(10,14,23,0.95)',
            border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 10, width: 170, backdropFilter: 'blur(8px)' }}>
            <div style={{ fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>LAYERS</div>
            {LAYER_OPTIONS.map(layer => (
              <button key={layer.key} onClick={() => toggleLayer(layer.key)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 6px',
                background: mapLayers[layer.key] ? `${layer.color}15` : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer', color: C.text, marginBottom: 2,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 6,
                  background: mapLayers[layer.key] ? `${layer.color}33` : C.surfaceRaised,
                  border: `2px solid ${mapLayers[layer.key] ? layer.color : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{layer.icon}</div>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700,
                  color: mapLayers[layer.key] ? '#fff' : C.textDim }}>{layer.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Map mode popup */}
        {showMapModes && (
          <div style={{ position: 'absolute', top: 74, right: 64, background: 'rgba(10,14,23,0.95)',
            border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 10, width: 170, backdropFilter: 'blur(8px)' }}>
            <div style={{ fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>MAP TYPE</div>
            {MAP_MODES.map(mode => (
              <button key={mode.id} onClick={() => { setMapMode(mode.id); setShowMapModes(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 6px',
                background: mapMode === mode.id ? `${C.accent}15` : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer', color: C.text, marginBottom: 2,
              }}>
                <div style={{ width: 32, height: 22, borderRadius: 4, background: mode.bg,
                  border: `2px solid ${mapMode === mode.id ? C.accent : C.border}` }} />
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700,
                  color: mapMode === mode.id ? C.accent : C.textDim }}>{mode.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* D-pad toggle + Recenter — bottom center, always visible */}
        <div style={{ position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {/* D-pad — only when toggled on */}
          {showDpad && (
            <div style={{ display: 'grid', gridTemplateColumns: '38px 38px 38px', gridTemplateRows: '38px 38px 38px', gap: 2, opacity: 0.8 }}>
              <div />
              <button onClick={() => setMapPanY(p => p + 50)} style={{...mapBtnStyle(), width: 38, height: 38, fontSize: 14}}>▲</button>
              <div />
              <button onClick={() => setMapPanX(p => p + 50)} style={{...mapBtnStyle(), width: 38, height: 38, fontSize: 14}}>◀</button>
              <button onClick={() => { setMapPanX(0); setMapPanY(0); setMapZoom(1); }} style={{...mapBtnStyle(), width: 38, height: 38, fontSize: 9}}>◎</button>
              <button onClick={() => setMapPanX(p => p - 50)} style={{...mapBtnStyle(), width: 38, height: 38, fontSize: 14}}>▶</button>
              <div />
              <button onClick={() => setMapPanY(p => p - 50)} style={{...mapBtnStyle(), width: 38, height: 38, fontSize: 14}}>▼</button>
              <div />
            </div>
          )}
          {/* Always-visible: recenter + dpad toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setMapPanX(0); setMapPanY(0); setMapZoom(1); }} style={{
              ...mapBtnStyle(), width: 'auto', padding: '0 12px', height: 34, fontSize: 11, gap: 4,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{ fontSize: 14 }}>◎</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700 }}>RECENTER</span>
            </button>
            <button onClick={() => setShowDpad(!showDpad)} style={{
              ...mapBtnStyle(showDpad), width: 'auto', padding: '0 12px', height: 34, fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 14 }}>✥</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700 }}>D-PAD</span>
            </button>
          </div>
        </div>

        {/* Measure mode indicator */}
        {mapMeasure && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            padding: '6px 14px', background: `${C.accent}cc`, borderRadius: 8,
            fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 800, color: '#fff' }}>
            📏 MEASURE MODE — Tap two points
          </div>
        )}

        {/* Operation info — top left */}
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(10,14,23,0.9)',
          border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', maxWidth: 170 }}>
          <div style={{ fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: 1.5 }}>OPERATION</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, marginTop: 2 }}>{ACTIVE_OPERATION.name}</div>
          <div style={{ fontSize: 9, color: C.textDim, marginTop: 4 }}>
            🌡 {ACTIVE_OPERATION.temp} · 💨 {ACTIVE_OPERATION.windDir} {ACTIVE_OPERATION.windSpeed}
          </div>
        </div>

        {/* Legend — bottom left */}
        <div style={{ position: 'absolute', bottom: 76, left: 12, background: 'rgba(10,14,23,0.9)',
          border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 7px',
          fontSize: 7, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mapLayers.fire && <div><span style={{ color: C.critical }}>●</span> Fire Zone</div>}
          {mapLayers.personnel && <div><span style={{ color: C.success }}>●</span> Personnel</div>}
          <div><span style={{ color: C.accent }}>●</span> You</div>
          {mapLayers.wind && <div><span style={{ color: C.info }}>➤</span> Wind</div>}
          {mapLayers.evac && <div><span style={{ color: C.purple }}>╌</span> Evac Routes</div>}
        </div>

        {/* Bottom status bar — shows live coordinates */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 26,
          background: 'rgba(10,14,23,0.92)', borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: C.textDim }}>
          <span>{coordLat}°N {coordLng}°E</span>
          <span style={{ color: currentMapMode.gridColor }}>{currentMapMode.label}</span>
          <span>{mapZoom.toFixed(1)}x · {TEAM_POSITIONS.filter(t => t.status === 'active').length} online</span>
        </div>
      </div>
    </div>
    );
  };

  // -- TAB: STREAMS --
  const StreamsTab = () => (
    <div style={{ flex: 1, padding: 12, overflowY: 'auto', paddingBottom: 80 }}>
      <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
        LIVE FEEDS — {STREAMS.filter(s => s.status === 'live').length} ACTIVE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STREAMS.map(stream => (
          <button key={stream.id} onClick={() => setSelectedStream(selectedStream === stream.id ? null : stream.id)} style={{
            background: C.surface, border: `1px solid ${stream.alert ? C.critical + '66' : C.border}`,
            borderRadius: 14, padding: 0, cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
            color: C.text, width: '100%',
          }}>
            {/* Stream preview */}
            <div style={{
              height: selectedStream === stream.id ? 200 : 100,
              background: stream.type === 'thermal'
                ? 'linear-gradient(135deg, #1a0505 0%, #3d0a0a 30%, #5c1a00 60%, #8b3a00 100%)'
                : 'linear-gradient(135deg, #0a1628 0%, #142240 50%, #1a2d50 100%)',
              position: 'relative', transition: 'height 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {stream.alert && (
                <div style={{
                  position: 'absolute', top: 8, right: 8, padding: '3px 8px',
                  background: C.critical, borderRadius: 6, fontSize: 9, fontWeight: 800,
                }}>
                  🔥 DETECTION
                </div>
              )}
              <div style={{
                position: 'absolute', top: 8, left: 8, padding: '3px 8px',
                background: 'rgba(0,0,0,0.6)', borderRadius: 6, fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
                LIVE
              </div>
              {stream.type === 'thermal' && (
                <div style={{ color: '#ff6b35', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
                  ▓▓▒▒░ THERMAL ░▒▒▓▓
                </div>
              )}
              {stream.type !== 'thermal' && (
                <div style={{ color: C.textDim, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", opacity: 0.5 }}>
                  ◈ VISUAL FEED ◈
                </div>
              )}
              {/* Detection boxes overlay when expanded */}
              {selectedStream === stream.id && stream.detections > 0 && (
                <>
                  <div style={{
                    position: 'absolute', top: '25%', left: '30%', width: 60, height: 45,
                    border: `1.5px solid ${C.critical}`, borderRadius: 2,
                    background: `${C.critical}11`,
                  }}>
                    <span style={{
                      position: 'absolute', bottom: -16, left: 0, fontSize: 8,
                      color: C.critical, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>FIRE 94%</span>
                  </div>
                  {stream.detections > 1 && (
                    <div style={{
                      position: 'absolute', top: '40%', right: '20%', width: 70, height: 30,
                      border: `1.5px dashed ${C.warning}`, borderRadius: 2,
                      background: `${C.warning}08`,
                    }}>
                      <span style={{
                        position: 'absolute', bottom: -16, left: 0, fontSize: 8,
                        color: C.warning, fontWeight: 600, whiteSpace: 'nowrap',
                      }}>SMOKE 87%</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Stream info */}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700 }}>
                {stream.name}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: C.textDim }}>
                <span>{stream.type.toUpperCase()}</span>
                {stream.detections > 0 && (
                  <span style={{ color: C.warning }}>● {stream.detections} detection{stream.detections > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // -- TAB: COMMS --
  const CommsTab = () => {
    const filteredMessages = activeChannel === 'ALL'
      ? MESSAGES
      : MESSAGES.filter(m => m.channel === activeChannel || m.channel === 'ALL');

    return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Channel header */}
      <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 2 }}>
          COMMUNICATIONS
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
          {['ALL', 'TACTICAL', 'AIR-OPS', 'MEDICAL'].map(ch => (
            <button key={ch} onClick={() => setActiveChannel(ch)} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: activeChannel === ch ? `${C.accent}22` : C.surfaceRaised,
              border: `2px solid ${activeChannel === ch ? C.accent : C.border}`,
              color: activeChannel === ch ? C.accent : C.textMuted, whiteSpace: 'nowrap',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}>{ch}</button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredMessages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: C.textDim, fontSize: 13 }}>
            No messages on {activeChannel} channel
          </div>
        ) : filteredMessages.map(msg => (
          <div key={msg.id} style={{
            background: msg.priority === 'critical' ? `${C.critical}15` : C.surface,
            border: `1px solid ${msg.priority === 'critical' ? C.critical + '44' : msg.priority === 'high' ? C.warning + '33' : C.border}`,
            borderRadius: 12, padding: '10px 12px',
            borderLeft: `3px solid ${msg.priority === 'critical' ? C.critical : msg.priority === 'high' ? C.warning : C.borderLight}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700,
                  color: msg.from === 'COMMAND' || msg.from === 'SYSTEM' ? C.accent : C.text,
                }}>{msg.from}</span>
                <span style={{
                  padding: '1px 5px', borderRadius: 4, fontSize: 8, fontWeight: 700,
                  background: C.surfaceRaised, color: C.textDim, letterSpacing: 0.5,
                }}>{msg.channel}</span>
              </div>
              <span style={{ fontSize: 10, color: C.textDim }}>{msg.time}</span>
            </div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{msg.text}</div>
          </div>
        ))}
      </div>

      {/* Compose */}
      <div style={{
        padding: '10px 12px 24px', borderTop: `1px solid ${C.border}`, background: C.surface,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input
          value={composeText}
          onChange={e => setComposeText(e.target.value)}
          placeholder={`Message ${activeChannel} channel...`}
          style={{
            flex: 1, padding: '14px 12px', background: C.surfaceRaised, border: `1px solid ${C.border}`,
            borderRadius: 12, color: C.text, fontSize: 14, fontFamily: "'Outfit', sans-serif",
            outline: 'none',
          }}
        />
        <button onClick={() => { if (composeText.trim()) { if (onMessageSend) onMessageSend({ text: composeText.trim(), channel: activeChannel, time: new Date().toLocaleTimeString() }); setComposeText(''); } }} style={{
          width: 48, height: 48, borderRadius: 12, border: 'none',
          background: `linear-gradient(135deg, ${C.accent} 0%, #ea580c 100%)`,
          color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>↑</button>
      </div>
    </div>
    );
  };

  // -- TAB: NAVIGATE --
  const NavigateTab = () => {
    const typeColors = { command: C.accent, resource: C.info, evacuation: C.success, staging: C.purple, hazard: C.critical };
    const typeIcons = { command: '⭐', resource: '💧', evacuation: '🚪', staging: '📦', hazard: '⚠️' };
    const activeNavPoint = NAVIGATION_POINTS.find(p => p.id === selectedNavPoint);
    const otherPoints = NAVIGATION_POINTS.filter(p => p.id !== selectedNavPoint);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* SELECTED DESTINATION — Large hero card at top */}
        {activeNavPoint ? (
          <div style={{
            flexShrink: 0, padding: 16,
            background: `linear-gradient(135deg, ${typeColors[activeNavPoint.type]}18 0%, ${C.bg} 100%)`,
            borderBottom: `2px solid ${typeColors[activeNavPoint.type]}66`,
          }}>
            {/* Big directional arrow */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12,
            }}>
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: `${typeColors[activeNavPoint.type]}22`,
                border: `3px solid ${typeColors[activeNavPoint.type]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  fontSize: 44, transform: `rotate(${activeNavPoint.bearing}deg)`,
                  color: typeColors[activeNavPoint.type], lineHeight: 1,
                }}>↑</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 900,
                  color: '#fff', lineHeight: 1.2,
                }}>{activeNavPoint.name}</div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800,
                  color: typeColors[activeNavPoint.type], marginTop: 4,
                }}>{activeNavPoint.distance}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                    color: '#fff', fontWeight: 700,
                  }}>ETA {activeNavPoint.eta}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                    color: C.textMuted, fontWeight: 600,
                  }}>{activeNavPoint.bearing}°</span>
                </div>
              </div>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setActiveTab('map')} style={{
                flex: 1, padding: '14px', border: 'none', borderRadius: 10, cursor: 'pointer',
                background: typeColors[activeNavPoint.type], color: '#fff',
                fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800,
              }}>
                📍 VIEW ON MAP
              </button>
              <button onClick={() => setSelectedNavPoint(null)} style={{
                padding: '14px 18px', border: `2px solid ${C.borderLight}`, borderRadius: 10, cursor: 'pointer',
                background: 'transparent', color: C.textMuted,
                fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700,
              }}>
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* No selection — show compass + prompt */
          <div style={{ flexShrink: 0, padding: '16px 16px 8px', textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto 12px',
              background: `radial-gradient(circle, ${C.surfaceRaised} 0%, ${C.bg} 100%)`,
              border: `2px solid ${C.borderLight}`, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div ref={compassNavRef} style={{ position: 'absolute' }}>
                <div style={{
                  width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
                  borderBottom: `24px solid ${C.critical}`, position: 'absolute', top: -32, left: -7,
                }} />
                <div style={{
                  width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                  borderTop: `18px solid ${C.textDim}`, position: 'absolute', bottom: -28, left: -5,
                }} />
              </div>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, zIndex: 1 }} />
              <div style={{ position: 'absolute', top: 4, fontSize: 10, fontWeight: 900, color: C.critical }}>N</div>
              <div style={{ position: 'absolute', bottom: 4, fontSize: 9, fontWeight: 700, color: C.textDim }}>S</div>
              <div style={{ position: 'absolute', left: 6, fontSize: 9, fontWeight: 700, color: C.textDim }}>W</div>
              <div style={{ position: 'absolute', right: 6, fontSize: 9, fontWeight: 700, color: C.textDim }}>E</div>
            </div>
            <div style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: C.textMuted,
            }}>Select a destination below</div>
          </div>
        )}

        {/* Remaining points list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', paddingBottom: 80 }}>
          <div style={{
            fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 2,
            marginBottom: 8, paddingLeft: 2,
          }}>
            {activeNavPoint ? 'OTHER DESTINATIONS' : 'ALL DESTINATIONS'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(activeNavPoint ? otherPoints : NAVIGATION_POINTS).map(point => {
              const color = typeColors[point.type] || C.textMuted;
              return (
                <button key={point.id} onClick={() => setSelectedNavPoint(point.id)} style={{
                  background: C.surface, border: `2px solid ${C.border}`,
                  borderRadius: 14, padding: '14px', cursor: 'pointer', textAlign: 'left',
                  color: C.text, width: '100%', transition: 'all 0.15s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, background: `${color}22`,
                        border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                      }}>{typeIcons[point.type]}</div>
                      <div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: '#fff' }}>{point.name}</div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, fontWeight: 600 }}>{point.type.toUpperCase()}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: '#fff' }}>
                        {point.distance}
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>
                        ETA {point.eta}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // REPORT & SUPPORT PANEL — Full device access
  // ============================================================================
  const REPORT_TYPES = [
    { id: 'fire', icon: '🔥', label: 'Fire / Smoke', color: C.critical, desc: 'Flames, embers, smoke column' },
    { id: 'chemical', icon: '☣️', label: 'Chemical Spill', color: '#e11d48', desc: 'Chemical leak or contamination' },
    { id: 'radioactive', icon: '☢️', label: 'Radioactive', color: '#facc15', desc: 'Radioactive material or waste' },
    { id: 'chemwaste', icon: '🧪', label: 'Chemical Waste', color: '#84cc16', desc: 'Toxic drums, illegal dumping' },
    { id: 'armed', icon: '🚫', label: 'Armed Conflict', color: '#dc2626', desc: 'Weapons, active threat, danger' },
    { id: 'injured', icon: '🩹', label: 'Person Injured', color: '#f59e0b', desc: 'Someone needs medical help' },
    { id: 'accident', icon: '🚗', label: 'Vehicle Accident', color: '#f97316', desc: 'Collision, rollover, stuck' },
    { id: 'blocked', icon: '🚧', label: 'Road Blocked', color: C.accent, desc: 'Path or road impassable' },
    { id: 'hazard', icon: '⚠️', label: 'Hazard', color: '#a855f7', desc: 'Power lines, unstable ground' },
    { id: 'resource', icon: '💧', label: 'Resource Found', color: C.info, desc: 'Water source, shelter, supplies' },
    { id: 'other', icon: '📢', label: 'Other', color: C.textMuted, desc: 'Anything else to report' },
  ];

  const SUPPORT_TYPES = [
    { id: 'medical', icon: '⛑️', label: 'Medical Team', color: '#ef4444', desc: 'Paramedics, first aid, triage' },
    { id: 'fire_crew', icon: '🚒', label: 'Fire Crew', color: '#f97316', desc: 'Firefighters, pumper, hose line' },
    { id: 'water', icon: '🚛', label: 'Water Tanker', color: C.info, desc: 'Water supply or refill needed' },
    { id: 'hazmat', icon: '☣️', label: 'HAZMAT Team', color: '#84cc16', desc: 'Chemical, biological, nuclear' },
    { id: 'air', icon: '🚁', label: 'Air Support', color: '#8b5cf6', desc: 'Helicopter, water bomber, drone' },
    { id: 'evac', icon: '🚌', label: 'Evacuation', color: '#a855f7', desc: 'Bus, transport for civilians' },
    { id: 'medevac', icon: '🏥', label: 'Medical Evacuation', color: '#dc2626', desc: 'Urgent patient transport, airlift' },
    { id: 'police', icon: '🚔', label: 'Law Enforcement', color: '#3b82f6', desc: 'Police, security, perimeter' },
    { id: 'engineer', icon: '🏗️', label: 'Engineering', color: '#f59e0b', desc: 'Heavy equipment, road clearing' },
    { id: 'comms', icon: '📡', label: 'Communications', color: C.accent, desc: 'Radio relay, signal boost' },
    { id: 'supply', icon: '📦', label: 'Supplies', color: '#64748b', desc: 'Food, fuel, equipment, PPE' },
  ];

  const openReport = (mode = 'report') => {
    setReportMode(mode);
    setShowReport(true);
    setReportStep('type');
    setReportType(null);
    setReportCaptures([]);
    setReportNote('');
    setReportSent(false);
    // Auto-capture GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setReportLocation({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5), acc: Math.round(pos.coords.accuracy) }),
        () => setReportLocation({ lat: '43.3772', lng: '2.4483', acc: '~sim' }),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setReportLocation({ lat: '43.3772', lng: '2.4483', acc: '~sim' });
    }
  };

  const handleFileCapture = (e, type) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setReportCaptures(prev => [...prev, { type, name: file.name, url, size: file.size }]);
    });
    e.target.value = '';
  };

  const submitReport = () => {
    setReportSent(true);
    if (onReportSubmit) onReportSubmit({ type: reportType, mode: reportMode, captures: reportCaptures.length, note: reportNote, location: reportLocation, time: new Date().toLocaleTimeString() });
    setTimeout(() => {
      setShowReport(false);
      setReportSent(false);
    }, 2500);
  };

  const ReportPanel = () => {
    if (!showReport) return null;
    const isSupport = reportMode === 'support';
    const typeList = isSupport ? SUPPORT_TYPES : REPORT_TYPES;
    const activeType = typeList.find(t => t.id === reportType);
    const headerColor = isSupport ? C.info : C.critical;
    const headerIcon = isSupport ? '🤝' : '🚨';
    const headerTitle = isSupport ? 'REQUEST SUPPORT' : 'EMERGENCY REPORT';
    const sentMessage = isSupport ? 'Support request sent to command.' : 'Command has been notified.';
    const questionText = isSupport ? 'What support do you need?' : 'What did you see?';
    const questionSub = isSupport ? 'Select the type of support required.' : 'Tap the closest match — you can add details next.';

    // Sent confirmation
    if (reportSent) {
      return (
        <div style={{
          position: embeddedMode ? 'absolute' : 'fixed', inset: 0, zIndex: 1000, background: C.bg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%', background: `${C.success}22`,
            border: `3px solid ${C.success}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 48, marginBottom: 20,
          }}>✓</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
            {isSupport ? 'REQUEST SENT' : 'REPORT SENT'}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
            {sentMessage}<br />Your location and media have been shared.
          </div>
        </div>
      );
    }

    return (
      <div style={{
        position: embeddedMode ? 'absolute' : 'fixed', inset: 0, zIndex: 1000, background: C.bg,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Hidden file inputs for camera/video */}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={e => handleFileCapture(e, 'photo')} />
        <input ref={videoInputRef} type="file" accept="video/*" capture="environment"
          style={{ display: 'none' }} onChange={e => handleFileCapture(e, 'video')} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: reportStep === 'type' ? headerColor : (activeType?.color || headerColor),
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>
            {headerIcon} {headerTitle}
          </div>
          <button onClick={() => setShowReport(false)} style={{
            padding: '8px 14px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8, color: '#fff', fontFamily: "'Outfit', sans-serif",
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}>CANCEL</button>
        </div>

        {/* Step 1: What did you see? */}
        {reportStep === 'type' && (
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <div style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 900, color: '#fff',
              marginBottom: 4,
            }}>{questionText}</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              {questionSub}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {typeList.map(type => (
                <button key={type.id} onClick={() => { setReportType(type.id); setReportStep('capture'); }} style={{
                  padding: '20px 12px', background: C.surface, border: `2px solid ${C.border}`,
                  borderRadius: 14, cursor: 'pointer', textAlign: 'center', color: C.text,
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 6, lineHeight: 1 }}>{type.icon}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: '#fff' }}>{type.label}</div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, lineHeight: 1.3 }}>{type.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Capture evidence + details */}
        {reportStep === 'capture' && activeType && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Type badge */}
            <div style={{
              padding: '10px 16px', background: `${activeType.color}15`,
              borderBottom: `1px solid ${activeType.color}33`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 24 }}>{activeType.icon}</span>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: '#fff' }}>{activeType.label}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>
                  {reportLocation ? `📍 ${reportLocation.lat}, ${reportLocation.lng} (±${reportLocation.acc}m)` : '📍 Getting location...'}
                </div>
              </div>
              <button onClick={() => setReportStep('type')} style={{
                marginLeft: 'auto', padding: '4px 10px', background: C.surfaceRaised,
                border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMuted,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>Change</button>
            </div>

            <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
              {/* Capture buttons — BIG touch targets */}
              <div style={{
                fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10,
              }}>CAPTURE EVIDENCE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <button onClick={() => fileInputRef.current?.click()} style={{
                  padding: '22px 12px', background: C.surface, border: `2px solid ${C.border}`,
                  borderRadius: 14, cursor: 'pointer', textAlign: 'center', color: C.text,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 4, lineHeight: 1 }}>📸</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: '#fff' }}>Take Photo</div>
                  <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Opens camera</div>
                </button>
                <button onClick={() => videoInputRef.current?.click()} style={{
                  padding: '22px 12px', background: C.surface, border: `2px solid ${C.border}`,
                  borderRadius: 14, cursor: 'pointer', textAlign: 'center', color: C.text,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 4, lineHeight: 1 }}>🎥</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: '#fff' }}>Record Video</div>
                  <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Opens camera</div>
                </button>
                <button onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file'; input.accept = 'image/*,video/*'; input.multiple = true;
                  input.onchange = (e) => handleFileCapture(e, 'file');
                  input.click();
                }} style={{
                  padding: '22px 12px', background: C.surface, border: `2px solid ${C.border}`,
                  borderRadius: 14, cursor: 'pointer', textAlign: 'center', color: C.text,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 4, lineHeight: 1 }}>📁</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: '#fff' }}>From Gallery</div>
                  <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Choose existing</div>
                </button>
                <button onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file'; input.accept = 'audio/*'; input.capture = 'user';
                  input.onchange = (e) => handleFileCapture(e, 'audio');
                  input.click();
                }} style={{
                  padding: '22px 12px', background: C.surface, border: `2px solid ${C.border}`,
                  borderRadius: 14, cursor: 'pointer', textAlign: 'center', color: C.text,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 4, lineHeight: 1 }}>🎙️</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: '#fff' }}>Voice Note</div>
                  <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Record audio</div>
                </button>
              </div>

              {/* Captured files preview */}
              {reportCaptures.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, color: C.success, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8,
                  }}>
                    {reportCaptures.length} FILE{reportCaptures.length > 1 ? 'S' : ''} ATTACHED
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {reportCaptures.map((cap, i) => (
                      <div key={i} style={{
                        position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden',
                        border: `2px solid ${C.borderLight}`, background: C.surfaceRaised,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {cap.type === 'photo' || cap.type === 'file' ? (
                          <img src={cap.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 28 }}>{cap.type === 'video' ? '🎥' : '🎙️'}</span>
                        )}
                        <button onClick={() => setReportCaptures(prev => prev.filter((_, j) => j !== i))} style={{
                          position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 12,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text note */}
              <div style={{
                fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8,
              }}>ADD DETAILS (OPTIONAL)</div>
              <textarea
                value={reportNote}
                onChange={e => setReportNote(e.target.value)}
                placeholder={isSupport 
                  ? "How many people? What's the urgency? Any special equipment needed?"
                  : "What do you see? How big? Which direction is it spreading?"}
                rows={3}
                style={{
                  width: '100%', padding: '14px', background: C.surfaceRaised, border: `1px solid ${C.border}`,
                  borderRadius: 12, color: C.text, fontSize: 15, fontFamily: "'Outfit', sans-serif",
                  outline: 'none', resize: 'none',
                }}
              />
            </div>

            {/* Submit — always visible at bottom */}
            <div style={{ padding: '12px 16px 28px', flexShrink: 0, background: C.surface, borderTop: `1px solid ${C.border}` }}>
              <button onClick={submitReport} style={{
                width: '100%', padding: '20px', border: 'none', borderRadius: 14, cursor: 'pointer',
                background: activeType.color, color: '#fff',
                fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: 1,
              }}>
                SEND {isSupport ? 'REQUEST' : 'REPORT'} →
              </button>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: C.textDim }}>
                {reportCaptures.length} file{reportCaptures.length !== 1 ? 's' : ''} · Location attached · Sent to {isSupport ? 'command & dispatch' : 'all command channels'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN LAYOUT
  // ============================================================================
  return (
    <div style={{
      height: embeddedMode ? '100%' : '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace", overflow: 'hidden',
      maxWidth: embeddedMode ? '100%' : 480, margin: '0 auto', width: '100%',
      position: 'relative',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        input, textarea { font-family: 'Outfit', sans-serif; }
        ::-webkit-scrollbar { width: 0; }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(249,115,22,0.3); } 50% { box-shadow: 0 0 40px rgba(249,115,22,0.6); } }
        @keyframes emergencyPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <StatusPanel />
      <ReportPanel />

      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: C.surface, borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🦅</span>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: C.accent }}>WATCHTOWER</div>
            <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 1.5 }}>{ACTIVE_OPERATION.id}</div>
          </div>
        </div>

        {/* Status button */}
        <button onClick={() => setShowStatusPanel(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          background: `${currentStatus.color}22`, border: `2px solid ${currentStatus.color}`,
          borderRadius: 10, cursor: 'pointer', color: currentStatus.color,
        }}>
          <span style={{ fontSize: 18 }}>{currentStatus.icon}</span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700 }}>{currentStatus.label}</span>
        </button>
      </header>

      {/* Alert banner — compact, non-blocking */}
      <AlertBanner />

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {activeTab === 'map' && renderMap()}
        {activeTab === 'streams' && <StreamsTab />}
        {activeTab === 'comms' && <CommsTab />}
        {activeTab === 'navigate' && <NavigateTab />}
      </div>

      {/* Bottom navigation — Center REPORT button raised for emergency access */}
      <nav style={{
        display: 'flex', alignItems: 'flex-end', background: C.surface, borderTop: `1px solid ${C.border}`,
        padding: '4px 4px 20px', flexShrink: 0, position: 'relative',
      }}>
        {[
          { id: 'map', icon: '🗺️', label: 'MAP' },
          { id: 'streams', icon: '📡', label: 'FEEDS' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: '10px 4px', border: 'none', borderRadius: 12, cursor: 'pointer',
            background: activeTab === tab.id ? `${C.accent}22` : 'transparent',
            color: activeTab === tab.id ? C.accent : C.textDim,
            transition: 'all 0.15s ease', minHeight: 56,
          }}>
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{tab.label}</span>
          </button>
        ))}

        {/* Center ACTION button — opens report/support menu */}
        <div style={{ flex: 1.2, display: 'flex', justifyContent: 'center', position: 'relative' }}>
          {/* Popup menu */}
          {showActionMenu && (
            <div style={{
              position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', gap: 8, width: 200,
            }}>
              <button onClick={() => { setShowActionMenu(false); openReport('report'); }} style={{
                padding: '16px 14px', border: `2px solid ${C.critical}`, borderRadius: 14,
                background: C.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                color: C.text, width: '100%',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: `${C.critical}22`,
                  border: `1px solid ${C.critical}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>🚨</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: '#fff' }}>Report</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Report what you see</div>
                </div>
              </button>
              <button onClick={() => { setShowActionMenu(false); openReport('support'); }} style={{
                padding: '16px 14px', border: `2px solid ${C.info}`, borderRadius: 14,
                background: C.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                color: C.text, width: '100%',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: `${C.info}22`,
                  border: `1px solid ${C.info}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>🤝</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: '#fff' }}>Request Support</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Ask for what you need</div>
                </div>
              </button>
            </div>
          )}
          {/* Backdrop for action menu */}
          {showActionMenu && (
            <div onClick={() => setShowActionMenu(false)} style={{
              position: embeddedMode ? 'absolute' : 'fixed', inset: 0, zIndex: -1,
            }} />
          )}
          <button onClick={() => setShowActionMenu(!showActionMenu)} style={{
            width: 68, height: 68, borderRadius: '50%',
            border: `3px solid ${showActionMenu ? C.accent : C.critical}`,
            background: showActionMenu
              ? C.surface
              : `linear-gradient(135deg, ${C.critical} 0%, #b91c1c 100%)`,
            color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', marginTop: -24,
            boxShadow: showActionMenu ? 'none' : `0 4px 20px ${C.critical}66`,
            transition: 'all 0.15s ease',
          }}>
            <span style={{ fontSize: showActionMenu ? 20 : 24, lineHeight: 1 }}>{showActionMenu ? '✕' : '🚨'}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 900, letterSpacing: 1, marginTop: 1,
              color: showActionMenu ? C.textMuted : '#fff',
            }}>{showActionMenu ? 'CLOSE' : 'ACTION'}</span>
          </button>
        </div>

        {[
          { id: 'comms', icon: '📻', label: 'COMMS' },
          { id: 'navigate', icon: '🧭', label: 'NAV' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: '10px 4px', border: 'none', borderRadius: 12, cursor: 'pointer',
            background: activeTab === tab.id ? `${C.accent}22` : 'transparent',
            color: activeTab === tab.id ? C.accent : C.textDim,
            transition: 'all 0.15s ease', minHeight: 56,
          }}>
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};



// ============================================
// COLLABORATOR PREVIEW FRAME — Phone mockup
// Shows operator exactly what the field user sees
// ============================================
export const CollaboratorPreviewFrame = ({ onClose, onJoinOperation, onStatusUpdate, onReportSubmit, onMessageSend }) => (
  <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-3" onClick={onClose}>
    <div className="relative flex flex-col items-center gap-2 w-full h-full max-w-[480px] max-h-[95vh]" onClick={e => e.stopPropagation()}>
      {/* Label */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <span className="text-blue-400 text-xs font-bold">📱 COLLABORATOR FIELD APP PREVIEW</span>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-xs font-bold">
          ✕ CLOSE
        </button>
      </div>
      {/* Responsive phone frame — fills available height, maintains mobile aspect */}
      <div style={{ flex: 1, width: '100%', minHeight: 0, borderRadius: 24, border: '3px solid #334155', background: '#0a0e17', overflow: 'hidden', position: 'relative', boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 120px rgba(249,115,22,0.1)' }}>
        {/* Notch */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 100, height: 20, background: '#0a0e17', borderRadius: '0 0 12px 12px', zIndex: 50 }} />
        {/* App content — fills the frame */}
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          <WatchtowerCollaborator
            embeddedMode={true}
            onJoinOperation={onJoinOperation}
            onStatusUpdate={onStatusUpdate}
            onReportSubmit={onReportSubmit}
            onMessageSend={onMessageSend}
          />
        </div>
      </div>
      {/* Info bar */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-shrink-0">
        <span>This is what the field collaborator sees on their phone after tapping the invite link</span>
      </div>
    </div>
  </div>
);
