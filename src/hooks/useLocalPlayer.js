import { useState, useEffect, useRef } from 'react';
import { getTrackById } from '../services/localMusicDB';

export const useLocalPlayer = () => {
  // State quản lý
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.7);
  const [error, setError] = useState(null);
  
  // References
  const audioRef = useRef(new Audio());
  const intervalRef = useRef(null);
  
  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      // Dừng audio và clear interval
      audioRef.current.pause();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Xử lý khi isPlaying thay đổi
  useEffect(() => {
    if (isPlaying) {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
        setError('Không thể phát nhạc');
      });
      
      // Tạo interval để cập nhật thời gian hiện tại
      intervalRef.current = setInterval(() => {
        setCurrentTime(audioRef.current.currentTime);
      }, 100);
    } else {
      audioRef.current.pause();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isPlaying]);
  
  // Xử lý sự kiện audio
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handleError = (e) => {
      console.error('Audio error:', e);
      setError('Lỗi khi phát nhạc');
      setIsPlaying(false);
    };
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);
  
  // Điều chỉnh volume
  useEffect(() => {
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);
  
  // Load và phát một track
  const loadTrack = async (trackId) => {
    try {
      // Dừng phát nhạc hiện tại
      audioRef.current.pause();
      setIsPlaying(false);
      
      // Reset state
      setCurrentTime(0);
      setDuration(0);
      setError(null);
      
      // Lấy thông tin track từ DB
      const track = await getTrackById(trackId);
      
      // Cập nhật audio source
      audioRef.current.src = track.url;
      
      // Cập nhật state
      setCurrentTrack(track);
      
      // Lắng nghe sự kiện loadedmetadata để lấy duration
      const loadedMetadataHandler = () => {
        setDuration(audioRef.current.duration);
        
        // Không tự động phát nữa, để người dùng click vào nút play
        // setIsPlaying(true);
        
        // Remove event listener sau khi đã xử lý
        audioRef.current.removeEventListener('loadedmetadata', loadedMetadataHandler);
      };
      
      audioRef.current.addEventListener('loadedmetadata', loadedMetadataHandler);
      
      // Load audio
      audioRef.current.load();
      
      return track;
    } catch (error) {
      console.error('Error loading track:', error);
      setError('Không thể tải bài hát');
      throw error;
    }
  };
  
  // Các hàm điều khiển
  const play = () => {
    audioRef.current.play().catch(error => {
      console.error('Error playing audio:', error);
      if (error.name === 'NotAllowedError') {
        setError('Trình duyệt yêu cầu tương tác người dùng trước khi phát nhạc. Vui lòng nhấp vào nút play.');
      } else {
        setError('Không thể phát nhạc: ' + error.message);
      }
      setIsPlaying(false);
    });
    setIsPlaying(true);
  };
  
  const pause = () => {
    setIsPlaying(false);
  };
  
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };
  
  const seek = (time) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };
  
  const setPlayerVolume = (newVolume) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      // Unmute: restore previous volume
      setIsMuted(false);
      setVolume(previousVolume);
    } else {
      // Mute: save current volume and set to 0
      setPreviousVolume(volume);
      setIsMuted(true);
    }
  };
  
  return {
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    volume,
    isMuted,
    error,
    audioElement: audioRef.current,
    loadTrack,
    play,
    pause,
    togglePlay,
    seek,
    setVolume: setPlayerVolume,
    toggleMute
  };
};

export default useLocalPlayer;
