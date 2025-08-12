import React, { useState, useEffect } from 'react';
import { useStemSeparation } from '../../hooks/useStemSeparation'; // Giả sử hooks ở thư mục /hooks
import { formatFileSize } from '../utils/formatters'; // Giả sử có file utils

// Props:
// - onSeparationComplete: Hàm được gọi khi một track tách xong để component cha fetch lại list
export default function UploadCard({ onSeparationComplete }) {
    const [uploadedFile, setUploadedFile] = useState(null);
    const {
        isSeparating,
        progressLog,
        error,
        newlyCompletedTrack,
        startSeparation
    } = useStemSeparation();

    useEffect(() => {
        if (newlyCompletedTrack) {
            onSeparationComplete(); // Thông báo cho cha
        }
    }, [newlyCompletedTrack, onSeparationComplete]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
        }
    };

    const handleStart = () => {
        if (uploadedFile) {
            startSeparation(uploadedFile);
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl h-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm text-white font-semibold">
                    1
                </span>
                Upload & Tách nhạc
            </h3>

            {/* File Upload */}
            <div className="mb-6">
                <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="w-full p-3 bg-white/60 border border-blue-200 rounded-xl text-gray-800 placeholder-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 backdrop-blur-sm"
                />
                {uploadedFile && (
                    <div className="mt-3 p-3 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                        <div className="text-gray-800 font-medium truncate">
                            {uploadedFile.name}
                        </div>
                        <div className="text-gray-600 text-sm">
                            Kích thước: {formatFileSize(uploadedFile.size)}
                        </div>
                    </div>
                )}
            </div>

            {/* Start Button */}
            {uploadedFile && (
                <div className="mb-4">
                    <button
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleStart}
                        disabled={isSeparating}
                    >
                        {isSeparating ? 'Đang xử lý...' : 'Bắt đầu tách nhạc'}
                    </button>
                </div>
            )}

            {/* Terminal Log */}
            {isSeparating && (
                <div className="mt-6 p-4 bg-white/60 rounded-xl backdrop-blur-md border border-blue-200/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-800 font-medium flex items-center">
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></span>
                            Đang tách nhạc
                        </span>
                    </div>
                    <div className="p-3 bg-gray-100/80 rounded-xl max-h-64 overflow-y-auto backdrop-blur-sm border border-blue-200/30">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                            {progressLog.slice(-2000) || 'Đang khởi động...'}
                        </pre>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
}
