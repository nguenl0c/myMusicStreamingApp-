// src/screens/unifiedPlaylists.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import unifiedPlaylistManager from '../services/unifiedPlaylistManager';
import { getAllTracks } from '../services/localMusicDB';
import { callSpotifyAPI } from '../spotify';
import LocalTrackUploader from '../components/audioPlayer/localTrackUploader';

export default function UnifiedPlaylists() {
    const navigate = useNavigate();
    const [playlists, setPlaylists] = useState([]);
    const [localTracks, setLocalTracks] = useState([]);
    const [spotifySearchResults, setSpotifySearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
    const [spotifyPlaylistInput, setSpotifyPlaylistInput] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState(null);

    // Lấy danh sách playlist
    useEffect(() => {
        const loadPlaylists = () => {
            const list = unifiedPlaylistManager.getPlaylists();
            setPlaylists(list);
        };

        loadPlaylists();

        // Load local tracks
        const loadLocalTracks = async () => {
            try {
                const tracks = await getAllTracks();
                setLocalTracks(tracks);
            } catch (error) {
                console.error('Error loading local tracks:', error);
            }
        };

        loadLocalTracks();
    }, []);

    // Tìm kiếm nhạc Spotify
    const searchSpotify = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);

        try {
            const response = await callSpotifyAPI('get', '/search', {
                params: { q: searchQuery, type: 'track', limit: 10 }
            });

            if (response && response.tracks && response.tracks.items) {
                setSpotifySearchResults(response.tracks.items);
            }
        } catch (error) {
            console.error('Error searching Spotify:', error);
            setError('Không thể tìm kiếm nhạc trên Spotify');
        } finally {
            setIsSearching(false);
        }
    };

    // Tạo playlist mới
    const createNewPlaylist = () => {
        if (!newPlaylistName.trim()) {
            setError('Vui lòng nhập tên playlist');
            return;
        }

        const playlist = unifiedPlaylistManager.createPlaylist(
            newPlaylistName,
            newPlaylistDescription
        );

        setNewPlaylistName('');
        setNewPlaylistDescription('');
        setPlaylists(unifiedPlaylistManager.getPlaylists());
        setSelectedPlaylist(playlist.id);
    };

    // Import Spotify playlist
    const importSpotifyPlaylist = async () => {
        if (!spotifyPlaylistInput.trim()) {
            setError('Vui lòng nhập ID hoặc URL của Spotify playlist');
            return;
        }

        let playlistId = spotifyPlaylistInput.trim();

        // Extract ID from URL if needed
        if (playlistId.includes('spotify.com/playlist/')) {
            const matches = playlistId.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
            if (matches && matches[1]) {
                playlistId = matches[1];
            }
        }

        setIsImporting(true);

        try {
            const importedId = await unifiedPlaylistManager.importFromSpotifyPlaylist(playlistId);

            if (importedId) {
                setPlaylists(unifiedPlaylistManager.getPlaylists());
                setSelectedPlaylist(importedId);
                setSpotifyPlaylistInput('');
            } else {
                setError('Không thể import playlist từ Spotify');
            }
        } catch (error) {
            console.error('Error importing Spotify playlist:', error);
            setError('Lỗi khi import playlist từ Spotify');
        } finally {
            setIsImporting(false);
        }
    };

    // Thêm bài hát vào playlist
    const addTrackToPlaylist = async (track, source) => {
        if (!selectedPlaylist) {
            setError('Vui lòng chọn playlist');
            return;
        }

        let success = false;

        if (source === 'spotify') {
            success = await unifiedPlaylistManager.addSpotifyTrackToPlaylist(selectedPlaylist, track.id);
        } else {
            success = await unifiedPlaylistManager.addLocalTrackToPlaylist(selectedPlaylist, track.id);
        }

        if (success) {
            setPlaylists(unifiedPlaylistManager.getPlaylists());
        } else {
            setError(`Không thể thêm bài hát ${track.name || track.title} vào playlist`);
        }
    };

    // Mở playlist để phát
    const playPlaylist = (playlistId) => {
        navigate(`/play/${playlistId}`);
    };

    // Các chức năng khác: xóa bài hát, xóa playlist, v.v.
    // ...

    return (
        <div className="unified-playlists screen-container p-4 h-screen">
            <h1 className="text-2xl font-bold mb-6">Virtual Playlist (Beta)</h1>

            {error && (
                <div className="bg-red-500 text-white p-3 rounded-lg mb-4">
                    {error}
                    <button
                        className="ml-4 text-white hover:underline"
                        onClick={() => setError(null)}
                    >
                        Đóng
                    </button>
                </div>
            )}

            {/* Main Layout Container */}
            <div className="flex h-[calc(100vh-120px)] gap-6">
                {/* Left Side - 60% width */}
                <div className="flex flex-col w-[60%] gap-6">
                    {/* Block 1: Create Playlist + Playlist List - 50% height */}
                    <div className="h-[50%] bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            Quản lý Playlist
                        </h2>

                        <div className="flex gap-4 h-[calc(100%-60px)]">
                            {/* Create New Playlist */}
                            <div className="w-[55%] bg-white/60 rounded-xl p-4 backdrop-blur-sm border border-blue-200/50 overflow-y-auto">
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">Tạo playlist mới</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Tên playlist</label>
                                        <input
                                            type="text"
                                            value={newPlaylistName}
                                            onChange={(e) => setNewPlaylistName(e.target.value)}
                                            placeholder="Nhập tên playlist"
                                            className="w-full p-2 bg-white/80 border border-blue-200 rounded-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Mô tả (tùy chọn)</label>
                                        <textarea
                                            value={newPlaylistDescription}
                                            onChange={(e) => setNewPlaylistDescription(e.target.value)}
                                            placeholder="Mô tả về playlist"
                                            className="w-full p-2 bg-white/80 border border-blue-200 rounded-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:outline-none h-14 resize-none text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={createNewPlaylist}
                                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 text-sm"
                                    >
                                        <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                        Tạo playlist
                                    </button>
                                </div>

                                {/* Import từ Spotify */}
                                <div className="mt-4 pt-4 border-t border-blue-200/50">
                                    <h4 className="text-md font-medium text-gray-800 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                                        </svg>
                                        Import từ Spotify
                                    </h4>
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={spotifyPlaylistInput}
                                            onChange={(e) => setSpotifyPlaylistInput(e.target.value)}
                                            placeholder="Nhập Spotify playlist ID/URL"
                                            className="w-full p-2 bg-white/80 border border-blue-200 rounded-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                                        />
                                        <button
                                            onClick={importSpotifyPlaylist}
                                            disabled={isImporting}
                                            className="w-full bg-gradient-to-r from-blue-300 to-blue-600 hover:from-blue-400 hover:to-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 text-sm"
                                        >
                                            {isImporting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline mr-2"></div>
                                                    Đang import...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                    Import Playlist
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Playlist List */}
                            <div className="w-[45%] bg-white/60 rounded-xl p-4 backdrop-blur-sm border border-blue-200/50">
                                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Danh sách playlist
                                </h3>
                                <div className="playlist-list space-y-2 h-[calc(100%-50px)] overflow-y-auto">
                                    {playlists.length === 0 ? (
                                        <div className="text-center text-gray-500 py-8">
                                            Chưa có playlist nào. Hãy tạo playlist mới!
                                        </div>
                                    ) : (
                                        playlists.map(playlist => (
                                            <div
                                                key={playlist.id}
                                                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${selectedPlaylist === playlist.id 
                                                    ? 'bg-blue-100 border-2 border-blue-300' 
                                                    : 'bg-white/80 hover:bg-blue-50 border border-blue-200/50'
                                                }`}
                                                onClick={() => setSelectedPlaylist(playlist.id)}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-medium text-gray-800 truncate">{playlist.name}</h4>
                                                    <div className="flex space-x-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                playPlaylist(playlist.id);
                                                            }}
                                                            className="p-1.5 bg-gradient-to-r from-blue-300 to-blue-600 hover:from-blue-400 hover:to-blue-700 text-white rounded-lg transition-all duration-200"
                                                            title="Phát playlist"
                                                        >
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('Bạn có chắc muốn xóa playlist này?')) {
                                                                    unifiedPlaylistManager.deletePlaylist(playlist.id);
                                                                    setPlaylists(unifiedPlaylistManager.getPlaylists());
                                                                    if (selectedPlaylist === playlist.id) {
                                                                        setSelectedPlaylist(null);
                                                                    }
                                                                }
                                                            }}
                                                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200"
                                                            title="Xóa playlist"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                                    </svg>
                                                    {playlist.tracks.length} bài hát
                                                </p>
                                                {playlist.description && (
                                                    <p className="text-xs text-gray-500 mt-1 truncate">{playlist.description}</p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Block 2: Playlist Content - 50% height */}
                    <div className="h-[50%] bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl">
                        {selectedPlaylist ? (
                            <>
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                    </svg>
                                    Nội dung: {playlists.find(p => p.id === selectedPlaylist)?.name}
                                </h2>

                                <div className="playlist-tracks h-[calc(100%-60px)] overflow-y-auto space-y-2 bg-white/60 rounded-xl p-4 backdrop-blur-sm border border-blue-200/50">
                                    {playlists.find(p => p.id === selectedPlaylist)?.tracks.length === 0 ? (
                                        <div className="text-center text-gray-500 py-8">
                                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                            </svg>
                                            Playlist trống. Hãy thêm nhạc vào playlist!
                                        </div>
                                    ) : (
                                        playlists.find(p => p.id === selectedPlaylist)?.tracks.map((track, index) => (
                                            <div key={`${track.id}-${index}`} className="flex items-center bg-white/80 p-3 rounded-lg border border-blue-200/50 hover:bg-blue-50 transition-colors">
                                                <div className="mr-3 text-gray-500 font-medium w-8 text-center">{index + 1}</div>

                                                <div className="flex-1">
                                                    <h4 className="font-medium text-gray-800 truncate">{track.title}</h4>
                                                    <p className="text-sm text-gray-600 truncate">{track.artist}</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${track.source === 'spotify'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {track.source === 'spotify' ? 'Spotify' : 'Local'}
                                                    </span>

                                                    <button
                                                        onClick={() => {
                                                            unifiedPlaylistManager.removeTrackFromPlaylist(selectedPlaylist, index);
                                                            setPlaylists(unifiedPlaylistManager.getPlaylists());
                                                        }}
                                                        className="p-1 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                                        title="Xóa khỏi playlist"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center text-gray-500">
                                    <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-lg">Chọn một playlist để xem nội dung</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side - 40% width */}
                <div className="w-[40%] flex flex-col gap-6">
                    {/* Block 3a: Local Music */}
                    <div className="h-1/2 bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            </svg>
                            Nhạc Local
                        </h2>

                        {/* Upload nhạc mới */}
                        <div className="mb-4">
                            <LocalTrackUploader
                                onTracksUploaded={() => {
                                    getAllTracks().then(tracks => setLocalTracks(tracks));
                                }}
                            />
                        </div>

                        {/* Danh sách nhạc local */}
                        <div className="local-tracks-list h-[calc(100%-120px)] overflow-y-auto space-y-2 bg-white/60 rounded-xl p-4 backdrop-blur-sm border border-blue-200/50">
                            {localTracks.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                    </svg>
                                    Chưa có nhạc local. Hãy upload nhạc mới!
                                </div>
                            ) : (
                                localTracks.map(track => (
                                    <div key={track.id} className="flex items-center bg-white/80 p-2 rounded-lg border border-blue-200/50 hover:bg-blue-50 transition-colors">
                                        <div className="flex-1 min-w-0 ">
                                            <h4 className="font-medium text-gray-800 truncate text-sm">{track.title}</h4>
                                            <p className="text-xs text-gray-600 truncate">{track.artist}</p>
                                        </div>

                                        <button
                                            onClick={() => addTrackToPlaylist(track, 'local')}
                                            disabled={!selectedPlaylist}
                                            className={`ml-2 p-2 rounded-lg transition-all ${!selectedPlaylist
                                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-blue-300 to-blue-600 hover:from-blue-400 hover:to-blue-700 text-white'
                                                }`}
                                            title="Thêm vào playlist"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Block 3b: Spotify Search */}
                    <div className="h-1/2 bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                            </svg>
                            Tìm nhạc Spotify
                        </h2>

                        <div className="flex mb-4">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm bài hát..."
                                className="flex-1 p-2 bg-white/80 border border-blue-200 rounded-l-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                                onKeyPress={(e) => e.key === 'Enter' && searchSpotify()}
                            />
                                                                    <button
                                            onClick={searchSpotify}
                                            disabled={isSearching || !searchQuery.trim()}
                                            className="bg-gradient-to-r from-blue-300 to-blue-600 hover:from-blue-400 hover:to-blue-700 text-white py-2 px-4 rounded-r-lg disabled:opacity-50 transition-colors"
                                        >
                                            {isSearching ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline mr-2"></div>
                                                    Tìm...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                    Tìm
                                                </>
                                            )}
                                        </button>
                        </div>

                        {/* Kết quả tìm kiếm */}
                        <div className="spotify-search-results h-[calc(100%-120px)] overflow-y-auto bg-white/60 rounded-xl p-4 backdrop-blur-sm border border-blue-200/50">
                            {spotifySearchResults.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                                    </svg>
                                    {isSearching
                                        ? 'Đang tìm kiếm...'
                                        : searchQuery
                                            ? 'Không tìm thấy kết quả'
                                            : 'Nhập từ khóa để tìm kiếm'}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {spotifySearchResults.map(track => (
                                        <div key={track.id} className="flex items-center bg-white/80 p-2 rounded-lg border border-blue-200/50 hover:bg-blue-50 transition-colors">
                                            {track.album.images && track.album.images[0] && (
                                                <img
                                                    src={track.album.images[0].url}
                                                    alt={track.album.name}
                                                    className="w-10 h-10 object-cover rounded mr-3"
                                                />
                                            )}

                                            <div className="flex-1 truncate">
                                                <h4 className="text-gray-800 font-medium text-sm truncate">{track.name}</h4>
                                                <p className="text-xs text-gray-600 truncate">
                                                    {track.artists.map(a => a.name).join(', ')}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => addTrackToPlaylist(track, 'spotify')}
                                                disabled={!selectedPlaylist}
                                                className={`ml-2 p-2 rounded-lg transition-all ${!selectedPlaylist
                                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                        : 'bg-gradient-to-r from-blue-300 to-blue-600 hover:from-blue-400 hover:to-blue-700 text-white'
                                                    }`}
                                                title="Thêm vào playlist"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}