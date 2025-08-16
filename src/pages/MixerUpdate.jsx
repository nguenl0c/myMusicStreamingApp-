import React, { useState, useEffect, useCallback } from 'react';
import UploadCard from '../components/mixer/UploadCard';
import MixerCard from '../components/mixer/MixerCard';
import LibraryCard from '../components/mixer/LibraryCard';
import { useStemPlayer } from '../hooks/useStemPlayer';
import { fetchStems, fetchMixedSongs, deleteStemTrack, deleteMixedSong } from '../services/mixerApi';

export default function Mixer() {
    const [stemsList, setStemsList] = useState([]);
    const [mixedSongs, setMixedSongs] = useState([]);
    const [deletingTrackId, setDeletingTrackId] = useState(null);
    const [deletingMixedFilename, setDeletingMixedFilename] = useState(null);
    const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'mixer'

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
        if (!trackId) return;
        if (!window.confirm('Bạn có chắc muốn xóa track này?')) return;
        try {
            setDeletingTrackId(trackId);
            await deleteStemTrack(trackId);
            await loadData();
        } catch (e) {
            console.error('Delete track failed', e);
        } finally {
            setDeletingTrackId(null);
        }
    };

    const handleDeleteMixed = async (filename) => {
        if (!filename) return;
        if (!window.confirm('Bạn có chắc muốn xóa bài hát đã mix?')) return;
        try {
            setDeletingMixedFilename(filename);
            await deleteMixedSong(filename);
            await loadData();
        } catch (e) {
            console.error('Delete mixed failed', e);
        } finally {
            setDeletingMixedFilename(null);
        }
    };


    return (
        <div className="min-h-screen p-4 md:p-6 screen-container">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 text-center">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 bg-clip-text text-transparent mb-4">
                    Music Mixer Studio
                </h1>
            </div>

            <div className="max-w-[1600px] mx-auto grid grid-cols-10 gap-2">

                    <div className="space-y-6 col-span-4">
                        <LibraryCard
                            stemsList={stemsList}
                            mixedSongs={mixedSongs}
                            selectedStems={player.selectedStems}
                            audioRefs={player.audioRefs}
                            onSelectStem={(song, stemType, url) => {
                                const songObj = typeof song === 'string' ? { song } : song;
                                player.handleSelectStem(songObj, stemType, url);
                            }}
                            onDeleteTrack={handleDeleteTrack}
                            onDeleteMixedSong={handleDeleteMixed}
                            deletingTrackId={deletingTrackId}
                            deletingMixedFilename={deletingMixedFilename}
                            playingStems={{}}
                        />
                    </div>

                <div className="col-span-6 gap-6 mb-16 flex flex-col">
                    {/* Tabs header */}
                    <div className="bg-white/70 border border-blue-200/50 rounded-2xl p-1 flex w-full">
                        <button
                            className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${activeTab === 'upload' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-blue-50'}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            Upload & Tách nhạc
                        </button>
                        <button
                            className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${activeTab === 'mixer' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-blue-50'}`}
                            onClick={() => setActiveTab('mixer')}
                        >
                            Ghép stems
                        </button>
                    </div>

                    {/* Tab content */}
                    {activeTab === 'upload' ? (
                        <div className="w-full">
                            <UploadCard onSeparationComplete={loadData} />
                        </div>
                    ) : (
                        <div className="w-full">
                            <MixerCard
                                {...player}
                                onMixComplete={loadData}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
