import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function Mixer() {const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stemsList, setStemsList] = useState([]);
  const [selectedStems, setSelectedStems] = useState({});
  const [mixing, setMixing] = useState(false);
  const [mixResult, setMixResult] = useState(null);
  const [error, setError] = useState(null);  const [trackId, setTrackId] = useState(null);
  const [progressLog, setProgressLog] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null); // { name, duration, id }  const [showOutputManager, setShowOutputManager] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState(null);
  const [playingStems, setPlayingStems] = useState({}); // Track which stems are playing
  const audioRefs = useRef({}); // Store audio element references

  const progressInterval = useRef(null);
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
    return new Date(dateString).toLocaleString();
  };  const fetchStems = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/stems');
      setStemsList(res.data);
    } catch (error) {
      console.error('Error loading stems:', error);
      setError('Không thể tải danh sách stems');
    }
  };

  // Fetch stems list
  useEffect(() => {
    fetchStems();
  }, []);

  // Handle upload chỉ upload file, lấy metadata
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setMixResult(null);
    setTrackId(null);
    setProgress(0);
    setProgressLog('');
    // Lấy metadata bằng Audio API
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      setUploadedFile({
        name: file.name,
        duration: audio.duration,
        file
      });
      URL.revokeObjectURL(url);
      setUploading(false);
    });
    audio.addEventListener('error', () => {
      setError('Không đọc được metadata file');
      setUploading(false);
      URL.revokeObjectURL(url);
    });
  };
  // Bắt đầu tách nhạc khi bấm nút
  const handleStartDemucs = async () => {
    if (!uploadedFile?.file) return;
    console.log('Bắt đầu upload và tách nhạc cho file:', uploadedFile.name);
    setUploading(true);
    setError(null);
    setProgress(0);
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
  };
  // Theo dõi tiến trình tách nhạc
  useEffect(() => {
    if (!trackId) return;
    setProgress(0);
    setProgressLog('');
    progressInterval.current = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/demucs-progress/${trackId}`);
        setProgress(res.data.percent || 0);
        setProgressLog(res.data.log || '');
        if (res.data.done) {
          clearInterval(progressInterval.current);
          setUploading(false);
          fetchStems();
        }
      } catch (error) {
        console.error('Lỗi khi lấy tiến trình:', error);
      }
    }, 1000);
    return () => clearInterval(progressInterval.current);
  }, [trackId]);

  // Handle select stem
  const handleSelectStem = (song, stem, url) => {
    setSelectedStems(prev => ({ ...prev, [stem]: { song, url } }));
  };
  // Handle mix
  const handleMix = async () => {
    setMixing(true);
    setMixResult(null);
    setError(null);
    try {
      const stems = Object.values(selectedStems);
      const res = await axios.post('http://localhost:5000/api/mix', { stems });
      setMixResult(res.data.url);
    } catch {
      setError('Ghép nhạc thất bại');
    }
    setMixing(false);
  };
  return (
    <div className="screen-container min-h-screen p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            🎵 Music Mixer Studio
          </h1>
          <p className="text-gray-300 text-lg">Tách và ghép stem nhạc chuyên nghiệp</p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          
          {/* Upload Section */}
          <div className="xl:col-span-1">
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm">1</span>
                Upload Audio
              </h3>
              
              <label className="group flex flex-col items-center gap-4 cursor-pointer w-full p-6 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl transition-all duration-300 hover:bg-slate-800/50">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-white font-medium block">Chọn file nhạc</span>
                  <span className="text-gray-400 text-sm">MP3, WAV, M4A...</span>
                </div>
                <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" disabled={uploading} />
              </label>

              {uploadedFile && (
                <div className="mt-6 p-4 bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white truncate">{uploadedFile.name}</div>
                      <div className="text-sm text-gray-400">
                        Thời lượng: {uploadedFile.duration ? uploadedFile.duration.toFixed(1) + 's' : 'Đang tải...'}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    onClick={handleStartDemucs}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        Bắt đầu tách nhạc
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Progress Bar */}
              {(uploading || (trackId && progress < 100)) && (
                <div className="mt-6 p-4 bg-slate-700/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Tiến trình</span>
                    <span className="text-blue-400 font-bold">{progress}%</span>
                  </div>
                  <div className="h-3 bg-slate-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out rounded-full" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                  {progressLog && (
                    <div className="mt-3 p-3 bg-slate-800 rounded-lg max-h-32 overflow-y-auto">
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap">{progressLog.slice(-800)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>          {/* Stems Library Section */}
          <div className="xl:col-span-2">
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl">              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center text-sm">2</span>
                  Thư viện Stems
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                    onClick={fetchStems}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Làm mới
                  </button>
                  <button
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                    onClick={() => setShowOutputManager(!showOutputManager)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                    {showOutputManager ? 'Ẩn quản lý' : 'Quản lý thư mục'}
                  </button>
                </div>
              </div>
                {showOutputManager && (
                <div className="mb-6 p-4 bg-slate-700/50 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      Quản lý thư mục output
                    </h4>
                    
                    {stemsList.length > 0 && (
                      <div className="text-sm text-gray-400">
                        {stemsList.length} tracks • {formatFileSize(stemsList.reduce((total, song) => total + (song.totalSize || 0), 0))}
                      </div>
                    )}
                  </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stemsList.map((song) => (
                      <div key={song.song} className="bg-slate-600/50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h5 className="font-medium text-white truncate">{song.song}</h5>                            <div className="text-sm text-gray-400 mt-1">
                              {song.originalFile && (
                                <div>File gốc: {song.originalFile}</div>
                              )}
                              {song.createdAt && (
                                <div>Tạo lúc: {formatDate(song.createdAt)}</div>
                              )}
                              <div>{song.stemCount || Object.keys(song.stems).length} stems • {formatFileSize(song.totalSize)}</div>
                            </div>
                          </div>
                          <button
                            className={`ml-3 px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                              deletingTrack === song.trackId
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                            onClick={() => deleteTrack(song.trackId)}
                            disabled={deletingTrack === song.trackId}
                          >
                            {deletingTrack === song.trackId ? 'Đang xóa...' : 'Xóa'}
                          </button>
                        </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(song.stems).map(([stemType, stemData]) => (
                            <div key={stemType} className="bg-slate-700/50 rounded p-2">
                              <div className="font-medium text-white capitalize mb-1">
                                {stemType === 'vocals' ? '🎤 Vocal' : 
                                 stemType === 'drums' ? '🥁 Drums' : 
                                 stemType === 'bass' ? '🎸 Bass' : '🎹 Other'}
                              </div>
                              {stemData && stemData.size && (
                                <div className="text-gray-400">
                                  {formatFileSize(stemData.size)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {stemsList.length === 0 && (
                    <div className="text-center py-6">
                      <div className="text-gray-400">Chưa có stems nào trong thư mục output</div>
                    </div>
                  )}
                </div>
              )}
              
              {stemsList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-lg">Chưa có bài hát nào được tách</p>
                  <p className="text-gray-500 text-sm mt-1">Upload và tách nhạc để xem stems tại đây</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-white">
                    <thead>
                      <tr className="bg-slate-700/50 rounded-lg">
                        <th className="py-4 px-4 text-left font-semibold">Bài hát</th>
                        <th className="py-4 px-4 text-center font-semibold">🎤 Vocal</th>
                        <th className="py-4 px-4 text-center font-semibold">🥁 Drums</th>
                        <th className="py-4 px-4 text-center font-semibold">🎸 Bass</th>
                        <th className="py-4 px-4 text-center font-semibold">🎹 Other</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {stemsList.map((song, index) => (
                        <tr key={song.song} className={`border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors duration-200 ${index % 2 === 0 ? 'bg-slate-800/20' : ''}`}>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">{index + 1}</span>
                              </div>
                              <div>
                                <div className="font-medium text-white truncate max-w-xs">{song.song}</div>
                                <div className="text-sm text-gray-400">
                                  {Object.keys(song.stems).length} stems có sẵn
                                </div>
                              </div>
                            </div>
                          </td>
                          {['vocals', 'drums', 'bass', 'other'].map(stem => (
                            <td key={stem} className="py-4 px-4">
                              {song.stems[stem] ? (
                                <div className="flex flex-col items-center gap-3">
                                  <button
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                                      selectedStems[stem]?.song === song.song 
                                        ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg' 
                                        : 'bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white'
                                    }`}
                                    onClick={() => handleSelectStem(song.song, stem, song.stems[stem].url)}
                                  >
                                    {selectedStems[stem]?.song === song.song ? '✓ Đã chọn' : 'Chọn'}
                                  </button>                                  <audio 
                                    controls 
                                    src={`http://localhost:5000${song.stems[stem].url}`} 
                                    className="w-36 h-8 rounded-lg" 
                                    style={{filter: 'hue-rotate(220deg) saturate(0.8)'}}
                                  />
                                </div>
                              ) : (
                                <div className="flex justify-center">
                                  <span className="text-gray-500 bg-slate-700/30 px-3 py-1 rounded-full text-sm">Không có</span>
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mix Section */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-sm">3</span>
              Ghép stems thành bài hát mới
            </h3>

            {/* Selected Stems Display */}
            {Object.keys(selectedStems).length > 0 && (
              <div className="mb-6 p-4 bg-slate-700/50 rounded-xl">
                <h4 className="text-white font-medium mb-3">Stems đã chọn:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(selectedStems).map(([stem, data]) => (
                    <div key={stem} className="bg-slate-600/50 rounded-lg p-3 text-center">
                      <div className="text-sm font-medium text-white capitalize mb-1">
                        {stem === 'vocals' ? '🎤 Vocal' : 
                         stem === 'drums' ? '🥁 Drums' : 
                         stem === 'bass' ? '🎸 Bass' : '🎹 Other'}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{data.song}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                className={`px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center gap-3 ${
                  Object.keys(selectedStems).length < 2 || mixing
                    ? 'bg-slate-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                }`}
                onClick={handleMix}
                disabled={mixing || Object.keys(selectedStems).length < 2}
              >
                {mixing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang ghép nhạc...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Ghép các stems đã chọn
                  </>
                )}
              </button>
              
              {Object.keys(selectedStems).length < 2 && (
                <p className="text-gray-400 text-sm">Chọn ít nhất 2 stems để ghép nhạc</p>
              )}
            </div>

            {/* Mix Result */}
            {mixResult && (
              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <h4 className="text-green-400 font-medium mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Ghép nhạc thành công!
                </h4>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <audio 
                    controls 
                    src={`http://localhost:5000${mixResult}`} 
                    className="flex-1 w-full rounded-lg" 
                    style={{filter: 'hue-rotate(120deg) saturate(0.9)'}}
                  />
                  <a 
                    href={`http://localhost:5000${mixResult}`} 
                    download 
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
