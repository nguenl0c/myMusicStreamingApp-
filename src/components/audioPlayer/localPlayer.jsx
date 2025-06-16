import React, { useState, useEffect } from 'react';
import { useLocalPlayer } from '../../hooks/useLocalPlayer';
import Controls from './controls';
import ProgressCircle from './progressCircle';

export default function LocalPlayer({
    trackId,
    onTrackEnd,
    isActive = true,
    onPlaybackStateChange
}) {
    const {
        currentTrack,
        isPlaying,
        duration,
        currentTime,
        volume,
        isMuted,
        error,
        loadTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute
    } = useLocalPlayer();

    // Thông báo cho parent component về trạng thái phát
    useEffect(() => {
        if (onPlaybackStateChange) {
            onPlaybackStateChange({
                isPlaying,
                currentTime,
                duration,
                track: currentTrack
            });
        }
    }, [isPlaying, currentTime, duration, currentTrack, onPlaybackStateChange]);

    // Load track khi trackId thay đổi
    useEffect(() => {
        if (trackId && isActive) {
            loadTrack(trackId);
        }
    }, [trackId, isActive]);

    // Xử lý khi track kết thúc
    useEffect(() => {
        // Khi track kết thúc và currentTime về 0
        if (currentTrack && duration > 0 && currentTime >= duration - 0.1) {
            if (onTrackEnd) {
                onTrackEnd();
            }
        }
    }, [currentTime, duration, currentTrack, onTrackEnd]);

    // Tạm dừng khi không active
    useEffect(() => {
        if (!isActive && isPlaying) {
            togglePlay(); // Pause
        }
    }, [isActive, isPlaying]);

    if (!currentTrack) {
        return null;
    }

    return (
        <div className={`local-player ${isActive ? 'active' : 'inactive'}`}>
            {error && <div className="error-message">{error}</div>}

            <Controls
                isPlaying={isPlaying}
                onPlayPause={togglePlay}
                onSkipNext={onTrackEnd}
                onSkipPrevious={() => { }} // Bạn có thể thêm logic để quay lại bài trước
                trackProgress={currentTime}
                duration={duration}
                onProgressChange={seek}
                volume={volume}
                onVolumeChange={setVolume}
                isMuted={isMuted}
                onMuteToggle={toggleMute}
                isShuffled={false}
                onShuffleToggle={() => {}}
                repeatMode="none"
                onRepeatToggle={() => {}}
            />
        </div>
    );
}