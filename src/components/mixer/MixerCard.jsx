import React, { useState } from 'react';
import { mixStems } from '../../services/mixerApi.js'; 
import { formatTime } from '../utils/formatters';

// Props:
// - selectedStems, masterCurrentTime, masterDuration, isPlaying: State từ hook useStemPlayer
// - playAllSelected, stopAllAudio, seekAll: Hàm điều khiển từ hook useStemPlayer
// - onMixComplete: Hàm gọi khi mix xong để component cha fetch lại list
export default function MixerCard({
    selectedStems,
    masterCurrentTime,
    masterDuration,
    isPlaying,
    playAllSelected,
    stopAllAudio,
    seekAll,
    handleSelectStem,
    onMixComplete,
}) {
    const [songName, setSongName] = useState('');
    const [isMixing, setIsMixing] = useState(false);
    const [error, setError] = useState(null);

    const selectedCount = Object.keys(selectedStems).length;

    const handleMix = async () => {
        if (selectedCount < 2 || !songName.trim()) return;

        setIsMixing(true);
        setError(null);
        try {
            const stemPaths = Object.values(selectedStems).map(stem => stem.url);
            await mixStems(stemPaths, songName.trim());
            onMixComplete();
            setSongName('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ghép nhạc thất bại');
        } finally {
            setIsMixing(false);
        }
    };

    const handleProgressChange = (e) => {
        if (masterDuration === 0) return;
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = (clickX / rect.width) * masterDuration;
        seekAll(Math.max(0, Math.min(newTime, masterDuration)));
    };

    return (
        <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl h-full">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm text-white font-semibold">
                    2
                </span>
                Ghép stems
            </h3>

            {/* Selected Stems Display */}
            {selectedCount > 0 && (
                <div className="mb-4 p-3 bg-white/60 rounded-xl">
                    <h4 className="text-gray-800 font-medium text-sm mb-2">
                        Đã chọn ({selectedCount} stems):
                    </h4>
                    <ul className="space-y-1">
                        {Object.entries(selectedStems).map(([key, stem]) => (
                            <li key={key} className="flex items-center gap-2 text-gray-700 text-sm bg-blue-50/60 rounded px-2 py-1">
                                {/* Icon stem */}
                                <span className="inline-block w-5 text-blue-500">
                                    {stem.type === 'vocals' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7" /></svg>}
                                    {stem.type === 'drums' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="4" fill="currentColor" /></svg>}
                                    {stem.type === 'bass' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="4" rx="2" fill="currentColor" /></svg>}
                                    {stem.type === 'other' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M8 12h8" stroke="currentColor" strokeWidth="2" /></svg>}
                                </span>
                                <span className="truncate font-medium" title={stem.song}>{stem.song}</span>
                                <span className="text-xs text-gray-500">({stem.type})</span>
                                <button
                                    className="ml-auto px-2 py-1 text-xs text-red-500 hover:underline"
                                    title="Bỏ chọn stem này"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (typeof handleSelectStem === 'function') {
                                            handleSelectStem({ song: stem.song }, stem.type, stem.url);
                                        }
                                    }}
                                >
                                    Bỏ chọn
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Master Player Controls */}
            {selectedCount >= 2 && (
                <div className="mt-4 p-3 bg-white/60 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={playAllSelected} disabled={isPlaying}>Play</button>
                        <button onClick={stopAllAudio} disabled={!isPlaying}>Stop</button>
                    </div>
                    <div className="text-xs text-gray-600">
                        {formatTime(masterCurrentTime)} / {formatTime(masterDuration)}
                    </div>
                    <div
                        className="relative w-full h-3 bg-gray-200/60 rounded-full cursor-pointer"
                        onClick={handleProgressChange}
                    >
                        <div
                            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                            style={{ width: masterDuration > 0 ? `${(masterCurrentTime / masterDuration) * 100}%` : '0%' }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Mix Button & Name Input */}
            {selectedCount >= 2 && (
                <div className="mt-4">
                    <input
                        type="text"
                        value={songName}
                        onChange={(e) => setSongName(e.target.value)}
                        placeholder="Tên bài hát mới..."
                        className="w-full p-3 border rounded-xl mb-2"
                    />
                    <button
                        onClick={handleMix}
                        disabled={isMixing || !songName.trim()}
                        className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                    >
                        {isMixing ? 'Đang ghép...' : 'Ghép các stems đã chọn'}
                    </button>
                </div>
            )}
            {error && <div className="text-red-500 mt-2">{error}</div>}
        </div>
    );
}
