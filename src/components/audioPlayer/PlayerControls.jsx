import React, { useState, useEffect } from 'react';
import {
  BsPlayCircleFill,
  BsPauseCircleFill,
  BsShuffle,
} from "react-icons/bs";
import { CgPlayTrackNext, CgPlayTrackPrev } from "react-icons/cg";
import { FiRepeat } from "react-icons/fi";

// Hàm format thời gian từ giây sang mm:ss
const formatTime = (timeInSeconds) => {
  if (!timeInSeconds || isNaN(timeInSeconds)) return "0:00";
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function PlayerControls({ player, playerState }) {
  const [position, setPosition] = useState(0);

  // Lấy trạng thái từ playerState
  const isPaused = playerState?.paused ?? true;
  const duration = playerState?.duration ?? 0;
  // const currentPosition = playerState?.position ?? 0;
  // const currentTrack = playerState?.track_window?.current_track;

  // Cập nhật thanh trượt tiến trình một cách mượt mà
  useEffect(() => {
    let animationFrameId;

    const updatePosition = () => {
      if (!isPaused) {
        // Ước tính vị trí hiện tại dựa trên lần cập nhật cuối cùng từ SDK
        const timeSinceLastUpdate = (Date.now() - playerState.timestamp) / 1000;
        const estimatedPosition = (playerState.position / 1000) + timeSinceLastUpdate;
        setPosition(estimatedPosition * 1000);
      } else {
        setPosition(playerState.position);
      }
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    if (playerState) {
      animationFrameId = requestAnimationFrame(updatePosition);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [playerState, isPaused]);

  if (!player || !playerState) {
    return <div className="text-white">Đang tải trình điều khiển...</div>;
  }

  const handleSeek = (e) => {
    const newPosition = Number(e.target.value);
    player.seek(newPosition).then(() => {
      setPosition(newPosition);
      console.log(`Đã tua đến ${newPosition}ms`);
    });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md">
      {/* Thanh tiến trình */}
      <div className="w-full flex items-center gap-4">
        <span className="text-xs text-gray-700">{formatTime(position / 1000)}</span>
        <input
          type="range"
          min="0"
          max={duration}
          value={position}
          onChange={handleSeek}
          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${(position / duration) * 100}%, #4d4d4d ${(position / duration) * 100}%, #4d4d4d 100%)`
          }}
        />
        <span className="text-xs text-gray-700">{formatTime(duration / 1000)}</span>
      </div>

      {/* Các nút điều khiển */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <BsShuffle className="text-gray-600 hover:text-white cursor-pointer" size={20} />
        <CgPlayTrackPrev
          className="text-gray-600 hover:text-white cursor-pointer"
          size={40}
          onClick={() => player.previousTrack()}
        />
        <div
          className="text-white cursor-pointer"
          onClick={() => player.togglePlay()}
        >
          {isPaused ? (
            <BsPlayCircleFill size={50} />
          ) : (
            <BsPauseCircleFill size={50} />
          )}
        </div>
        <CgPlayTrackNext
          className="text-gray-600 hover:text-white cursor-pointer"
          size={40}
          onClick={() => player.nextTrack()}
        />
        <FiRepeat className="text-gray-600 hover:text-white cursor-pointer" size={20} />
      </div>
    </div>
  );
}
