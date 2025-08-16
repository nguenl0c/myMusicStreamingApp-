import { useState } from 'react';
import { formatFileSize, formatDate } from '../utils/formatters';
import { FaFolderOpen } from "react-icons/fa";
import { FaItunesNote } from "react-icons/fa6";
// Centralized API base (fallback to localhost if not provided via prop)
const DEFAULT_API_BASE = import.meta?.env?.VITE_API_BASE || 'http://localhost:5000';

// Props:
// - stemsList: Mảng các track đã tách
// - mixedSongs: Mảng các bài hát đã mix
// - selectedStems: Object các stem đang được chọn để hiển thị UI
// - audioRefs: Ref object để gán vào thẻ audio
// - onSelectStem: Hàm để chọn/bỏ chọn một stem
// - onDeleteTrack: Hàm để xóa một track (gồm các stems)
// - onDeleteMixedSong: Hàm để xóa một bài hát đã mix
// - onRefresh: Hàm để làm mới danh sách
export default function LibraryCard({
    stemsList = [],
    mixedSongs = [],
    selectedStems = {},
    audioRefs,
    onSelectStem,
    onDeleteTrack,
    onDeleteMixedSong,
    apiBase = DEFAULT_API_BASE,
    deletingTrackId,
    deletingMixedFilename,
    playingStems = {},
}) {
    const [expandedTracks, setExpandedTracks] = useState({});

    const toggleTrackExpansion = (trackId) => {
        setExpandedTracks(prev => ({ ...prev, [trackId]: !prev[trackId] }));
    };

    return (
        <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                
                    Thư viện
                </h3>
            </div>

            {/* Stems Library */}
            <div className="mb-6 p-4 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                <h4 className="text-gray-800 font-medium mb-3 flex items-center gap-2">
                    <FaFolderOpen  className='text-blue-500'/>
                    Thư viện Stems ({stemsList.length})
                </h4>
                <div className="grid gap-3 max-h-72 overflow-y-auto text-sm">
                    {stemsList.map((song) => {
                        const isExpanded = expandedTracks[song.trackId] || false;
                        const stemCount = song.stemCount || Object.keys(song.stems || {}).length;
                        const trackPlaying = Object.keys(playingStems).some(k => k.startsWith(`${song.song}_`) && playingStems[k]);
                        return (
                            <div key={song.trackId} className="bg-white/60 rounded-xl overflow-hidden backdrop-blur-sm border border-blue-200/50">
                                {/* Header Row */}
                                <div
                                    className="p-4 cursor-pointer hover:bg-blue-50/60 transition-colors flex items-start gap-3"
                                    onClick={() => toggleTrackExpansion(song.trackId)}
                                >
                                    <svg
                                        className={`w-4 h-4 mt-1 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="font-medium text-gray-800 truncate flex items-center gap-2" title={song.song}>{song.song}{trackPlaying && <span className="text-[10px] text-green-600">●</span>}</h5>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600 mt-1">
                                            {song.createdAt && (
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                                                    {formatDate(song.createdAt)}
                                                </span>
                                            )}
                                            {song.totalSize != null && (
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                                    {formatFileSize(song.totalSize)}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" /></svg>
                                                {stemCount} stems
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className={`p-2 rounded-lg transition-colors flex-shrink-0 ${deletingTrackId === song.trackId ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                                        onClick={(e) => { e.stopPropagation(); if (onDeleteTrack) onDeleteTrack(song.trackId); }}
                                        disabled={deletingTrackId === song.trackId}
                                        title={deletingTrackId === song.trackId ? 'Đang xóa...' : 'Xóa track'}
                                    >
                                        {deletingTrackId === song.trackId ? (
                                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        )}
                                    </button>
                                </div>
                                {/* Expanded stems */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-blue-200/40">
                                        <div className="pt-4 space-y-4">
                                            {Object.entries(song.stems || {}).map(([stemType, stemData]) => {
                                                const audioKey = `${song.song}_${stemType}`;
                                                const isSelected = Object.values(selectedStems).some(sel => sel.type === stemType && sel.song === song.song);
                                                const isPlaying = !!playingStems[audioKey];
                                                return (
                                                    <div
                                                        key={stemType}
                                                        className={`rounded-lg p-4 cursor-pointer bg-slate-100/60 hover:bg-slate-200/60 transition-colors relative group ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/70' : ''}`}
                                                        onClick={() => onSelectStem && onSelectStem(song, stemType, stemData.url)}
                                                    >
                                                        {isSelected && (
                                                            <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-medium text-gray-800 flex items-center gap-2 capitalize text-sm">
                                                                <span>{stemType}</span>
                                                                {stemData?.size && (<span className="text-xs text-gray-500">({formatFileSize(stemData.size)})</span>)}
                                                                {isPlaying && (<span className="inline-flex items-center gap-1 text-green-600 text-[10px]">● playing</span>)}
                                                            </div>
                                                        </div>
                                                        <audio
                                                            ref={(el) => { if (el) audioRefs.current[audioKey] = el; }}
                                                            controls
                                                            src={`${apiBase}${stemData.url}`}
                                                            className="w-full h-10 rounded-full"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {stemsList.length === 0 && (
                    <div className="text-center py-6 text-gray-500 text-sm">Chưa có stems nào</div>
                )}
            </div>

            {/* Mixed Songs Library */}
            <div className="p-4 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                <h4 className="text-gray-800 font-medium mb-3 flex items-center gap-2">
                    <FaItunesNote className='text-blue-500'/>
                    Bài hát đã ghép ({mixedSongs.length})
                </h4>
                <div className="grid gap-3 max-h-30  overflow-y-auto text-sm">
                    {mixedSongs.map(song => (
                        <div key={song.filename || song.path} className="bg-white/70 rounded-lg p-4 flex flex-col gap-3 border border-blue-200/40">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <h5 className="font-medium text-gray-800 truncate" title={song.name}>{song.name}</h5>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600 mt-1">
                                        {song.createdAt && (
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                                                {formatDate(song.createdAt)}
                                            </span>
                                        )}
                                        {song.size != null && (
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                                {formatFileSize(song.size)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className={`p-2 rounded-lg transition-colors flex-shrink-0 ${deletingMixedFilename === song.filename ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                                    onClick={() => onDeleteMixedSong && onDeleteMixedSong(song.filename)}
                                    disabled={deletingMixedFilename === song.filename}
                                    title={deletingMixedFilename === song.filename ? 'Đang xóa...' : 'Xóa bài hát'}
                                >
                                    {deletingMixedFilename === song.filename ? (
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    )}
                                </button>
                            </div>
                            <audio
                                controls
                                src={`${apiBase}${song.path}`}
                                className="w-full h-10 rounded-full"
                            />
                        </div>
                    ))}
                </div>
                {mixedSongs.length === 0 && (
                    <div className="text-center py-6 text-gray-500 text-sm">Chưa có bài hát nào được ghép</div>
                )}
            </div>
        </div>
    );
}
