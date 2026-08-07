import React, { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2, Camera, Radio, Video } from 'lucide-react';

const DeviceFeedViewer = ({ device, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const getStaticFeedUrl = () => {
    if (!device) return '';

    const imageMap = {
      'DRONE-01': 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'DRONE-02': 'https://images.pexels.com/photos/1743165/pexels-photo-1743165.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'DRONE-03': 'https://images.pexels.com/photos/957024/forest-trees-perspective-bright-957024.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'CAM-N1': 'https://images.pexels.com/photos/210182/pexels-photo-210182.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'CAM-N2': 'https://images.pexels.com/photos/1408221/pexels-photo-1408221.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'CAM-S1': 'https://images.pexels.com/photos/2739664/pexels-photo-2739664.jpeg?auto=compress&cs=tinysrgb&w=1200',
    };

    return imageMap[device.id] || (device.type === 'drone'
      ? 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=1200'
      : 'https://images.pexels.com/photos/210182/pexels-photo-210182.jpeg?auto=compress&cs=tinysrgb&w=1200');
  };

  const feedUrl = getStaticFeedUrl();

  if (!device) return null;

  const isCamera = device.type === 'camera';
  const isDrone = device.type === 'drone';

  return (
    <div
      className={`fixed bg-slate-900 border border-slate-700 shadow-2xl transition-all duration-300 ${
        isFullscreen
          ? 'inset-4'
          : 'bottom-4 right-4 w-96 h-72'
      }`}
      style={{
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        zIndex: 9999
      }}
    >
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {isDrone && <Video className="w-4 h-4 text-purple-400" />}
          {isCamera && <Camera className="w-4 h-4 text-blue-400" />}
          <span className="text-white font-semibold text-sm">{device.name}</span>
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-slate-300" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-300" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      <div className="relative w-full h-[calc(100%-40px)] bg-black">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/50 text-sm">Loading feed...</div>
          </div>
        )}
        {feedUrl && (
          <img
            src={feedUrl}
            alt={`${device.name} feed`}
            className="w-full h-full object-cover"
            style={{
              filter: isDrone ? 'contrast(1.1) saturate(1.2)' : 'contrast(1.05)',
              transition: 'opacity 0.3s ease-in-out',
              opacity: imageLoaded ? 1 : 0
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              console.error('Failed to load image:', feedUrl);
              setImageLoaded(true);
            }}
          />
        )}

        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between text-xs text-white/90">
            <div className="flex items-center gap-3">
              <span className="font-mono">{new Date().toLocaleTimeString()}</span>
              <span className="px-2 py-0.5 bg-red-500/80 rounded">REC</span>
            </div>
            <div className="font-mono">
              {device.position.lat.toFixed(6)}, {device.position.lng.toFixed(6)}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
          <div className="grid grid-cols-3 gap-2 text-xs text-white/90">
            <div>
              <div className="text-white/60 mb-0.5">Battery</div>
              <div className="font-mono">{isDrone ? '78%' : '100%'}</div>
            </div>
            <div>
              <div className="text-white/60 mb-0.5">Signal</div>
              <div className="font-mono flex items-center gap-1">
                <Radio className="w-3 h-3" />
                Excellent
              </div>
            </div>
            <div>
              <div className="text-white/60 mb-0.5">Altitude</div>
              <div className="font-mono">{isDrone ? '120m' : '45m'}</div>
            </div>
          </div>
        </div>

        {isDrone && (
          <div className="absolute inset-0 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <circle cx="50" cy="50" r="1" fill="none" stroke="rgba(168, 85, 247, 0.6)" strokeWidth="0.2" />
              <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="0.2" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="0.1" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="0.1" />
            </svg>
          </div>
        )}

        {isCamera && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 border-2 border-blue-400/40 rounded-full"></div>
              <div className="absolute inset-4 border border-blue-400/30 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceFeedViewer;
