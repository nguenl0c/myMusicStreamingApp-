import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAPIKit } from "../spotify";
import { IconContext } from "react-icons";
import { AiFillPlayCircle } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

export default function Library() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextUrl, setNextUrl] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const scrollTimeoutRef = useRef(null);

  const fetchPlaylists = async (url = "me/playlists?limit=30") => {
    try {
      setError(null); // Clear previous errors
      const api = getAPIKit();
      const response = await api.get(url);
      
      // Kiểm tra response data
      if (!response.data || !response.data.items) {
        throw new Error("Invalid response format");
      }
      
      // Thêm vào mảng playlist hiện có nếu đang tải thêm
      if (url !== "me/playlists?limit=30") {
        setPlaylists(prev => [...prev, ...response.data.items]);
      } else {
        setPlaylists(response.data.items);
      }
      
      // Lưu URL tiếp theo nếu có
      if (response.data.next) {
        // Chuyển URL đầy đủ thành path tương đối
        const nextRelativeUrl = response.data.next.replace("https://api.spotify.com/v1/", "");
        setNextUrl(nextRelativeUrl);
      } else {
        setNextUrl(null);
      }
    } catch (error) {
      console.error("Không thể lấy playlist:", error);
      setError(error.message || "Không thể tải playlist");
      // Nếu lỗi xảy ra trong lần load đầu, set empty array
      if (url === "me/playlists?limit=30") {
        setPlaylists([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load thêm khi cuộn xuống với debounce
  const loadMore = useCallback(() => {
    if (nextUrl && !loadingMore && !loading) {
      setLoadingMore(true);
      fetchPlaylists(nextUrl);
    }
  }, [nextUrl, loadingMore, loading]);
    useEffect(() => {
    fetchPlaylists();
    
    // Cleanup timeout khi component unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const navigate = useNavigate();

  const playPlaylist = (id) => {
    navigate("/players", { state: { id: id } });
  };
  return (
    <div className="screen-container w-full h-full p-0 m-0">      <div 
        className="w-full h-full p-[3%] flex flex-wrap justify-start gap-6 overflow-y-auto" 
        onScroll={(e) => {
          // Clear timeout trước đó
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          
          // Debounce scroll handling
          scrollTimeoutRef.current = setTimeout(() => {
            const { scrollTop, scrollHeight, clientHeight } = e.target;
            const threshold = 50; // 50px threshold
            const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;
            
            if (isNearBottom && nextUrl && !loadingMore && !loading) {
              loadMore();
            }
          }, 100); // 100ms debounce
        }}
      >
        
        {loading ? (    
          <div className="w-full flex justify-center items-center h-40">
            <div className="w-10 h-10 border-4 border-[#2ecd67] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="w-full text-center text-red-500 mt-10">
            <p>❌ {error}</p>
            <button 
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchPlaylists();
              }}
              className="mt-4 px-4 py-2 bg-[#2ecd67] text-white rounded-lg hover:bg-[#25a855]"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <>  
            {playlists?.map((playlist) => (
              <div
                className="relative w-[15%] h-[35%] rounded-[20px] p-[1%] mb-[2%] 
                          bg-gradient-to-r from-[rgb(40,58,88)] to-[rgba(54,69,98,0)] cursor-pointer transition-all duration-200 hover:scale-[1.05]"
                key={playlist.id}
                onClick={() => playPlaylist(playlist.id)}
              >
                <img
                  src={playlist.images?.[0]?.url || "https://community.spotify.com/t5/image/serverpage/image-id/25294i2836BD1C1A31BDF2"}
                  className="w-full aspect-square rounded-[15px]"
                  alt="Playlist-Art"
                  onError={(e) => {
                    e.target.src = "https://community.spotify.com/t5/image/serverpage/image-id/25294i2836BD1C1A31BDF2";
                  }}
                />
                <p className="font-extrabold text-base text-[#c4d0e3] my-[10px] overflow-hidden text-ellipsis line-clamp-2">
                  {playlist.name || "Unnamed Playlist"}
                </p>
                <p className="font-normal text-xs m-0 text-[#c4d0e37c]">
                  {playlist.tracks?.total || 0} Songs
                </p>
                <div className="absolute right-0 bottom-0 opacity-0 w-full h-[30%] rounded-[20px] 
                                bg-gradient-to-t from-[rgba(54,69,98,1)] via-[rgba(54,69,98,0.5)] to-[rgba(54,69,98,0)] 
                                flex items-end justify-end p-[8%] 
                                transition-all duration-500 group-hover:opacity-100 hover:opacity-100">
                  <IconContext.Provider value={{ size: "50px", color: "#E99D72" }}>
                    <AiFillPlayCircle />
                  </IconContext.Provider>
                </div>
              </div>
            ))}
            
            {loadingMore && (
              <div className="w-full flex justify-center items-center h-20">
                <div className="w-8 h-8 border-4 border-[#2ecd67] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* Hiển thị khi đã load hết */}
            {!loadingMore && !nextUrl && playlists.length > 0 && (
              <div className="w-full text-center text-black/80 mt-10 opacity-60">
                🎵 Đã hiển thị tất cả playlist ({playlists.length} playlists)
              </div>
            )}
          </>
        )}
        
        {!loading && !error && playlists.length === 0 && (
          <div className="w-full text-center text-[#c4d0e3] mt-10">
            Không tìm thấy playlist nào. Hãy tạo playlist mới trên Spotify!
          </div>
        )}
      </div>
    </div>
  );
}
