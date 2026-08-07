import React, { useState, useRef } from 'react';
import {
  Video, AlertTriangle, Play, Pause, X, Maximize2, ExternalLink, Minus
} from 'lucide-react';
import { LiveDetectionView } from './LiveDetectionView';
import { DeviceIcon, VIEW_SIZES, ViewSizeSelector, getDeviceColor } from './common';


// Draggable/Resizable Stream Window Component
export const StreamWindow = ({ 
  stream, 
  detections = [], 
  initialSize = 'small',
  initialPosition = { x: 100, y: 100 },
  onClose,
  onPopout,
  onAcknowledge,
  onMinimize,
  onUpdateStream,
  onEmergency,
  isPopout = false,
  isPausedGlobal = false,
  zIndex = 10
}) => {
  const [viewSize, setViewSize] = useState(initialSize);
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [customSize, setCustomSize] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const dragRef = React.useRef(null);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  
  const needsAttention = stream.hasActiveDetection && !stream.alertAcknowledged;
  const config = VIEW_SIZES[viewSize];
  const effectivelyPaused = isPaused || isPausedGlobal;
  
  const currentWidth = customSize?.width || config.width;
  const currentHeight = customSize?.height || config.height;
  
  // Handle drag start
  const handleDragStart = (e) => {
    if (e.target.closest('button')) return;
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };
  
  // Handle drag
  const handleDrag = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y
    });
  };
  
  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };
  
  // Handle resize
  const handleResize = (e, direction) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = currentWidth;
    const startHeight = currentHeight;
    
    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      setCustomSize({
        width: Math.max(200, startWidth + deltaX),
        height: Math.max(120, startHeight + deltaY)
      });
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setIsResizing(false);
    };
    
    setIsResizing(true);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Minimized view
  if (viewSize === 'minimized') {
    return (
      <div
        className={`fixed bg-slate-900 rounded-lg shadow-xl border overflow-hidden cursor-move ${
          needsAttention ? 'border-red-500 animate-pulse' : 'border-slate-700'
        }`}
        style={{ 
          left: position.x, 
          top: position.y, 
          width: 200,
          zIndex 
        }}
        onMouseDown={handleDragStart}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className={`flex items-center justify-between px-3 py-2 ${
          needsAttention ? 'bg-red-500/20' : 'bg-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stream.status === 'active' ? 'bg-green-500' : 'bg-slate-500'}`} />
            <span className="text-xs text-white font-medium truncate" style={{ maxWidth: 100 }}>
              {stream.name.split(' ').slice(-1)}
            </span>
            {needsAttention && <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewSize('small')} className="p-1 hover:bg-slate-700 rounded">
              <Maximize2 className="w-3 h-3 text-slate-400" />
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-red-500/20 rounded">
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dragRef}
      className={`fixed bg-slate-900 rounded-xl shadow-2xl overflow-hidden transition-shadow ${
        needsAttention 
          ? 'border-4 border-red-500 shadow-red-500/30' 
          : 'border border-slate-700'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{ 
        left: isPopout ? position.x : 'auto',
        top: isPopout ? position.y : 'auto',
        width: typeof currentWidth === 'number' ? currentWidth : currentWidth,
        height: typeof currentHeight === 'number' ? currentHeight : currentHeight,
        zIndex,
        ...(needsAttention && {
          animation: 'pulse-border-critical 1s ease-in-out infinite'
        })
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Title Bar - Draggable */}
      <div 
        className={`flex items-center justify-between px-3 py-2 cursor-move select-none ${
          needsAttention ? 'bg-red-500' : 'bg-slate-800'
        }`}
        onMouseDown={handleDragStart}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="flex items-center gap-2">
          <DeviceIcon deviceType={stream.deviceType} className={`w-4 h-4 ${getDeviceColor(stream.deviceType)}`} />
          <span className="text-sm text-white font-medium truncate" style={{ maxWidth: viewSize === 'thumbnail' ? 80 : 150 }}>
            {stream.name}
          </span>
          {stream.status === 'active' && (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
          {needsAttention && (
            <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded font-bold">
              {stream.detectionType?.toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* View Size Quick Toggle */}
          <ViewSizeSelector currentSize={viewSize} onSizeChange={setViewSize} compact />
          
          {/* Pause/Play */}
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className="p-1 hover:bg-white/10 rounded"
            title={isPaused ? 'Resume' : 'Pause (save resources)'}
          >
            {isPaused ? <Play className="w-3 h-3 text-white" /> : <Pause className="w-3 h-3 text-white" />}
          </button>
          
          {/* Popout to new window */}
          {onPopout && (
            <button onClick={onPopout} className="p-1 hover:bg-white/10 rounded" title="Pop out to new window">
              <ExternalLink className="w-3 h-3 text-white" />
            </button>
          )}
          
          {/* Minimize */}
          <button onClick={() => setViewSize('minimized')} className="p-1 hover:bg-white/10 rounded" title="Minimize">
            <Minus className="w-3 h-3 text-white" />
          </button>
          
          {/* Fullscreen */}
          <button onClick={() => setViewSize(viewSize === 'large' ? 'medium' : 'large')} className="p-1 hover:bg-white/10 rounded">
            <Maximize2 className="w-3 h-3 text-white" />
          </button>
          
          {/* Close */}
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-red-500/50 rounded">
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
      </div>
      
      {/* Video Content */}
      <div className="relative" style={{ height: 'calc(100% - 40px)' }}>
        {effectivelyPaused ? (
          <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center">
            <Pause className="w-12 h-12 text-slate-500 mb-2" />
            <span className="text-slate-400 text-sm">Stream Paused</span>
            <span className="text-slate-500 text-xs">{isPausedGlobal ? 'All streams paused' : 'Click play to resume'}</span>
          </div>
        ) : (
          <LiveDetectionView 
            stream={stream} 
            detections={detections}
            onClose={null}
            onUpdateStream={onUpdateStream}
            onEmergency={onEmergency}
          />
        )}
      </div>
      
      {/* Resize Handle */}
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
        onMouseDown={(e) => handleResize(e, 'se')}
      >
        <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-slate-500 group-hover:border-orange-500 transition-colors" />
      </div>
    </div>
  );
};
