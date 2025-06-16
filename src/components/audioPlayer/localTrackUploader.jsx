import React, { useState } from 'react';
import { saveTrack } from '../../services/localMusicDB';

export default function LocalTrackUploader({ onTracksUploaded }) {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files).filter(
            file => file.type.startsWith('audio/')
        );

        if (files.length === 0) {
            return;
        }

        setIsUploading(true);
        setProgress(0);

        const trackIds = [];
        let processed = 0;

        for (const file of files) {
            try {
                const trackId = await saveTrack(file);
                trackIds.push(trackId);
                processed++;
                setProgress(Math.round((processed / files.length) * 100));
            } catch (error) {
                console.error(`Error uploading file ${file.name}:`, error);
            }
        }

        setIsUploading(false);

        if (onTracksUploaded && trackIds.length > 0) {
            onTracksUploaded(trackIds);
        }

        // Reset input để có thể upload lại file giống nhau
        event.target.value = '';
    };

    return (
        <div className="local-track-uploader">
            <label className="flex items-center gap-2 cursor-pointer">
                <div className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-full font-medium transition duration-300">
                    Upload Music
                    <input
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                    />
                </div>
                <span className="text-sm text-gray-400">Supports MP3, WAV, FLAC, etc.</span>
            </label>

            {isUploading && (
                <div className="mt-2">
                    <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#1DB954] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Uploading... {progress}%</p>
                </div>
            )}
        </div>
    );
}