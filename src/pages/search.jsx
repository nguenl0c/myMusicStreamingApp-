import React, { useState } from 'react';
import { callSpotifyAPI } from "../spotify";
import { IconContext } from "react-icons";
import { AiFillPlayCircle } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

export default function Search() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [artistTracks, setArtistTracks] = useState(null);
  const [_selectedArtist, setSelectedArtist] = useState(null);
  
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search) return;
    
    setLoading(true);
    try {
      const response = await callSpotifyAPI('get', '/search', {
        params: { q: search, type: 'track,artist,album', limit: 10 }
      });
      setSearchResults(response);
      setArtistTracks(null);
      setSelectedArtist(null);
      setLoading(false);
    } catch (error) {
      console.error("Lỗi tìm kiếm:", error);
      setLoading(false);
    }
  };

  const playTrack = (track) => {
    navigate("/players", {
      state: {
        type: "album", // Play within the album context
        id: track.album.id,
        offset: { uri: track.uri }, // Start from this specific track
      },
    });
  };

  const playAlbum = (album) => {
    navigate("/players", {
      state: {
        type: "album",
        id: album.id,
      },
    });
  };

  const viewArtist = async (artist) => {
    setLoading(true);
    setSelectedArtist(artist);

    try {
      const response = await callSpotifyAPI('get', `/artists/${artist.id}/top-tracks`, {
        params: { market: 'VN' }
      });
      setArtistTracks({
        name: artist.name,
        id: artist.id,
        tracks: response.tracks,
      });
      setLoading(false);
    } catch (error) {
      console.error("Lỗi khi lấy bài hát của nghệ sĩ:", error);
      setLoading(false);
    }
  };

  const playArtistTracks = () => {
    if (!artistTracks || !artistTracks.id) return;
    navigate("/players", {
      state: {
        type: "artist",
        id: artistTracks.id,
      },
    });
  };
  
  const backToSearch = () => {
    setArtistTracks(null);
    setSelectedArtist(null);
  };

  return (
    <div className="screen-container w-full h-full">
      <div className="w-full h-full p-[3%] overflow-y-auto">
        <h1 className="text-black text-3xl font-bold mb-8">Tìm kiếm</h1>
        
        {/* Form tìm kiếm */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="flex">
            <div className="relative w-full mr-4">
              <input  
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full bg-[#2a2a2a] border-none text-white rounded-full py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#3b8ae8]"
                placeholder="Bạn muốn nghe gì?"
              />
            </div>
            <button 
              type="submit" 
              className="bg-[#3b8ae8] hover:bg-[#2f66c8] text-[#141517] py-3 px-4 rounded-full font-medium text-nowrap"
            >
              Tìm kiếm
            </button>
          </form>
        </div>
        
        {/* Hiển thị kết quả tìm kiếm */}
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-10 h-10 border-4 border-[#2ecd67] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : artistTracks ? (
          <div>
            {/* Hiển thị thông tin nghệ sĩ và bài hát */}
            <div className="flex items-center mb-6">
              <button onClick={backToSearch} className="mr-4 px-4 py-2 bg-[#3b8ae8] text-white rounded-full">
                Quay lại
              </button>
              <h2 className="text-white text-2xl font-bold">Bài hát nổi bật của {artistTracks.name}</h2>
              <button 
                onClick={playArtistTracks}
                className="ml-4 flex items-center bg-[#1DB954] text-white px-4 py-2 rounded-full"
              >
                <IconContext.Provider value={{ size: "24px", color: "#ffffff" }}>
                  <AiFillPlayCircle className="mr-2" />
                </IconContext.Provider>
                Phát tất cả
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {artistTracks.tracks.map((track, index) => (
                <div 
                  key={track.id}
                  className="flex items-center bg-[#181818] p-3 rounded-lg hover:bg-[#282828] transition duration-300 cursor-pointer"
                  onClick={() => playTrack(track)}
                >
                  <div className="w-10 text-gray-400 text-center">{index + 1}</div>
                  <img 
                    src={track.album.images[0]?.url} 
                    alt={track.name}
                    className="w-12 h-12 rounded-md mr-4" 
                  />
                  <div className="flex-grow">
                    <p className="text-white font-medium">{track.name}</p>
                    <p className="text-gray-400 text-sm">{track.album.name}</p>
                  </div>
                  <div className="text-gray-400">{Math.floor(track.duration_ms / 60000)}:{((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* Tracks */}
            {searchResults.tracks && (
              <div className="mb-8">
                <h2 className="text-white text-xl font-bold mb-4">Bài hát</h2>
                <div className="grid grid-cols-5 gap-4">
                  {searchResults.tracks.items.map((track) => (
                    <div 
                      key={track.id} 
                      className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition duration-300 cursor-pointer"
                      onClick={() => playTrack(track)}
                    >
                      <div className="relative mb-4 group">
                        <img 
                          src={track.album.images[0]?.url} 
                          alt={track.name}
                          className="w-full aspect-square object-cover rounded-md shadow-lg" 
                        />
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <IconContext.Provider value={{ size: "40px", color: "#2ecd67" }}>
                            <AiFillPlayCircle />
                          </IconContext.Provider>
                        </div>
                      </div>
                      <p className="text-white font-medium truncate">{track.name}</p>
                      <p className="text-gray-400 text-sm truncate">{track.artists[0].name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Artists */}
            {searchResults.artists && (
              <div className="mb-8">
                <h2 className="text-white text-xl font-bold mb-4">Nghệ sĩ</h2>
                <div className="grid grid-cols-5 gap-4">
                  {searchResults.artists.items.map((artist) => (
                    <div 
                      key={artist.id} 
                      className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition duration-300 cursor-pointer"
                      onClick={() => viewArtist(artist)}
                    >
                      <img 
                        src={artist.images[0]?.url || "https://i.scdn.co/image/ab6761610000e5eb5317a5879a313cbfb73a0eb0"} 
                        alt={artist.name}
                        className="w-full aspect-square object-cover rounded-full shadow-lg mb-4" 
                      />
                      <p className="text-white font-medium text-center truncate">{artist.name}</p>
                      <p className="text-gray-400 text-sm text-center">Nghệ sĩ</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Albums */}
            {searchResults.albums && (
              <div>
                <h2 className="text-white text-xl font-bold mb-4">Album</h2>
                <div className="grid grid-cols-5 gap-4">
                  {searchResults.albums.items.map((album) => (
                    <div 
                      key={album.id} 
                      className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition duration-300 cursor-pointer"
                      onClick={() => playAlbum(album)}
                    >
                      <div className="relative mb-4 group">
                        <img 
                          src={album.images[0]?.url} 
                          alt={album.name}
                          className="w-full aspect-square object-cover rounded-md shadow-lg" 
                        />
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <IconContext.Provider value={{ size: "40px", color: "#2ecd67" }}>
                            <AiFillPlayCircle />
                          </IconContext.Provider>
                        </div>
                      </div>
                      <p className="text-white font-medium truncate">{album.name}</p>
                      <p className="text-gray-400 text-sm truncate">{album.artists[0].name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Khi không có kết quả */}
            {searchResults.tracks && searchResults.tracks.items.length === 0 && (
              <div className="text-center text-gray-400 py-10">
                Không tìm thấy kết quả nào cho "{search}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
// ```
