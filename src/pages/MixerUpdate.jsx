import React, { useState, useEffect, useCallback } from 'react';
import UploadCard from '../components/mixer/UploadCard';
import MixerCard from '../components/mixer/MixerCard';
import LibraryCard from '../components/mixer/LibraryCard';
import { useStemPlayer } from '../hooks/useStemPlayer';
import { fetchStems, fetchMixedSongs, deleteStemTrack, deleteMixedSong } from '../services/mixerApi';

export default function Mixer() {
    const [stemsList, setStemsList] = useState([]);
    const [mixedSongs, setMixedSongs] = useState([]);

    // Hook player được quản lý ở cấp cao nhất
    const player = useStemPlayer();

    const loadData = useCallback(async () => {
        try {
            const [stemsRes, mixedRes] = await Promise.all([fetchStems(), fetchMixedSongs()]);
            setStemsList(stemsRes.data || []);
            setMixedSongs(mixedRes.data || []);
        } catch (error) {
            console.error("Failed to load data:", error);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDeleteTrack = async (trackId) => {
        if (window.confirm('Bạn có chắc muốn xóa track này?')) {
            await deleteStemTrack(trackId);
            loadData(); // Tải lại dữ liệu
        }
    };

    const handleDeleteMixed = async (filename) => {
        if (window.confirm('Bạn có chắc muốn xóa bài hát đã mix?')) {
            await deleteMixedSong(filename);
            loadData(); // Tải lại dữ liệu
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-6 screen-container">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 text-center">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 bg-clip-text text-transparent mb-4">
                    Music Mixer Studio
                </h1>
                <p className="text-gray-700 text-lg">
                    Công cụ tách và phối nhạc như lắp ghép
                </p>
            </div>

            <div className="max-w-[1600px] mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-16">

                    <div className="lg:col-span-3 space-y-6">
                        <UploadCard onSeparationComplete={loadData} />
                    </div>

                    <div className="lg:col-span-3">
                        <MixerCard
                            {...player} // Truyền tất cả state và hàm của player xuống
                            onMixComplete={loadData}
                        />
                    </div>

                    <div className="lg:col-span-4">
                        <LibraryCard
                            stemsList={stemsList}
                            mixedSongs={mixedSongs}
                            selectedStems={player.selectedStems}
                            audioRefs={player.audioRefs}
                            onSelectStem={player.handleSelectStem}
                            onDeleteTrack={handleDeleteTrack}
                            onDeleteMixedSong={handleDeleteMixed}
                            onRefresh={loadData}
                        />
                    </div>

                </div>
            </div>
        </div>
    );
}
