// src/screens/playUnifiedPlaylist.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UnifiedPlayer from '../components/audioPlayer/unifiedPlayer.jsx';
import unifiedPlaylistManager from '../services/unifiedPlaylistManager.js';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function PlayUnifiedPlaylist() {
    const { playlistId } = useParams();
    const navigate = useNavigate();
    const [playlist, setPlaylist] = useState(null);
    const [error, setError] = useState(null);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [tracks, setTracks] = useState([]);

    // DnD-kit setup
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    // Lấy thông tin playlist
    useEffect(() => {
        if (!playlistId) {
            setError('Không tìm thấy playlist ID');
            return;
        }

        const playlist = unifiedPlaylistManager.getPlaylist(playlistId);

        if (!playlist) {
            setError('Không tìm thấy playlist');
            return;
        }

        setPlaylist(playlist);
        
        // Load playable tracks
        const loadTracks = async () => {
            try {
                const playableTracks = await unifiedPlaylistManager.getPlayableTracksForPlaylist(playlistId);
                setTracks(playableTracks);
                if (playableTracks.length > 0) {
                    setCurrentTrack(playableTracks[0]);
                }
            } catch (error) {
                console.error('Error loading tracks:', error);
            }
        };
        
        loadTracks();
    }, [playlistId]);

    // Handle track change from player
    const handleTrackChange = (track, index) => {
        setCurrentTrack(track);
        setCurrentTrackIndex(index);
    };

    // Handle track selection from queue
    const handleTrackSelect = (index) => {
        setCurrentTrackIndex(index);
        setCurrentTrack(tracks[index]);
    };

    // Handle drag end
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        
        const oldIndex = tracks.findIndex((t) => `${t.type}-${t.id}` === active.id);
        const newIndex = tracks.findIndex((t) => `${t.type}-${t.id}` === over.id);
        
        if (oldIndex === -1 || newIndex === -1) return;
        
        const newTracks = arrayMove(tracks, oldIndex, newIndex);
        setTracks(newTracks);
        
        // Nếu đang phát bài bị kéo, cập nhật lại index
        if (currentTrackIndex === oldIndex) {
            setCurrentTrackIndex(newIndex);
        } else if (oldIndex < currentTrackIndex && newIndex >= currentTrackIndex) {
            setCurrentTrackIndex(currentTrackIndex - 1);
        } else if (oldIndex > currentTrackIndex && newIndex <= currentTrackIndex) {
            setCurrentTrackIndex(currentTrackIndex + 1);
        }
    };

    // Format duration
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Sortable Track Component
    const SortableTrack = ({ track, index, currentTrackIndex, onClick }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({ id: `${track.type}-${track.id}` });
        
        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };

        return (
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    index === currentTrackIndex
                        ? 'bg-blue-100 border-2 border-blue-300'
                        : 'bg-white/80 hover:bg-blue-50 border border-blue-200/50'
                } ${isDragging ? 'shadow-lg z-10' : ''}`}
                onClick={onClick}
            >
                {/* Track Number / Playing Indicator */}
                <div className="w-8 text-center mr-3">
                    {index === currentTrackIndex ? (
                        <div className="w-4 h-4 mx-auto">
                            <div className="flex space-x-1">
                                <div className="w-1 h-4 bg-blue-500 animate-pulse"></div>
                                <div className="w-1 h-4 bg-blue-500 animate-pulse" style={{animationDelay: '0.1s'}}></div>
                                <div className="w-1 h-4 bg-blue-500 animate-pulse" style={{animationDelay: '0.2s'}}></div>
                            </div>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-500 font-medium">{index + 1}</span>
                    )}
                </div>

                {/* Track Thumbnail */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-200 to-blue-400 rounded-lg mr-3 flex items-center justify-center flex-shrink-0">
                    {track.image ? (
                        <img 
                            src={track.image} 
                            alt={track.name}
                            className="w-full h-full object-cover rounded-lg"
                        />
                    ) : (
                        <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-800 truncate text-sm">{track.name}</h4>
                    <p className="text-xs text-gray-600 truncate">{track.artist}</p>
                </div>

                {/* Track Source & Duration */}
                <div className="flex items-center gap-2 ml-2">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        track.type === 'spotify' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                    }`}>
                        {track.type === 'spotify' ? 'S' : 'L'}
                    </span>
                    {track.duration && (
                        <span className="text-xs text-gray-500">{formatTime(track.duration)}</span>
                    )}
                </div>
            </div>
        );
    };

    // Xử lý lỗi
    if (error) {
        return (
            <div className="flex flex-col items-center screen-container justify-center h-screen bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="bg-red-500 text-white p-4 rounded-lg mb-4">
                    {error}
                </div>
                <button
                    onClick={() => navigate('/playlists')}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-4 rounded-lg"
                >
                    Quay lại danh sách playlist
                </button>
            </div>
        );
    }

    // Render loading state
    if (!playlist) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="text-xl text-gray-800">Đang tải...</div>
            </div>
        );
    }

    return (
        <div className="h-screen screen-container flex flex-col">
            {/* Header */}
            <div className="p-3">
                <button
                    onClick={() => navigate('/playlists')}
                    className="text-black hover:text-gray-700 flex items-center gap-2 mb-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Quay lại</span>
                </button>
                <h1 className="text-2xl font-bold text-gray-800">{playlist.name}</h1>
                {playlist.description && (
                    <p className="text-gray-600 text-sm">{playlist.description}</p>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-6 p-6 overflow-hidden">
                {/* Left Side - Track Info & Artwork */}
                <div className="w-[70%] flex flex-col">
                    {/* Current Track Display */}
                    <div className="bg-white/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-8 shadow-xl flex-1">
                        <div className="h-full flex flex-col items-center justify-center">
                            {currentTrack ? (
                                <>
                                    {/* Track Artwork */}
                                    <div className="w-80 h-80 bg-gradient-to-br from-blue-200 to-blue-400 rounded-3xl mb-6 flex items-center justify-center shadow-2xl">
                                        {currentTrack.image ? (
                                            <img 
                                                src={currentTrack.image} 
                                                alt={currentTrack.name}
                                                className="w-full h-full object-cover rounded-3xl"
                                            />
                                        ) : (
                                            <svg className="w-32 h-32 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Track Info */}
                                    <div className="text-center">
                                        <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentTrack.name}</h2>
                                        <p className="text-xl text-gray-600 mb-4">{currentTrack.artist}</p>
                                        
                                        {/* Track Details */}
                                        <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                    currentTrack.type === 'spotify' 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {currentTrack.type === 'spotify' ? 'Spotify' : 'Local'}
                                                </span>
                                            </div>
                                            {currentTrack.duration && (
                                                <div className="flex items-center gap-1">
                                                    <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>{formatTime(currentTrack.duration)}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                                </svg>
                                                <span>Track {currentTrackIndex + 1} of {tracks.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-gray-500">
                                    <svg className="w-24 h-24 text-black mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-lg">Chọn một bài hát để phát</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side - Queue & Player */}
                <div className="w-[30%] flex flex-col gap-4 h-full">
                    {/* Queue */}
                    <div className="bg-white/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl flex-1 min-h-0">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                                Queue
                            </h3>
                            <span className="text-sm text-gray-600">{tracks.length} bài hát</span>
                        </div>

                        {/* Track List with Drag & Drop */}
                        <div className="h-[calc(100%-60px)] overflow-y-auto">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={tracks.map(track => `${track.type}-${track.id}`)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                        {tracks.length === 0 ? (
                                            <div className="text-center text-gray-500 py-8">
                                                <svg className="w-16 h-16 text-black mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                                </svg>
                                                Không có bài hát nào trong playlist
                                            </div>
                                        ) : (
                                            tracks.map((track, index) => (
                                                <SortableTrack
                                                    key={`${track.type}-${track.id}`}
                                                    track={track}
                                                    index={index}
                                                    currentTrackIndex={currentTrackIndex}
                                                    onClick={() => handleTrackSelect(index)}
                                                />
                                            ))
                                        )}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    </div>

                    {/* Compact Player */}
                    <div className="bg-white/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-4 shadow-xl flex-shrink-0 mb-6">
                        {currentTrack && (
                            <div className="flex items-center gap-3 mb-3">
                                {/* Mini Track Info */}
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-200 to-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {currentTrack.image ? (
                                        <img 
                                            src={currentTrack.image} 
                                            alt={currentTrack.name}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                    ) : (
                                        <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-800 truncate text-sm">{currentTrack.name}</h4>
                                    <p className="text-xs text-gray-600 truncate">{currentTrack.artist}</p>
                                </div>
                            </div>
                        )}
                        
                        <div className="player-wrapper">
                            <UnifiedPlayer 
                                playlistId={playlistId} 
                                initialTrackIndex={currentTrackIndex}
                                onTrackChange={handleTrackChange}
                            />
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
}