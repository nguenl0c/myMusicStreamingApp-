import React from 'react';
import { BsGear, BsX } from 'react-icons/bs';

export default function PlayerSettings({ 
  isOpen, 
  onClose, 
  settings = {},
  onSettingsChange
}) {
  if (!isOpen) return null;

  const handleSettingChange = (key, value) => {
    onSettingsChange({
      [key]: value
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium flex items-center">
            <BsGear className="mr-2" />
            Player Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            title="Close Settings"
          >
            <BsX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Auto Play Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Auto Play Next Track</label>
              <p className="text-xs text-gray-400">Automatically play the next track when current track ends</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoPlay || false}
                onChange={(e) => handleSettingChange('autoPlay', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Gapless Playback / Crossfade Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Gapless Playback</label>
              <p className="text-xs text-gray-400">Enable smooth transitions between tracks</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.gaplessPlayback || false}
                onChange={(e) => handleSettingChange('gaplessPlayback', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Crossfade Duration Setting */}
          {settings.gaplessPlayback && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Crossfade Duration: {settings.crossfadeDuration || 3}s
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={settings.crossfadeDuration || 3}
                onChange={(e) => handleSettingChange('crossfadeDuration', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1s</span>
                <span>10s</span>
              </div>
            </div>
          )}

          {/* Volume Normalization Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Normalize Volume</label>
              <p className="text-xs text-gray-400">Automatically adjust volume levels across tracks</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.normalizeVolume || false}
                onChange={(e) => handleSettingChange('normalizeVolume', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Show Notifications Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Show Notifications</label>
              <p className="text-xs text-gray-400">Display notifications when track changes</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showNotifications || false}
                onChange={(e) => handleSettingChange('showNotifications', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Help Text */}
          <div className="mt-6 p-3 bg-gray-700 rounded-lg">
            <h4 className="text-sm font-medium mb-2">💡 Tips</h4>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• Gapless playback creates seamless transitions between tracks</li>
              <li>• Longer crossfade durations create smoother blending</li>
              <li>• Volume normalization helps balance different recording levels</li>
              <li>• Use keyboard shortcuts for quick control (⌨️ button)</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
