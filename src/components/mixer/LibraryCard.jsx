import React, { useState } from 'react';
import { formatFileSize, formatDate } from '../utils/formatters';

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
    stemsList,
    mixedSongs,
    selectedStems,
    audioRefs,
    onSelectStem,
    onDeleteTrack,
    onDeleteMixedSong,
    onRefresh,
}) {
    const [expandedTracks, setExpandedTracks] = useState({});

    const toggleTrackExpansion = (trackId) => {
        setExpandedTracks(prev => ({ ...prev, [trackId]: !prev[trackId] }));
    };

    return (
        <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm text-white font-semibold">
                        3
                    </span>
                    Thư viện
                </h3>
                <button
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                    onClick={onRefresh}
                >
                    Làm mới
                </button>
            </div>

            {/* Stems Library */}
            <div className="mb-6 p-4 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                <h4 className="text-gray-800 font-medium mb-3">Thư viện Stems ({stemsList.length} tracks)</h4>
                <div className="grid gap-3 max-h-72 overflow-y-auto">
                    {stemsList.map((song) => {
                        const isExpanded = expandedTracks[song.trackId];
                        return (
                            <div key={song.trackId} className="bg-white/60 rounded-xl overflow-hidden border border-blue-200/50">
                                <div className="p-4 cursor-pointer hover:bg-blue-50/50" onClick={() => toggleTrackExpansion(song.trackId)}>
                                    {/* ... UI hiển thị thông tin track ... */}
                                    <h5 className="font-medium text-gray-800 truncate">{song.song}</h5>
                                </div>
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-slate-500/30">
                                        <div className="pt-4 space-y-4">
                                            {Object.entries(song.stems).map(([stemType, stemData]) => {
                                                const stemKey = `${song.song}_${stemType}`;
                                                const isSelected = !!selectedStems[stemKey];
                                                return (
                                                    <div
                                                        key={stemType}
                                                        className={`rounded-lg p-4 cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                                                        onClick={() => onSelectStem(song, stemType, stemData.url)}
                                                    >
                                                        <p className="font-medium text-gray-800 capitalize">{stemType}</p>
                                                        <audio
                                                            ref={el => { audioRefs.current[stemKey] = el; }}
                                                            controls
                                                            src={`http://localhost:5000${stemData.url}`}
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
            </div>

            {/* Mixed Songs Library */}
            {/* ... Tương tự cho mixedSongs ... */}
        </div>
    );
}
