import React, { useState } from 'react';
import { mixStems } from '../../services/mixerAPI'; 
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
                    {/* ... UI hiển thị các stem đã chọn ... */}
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
