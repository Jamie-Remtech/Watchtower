import { useState, useEffect } from 'react';
import {
  Video, AlertTriangle, Flame, Target, Radio, User, Navigation, Layers, Map, Circle, Compass, Truck, Send
} from 'lucide-react';
import { firePerimeters } from '../data/detections';
import { assetRegistry, personnelRegistry } from '../data/registries';


// ============================================
// LIVE DETECTION VIEW COMPONENT - ENHANCED HUD
// ============================================

export const LiveDetectionView = ({ stream, detections = [], onClose, isFullscreen = false, onUpdateStream, onEmergency }) => {
  const [showDetections, setShowDetections] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [showSpread, setShowSpread] = useState(true);
  const [showPerimeter, setShowPerimeter] = useState(true);
  const [controlMode, setControlMode] = useState(stream.controlMode || 'watchtower');
  const [filters, setFilters] = useState({ fire: true, smoke: true, human: true, vehicle: true });
  const [currentTime, setCurrentTime] = useState(new Date());
  // Instant comms popup state
  const [commsTarget, setCommsTarget] = useState(null); // detection id
  const [commsMsg, setCommsMsg] = useState('');
  const [commsSent, setCommsSent] = useState(false);
  const [commsMode, setCommsMode] = useState('msg'); // 'msg' or 'radio'
  const localCameraSettings = stream.cameraCapabilities || null;
  const perimeter = firePerimeters[stream.id] || null;

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getStaticFeedUrl = () => {
    const imageMap = {
      'DRONE-01': 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'DRONE-02': 'https://images.pexels.com/photos/1743165/pexels-photo-1743165.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'DRONE-03': 'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'CAM-N1': 'https://images.pexels.com/photos/210182/pexels-photo-210182.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'CAM-N2': 'https://images.pexels.com/photos/1408221/pexels-photo-1408221.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'CAM-S1': 'https://images.pexels.com/photos/2739664/pexels-photo-2739664.jpeg?auto=compress&cs=tinysrgb&w=1200',
    };
    return imageMap[stream.id] || 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=1200';
  };

  const feedUrl = getStaticFeedUrl();

  const getDetectionStyle = (type) => {
    switch(type) {
      case 'fire': return { border: '1.5px solid #f87171', background: 'rgba(248,113,113,0.08)', labelBg: '#ef4444', labelColor: 'white', glow: 'rgba(239,68,68,0.2)' };
      case 'smoke': return { border: '1.5px dashed rgba(248,113,113,0.5)', background: 'rgba(248,113,113,0.04)', labelBg: 'rgba(220,80,80,0.85)', labelColor: 'white', glow: 'rgba(248,113,113,0.12)' };
      case 'human': return { border: '1.5px solid #fbbf24', background: 'rgba(251,191,36,0.08)', labelBg: '#d97706', labelColor: 'white', glow: 'rgba(251,191,36,0.15)' };
      case 'vehicle': return { border: '1.5px solid #60a5fa', background: 'rgba(96,165,250,0.08)', labelBg: '#3b82f6', labelColor: 'white', glow: 'rgba(96,165,250,0.15)' };
      default: return { border: '1.5px solid #94a3b8', background: 'rgba(148,163,184,0.05)', labelBg: '#94a3b8', labelColor: 'white', glow: 'none' };
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'fire': return '🔥';
      case 'smoke': return '◉';
      case 'human': return '🧑';
      case 'vehicle': return '🚗';
      default: return '•';
    }
  };

  // Get background based on active camera mode
  const getModeBackground = () => {
    if (!localCameraSettings) return 'from-slate-700 via-slate-600 to-slate-800';
    switch (localCameraSettings.activeMode) {
      case 'thermal':
        return localCameraSettings.thermalPalette === 'ironbow' 
          ? 'from-purple-900 via-red-600 via-orange-500 to-yellow-300'
          : localCameraSettings.thermalPalette === 'rainbow'
          ? 'from-blue-600 via-green-500 via-yellow-400 to-red-500'
          : localCameraSettings.thermalPalette === 'black_hot'
          ? 'from-white via-gray-400 to-black'
          : localCameraSettings.thermalPalette === 'arctic'
          ? 'from-blue-900 via-cyan-500 to-white'
          : 'from-black via-gray-600 to-white';
      case 'nightvision':
        return 'from-green-950 via-green-900 to-green-950';
      case 'split':
      case 'pip':
        return 'from-slate-800 to-slate-700';
      default:
        return 'from-slate-700 via-slate-600 to-slate-800';
    }
  };

  // Filter detections based on active filters
  const visibleDetections = detections.filter(det => det && det.type && filters[det.type]);

  // Count by type for filter badges
  const typeCounts = detections.reduce((acc, det) => {
    if (det && det.type) acc[det.type] = (acc[det.type] || 0) + 1;
    return acc;
  }, {});

  const identifiedCount = detections.filter(d => d.type === 'human' && d.locatorId && personnelRegistry[d.locatorId]).length;
  const unidentifiedCount = (typeCounts.human || 0) - identifiedCount;
  const identifiedAssetCount = detections.filter(d => d.type === 'vehicle' && d.locatorId && assetRegistry[d.locatorId]).length;

  // Unified lookup: returns { registry, entry, category } or null
  const lookupAsset = (det) => {
    if (!det.locatorId) return null;
    if (personnelRegistry[det.locatorId]) return { registry: 'personnel', entry: personnelRegistry[det.locatorId], category: 'personnel' };
    if (assetRegistry[det.locatorId]) return { registry: 'asset', entry: assetRegistry[det.locatorId], category: assetRegistry[det.locatorId].category };
    return null;
  };

  const toggleFilter = (type) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const setAllFilters = (val) => {
    setFilters({ fire: val, smoke: val, human: val, vehicle: val });
  };

  // Convert spread direction (degrees) to arrow rotation
  const getSpreadArrow = (spread) => {
    if (!spread) return null;
    const rad = (spread.direction - 90) * Math.PI / 180;
    return {
      dx: Math.cos(rad) * 20,
      dy: Math.sin(rad) * 20,
      speed: spread.speed,
    };
  };

  // Build SVG polygon path from perimeter points  
  const perimeterPath = perimeter
    ? perimeter.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
    : '';

  return (
    <div className={`relative bg-slate-900 overflow-hidden ${isFullscreen ? 'w-full h-full' : 'w-full h-full'}`} onClick={() => commsTarget && setCommsTarget(null)}>
      {/* Simulated Video Feed Background */}
      <div className="absolute inset-0">
        {feedUrl ? (
          <img
            src={feedUrl}
            alt={`${stream.name} feed`}
            className="w-full h-full object-cover"
            style={{
              filter: localCameraSettings?.activeMode === 'thermal' ? 'hue-rotate(200deg) saturate(2) contrast(1.3)' :
                      localCameraSettings?.activeMode === 'nightvision' ? 'hue-rotate(80deg) saturate(0.8) brightness(0.7)' :
                      'contrast(1.05) saturate(1.1)',
              transition: 'opacity 0.5s ease-in-out'
            }}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${getModeBackground()}`}>
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }} />
          </div>
        )}

        {/* Thermal/Night Vision overlays */}
        {localCameraSettings?.activeMode === 'thermal' && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-red-600/30 to-yellow-500/30 mix-blend-overlay pointer-events-none" />
        )}
        {localCameraSettings?.activeMode === 'nightvision' && (
          <div className="absolute inset-0 bg-green-500/20 mix-blend-overlay pointer-events-none" />
        )}

        {/* Split view divider */}
        {localCameraSettings?.activeMode === 'split' && (
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/50 z-10" />
        )}

        {/* PiP window */}
        {localCameraSettings?.activeMode === 'pip' && feedUrl && (
          <div className="absolute right-2 w-1/5 aspect-video rounded border-2 border-white/50 z-20 overflow-hidden" style={{ bottom: '100px' }}>
            <img
              src={feedUrl}
              alt="PiP view"
              className="w-full h-full object-cover"
              style={{ filter: 'hue-rotate(200deg) saturate(2) contrast(1.3)' }}
            />
          </div>
        )}

        {/* Smoke/haze effect for active fires */}
        {stream.hasActiveDetection && stream.detectionType === 'fire' && (
          <>
            <div className="absolute top-0 left-1/4 w-1/3 h-2/3 bg-orange-500/30 blur-3xl rounded-full animate-pulse" />
            <div className="absolute top-1/4 right-1/4 w-1/4 h-1/2 bg-red-500/25 blur-2xl rounded-full" />
          </>
        )}
        {stream.hasActiveDetection && stream.detectionType === 'smoke' && (
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gray-400/40 via-gray-300/20 to-transparent backdrop-blur-sm" />
        )}
      </div>

      {/* ============================================ */}
      {/* FIRE PERIMETER OVERLAY (SVG) */}
      {/* ============================================ */}
      {showDetections && showPerimeter && perimeter && (
        <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Perimeter fill */}
          <path
            d={perimeterPath}
            fill="rgba(239,68,68,0.12)"
            stroke="#ef4444"
            strokeWidth="0.4"
            strokeDasharray="1.5,0.8"
          />
          {/* Perimeter label */}
          {(() => {
            const cx = perimeter.points.reduce((s, p) => s + p.x, 0) / perimeter.points.length;
            const cy = perimeter.points.reduce((s, p) => s + p.y, 0) / perimeter.points.length;
            return (
              <g>
                <rect x={cx - 8} y={cy - 2} width="16" height="4" rx="0.8" fill="rgba(239,68,68,0.75)" />
                <text x={cx} y={cy + 0.8} textAnchor="middle" fontSize="1.8" fontWeight="bold" fill="white" fontFamily="system-ui">
                  {perimeter.hectares}ha — {perimeter.status}
                </text>
              </g>
            );
          })()}
        </svg>
      )}

      {/* ============================================ */}
      {/* SPREAD VECTORS (SVG arrows) */}
      {/* ============================================ */}
      {showDetections && showSpread && (
        <svg className="absolute inset-0 w-full h-full z-11 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="arrowhead" markerWidth="3" markerHeight="2.4" refX="2.5" refY="1.2" orient="auto">
              <polygon points="0 0, 3 1.2, 0 2.4" fill="#ef4444" />
            </marker>
          </defs>
          {visibleDetections.filter(d => d.spread).map(det => {
            const arrow = getSpreadArrow(det.spread);
            if (!arrow) return null;
            const startX = det.x + det.width;
            const startY = det.y + det.height / 2;
            const endX = startX + arrow.dx / 4;
            const endY = startY + arrow.dy / 4;
            return (
              <g key={`spread-${det.id}`}>
                <line
                  x1={startX} y1={startY} x2={endX} y2={endY}
                  stroke="#ef4444" strokeWidth="0.35" markerEnd="url(#arrowhead)"
                />
                <rect x={endX + 0.5} y={endY - 1.2} width="5.5" height="2.4" rx="0.5" fill="rgba(239,68,68,0.75)" />
                <text x={endX + 3.25} y={endY + 0.3} textAnchor="middle" fontSize="1.5" fontWeight="bold" fill="white" fontFamily="system-ui">
                  {arrow.speed}km/h
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Compass Rose — rotates with camera bearing */}
      <div className="absolute top-1 left-1 z-20" style={{ width: '36px', height: '36px' }}>
        <svg viewBox="0 0 40 40" width="36" height="36">
          <circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          <g transform={`rotate(${-(stream.cameraBearing || 0)}, 20, 20)`}>
            <polygon points="20,4 17.5,13 22.5,13" fill="#ef4444" />
            <polygon points="20,36 17.5,27 22.5,27" fill="rgba(255,255,255,0.4)" />
            <line x1="35" y1="20" x2="29" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <line x1="5" y1="20" x2="11" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <text x="20" y="12" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#ef4444" fontFamily="system-ui">N</text>
            <text x="20" y="34" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">S</text>
            <text x="32" y="22" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">E</text>
            <text x="8" y="22" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">W</text>
          </g>
          <circle cx="20" cy="20" r="1.5" fill="white" />
        </svg>
        <div style={{ textAlign: 'center', marginTop: '1px' }}>
          <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{stream.cameraBearing || 0}°</span>
        </div>
      </div>

      {/* Live Indicator - Top Right */}
      <div className="absolute top-1 right-1 z-20">
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600/90 rounded text-white text-[10px] font-bold">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
      </div>

      {/* ============================================ */}
      {/* DETECTION BOXES — borders only, no labels */}
      {/* ============================================ */}
      {showDetections && visibleDetections.map(det => {
        const style = getDetectionStyle(det.type);
        const asset = lookupAsset(det);
        const isIdentified = !!asset;
        const idColors = asset ? (
          asset.category === 'personnel' ? { border: '#22c55e', bg: 'rgba(34,197,94,0.08)', glow: 'rgba(34,197,94,0.25)' }
          : asset.category === 'aircraft' ? { border: '#38bdf8', bg: 'rgba(56,189,248,0.08)', glow: 'rgba(56,189,248,0.25)' }
          : asset.category === 'drone' ? { border: '#fb923c', bg: 'rgba(251,146,60,0.08)', glow: 'rgba(251,146,60,0.25)' }
          : { border: '#a78bfa', bg: 'rgba(167,139,250,0.08)', glow: 'rgba(167,139,250,0.25)' } // vehicle = purple
        ) : null;
        return (
          <div
            key={det.id}
            className="absolute transition-all duration-300"
            style={{
              left: `${det.x}%`,
              top: `${det.y}%`,
              width: `${det.width}%`,
              height: `${det.height}%`,
              border: isIdentified ? `1.5px solid ${idColors.border}` : style.border,
              backgroundColor: isIdentified ? idColors.bg : style.background,
              boxShadow: commsTarget === det.id ? `0 0 20px ${idColors?.glow || style.glow}, inset 0 0 8px ${idColors?.glow || style.glow}` : isIdentified ? `0 0 10px ${idColors.glow}` : `0 0 8px ${style.glow}`,
              zIndex: commsTarget === det.id ? 35 : 12,
              cursor: isIdentified ? 'pointer' : 'default',
            }}
            onClick={isIdentified ? (ev) => { ev.stopPropagation(); setCommsTarget(commsTarget === det.id ? null : det.id); setCommsMsg(''); setCommsSent(false); setCommsMode('msg'); } : undefined}
          />
        );
      })}

      {/* ============================================ */}
      {/* DETECTION LABELS — separate layer, clamped to frame */}
      {/* ============================================ */}
      {showDetections && visibleDetections.map(det => {
        const style = getDetectionStyle(det.type);
        const asset = lookupAsset(det);
        const isIdentified = !!asset;
        if (!isIdentified) {
          // Unidentified: simple label clamped within frame
          const labelLeft = Math.min(det.x, 75);
          const labelAbove = det.y >= 12;
          const labelTop = labelAbove ? det.y - 1 : det.y + det.height + 0.5;
          return (
            <div
              key={`lbl-${det.id}`}
              className="absolute pointer-events-none"
              style={{
                left: `${labelLeft}%`,
                top: labelAbove ? undefined : `${labelTop}%`,
                bottom: labelAbove ? `${100 - det.y + 0.5}%` : undefined,
                zIndex: 13,
              }}
            >
              <span
                className="px-1 py-px text-xs font-bold rounded-sm whitespace-nowrap flex items-center gap-0.5"
                style={{
                  backgroundColor: style.labelBg,
                  color: style.labelColor,
                  fontSize: '8px',
                  lineHeight: '1.2',
                  maxWidth: '140px',
                  overflow: 'hidden',
                }}
              >
                {det.subtype || det.type}
                {showConfidence && det.confidence && (
                  <span style={{ opacity: 0.85 }}>({det.confidence}%)</span>
                )}
                <span style={{ opacity: 0.5, marginLeft: '1px', fontSize: '7px' }}>[{det.id}]</span>
              </span>
            </div>
          );
        }
        // Identified asset: rich label clamped within frame
        const e = asset.entry;
        const cat = asset.category;
        const idColors = (
          cat === 'personnel' ? { barTop: '#15803d', barBot: 'rgba(21,128,61,0.85)', border: '#22c55e' }
          : cat === 'aircraft' ? { barTop: '#0369a1', barBot: 'rgba(3,105,161,0.85)', border: '#38bdf8' }
          : cat === 'drone' ? { barTop: '#c2410c', barBot: 'rgba(194,65,12,0.85)', border: '#fb923c' }
          : { barTop: '#6d28d9', barBot: 'rgba(109,40,217,0.85)', border: '#a78bfa' } // vehicle = purple
        );
        const isCommsOpen = commsTarget === det.id;
        // Clamp label: keep within 1%-75% horizontal, above or below detection
        const clampedLeft = Math.max(1, Math.min(det.x, 58));
        const labelAbove = det.y >= 18;
        return (
          <div
            key={`lbl-${det.id}`}
            className="absolute cursor-pointer"
            onClick={(ev) => { ev.stopPropagation(); setCommsTarget(isCommsOpen ? null : det.id); setCommsMsg(''); setCommsSent(false); setCommsMode('msg'); }}
            style={{
              left: `${clampedLeft}%`,
              top: labelAbove ? undefined : `${det.y + det.height + 0.5}%`,
              bottom: labelAbove ? `${100 - det.y + 0.5}%` : undefined,
              maxWidth: `${Math.min(40, 98 - clampedLeft)}%`,
              zIndex: isCommsOpen ? 40 : 15,
            }}
          >
            {/* Top bar: Callsign + Name */}
            <div style={{ background: idColors.barTop, borderRadius: '3px 3px 0 0', padding: '1px 4px', display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden' }}>
              <span style={{ fontSize: '8px', color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{e.callsign}</span>
              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)' }}>•</span>
              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
            </div>
            {/* Bottom bar: Role/Type + Telemetry */}
            <div style={{ background: idColors.barBot, borderRadius: cat !== 'personnel' && e.unit ? '0' : '0 0 3px 3px', padding: '1px 4px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
              {cat === 'personnel' && (<>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{e.role}</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>|</span>
                <span style={{ fontSize: '7px', color: e.heartRate > 100 ? '#fbbf24' : '#86efac', whiteSpace: 'nowrap' }}>♥{e.heartRate}</span>
                <span style={{ fontSize: '7px', color: e.o2Level < 95 ? '#f87171' : '#86efac', whiteSpace: 'nowrap' }}>O₂{e.o2Level}%</span>
                <span style={{ fontSize: '7px', color: e.battery < 30 ? '#f87171' : e.battery < 50 ? '#fbbf24' : '#86efac', whiteSpace: 'nowrap' }}>🔋{e.battery}%</span>
              </>)}
              {cat === 'vehicle' && (<>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{e.type}</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>|</span>
                <span style={{ fontSize: '7px', color: e.fuel < 30 ? '#f87171' : e.fuel < 50 ? '#fbbf24' : '#c4b5fd', whiteSpace: 'nowrap' }}>⛽{e.fuel}%</span>
                {e.waterLevel !== null && <span style={{ fontSize: '7px', color: e.waterLevel < 20 ? '#f87171' : '#7dd3fc', whiteSpace: 'nowrap' }}>💧{e.waterLevel}%</span>}
                {e.speed > 0 && <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{e.speed}km/h</span>}
                {e.speed === 0 && <span style={{ fontSize: '7px', color: '#fbbf24', whiteSpace: 'nowrap' }}>STOPPED</span>}
              </>)}
              {cat === 'aircraft' && (<>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{e.type}</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>|</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>↑{e.altitude}m</span>
                <span style={{ fontSize: '7px', color: e.fuel < 30 ? '#f87171' : e.fuel < 50 ? '#fbbf24' : '#7dd3fc', whiteSpace: 'nowrap' }}>⛽{e.fuel}%</span>
                {e.waterLoad !== null && <span style={{ fontSize: '7px', color: e.waterLoad > 0 ? '#7dd3fc' : '#f87171', whiteSpace: 'nowrap' }}>💧{Math.round(e.waterLoad/1000)}k/{Math.round(e.maxWater/1000)}kL</span>}
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{e.speed}kt {e.heading}</span>
              </>)}
              {cat === 'drone' && (<>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{e.type}</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>|</span>
                <span style={{ fontSize: '7px', color: e.battery < 30 ? '#f87171' : e.battery < 50 ? '#fbbf24' : '#fdba74', whiteSpace: 'nowrap' }}>🔋{e.battery}%</span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>↑{e.altitude}m</span>
                <span style={{ fontSize: '7px', color: e.signal < 70 ? '#fbbf24' : '#fdba74', whiteSpace: 'nowrap' }}>📡{e.signal}%</span>
                {e.speed > 0 && <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{e.speed}km/h</span>}
              </>)}
            </div>
            {/* Unit/Operator line for non-personnel */}
            {cat !== 'personnel' && e.unit && (
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '0 0 3px 3px', padding: '0px 4px 1px' }}>
                <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{e.unit}{e.operator ? ` — ${e.operator}` : ''}</span>
              </div>
            )}
            {/* Click hint */}
            {!isCommsOpen && (
              <div style={{ marginTop: '1px' }}>
                <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>click to contact</span>
              </div>
            )}
          </div>
        );
      })}

      {/* ============================================ */}
      {/* INSTANT COMMS POPUP — Fixed overlay inside video frame */}
      {/* ============================================ */}
      {commsTarget && (() => {
        const targetDet = visibleDetections.find(d => d.id === commsTarget);
        if (!targetDet) return null;
        const targetAsset = lookupAsset(targetDet);
        if (!targetAsset) return null;
        const e = targetAsset.entry;
        const cat = targetAsset.category;
        const popColors = (
          cat === 'personnel' ? { border: '#22c55e', glow: 'rgba(34,197,94,0.25)', barTop: '#15803d' }
          : cat === 'aircraft' ? { border: '#38bdf8', glow: 'rgba(56,189,248,0.25)', barTop: '#0369a1' }
          : cat === 'drone' ? { border: '#fb923c', glow: 'rgba(251,146,60,0.25)', barTop: '#c2410c' }
          : { border: '#a78bfa', glow: 'rgba(167,139,250,0.25)', barTop: '#6d28d9' } // vehicle = purple
        );
        // Position popup near the detection but clamped well within frame
        // Max left: ensure 240px popup stays in view (never exceed ~52% for typical widths)
        const popLeft = Math.min(Math.max(targetDet.x, 2), 52);
        // Vertical: try below detection, but clamp top to 3% and ensure room for popup (~45% max)
        const popTop = Math.min(Math.max(targetDet.y + targetDet.height + 1, 3), 42);
        return (
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{
              position: 'absolute',
              left: `${popLeft}%`,
              top: `${popTop}%`,
              width: '240px',
              zIndex: 45,
              background: 'rgba(15,23,42,0.96)',
              border: `1px solid ${popColors.border}`,
              borderRadius: '8px',
              backdropFilter: 'blur(12px)',
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 16px ${popColors.glow}`,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: e.status === 'active' || e.status === 'deployed' ? '#22c55e' : e.status === 'moving' || e.status === 'en route' ? '#fbbf24' : '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'white' }}>{e.callsign}</span>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>{cat === 'personnel' ? e.role : e.type}</span>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); setCommsTarget(null); }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '1px 5px', fontSize: '11px', lineHeight: 1, borderRadius: '3px' }}
              >×</button>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '3px', padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { id: 'msg', icon: '💬', label: 'Message', color: popColors.border },
                { id: 'radio', icon: '📻', label: 'Radio', color: '#f97316' },
                { id: 'locate', icon: '📍', label: 'Locate', color: '#a78bfa' },
                { id: 'priority', icon: '🚨', label: 'Priority', color: '#ef4444' },
              ].map(action => (
                <button
                  key={action.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (action.id === 'locate') { alert(`Locating ${e.callsign} on Tactical Map...`); }
                    else if (action.id === 'priority') { alert(`🚨 PRIORITY ALERT sent to ${e.callsign}`); setCommsSent(true); setTimeout(() => setCommsSent(false), 2000); }
                    else { setCommsMode(action.id); }
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '4px 2px',
                    borderRadius: '4px',
                    border: commsMode === action.id ? `1px solid ${action.color}` : '1px solid transparent',
                    background: commsMode === action.id ? `${action.color}15` : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '13px', lineHeight: 1 }}>{action.icon}</span>
                  <span style={{ fontSize: '7px', color: commsMode === action.id ? action.color : 'rgba(255,255,255,0.5)', fontWeight: commsMode === action.id ? 'bold' : 'normal' }}>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Message/Radio Input Area */}
            {(commsMode === 'msg' || commsMode === 'radio') && (
              <div style={{ padding: '5px 8px' }}>
                {/* Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '5px' }}>
                  {(cat === 'personnel' ? [
                    'Report status', 'Fall back', 'Hold position', 'Rally to CP',
                  ] : cat === 'aircraft' ? [
                    'Cleared for drop', 'Hold pattern', 'RTB', 'Re-scoop',
                  ] : cat === 'drone' ? [
                    'Return to base', 'Hold position', 'Scan sector', 'Land now',
                  ] : [
                    'Report status', 'Hold position', 'Proceed to CP', 'Pull back',
                  ]).map(preset => (
                    <button
                      key={preset}
                      onClick={(ev) => { ev.stopPropagation(); setCommsMsg(preset); }}
                      style={{
                        fontSize: '8px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        background: commsMsg === preset ? `${popColors.border}30` : 'rgba(255,255,255,0.05)',
                        border: commsMsg === preset ? `1px solid ${popColors.border}50` : '1px solid rgba(255,255,255,0.08)',
                        color: commsMsg === preset ? popColors.border : 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >{preset}</button>
                  ))}
                </div>
                {/* Input + Send */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={commsMsg}
                    onChange={(ev) => { setCommsMsg(ev.target.value); setCommsSent(false); }}
                    onKeyDown={(ev) => {
                      ev.stopPropagation();
                      if (ev.key === 'Enter' && commsMsg.trim()) {
                        setCommsSent(true);
                        setTimeout(() => { setCommsSent(false); setCommsMsg(''); }, 2500);
                      }
                    }}
                    onClick={(ev) => ev.stopPropagation()}
                    placeholder={commsMode === 'radio' ? `Radio ${e.callsign}...` : `Message ${e.callsign}...`}
                    autoFocus
                    style={{
                      flex: 1,
                      fontSize: '9px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'white',
                      outline: 'none',
                      minWidth: 0,
                    }}
                  />
                  {commsSent ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(34,197,94,0.2)' }}>
                      <span style={{ fontSize: '9px', color: '#4ade80', fontWeight: 'bold' }}>✓ {commsMode === 'radio' ? 'TX' : 'SENT'}</span>
                    </div>
                  ) : (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (commsMsg.trim()) {
                          setCommsSent(true);
                          setTimeout(() => { setCommsSent(false); setCommsMsg(''); }, 2500);
                        }
                      }}
                      disabled={!commsMsg.trim()}
                      style={{
                        fontSize: '8px',
                        fontWeight: 'bold',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: commsMsg.trim() ? popColors.barTop : 'rgba(255,255,255,0.1)',
                        color: commsMsg.trim() ? 'white' : 'rgba(255,255,255,0.3)',
                        cursor: commsMsg.trim() ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap',
                      }}
                    >{commsMode === 'radio' ? '📻 TX' : '▸ SEND'}</button>
                  )}
                </div>
                {/* Channel */}
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>via</span>
                  <span style={{ fontSize: '7.5px', color: popColors.border, fontWeight: 'bold' }}>
                    {commsMode === 'radio' ? (cat === 'personnel' ? 'VHF Ch.4 — COMMAND' : cat === 'aircraft' ? 'VHF-AM 122.925 — AIR-OPS' : 'UHF Ch.12 — TAC') : '#ops-general'}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ============================================ */}
      {/* HUD TOOLBAR - Bottom overlay */}
      {/* ============================================ */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        {/* Main HUD Bar - Compacted */}
        <div className="bg-slate-900/90 border-t border-slate-700/50 backdrop-blur-sm">
          {/* Top row: AI toggle + toggles + filters all in one row */}
          <div className="flex items-center justify-between px-2 py-1 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* AI Detection Master Toggle */}
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
                </svg>
                <span className="text-white text-[10px] font-medium">AI</span>
                <button 
                  onClick={() => setShowDetections(!showDetections)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${showDetections ? 'bg-orange-500' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm`} 
                    style={{ left: showDetections ? '16px' : '2px' }}
                  />
                </button>
              </div>

              <div className="w-px h-4 bg-slate-600" />

              {/* Confidence / Spread / Perimeter toggles */}
              <button
                onClick={() => setShowConfidence(!showConfidence)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all border ${
                  showConfidence 
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' 
                    : 'bg-slate-800/60 text-slate-500 border-slate-600/50'
                }`}
              >
                <Target className="w-2.5 h-2.5" />
                Conf
              </button>
              <button
                onClick={() => setShowSpread(!showSpread)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all border ${
                  showSpread 
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' 
                    : 'bg-slate-800/60 text-slate-500 border-slate-600/50'
                }`}
              >
                <Navigation className="w-2.5 h-2.5" />
                Spread
              </button>
              {perimeter && (
                <button
                  onClick={() => setShowPerimeter(!showPerimeter)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all border ${
                    showPerimeter 
                      ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                      : 'bg-slate-800/60 text-slate-500 border-slate-600/50'
                  }`}
                >
                  <Layers className="w-2.5 h-2.5" />
                  {perimeter.hectares}ha
                </button>
              )}

              <div className="w-px h-4 bg-slate-600" />

              {/* Inline filters */}
              <button
                onClick={() => toggleFilter('fire')}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border ${
                  filters.fire ? 'bg-red-500/25 text-red-400 border-red-500/50' : 'bg-slate-800/40 text-slate-500 border-slate-700/40'
                }`}
              >
                <Flame className="w-2.5 h-2.5" />
                {typeCounts.fire || 0}
              </button>
              <button
                onClick={() => toggleFilter('smoke')}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border ${
                  filters.smoke ? 'bg-red-400/20 text-red-300 border-red-400/40' : 'bg-slate-800/40 text-slate-500 border-slate-700/40'
                }`}
              >
                <Circle className="w-2.5 h-2.5" />
                {typeCounts.smoke || 0}
              </button>
              <button
                onClick={() => toggleFilter('human')}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border ${
                  filters.human ? 'bg-amber-500/25 text-amber-400 border-amber-500/50' : 'bg-slate-800/40 text-slate-500 border-slate-700/40'
                }`}
              >
                <User className="w-2.5 h-2.5" />
                {typeCounts.human || 0}
                {identifiedCount > 0 && (
                  <span style={{ fontSize: '7px', color: '#4ade80', marginLeft: '1px' }}>({identifiedCount}ID)</span>
                )}
              </button>
              <button
                onClick={() => toggleFilter('vehicle')}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border ${
                  filters.vehicle ? 'bg-blue-500/25 text-blue-400 border-blue-500/50' : 'bg-slate-800/40 text-slate-500 border-slate-700/40'
                }`}
              >
                <Truck className="w-2.5 h-2.5" />
                {typeCounts.vehicle || 0}
                {identifiedAssetCount > 0 && (
                  <span style={{ fontSize: '7px', color: '#4ade80', marginLeft: '1px' }}>({identifiedAssetCount}ID)</span>
                )}
              </button>
            </div>

            {/* Right: All/None + utility */}
            <div className="flex items-center gap-1">
              <button onClick={() => setAllFilters(true)} className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white">All</button>
              <span className="text-slate-600 text-[10px]">|</span>
              <button onClick={() => setAllFilters(false)} className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white">None</button>
            </div>
          </div>

          {/* Emergency Controls - compact */}
          {stream.deviceType === 'drone' && (
            <div className="px-2 py-1 border-t border-red-500/20">
              <button
                onClick={() => onEmergency && onEmergency(stream.id)}
                className="w-full py-1.5 bg-red-500/15 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 rounded text-red-400 hover:text-red-300 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <AlertTriangle className="w-3 h-3" />
                EMERGENCY CONTROLS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
