import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAccessToken } from '../spotify';

const useSpotifyPlayer = ({ currentTrack, isPlaying: externalIsPlaying, onTrackEnd, currentIndex, tracks }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');
  const intervalRef = useRef(null);

  // Lấy token Spotify
  useEffect(() => {
    setToken(getAccessToken());
  }, []);

  // Theo dõi trạng thái phát từ props
  useEffect(() => {
    setIsPlaying(!!externalIsPlaying);
  }, [externalIsPlaying]);

  // Theo dõi tiến trình phát nhạc Spotify
  useEffect(() => {
    if (!token || !isPlaying || !currentTrack) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data && res.data.is_playing && res.data.item) {
          setCurrentTime(res.data.progress_ms / 1000);
          setDuration(res.data.item.duration_ms / 1000);
          if (res.data.progress_ms >= res.data.item.duration_ms - 1000 && onTrackEnd) {
            onTrackEnd();
          }
        }
      } catch (err) {
        // Có thể do không có bài hát nào đang phát
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [token, isPlaying, currentTrack, onTrackEnd]);

  // Seek
  const seek = async (time) => {
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/seek',
        null,
        {
          params: { position_ms: Math.round(time * 1000) },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCurrentTime(time);
    } catch (err) {
      setError('Không thể tua bài hát');
    }
  };

  // Play/Pause
  const play = async () => {
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        { uris: tracks ? tracks.map(t => t.track?.uri || t.track?.id ? `spotify:track:${t.track.id}` : t.uri || t.id) : undefined, offset: { position: currentIndex || 0 } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsPlaying(true);
    } catch (err) {
      setError('Không thể phát nhạc Spotify');
    }
  };
  const pause = async () => {
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/pause',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsPlaying(false);
    } catch (err) {
      setError('Không thể tạm dừng Spotify');
    }
  };
  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  return {
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    error,
    play,
    pause,
    togglePlay,
    seek,
  };
};

export default useSpotifyPlayer;
