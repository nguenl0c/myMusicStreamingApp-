import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom';
import { getAPIKit } from '../spotify';
import Queue from '../components/audioPlayer/queue';
import AudioPlayer from '../components/audioPlayer/audioPlayer';

export default function Players({ isPremium = false, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  // Dùng để lấy preview URL khi không có Premium
  const fetchPreviewUrl = async (trackId) => {
    if (!trackId) return null;
    
    try {
      const apiClient = getAPIKit();
      const response = await apiClient.get(`/tracks/${trackId}`);
      
      if (response.data && response.data.preview_url) {
        return response.data.preview_url;
      }
      return null;
    } catch (error) {
      console.error("Lỗi khi lấy preview URL:", error);
      return null;
    }
  };
  
  // Lấy danh sách nhạc local (for dual player)
  useEffect(() => {
  // Lấy danh sách nhạc local (for dual player)
  // Đã loại bỏ localTracks vì không sử dụng
    const fetchData = async () => {
      // Reset error state at start
      setError(null);
      
      try {
        if (!location.state) {
          // Không set error, để hiển thị màn hình chờ
          return;
        }
        
        const apiClient = getAPIKit();
        
        // Kiểm tra xem có formattedTracks trực tiếp từ trang Search không
        if (location.state.formattedTracks) {
          console.log("Sử dụng formattedTracks từ Search:", location.state.formattedTracks.length);
          setTracks(location.state.formattedTracks);
          setCurrentTrack(location.state.trackData);
          
          // Kiểm tra isPlaying để tự động phát nếu được yêu cầu
          if (location.state.isPlaying) {
            setIsPlaying(true);
          }
          
          // Nếu không phải Premium, lấy preview URL cho bài hát
          if (!isPremium && location.state.trackData) {
            const url = await fetchPreviewUrl(location.state.trackData.id);
            setPreviewUrl(url);
          }
          return;
        }
        
        // Xử lý theo loại: playlist hoặc track
        if (location.state.type === 'track' && location.state.trackData) {
          console.log("Đang xử lý track riêng lẻ:", location.state.trackData.name);
          // Nếu là track riêng lẻ từ search
          setCurrentTrack(location.state.trackData);
          
          // Nếu không phải Premium, lấy preview URL cho bài hát
          if (!isPremium) {
            const url = await fetchPreviewUrl(location.state.trackData.id);
            setPreviewUrl(url);
          }
          
          // Lấy các track liên quan từ album chứa track này
          if (location.state.context && location.state.context.includes('album')) {
            const albumId = location.state.context.split(':').pop();
            console.log("Lấy tracks từ album:", albumId);
            try {
              const response = await apiClient.get(`/albums/${albumId}/tracks`);
              if (response.data && response.data.items) {
                // Format dữ liệu để phù hợp với cấu trúc
                const formattedTracks = response.data.items.map(item => ({
                  track: item
                }));
                setTracks(formattedTracks);
              }
            } catch (err) {
              console.error("Lỗi khi lấy tracks từ album:", err);
              // Nếu không lấy được tracks từ album, vẫn hiển thị track hiện tại
              setTracks([{ track: location.state.trackData }]);
            }
          } else {
            console.log("Không có context album, chỉ hiển thị track hiện tại");
            // Nếu không có album, chỉ hiển thị track hiện tại
            setTracks([{ track: location.state.trackData }]);
          }
        } 
        // Xử lý albums
        else if (location.state.type === 'album' && location.state.id) {
          console.log("Đang xử lý album:", location.state.id);
          try {
            const response = await apiClient.get(`/albums/${location.state.id}/tracks`);
            
            if (response.data && response.data.items && response.data.items.length > 0) {
              console.log(`Đã tìm thấy ${response.data.items.length} tracks trong album`);
              // Format dữ liệu để phù hợp với cấu trúc
              const formattedTracks = response.data.items.map(item => ({
                track: item
              }));
              setTracks(formattedTracks);
              setCurrentTrack(response.data.items[0]);
              
              // Nếu không phải Premium, lấy preview URL cho bài hát đầu tiên
              if (!isPremium) {
                const url = await fetchPreviewUrl(response.data.items[0].id);
                setPreviewUrl(url);
              }
              
              // Kiểm tra isPlaying để tự động phát nếu được yêu cầu
              if (location.state.isPlaying) {
                setIsPlaying(true);
              }
            } else {
              setError("Album không có bài hát nào");
            }
          } catch (err) {
            console.error("Lỗi khi lấy album:", err);
            setError("Không thể tải danh sách bài hát từ album");
          }
        }
        // Xử lý playlist
        else if (location.state.id) {
          console.log("Đang xử lý playlist:", location.state.id);
          try {
            const response = await apiClient.get(`/playlists/${location.state.id}/tracks`);
            
            if (response.data && response.data.items && response.data.items.length > 0) {
              console.log(`Đã tìm thấy ${response.data.items.length} tracks trong playlist`);
              setTracks(response.data.items);
              setCurrentTrack(response.data.items[0].track);
              
              // Nếu không phải Premium, lấy preview URL cho bài hát đầu tiên
              if (!isPremium) {
                const url = await fetchPreviewUrl(response.data.items[0].track.id);
                setPreviewUrl(url);
              }
              
              // Kiểm tra isPlaying để tự động phát nếu được yêu cầu
              if (location.state.isPlaying) {
                setIsPlaying(true);
              }
            } else {
              setError("Playlist không có bài hát nào");
            }
          } catch (err) {
            console.error("Lỗi khi lấy playlist:", err);
            setError("Không thể tải danh sách bài hát từ playlist");
          }
        } else {
          // Không set error, để hiển thị màn hình chờ
          console.log("Không có thông tin đầy đủ để phát nhạc, hiển thị màn hình chờ");
        }
      } catch (err) {
        console.error("Lỗi khi lấy danh sách bài hát:", err);
        setError("Không thể tải thông tin bài hát");
      }
    };
    
    fetchData();
  }, [location.state, isPremium]);

  // Cập nhật currentTrack khi currentIndex thay đổi
  useEffect(() => {
    const updateCurrentTrack = async () => {
      if (tracks && tracks.length > 0 && currentIndex >= 0 && currentIndex < tracks.length) {
        const track = tracks[currentIndex].track;
        setCurrentTrack(track);
        
        // Nếu không phải Premium, lấy preview URL cho bài hát
        if (!isPremium) {
          const url = await fetchPreviewUrl(track.id);
          setPreviewUrl(url);
        }
      }
    };
    
    updateCurrentTrack();
  }, [currentIndex, tracks, isPremium]);



//--------------------------------------------------------------------------------------------------------------------------------------
  // Nếu có lỗi, hiển thị thông báo
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen screen_container p-6">
        <div className="text-white text-center p-8 bg-[#181818] rounded-lg max-w-md">
          <p className="text-xl text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 bg-[#1DB954] hover:bg-[#1ed760] text-white py-2 px-4 rounded-full font-medium"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Nếu không có track nào được chọn, hiển thị màn hình chờ đẹp
  if (!currentTrack?.name) {
    return (
      <div className="pt-6 flex flex-col items-center justify-center h-screen screen-container relative">
        
        <div className="w-full h-full flex flex-col items-center justify-center relative z-10">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            {/* Welcome Message */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-black font-soft">
                Hi, {user ? `${user.name}` : "Music Lover"}! 👋
              </h1>
            </div>

            {/* Animated Music Icon */}
            <div className="relative animate-float">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-glow">
                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              {/* Animated rings */}
              <div className="absolute inset-0 w-32 h-32 mx-auto rounded-full border-4 border-blue-400/30 animate-ping"></div>
              <div className="absolute inset-0 w-40 h-40 mx-auto rounded-full border-2 border-purple-400/20 animate-ping" style={{animationDelay: '0.5s'}}></div>
              <div className="absolute inset-0 w-48 h-48 mx-auto rounded-full border border-indigo-400/10 animate-ping" style={{animationDelay: '1s'}}></div>
            </div>

            {/* Instructions */}
            <div className="bg-gradient-to-br from-[#181818]/60 to-[#2a2a2a]/70 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-gray-700/50">
              <h3 className="text-2xl font-semibold text-white font-soft mb-6">
                Một số tính năng của dự án! 🎵
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start space-x-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white font-soft">Tìm kiếm bài hát</h4>
                    <p className="text-gray-400 font-smooth text-sm">Sử dụng thanh tìm kiếm để khám phá hàng triệu bài hát</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-xl border border-green-500/20">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white font-soft">Duyệt Thư viện</h4>
                    <p className="text-gray-400 font-smooth text-sm">Khám phá playlist và album từ thư viện của bạn</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
                <button
                  onClick={() => navigate('/search')}
                  className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-soft relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center space-x-2">
                    <span>🔍</span>
                    <span>Tìm kiếm nhạc</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </button>
                <button
                  onClick={() => navigate('/library')}
                  className="group px-8 py-4 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-soft relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center space-x-2">
                    <span>📚</span>
                    <span>Thư viện</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-teal-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </button>
                <button
                  onClick={() => navigate('/Mixer')}
                  className="group px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-soft relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center space-x-2">
                    <span>🎛️</span>
                    <span>Mixer</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </button>
              </div>
            </div>

            {/* Fun Facts & Tips */}
            <div className="grid md:grid-cols-3 gap-4 mt-8">
              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-4 rounded-xl border border-orange-500/20 text-center">
                <div className="text-2xl mb-2">🎧</div>
                <h4 className="text-sm font-semibold text-white font-soft">Chất lượng cao</h4>
                <p className="text-xs text-gray-400 font-smooth">Streaming 320kbps</p>
              </div>
              
              <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 p-4 rounded-xl border border-pink-500/20 text-center">
                <div className="text-2xl mb-2">🎵</div>
                <h4 className="text-sm font-semibold text-white font-soft">Hàng triệu bài hát</h4>
                <p className="text-xs text-gray-400 font-smooth">Khám phá không giới hạn</p>
              </div>
              
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-4 rounded-xl border border-cyan-500/20 text-center">
                <div className="text-2xl mb-2">🎛️</div>
                <h4 className="text-sm font-semibold text-white font-soft">Tính năng Mixer</h4>
                <p className="text-xs text-gray-400 font-smooth">Tách nhạc chuyên nghiệp</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-6 screen-container">
      {!isPremium && previewUrl === null && currentTrack?.name && (
        <div className="w-full mb-4 bg-yellow-600 text-white p-3 text-center rounded-lg">
          Không có preview cho bài hát "{currentTrack.name}". Vui lòng chọn bài
          khác.
        </div>
      )}

      <div className="w-full h-full flex flex-col">
        <div className="flex-grow flex flex-col justify-between md:flex-row gap-6 pt-6 ">
          {/* Album/Track Info & Controls - Left Side (45%%) */}
          <div className="flex flex-col justify-center md:w-[45%] w-full">
            <div className="mb-4">
              {currentTrack?.album && (
                <div
                  className="bg-gradient-to-br from-[#ffffff]/30 to-[#C9DFF5]/50 
                                rounded-3xl p-4 shadow-lg"
                >
                  <img
                    src={currentTrack.album.images?.[0]?.url}
                    alt={currentTrack.name}
                    className="w-full max-w-[300px] object-cover rounded-md mb-4 shadow-md mx-auto"
                  />

                  {/* Controls dưới album */}
                  <div className="mt-6 flex justify-center">
                    <AudioPlayer
                      currentTrack={currentTrack}
                      currentIndex={currentIndex}
                      setCurrentIndex={setCurrentIndex}
                      tracks={tracks}
                      isPremium={isPremium}
                      previewUrl={previewUrl}
                      isPlaying={isPlaying}
                      setIsPlaying={setIsPlaying}
                      userPaused={userPaused}
                      setUserPaused={setUserPaused}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side (40%) - Thông tin bài hát và Lyrics */}
          <div className="md:w-[50%] w-full">
            <div className="h-full rounded-xl p-6 flex flex-col">
              {/* Song Information Section */}
              <div className="mb-6 flex justify-center">
                {currentTrack?.name ? (
                  <div className="space-y-3 text-center">
                    {/* Song Title */}
                    <div>
                      <h3 className="text-2xl font-bold text-black leading-normal font-soft">
                        {currentTrack.name}
                      </h3>
                    </div>

                    {/* Artist(s) */}
                    <div>
                      <p className="text-blacl/80 font-normal font-smooth">
                        {currentTrack.artists
                          ?.map((artist) => artist.name)
                          .join(", ") || "Không rõ"}
                      </p>
                    </div>

                    {/* Release Date */}
                    {currentTrack.album?.release_date && (
                      <div>
                        <p className="text-black/70 font-normal font-smooth">
                          {new Date(
                            currentTrack.album.release_date
                          ).getFullYear()}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-center py-4 font-smooth">
                    Chưa có bài hát nào được chọn
                  </div>
                )}
              </div>

              {/* Lyrics Section */}
              <div className="flex-1 border-t border-gray-600/50 pt-6">
                <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2 font-soft">
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
                      d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1a1 1 0 011-1h2a1 1 0 011 1v18a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h2z"
                    />
                  </svg>
                  Lyrics
                </h3>

                <div className="bg-gradient-to-br from-[#C9DFF5]/30 to-[#85A5D9]/30 rounded-lg shadow-lg p-4 h-[90%] min-h-[100px] flex flex-col justify-center">
                  {currentTrack?.name ? (
                    <div className="text-center space-y-4">
                      <svg
                        className="w-12 h-12 text-black mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                      <div className="space-y-2">
                        <p className="text-gray-400 text-sm italic font-smooth">
                          Lyrics cho "{currentTrack.name}" 
                        </p>
                        <p className="text-gray-500 text-xs font-smooth">
                          Phần này là để hiện thị lyrics của bài hát
                        </p>
                        <div className="flex justify-center">
                          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-4 py-2 rounded-full">
                            <span className="text-blue-400 text-xs font-normal font-smooth">
                              Coming Soon
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <svg
                        className="w-8 h-8 mx-auto mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                      <p className="text-sm font-smooth">
                        Chọn bài hát để xem lyrics
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Section - Bottom */}
        <div className="mt-6 w-full">
          <Queue
            tracks={tracks}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            isPlaying={isPlaying}
            onPlayPause={() => {
              const newState = !isPlaying;
              setIsPlaying(newState);
              if (!newState) {
                setUserPaused(true);
              } else {
                setUserPaused(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
