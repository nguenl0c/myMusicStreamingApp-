import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function Mixer() {
  const [uploading, setUploading] = useState(false);
  const [stemsList, setStemsList] = useState([]);
  const [selectedStems, setSelectedStems] = useState({});
  const [mixing, setMixing] = useState(false);
  const [mixResult, setMixResult] = useState(null);
  const [error, setError] = useState(null);
  const [trackId, setTrackId] = useState(null);
  const [progressLog, setProgressLog] = useState('');
  const [completedTracks, setCompletedTracks] = useState([]); // Track completed separations
  const [uploadedFile, setUploadedFile] = useState(null); // { name, duration, id }
  const [mixedSongs, setMixedSongs] = useState([]);
  const [deletingMixedSong, setDeletingMixedSong] = useState(null);
  const [deletingTrack, setDeletingTrack] = useState(null);
  const [playingStems, setPlayingStems] = useState({}); // Track which stems are playing
  const audioRefs = useRef({}); // Store audio element references
  const [expandedTracks, setExpandedTracks] = useState({}); // Track which tracks are expanded
  const [songName, setSongName] = useState(''); // For naming mixed songs
  
  // Master progress bar states
  const [masterCurrentTime, setMasterCurrentTime] = useState(0);
  const [masterDuration, setMasterDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const masterProgressInterval = useRef(null);

  const progressInterval = useRef(null);

  // Function to toggle track expansion
  const toggleTrackExpansion = (trackId) => {
    setExpandedTracks(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };

  // Function to stop all audio elements (not just selected stems)
  const stopAllAudio = () => {
    // Dừng tất cả audio elements trong audioRefs
    Object.values(audioRefs.current).forEach(audioElement => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    });
    // Reset tất cả playing states
    setPlayingStems({});
    setIsPlaying(false);
    setMasterCurrentTime(0);
    
    // Clear master progress interval
    if (masterProgressInterval.current) {
      clearInterval(masterProgressInterval.current);
      masterProgressInterval.current = null;
    }
  };

  // Function to update master progress bar
  const updateMasterProgress = () => {
    const selectedAudioElements = Object.entries(selectedStems).map(([stemType, stemData]) => {
      const audioKey = `${stemData.song}_${stemType}`;
      return audioRefs.current[audioKey];
    }).filter(Boolean);

    if (selectedAudioElements.length > 0) {
      // Use the first audio element as reference for time
      const referenceAudio = selectedAudioElements[0];
      if (referenceAudio && !isNaN(referenceAudio.currentTime)) {
        setMasterCurrentTime(referenceAudio.currentTime);
      }
      
      // Set duration from the longest audio
      const maxDuration = Math.max(...selectedAudioElements.map(audio => 
        audio && !isNaN(audio.duration) ? audio.duration : 0
      ));
      if (maxDuration > 0 && maxDuration !== masterDuration) {
        setMasterDuration(maxDuration);
      }
    }
  };

  // Function to initialize master duration when stems are selected
  const initializeMasterDuration = () => {
    const selectedAudioElements = Object.entries(selectedStems).map(([stemType, stemData]) => {
      const audioKey = `${stemData.song}_${stemType}`;
      return audioRefs.current[audioKey];
    }).filter(Boolean);

    if (selectedAudioElements.length > 0) {
      const maxDuration = Math.max(...selectedAudioElements.map(audio => 
        audio && !isNaN(audio.duration) ? audio.duration : 0
      ));
      if (maxDuration > 0) {
        setMasterDuration(maxDuration);
      }
    }
  };

  // Function to seek all selected stems to a specific time
  const seekAllStems = (time) => {
    Object.entries(selectedStems).forEach(([stemType, stemData]) => {
      const audioKey = `${stemData.song}_${stemType}`;
      const audioElement = audioRefs.current[audioKey];
      if (audioElement) {
        audioElement.currentTime = time;
      }
    });
    setMasterCurrentTime(time);
  };

  // Function to handle master progress bar click/drag
  const handleMasterProgressChange = (e) => {
    if (masterDuration === 0) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * masterDuration;
    
    seekAllStems(Math.max(0, Math.min(newTime, masterDuration)));
  };

  // Function to handle mouse down for dragging
  const handleMouseDown = (e) => {
    if (masterDuration === 0) return;
    
    const handleMouseMove = (moveEvent) => {
      const progressBar = e.currentTarget;
      const rect = progressBar.getBoundingClientRect();
      const moveX = moveEvent.clientX - rect.left;
      const newTime = (moveX / rect.width) * masterDuration;
      seekAllStems(Math.max(0, Math.min(newTime, masterDuration)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Handle initial click
    handleMasterProgressChange(e);
  };

  // Format time for display (mm:ss)
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to play all selected stems simultaneously
  const playAllSelectedStems = () => {
    // Dừng tất cả audio đang phát trước khi phát mới
    stopAllAudio();
    
    // Phát các stems đã chọn
    Object.entries(selectedStems).forEach(([stemType, stemData]) => {
      const audioKey = `${stemData.song}_${stemType}`;
      const audioElement = audioRefs.current[audioKey];
      if (audioElement) {
        audioElement.currentTime = masterCurrentTime; // Start from current master time
        audioElement.play().catch(console.error);
        setPlayingStems(prev => ({ ...prev, [audioKey]: true }));
      }
    });
    
    setIsPlaying(true);
    
    // Start master progress tracking
    if (masterProgressInterval.current) {
      clearInterval(masterProgressInterval.current);
    }
    
    masterProgressInterval.current = setInterval(() => {
      updateMasterProgress();
      
      // Check if any audio has ended
      const selectedAudioElements = Object.entries(selectedStems).map(([stemType, stemData]) => {
        const audioKey = `${stemData.song}_${stemType}`;
        return audioRefs.current[audioKey];
      }).filter(Boolean);
      
      const allEnded = selectedAudioElements.every(audio => audio.ended);
      if (allEnded && selectedAudioElements.length > 0) {
        stopAllSelectedStems();
      }
    }, 100); // Update every 100ms for smooth progress
  };

  // Function to stop all playing stems
  const stopAllSelectedStems = () => {
    // Sử dụng stopAllAudio để đảm bảo dừng tất cả
    stopAllAudio();
  };

  // Handle audio play/pause state tracking
  const handleAudioPlay = (audioKey) => {
    setPlayingStems(prev => ({ ...prev, [audioKey]: true }));
  };

  const handleAudioPause = (audioKey) => {
    setPlayingStems(prev => ({ ...prev, [audioKey]: false }));
  };

  // Delete stems and original file
  const deleteTrack = async (trackId) => {
    const confirmed = window.confirm('Bạn có chắc chắn muốn xóa track này? Hành động này không thể hoàn tác.');
    if (!confirmed) return;
    
    try {
      setDeletingTrack(trackId);
      const response = await fetch(`/api/stems/${trackId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Refresh stems list
        fetchStems();
        alert('Track deleted successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete track');
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      alert('Failed to delete track');
    } finally {
      setDeletingTrack(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch stems từ server
  const fetchStems = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/stems');
      setStemsList(response.data || []);
    } catch (error) {
      console.error('Error fetching stems:', error);
      setStemsList([]);
    }
  };

  // Fetch mixed songs từ server
  const fetchMixedSongs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/mixed-songs');
      setMixedSongs(response.data || []);
    } catch (error) {
      console.error('Error fetching mixed songs:', error);
      setMixedSongs([]);
    }
  };

  // Clear completed tracks
  const clearCompletedTracks = () => {
    setCompletedTracks([]);
  };

  // Delete mixed song
  const deleteMixedSong = async (filename) => {
    const confirmed = window.confirm('Bạn có chắc chắn muốn xóa bài hát này? Hành động này không thể hoàn tác.');
    if (!confirmed) return;
    
    try {
      setDeletingMixedSong(filename);
      const response = await fetch(`/api/mixed-songs/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Refresh mixed songs list
        fetchMixedSongs();
        alert('Xóa bài hát thành công!');
      } else {
        const data = await response.json();
        alert(data.error || 'Không thể xóa bài hát');
      }
    } catch (error) {
      console.error('Error deleting mixed song:', error);
      alert('Không thể xóa bài hát');
    } finally {
      setDeletingMixedSong(null);
    }
  };

  useEffect(() => {
    fetchStems();
    fetchMixedSongs();
  }, []);

  // Initialize master duration when selected stems change
  useEffect(() => {
    if (Object.keys(selectedStems).length >= 2) {
      // Small delay to ensure audio elements are ready
      setTimeout(() => {
        initializeMasterDuration();
      }, 100);
    } else {
      setMasterDuration(0);
      setMasterCurrentTime(0);
    }
  }, [selectedStems]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (masterProgressInterval.current) {
        clearInterval(masterProgressInterval.current);
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile({ 
        file, 
        name: file.name, 
        size: file.size 
      });
      setError(null);
    }
  };
  const handleStartSeparation = async () => {
    if (!uploadedFile) {
      setError('Vui lòng chọn file nhạc để tách');
      return;
    }

    // Dừng tất cả audio trước khi bắt đầu tách nhạc mới
    stopAllAudio();

    setUploading(true);
    setError(null);
    setProgressLog('');
    setMixResult(null);
    setTrackId(null);
    
    const formData = new FormData();
    formData.append('audio', uploadedFile.file);
    
    try {
      // Bước 1: Upload file và lấy trackId
      console.log('Đang upload file...');
      const uploadRes = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      console.log('Upload thành công:', uploadRes.data);
      const newTrackId = uploadRes.data.trackId;
      
      // Bước 2: Bắt đầu tách nhạc
      console.log('Bắt đầu tách nhạc với trackId:', newTrackId);
      const demucsRes = await axios.post('http://localhost:5000/api/start-demucs', {
        trackId: newTrackId
      });
      
      console.log('Response từ start-demucs:', demucsRes.data);
      setTrackId(newTrackId);
      console.log('TrackId nhận được:', newTrackId);
      
    } catch (err) {
      console.error('Lỗi khi upload/tách nhạc:', err);
      console.error('Response lỗi:', err.response?.data);
      let msg = 'Tách nhạc thất bại';
      if (err.response && err.response.data) {
        if (err.response.data.error) msg = err.response.data.error;
        if (err.response.data.detail) msg += ': ' + err.response.data.detail.slice(-500);
      }
      setError(msg);
      setUploading(false);
    }
  };  // Theo dõi tiến trình tách nhạc
  useEffect(() => {
    if (!trackId) return;
    setProgressLog('');
    let retryCount = 0;
    const maxRetries = 3;
    
    progressInterval.current = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/demucs-progress/${trackId}`);
        
        // Nếu server báo có lỗi, hiển thị
        if (res.data.error) {
          console.error('Demucs error:', res.data.error);
          setError(`Lỗi khi tách nhạc: ${res.data.error}`);
          clearInterval(progressInterval.current);
          setUploading(false);
        }
        
        // Cập nhật log
        if (res.data.log) {
          setProgressLog(res.data.log);
          // Log để debug
          console.log(`Status: ${res.data.done ? 'Done' : 'Running'}`);
        }
        
        // Nếu hoàn thành hoặc server báo đã xong
        if (res.data.done) {
          console.log('Process complete, fetching stems');
          clearInterval(progressInterval.current);
          setUploading(false);
          
          // Add to completed tracks with original filename
          if (uploadedFile) {
            setCompletedTracks(prev => [...prev, {
              trackId: trackId,
              originalName: uploadedFile.name,
              completedAt: new Date().toISOString()
            }]);
          }
          
          // Clear terminal and uploaded file after completion
          setTimeout(() => {
            setProgressLog('');
            setTrackId(null);
            setUploadedFile(null);
          }, 2000); // Show success for 2 seconds
          
          fetchStems();
          retryCount = 0;
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
        retryCount++;
        
        // Chỉ dừng nếu có nhiều lỗi liên tiếp
        if (retryCount >= maxRetries) {
          clearInterval(progressInterval.current);
          setUploading(false);
          setError('Không thể kết nối đến máy chủ để cập nhật tiến trình');
        }
      }
    }, 1000);
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [trackId]);

  const handleSelectStem = (song, stem, url) => {
    // Dừng tất cả audio khi thay đổi selection để tránh nhầm lẫn
    stopAllAudio();
    
    if (selectedStems[stem]?.song === song) {
      // Deselect if already selected
      const newSelected = { ...selectedStems };
      delete newSelected[stem];
      setSelectedStems(newSelected);
    } else {
      // Select new stem
      setSelectedStems(prev => ({
        ...prev,
        [stem]: { song, url }
      }));
    }
  };
  const handleMix = async () => {
    if (Object.keys(selectedStems).length < 2) {
      setError('Vui lòng chọn ít nhất 2 stems để ghép nhạc');
      return;
    }

    if (!songName.trim()) {
      setError('Vui lòng nhập tên bài hát');
      return;
    }

    // Dừng tất cả audio trước khi bắt đầu mixing
    stopAllAudio();

    setMixing(true);
    setError(null);
    
    try {
      const stemPaths = Object.values(selectedStems).map(stem => stem.url);
      const response = await axios.post('http://localhost:5000/api/mix', {
        stemPaths,
        songName: songName.trim()
      });
      
      setMixResult(response.data.mixPath);
      setSongName(''); // Clear the input after successful mix
      fetchMixedSongs(); // Refresh mixed songs list
    } catch (err) {
      console.error('Error mixing stems:', err);
      setError('Ghép nhạc thất bại: ' + (err.response?.data?.error || err.message));
    } finally {
      setMixing(false);
    }
  };

  return (
    <div
      className="min-h-screen p-4 md:p-6 screen-container"
      style={{
        fontFamily: '"Inter", "Segoe UI", "Roboto", "Noto Sans", "Arial", "Helvetica Neue", sans-serif',
      }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 bg-clip-text text-transparent mb-4">
            Music Mixer Studio
          </h1>
          <p className="text-gray-700 text-lg">
            Công cụ tách và phối nhạc như lắp ghép
          </p>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto">
        {/* Masonry/Card Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-16">
          {/* Card 1: Upload & Completed Tracks */}
          <div className="lg:col-span-3 space-y-6">
                          <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl">
                                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm text-white font-semibold">
                    1
                  </span>
                  Upload & Tách nhạc
                </h3>

              {/* File Upload */}
              <div className="mb-6">
                                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="w-full p-3 bg-white/60 border border-blue-200 rounded-xl text-gray-800 placeholder-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 backdrop-blur-sm"
                  />
                                  {uploadedFile && (
                    <div className="mt-3 p-3 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                      <div className="text-gray-800 font-medium truncate">
                        {uploadedFile.name}
                      </div>
                      <div className="text-gray-600 text-sm">
                        Kích thước: {formatFileSize(uploadedFile.size)}
                      </div>
                    </div>
                  )}
              </div>              
              {/* Start Separation Button */}
              {uploadedFile && !uploading && (
                <div className="mb-4">
                  <button
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                    onClick={handleStartSeparation}
                  >
                    Bắt đầu tách nhạc
                  </button>
                </div>
              )}              
              {/* Terminal Log - Only show when actively processing */}
              {uploading && (
                <div className="mt-6 p-4 bg-white/60 rounded-xl backdrop-blur-md border border-blue-200/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-800 font-medium">
                      <span className="flex items-center">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></span>
                        Đang tách nhạc
                      </span>
                    </span>
                  </div>
                  {progressLog && (
                    <div className="p-3 bg-gray-100/80 rounded-xl max-h-64 overflow-y-auto backdrop-blur-sm border border-blue-200/30">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                        {progressLog.slice(-2000)}
                      </pre>
                    </div>
                  )}
                  {!progressLog && (
                    <div className="p-3 bg-gray-100/80 rounded-xl text-center backdrop-blur-sm border border-blue-200/30">
                      <div className="text-gray-700 text-sm">Đang khởi động quá trình tách nhạc...</div>
                    </div>
                  )}
                </div>
              )}

              {/* Completed Tracks Display */}
              {completedTracks.length > 0 && (
                <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-green-400 font-medium flex items-center gap-2">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Đã tách thành công ({completedTracks.length})
                    </h4>
                    <button
                      onClick={clearCompletedTracks}
                      className="text-green-400 hover:text-green-300 text-xs underline"
                    >
                      Xóa lịch sử
                    </button>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {completedTracks.slice(-3).map((track, index) => (
                      <div key={track.trackId} className="flex items-center justify-between p-2 bg-green-500/5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                          </svg>
                          <span className="text-green-300 text-sm font-medium truncate" title={track.originalName}>
                            {track.originalName}
                          </span>
                        </div>
                        <span className="text-green-400 text-xs flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                          {formatDate(track.completedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {completedTracks.length > 3 && (
                    <div className="text-center mt-2">
                      <span className="text-green-400 text-xs">
                        và {completedTracks.length - 3} track khác...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Card 2: Mix Section */}
          <div className="lg:col-span-3">
            <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl h-fit">
                              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm text-white font-semibold">
                    2
                  </span>
                  Ghép stems thành bài hát mới
                </h3>

              {/* Selected Stems Display */}
              {Object.keys(selectedStems).length > 0 && (
                <div className="mb-4 p-3 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                                      <div className="flex items-center justify-between mb-2">
                      <h4 className="text-gray-800 font-medium text-sm">
                        Stems đã chọn ({Object.keys(selectedStems).length}):
                      </h4>
                    {Object.keys(selectedStems).length >= 2 && (
                      <div className="flex items-center gap-2">
                        <button
                          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
                          onClick={playAllSelectedStems}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Chạy thử
                        </button>
                        <button
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
                          onClick={stopAllSelectedStems}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M6 6h12v12H6z" />
                          </svg>
                          Dừng
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedStems).map(([stem, data]) => (
                      <div
                        key={stem}
                        className="bg-white/60 rounded-xl p-2 text-center backdrop-blur-sm border border-blue-200/50"
                      >
                        <div className="text-xs font-medium text-gray-800 capitalize mb-1 flex items-center justify-center gap-1">
                          {stem === "vocals" ? (
                            <>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                              </svg>
                              Vocal
                            </>
                          ) : stem === "drums" ? (
                            <>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                                <circle cx="10" cy="10" r="3"/>
                              </svg>
                              Drums
                            </>
                          ) : stem === "bass" ? (
                            <>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z"/>
                                <path d="M6 7h2v6H6V7zm4 0h2v6h-2V7z"/>
                              </svg>
                              Bass
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                              </svg>
                              Other
                            </>
                          )}
                        </div>
                        <div
                          className="text-xs text-gray-600 truncate"
                          title={data.song}
                        >
                          {data.song}
                        </div>
                        {playingStems[`${data.song}_${stem}`] && (
                          <div className="mt-1">
                            <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Master Progress Bar */}
                  {Object.keys(selectedStems).length >= 2 && (
                    <div className="mt-4 p-3 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-gray-800 font-medium text-xs">Mixing Progress...</h5>
                        <div className="text-xs text-gray-600">
                          {formatTime(masterCurrentTime)} / {formatTime(masterDuration)}
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div 
                        className="relative w-full h-3 bg-gray-200/60 rounded-full cursor-pointer group hover:h-4 transition-all duration-200"
                        onMouseDown={handleMouseDown}
                      >
                        {/* Background track */}
                        <div className="absolute inset-0 bg-gray-200/60 rounded-full"></div>
                        
                        {/* Progress fill */}
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-100"
                          style={{ 
                            width: masterDuration > 0 ? `${(masterCurrentTime / masterDuration) * 100}%` : '0%' 
                          }}
                        ></div>
                        
                        {/* Hover indicator */}
                        <div className="absolute top-0 left-0 w-full h-full rounded-full bg-blue-100/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        
                        {/* Progress handle */}
                        <div 
                          className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 border-blue-500"
                          style={{ 
                            left: masterDuration > 0 ? `calc(${(masterCurrentTime / masterDuration) * 100}% - 8px)` : '0px' 
                          }}
                        ></div>
                      </div>
                      
                      {/* Playback status */}
                      {isPlaying && (
                        <div className="flex items-center justify-center mt-2">
                          <div className="flex items-center gap-2 text-xs text-green-400">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            Đang phát {Object.keys(selectedStems).length} stems
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Song Name Input */}
              {Object.keys(selectedStems).length >= 2 && (
                <div className="mb-4">
                  <label className="block text-gray-800 font-medium mb-2 text-sm">
                    Tên bài hát mới:
                  </label>
                  <input
                    type="text"
                    value={songName}
                    onChange={(e) => setSongName(e.target.value)}
                    placeholder="Nhập tên cho bài hát của bạn..."
                    className="w-full p-3 bg-white/60 border border-blue-200 rounded-xl text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors duration-200 backdrop-blur-sm"
                  />
                </div>
              )}

              <div className="flex flex-col items-center justify-center gap-4">
                <button
                  className={`w-full px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 ${
                    Object.keys(selectedStems).length < 2 || mixing || !songName.trim()
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                  }`}
                  onClick={handleMix}
                  disabled={mixing || Object.keys(selectedStems).length < 2 || !songName.trim()}
                >
                  {mixing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Đang ghép nhạc...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Ghép các stems đã chọn
                    </>
                  )}
                </button>

                {(Object.keys(selectedStems).length < 2 || !songName.trim()) && (
                  <p className="text-gray-600 text-sm text-center">
                    {Object.keys(selectedStems).length < 2 
                      ? "Chọn ít nhất 2 stems để ghép nhạc"
                      : "Vui lòng nhập tên bài hát"
                    }
                  </p>
                )}
              </div>

              {/* Mix Result */}
              {mixResult && (
                <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <h4 className="text-green-400 font-medium mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Ghép nhạc thành công!
                  </h4>
                  <div className="flex flex-col gap-4">
                    <audio
                      controls
                      src={`http://localhost:5000${mixResult}`}
                      className="w-full rounded-lg"
                      style={{ filter: "hue-rotate(120deg) saturate(0.9)" }}
                    />
                    <a
                      href={`http://localhost:5000${mixResult}`}
                      download
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Tải xuống
                    </a>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-red-400">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {error}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Stems Library Section */}
          <div className="lg:col-span-4">
            <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm text-white font-semibold">
                      3
                    </span>
                    Thư viện Stems
                  </h3>
                                  <button
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                    onClick={fetchStems}
                  >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Làm mới
                </button>
              </div>
              
              {/* Stems Manager - Always visible */}
                <div className="mb-6 p-4 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                  <h4 className="text-gray-800 font-medium mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                      />
                    </svg>
                    ({stemsList.length} tracks)
                  </h4>
                  <div className="grid gap-3 max-h-72 overflow-y-auto">
                    {stemsList.map((song) => {
                      const isExpanded = expandedTracks[song.trackId] || false;
                      return (
                        <div
                          key={song.song}
                          className="bg-white/60 rounded-xl overflow-hidden backdrop-blur-sm border border-blue-200/50"
                        >
                          {/* Compact Header */}
                                                      <div
                              className="p-4 cursor-pointer hover:bg-blue-50/50 transition-colors"
                              onClick={() => toggleTrackExpansion(song.trackId)}
                            >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0 flex items-center gap-3">
                                <svg
                                  className={`w-4 h-4 text-gray-400 transition-transform ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <h5
                                    className="font-medium text-gray-800 truncate"
                                    title={song.song}
                                  >
                                    {song.song}
                                  </h5>
                                  <div className="text-sm text-gray-600 flex items-center gap-4">
                                    {song.createdAt && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                        </svg>
                                        {formatDate(song.createdAt)}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                      </svg>
                                      {formatFileSize(song.totalSize)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                      </svg>
                                      {song.stemCount ||
                                        Object.keys(song.stems).length}{" "}
                                      stems
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                className={`flex-shrink-0 p-2 rounded-lg transition-all duration-200 ${
                                  deletingTrack === song.trackId
                                    ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                                    : "text-red-500 hover:text-red-600 hover:scale-105"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTrack(song.trackId);
                                }}
                                disabled={deletingTrack === song.trackId}
                                title={deletingTrack === song.trackId ? "Đang xóa..." : "Xóa track"}
                              >
                                {deletingTrack === song.trackId ? (
                                  <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expandable Stems Section */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-slate-500/30">
                              <div className="pt-4 space-y-4">
                                {Object.entries(song.stems).map(
                                  ([stemType, stemData]) => (
                                    <div
                                      key={stemType}
                                      className={`bg-slate-700/50 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-slate-600/50 relative ${
                                        selectedStems[stemType]?.song === song.song
                                          ? "ring-2 ring-blue-500 bg-blue-50/10"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        handleSelectStem(
                                          song.song,
                                          stemType,
                                          stemData.url
                                        )
                                      }
                                    >
                                      {/* Selected indicator */}
                                      {selectedStems[stemType]?.song === song.song && (
                                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                          <svg
                                            className="w-4 h-4 text-white"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="font-medium text-gray-800 flex items-center gap-2">
                                          {stemType === "vocals" ? (
                                            <>
                                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                              </svg>
                                              Vocal
                                            </>
                                          ) : stemType === "drums" ? (
                                            <>
                                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                                                <circle cx="10" cy="10" r="3"/>
                                              </svg>
                                              Drums
                                            </>
                                          ) : stemType === "bass" ? (
                                            <>
                                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z"/>
                                                <path d="M6 7h2v6H6V7zm4 0h2v6h-2V7z"/>
                                              </svg>
                                              Bass
                                            </>
                                          ) : (
                                            <>
                                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                              </svg>
                                              Other
                                            </>
                                          )}
                                          {stemData && stemData.size && (
                                            <span className="text-sm text-gray-600">
                                              ({formatFileSize(stemData.size)})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <audio
                                        ref={(el) => {
                                          if (el) {
                                            const audioKey = `${song.song}_${stemType}`;
                                            audioRefs.current[audioKey] = el;
                                            el.onplay = () =>
                                              handleAudioPlay(audioKey);
                                            el.onpause = () =>
                                              handleAudioPause(audioKey);
                                            el.onended = () =>
                                              handleAudioPause(audioKey);
                                          }
                                        }}
                                        controls
                                        src={`http://localhost:5000${stemData.url}`}
                                        className="w-full h-10 rounded-full"
                                        style={{
                                          filter:
                                            "hue-rotate(220deg) saturate(0.8)",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {stemsList.length === 0 && (
                    <div className="text-center py-6">
                      <div className="text-gray-400">
                        Chưa có stems nào trong thư mục output
                      </div>
                    </div>
                  )}
                </div>

              {/* Mixed Songs Section */}
              <div className="mt-6 p-4 bg-white/60 rounded-xl">
                <h4 className="text-gray-800 font-medium mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                  Bài hát đã ghép ({mixedSongs.length})
                </h4>
                                 <div className="grid gap-3 max-h-40 overflow-y-auto">
                  {mixedSongs.map((song, index) => (
                    <div
                      key={index}
                      className="bg-white/60 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-gray-800 truncate" title={song.name}>
                            {song.name}
                          </h5>
                          <div className="text-sm text-gray-600 flex items-center gap-4">
                            {song.createdAt && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                {formatDate(song.createdAt)}
                              </span>
                            )}
                            {song.size && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                                {formatFileSize(song.size)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className={`flex-shrink-0 p-2 rounded-lg transition-all duration-200 ${
                            deletingMixedSong === song.filename
                              ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                              : "hover:text-red-600 text-red-500 hover:scale-105"
                          }`}
                          onClick={() => deleteMixedSong(song.filename)}
                          disabled={deletingMixedSong === song.filename}
                          title={deletingMixedSong === song.filename ? "Đang xóa..." : "Xóa bài hát"}
                        >
                          {deletingMixedSong === song.filename ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="mt-3">
                        <audio
                          controls
                          src={`http://localhost:5000${song.path}`}
                          className="w-full h-10 rounded-full"
                          style={{ filter: "hue-rotate(120deg) saturate(0.9)" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {mixedSongs.length === 0 && (
                  <div className="text-center py-6">
                    <div className="text-gray-400">
                      Chưa có bài hát nào được ghép
                    </div>
                  </div>
                )}
              </div>

              {/* Empty state when no stems */}
              {stemsList.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-10 h-10 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-lg">
                    Chưa có bài hát nào được tách
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    Upload và tách nhạc để xem stems tại đây
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
