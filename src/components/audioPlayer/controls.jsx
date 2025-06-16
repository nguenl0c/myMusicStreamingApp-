import React, { useState, useEffect } from 'react';
import { IconContext } from 'react-icons';
import { BsPlayCircleFill, BsPauseCircleFill, BsSkipStartCircleFill, BsSkipEndCircleFill, BsVolumeUpFill, BsVolumeMuteFill, BsShuffle, BsRepeat, BsRepeat1 } from 'react-icons/bs';

export default function Controls({ 
  isPlaying, 
  onPlayPause, 
  onSkipNext, 
  onSkipPrevious,
  trackProgress = 0,
  duration = 0,
  onProgressChange,
  volume = 1,
  onVolumeChange,
  isMuted = false,
  onMuteToggle,
  isShuffled = false,
  onShuffleToggle,
  repeatMode = 'none', // 'none', 'all', 'one'
  onRepeatToggle
}) {
  // State để theo dõi tiến trình phát dưới dạng phần trăm
  const [progressPercentage, setProgressPercentage] = useState(0);

  // Cập nhật phần trăm tiến trình mỗi khi trackProgress hoặc duration thay đổi
  useEffect(() => {
    console.log("Track progress:", trackProgress, "Duration:", duration);
    
    if (duration > 0) {
      const percentage = (trackProgress / duration) * 100;
      setProgressPercentage(percentage);
    } else {
      setProgressPercentage(0);
    }
  }, [trackProgress, duration]);

  // Format thời gian (seconds -> mm:ss)
  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center">
      {/* Progress Bar */}
      <div className="w-full flex items-center space-x-2 mb-3">
        <span className="text-xs text-black">{formatTime(trackProgress)}</span>
        
        {/* Custom Progress Bar */}
        <div className="w-full relative">
          {/* Background */}
          <div className="w-full h-2 bg-gray-700 rounded-lg overflow-hidden">
            {/* Filled Progress */}
            <div 
              className="h-full bg-[#3B7ADF] transition-all duration-100 ease-linear"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          
          {/* Interactive Input (invisible but handles user interaction) */}
          <input
            type="range"
            value={trackProgress}
            min={0}
            max={duration || 1}
            step={1}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => onProgressChange && onProgressChange(parseFloat(e.target.value))}
          />
        </div>
        
        <span className="text-xs text-black">{formatTime(duration)}</span>
      </div>      {/* Control Buttons */}
      <div className="flex items-center justify-center space-x-6 mt-2 mb-4">        {/* Shuffle Button */}
        <IconContext.Provider value={{ size: "20px", color: isShuffled ? "#3B7ADF" : "#000000" }}>
          <button 
            onClick={onShuffleToggle}
            className="focus:outline-none hover:scale-110 transition-transform"
            title="Shuffle (Ctrl+S)"
          >
            <BsShuffle />
          </button>
        </IconContext.Provider>

        <IconContext.Provider value={{ size: "28px", color: "#000000" }}>
          <button 
            onClick={onSkipPrevious}
            className="focus:outline-none hover:scale-110 transition-transform"
            title="Previous Track (←)"
          >
            <BsSkipStartCircleFill />
          </button>
        </IconContext.Provider>

        <IconContext.Provider value={{ size: "50px", color: "#3B7ADF" }}>
          <button 
            onClick={onPlayPause}
            className="focus:outline-none hover:scale-105 transition-transform"
            title="Play/Pause (Space)"
          >
            {isPlaying ? <BsPauseCircleFill /> : <BsPlayCircleFill />}
          </button>
        </IconContext.Provider>        <IconContext.Provider value={{ size: "28px", color: "#000000" }}>
          <button 
            onClick={onSkipNext}
            className="focus:outline-none hover:scale-110 transition-transform"
            title="Next Track (→)"
          >
            <BsSkipEndCircleFill />
          </button>
        </IconContext.Provider>

        {/* Repeat Button */}        
        <IconContext.Provider value={{ 
          size: "20px", 
          color: repeatMode !== 'none' ? "#3B7ADF" : "#000000" 
        }}>
          <button
            onClick={onRepeatToggle}
            className="focus:outline-none hover:scale-110 transition-transform"
            title={`Repeat: ${repeatMode === 'none' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'} (Ctrl+R)`}
          >
            {repeatMode === 'one' ? <BsRepeat1 /> : <BsRepeat />}
          </button>
        </IconContext.Provider>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-3 mt-2 w-full max-w-xs">        
        <IconContext.Provider value={{ size: "20px", color: "#000000" }}>
          <button 
            onClick={onMuteToggle}
            className="focus:outline-none hover:scale-110 transition-transform"
            title={isMuted ? "Unmute (Ctrl+M)" : "Mute (Ctrl+M)"}
          >
            {isMuted ? <BsVolumeMuteFill /> : <BsVolumeUpFill />}
          </button>
        </IconContext.Provider>
        
        {/* Volume Slider */}
        <div className="flex-1 relative">
          <div className="w-full h-1 bg-gray-700 rounded-lg overflow-hidden">
            <div 
              className="h-full bg-[#3B7ADF] transition-all duration-100"
              style={{ width: `${isMuted ? 0 : (volume * 100)}%` }}
            ></div>
          </div>
            <input
            type="range"
            value={isMuted ? 0 : volume}
            min={0}
            max={1}
            step={0.01}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              const newVolume = parseFloat(e.target.value);
              if (onVolumeChange) {
                onVolumeChange(newVolume);
              }
            }}
            title="Volume Control (Ctrl+↑/↓)"
          />
        </div>
          <span className="text-xs text-black w-8 text-right">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
}
