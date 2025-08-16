import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { callSpotifyAPI } from '../spotify.js';
import useSpotifyPlayer from '../hooks/useSpotifyPlayer';

// Import các component con
import Queue from '../components/audioPlayer/queue';
import PlayerControls from '../components/audioPlayer/PlayerControls';

// --- COMPONENT CON: Khung hiển thị lời bài hát (Placeholder) ---
const LyricsView = ({ trackName }) => {
    return (
        <div className="w-full h-full bg-black/20 rounded-tl-2xl p-6 flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4">Lời bài hát</h2>
            <div className="flex-grow rounded-lg bg-black/30 flex flex-col items-center justify-center text-center text-white/50 p-4">
                <p className="text-lg font-semibold">"{trackName || '...'}"</p>
                <p className="mt-2 text-sm">Tính năng hiển thị lời bài hát sẽ sớm được cập nhật.</p>
            </div>
        </div>
    );
};


// --- COMPONENT CON: Khung hiển thị Playlist của người dùng (Hiển thị ngang) ---
const UserPlaylistsView = ({ onSelectPlaylist }) => {
    const [playlists, setPlaylists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserPlaylists = async () => {
            setIsLoading(true);
    try {
        const response = await callSpotifyAPI('get', '/me/playlists', { params: { limit: 30 } });
        setPlaylists(response?.items || []);
            } catch (error) {
                console.error("Không thể lấy danh sách playlist của người dùng:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserPlaylists();
    }, []);

    return (
        <div className="w-full h-full bg-gray-500/10 p-6 flex flex-col">
            <h2 className="text-4xl font-bold text-white mb-4">Other Playlists</h2>
            <div className="flex-grow overflow-x-auto custom-scrollbar">
                {isLoading ? (
                    <div className="text-center text-white/50">Đang tải playlists...</div>
                ) : (
                    <div className="flex gap-4 h-full">
                        {playlists.map(playlist => (
                            <div
                                key={playlist.id}
                                className="flex-shrink-0 w-auto h-full flex flex-col items-center justify-center p-2 rounded-md hover:bg-white/10 cursor-pointer transition-colors"
                                onClick={() => onSelectPlaylist(playlist.id, 'playlist')}
                            >
                                <img
                                    src={playlist.images?.[0]?.url || 'https://via.placeholder.com/150'}
                                    alt={playlist.name}
                                    className="w-50 aspect-square rounded-2xl object-cover"
                                />
                                <p className="text-white text-lg text-center mt-2 overflow-hidden text-ellipsis whitespace-nowrap w-full">{playlist.name}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENT CON: Hàng đợi (Hiển thị dọc) ---
const VerticalQueue = ({ tracks, playerState, onSelectTrack }) => {
    const currentTrackId = playerState?.track_window?.current_track?.id;

    return (
        <div className="w-full h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-2">
                {tracks.map((item, index) => {
                    const track = item.track || item;
                    if (!track) return null;

                    const isCurrentTrack = track.id === currentTrackId;
                    const imageUrl = track.album?.images?.[0]?.url || 'https://via.placeholder.com/80';

                    return (
                        <div
                            key={index + "-" + track.id}
                            className={`transition-all duration-300 w-full p-3 rounded-2xl flex items-center gap-4 cursor-pointer
                                        ${isCurrentTrack ? "bg-[#3A8AE7]" : "bg-gray-500/10 hover:bg-gray-500/20"}`}
                            onClick={() => onSelectTrack(track.uri)}
                        >
                            <img
                                src={imageUrl}
                                alt={track.name}
                                className="w-15 h-15 object-cover rounded-full flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <p className={`font-vt323 font-medium text-lg overflow-hidden text-ellipsis whitespace-nowrap ${isCurrentTrack ? "text-black" : "text-white"}`}>
                                    {track.name}
                                </p>
                                <p className="text-white/70 text-xs overflow-hidden text-ellipsis whitespace-nowrap mt-1">
                                    {track.artists?.map(artist => artist.name).join(", ")}
                                </p>
                            </div>
                            {isCurrentTrack && (
                                <div className="flex-shrink-0 ml-2">
                                    <div className="flex gap-1 items-center">
                                        <span className="w-1 h-3 bg-blue-400 animate-bounce"></span>
                                        <span className="w-1 h-5 bg-blue-400 animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                        <span className="w-1 h-3 bg-blue-400 animate-bounce" style={{animationDelay: '0.4s'}}></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- COMPONENT CHÍNH: Players ---
export default function Players({ isPremium = false }) {
    const location = useLocation();

    const [activeContext, setActiveContext] = useState({ id: null, type: null });
    const [tracks, setTracks] = useState([]);
    const [status, setStatus] = useState('waiting');
    const [_error, setError] = useState(null);

    const { player, isReady, deviceId, playerState } = useSpotifyPlayer();

    useEffect(() => {
        if (location.state?.id && location.state?.type) {
            setActiveContext({ id: location.state.id, type: location.state.type });
        }
    }, [location.state]);

    const startPlayback = useCallback(async (options) => {
        if (!isReady || !deviceId) {
            setTimeout(() => startPlayback(options), 1500);
            return;
        }
        try {
            await callSpotifyAPI('put', `/me/player/play`, {
                params: { device_id: deviceId },
                data: options
            });
        } catch (err) {
            console.error('Playback start failed:', err);
            setError("Không thể phát nhạc.");
            setStatus('error');
        }
    }, [isReady, deviceId]);

    const fetchDataAndPlay = useCallback(async () => {
        if (!activeContext.id || !activeContext.type) {
            setStatus('waiting');
            return;
        }
        setStatus('loading');
        setError(null);
        try {
            const { id, type } = activeContext;
            let contextUri = `spotify:${type}:${id}`;
            let responseTracks = [];
            if (type === 'playlist') {
                const response = await callSpotifyAPI('get', `/playlists/${id}/tracks`);
                responseTracks = response?.items || [];
            } else if (type === 'album') {
                const response = await callSpotifyAPI('get', `/albums/${id}/tracks`);
                responseTracks = response?.items.map(item => ({ track: item })) || [];
            }
            if (responseTracks.length > 0) {
                setTracks(responseTracks);
                setStatus('success');
                startPlayback({ context_uri: contextUri });
            } else {
                throw new Error("Playlist/Album này không có bài hát nào.");
            }
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    }, [activeContext, startPlayback]);

    useEffect(() => {
        if (isPremium) {
            fetchDataAndPlay();
        }
    }, [isPremium, fetchDataAndPlay]);

    const handleSelectTrackInQueue = (trackUri) => {
        const contextUri = `spotify:${activeContext.type}:${activeContext.id}`;
        startPlayback({ context_uri: contextUri, offset: { uri: trackUri } });
    };

    const handleSelectNewPlaylist = (id, type) => {
        setActiveContext({ id, type });
    };

    if (!isPremium) {
        return <div>Tính năng này yêu cầu tài khoản Premium.</div>;
    }

    const currentTrackInfo = playerState?.track_window?.current_track;

    return (
        <div className="flex h-screen w-full screen-container p-4 gap-4">
            {/* Cột Trái: Lyrics và Player (60%) */}
            <div className="w-3/7 h-full flex flex-col gap-4">
                <div className="flex-grow h-[40%]">
                    <LyricsView trackName={currentTrackInfo?.name} />
                </div>
                <div className="flex-shrink-0 h-[60%]">
                    {/* Player sẽ chỉ hiển thị khi có dữ liệu */}
                    {playerState && currentTrackInfo ? (
                        <div className="w-full h-full bg-black/20 rounded-bl-2xl p-6 flex flex-col justify-center items-center">
                            <img src={currentTrackInfo.album.images?.[0]?.url} alt={currentTrackInfo.name} className="w-full max-w-[200px] aspect-square object-cover rounded-2xl shadow-2xl mb-4" />
                            <h3 className="text-xl font-bold text-white text-center">{currentTrackInfo.name}</h3>
                            <p className="text-white/70 text-center mb-4 text-sm">{currentTrackInfo.artists?.map((artist) => artist.name).join(", ")}</p>
                            <PlayerControls player={player} playerState={playerState} />
                        </div>
                    ) : (
                        // Placeholder cho Player
                        <div className="w-full h-full bg-black/20 rounded-bl-2xl p-6 flex flex-col justify-center items-center text-white/50">
                            Trình phát nhạc sẽ hiển thị ở đây.
                        </div>
                    )}
                </div>
            </div>

            {/* Cột Phải: Queue và Playlists (40%) */}
            <div className="w-4/7 h-full flex flex-col p-6 gap-6">
                {/* Phần Queue */}
                <div className="flex-shrink-0 h-[50%] flex flex-col">
                    <h1 className="text-3xl font-bold text-white mb-4 flex-shrink-0">Queue</h1>
                    <div className="flex-grow min-h-0">
                        {status === 'success' && tracks.length > 0 ? (
                            <VerticalQueue tracks={tracks} playerState={playerState} onSelectTrack={handleSelectTrackInQueue} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/50">
                                {status === 'loading' ? 'Đang tải...' : 'Hàng đợi trống.'}
                            </div>
                        )}
                    </div>
                </div>
                {/* Phần Playlist (Hiển thị ngay lập tức) */}
                <div className="flex-grow min-h-0 flex flex-col">
                    <UserPlaylistsView onSelectPlaylist={handleSelectNewPlaylist} />
                </div>
            </div>
        </div>
    );
}