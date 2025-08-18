import React, { useState, useEffect } from 'react';
import { useStemSeparation } from '../../hooks/useStemSeparation';
import { formatFileSize } from '../utils/formatters';

export default function UploadCard({ onSeparationComplete }) {
    const [uploadedFile, setUploadedFile] = useState(null);
    const [model, setModel] = useState('htdemucs');
    const [twoStems, setTwoStems] = useState(''); // '', 'vocals', 'drums', 'bass', 'other'
    const [mp3Bitrate, setMp3Bitrate] = useState(192);
    const [mp3Preset, setMp3Preset] = useState(5);
    const {
        isSeparating,
        percent,
        statusText,
        isSuccess, // <-- Sử dụng state mới
        error,
        newlyCompletedTrack,
        startSeparation
    } = useStemSeparation();

    useEffect(() => {
        if (newlyCompletedTrack) {
            onSeparationComplete();
            // Xóa file đã upload khỏi state sau khi hoàn tất để sẵn sàng cho lần tiếp theo
            setUploadedFile(null);
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
            startSeparation(uploadedFile, { model, twoStems: twoStems || undefined, mp3Bitrate, mp3Preset });
        }
    };

    // Component hiển thị khi thành công
    const SuccessView = () => (
        <div className="flex flex-col items-center justify-center text-center p-6 bg-green-500/10 border border-green-500/30 rounded-2xl">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h4 className="text-lg font-bold text-green-800">Tách nhạc thành công!</h4>
            <p className="text-green-700">Stems mới đã được thêm vào thư viện của bạn.</p>
        </div>
    );

    // Component hiển thị khi đang xử lý
    const ProcessingView = () => (
        <div className="p-4 bg-white/60 rounded-xl backdrop-blur-md border border-blue-200/50">
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-gray-700">{statusText}</p>
                <p className="text-sm font-bold text-blue-600">{Math.round(percent)}%</p>
            </div>
            <div className="w-full bg-blue-200/50 rounded-full h-2.5 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
        </div>
    );

    // Component hiển thị form upload
    const UploadForm = () => (
        <>
            <div className="mb-6">
                <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="w-full p-3 bg-white/60 border border-blue-200 rounded-xl text-gray-800 placeholder-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 backdrop-blur-sm"
                />
                {uploadedFile && (
                    <div className="mt-3 p-3 bg-white/60 rounded-xl backdrop-blur-sm border border-blue-200/50">
                        <div className="text-gray-800 font-medium truncate" title={uploadedFile.name}>
                            {uploadedFile.name}
                        </div>
                        <div className="text-gray-600 text-sm">
                            Kích thước: {formatFileSize(uploadedFile.size)}
                        </div>
                    </div>
                )}
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                    <label className="block text-xs text-gray-600 mb-1">Mô hình</label>
                    <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 border rounded-xl bg-white/60">
                        <option value="htdemucs">htdemucs</option>
                        <option value="mdx_q">mdx_q (lightweight, faster)</option>
                        <option value="htdemucs_ft">htdemucs_ft (fine-tuned version)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-600 mb-1">Two Stems Options</label>
                    <select value={twoStems} onChange={e => setTwoStems(e.target.value)} className="w-full p-2 border rounded-xl bg-white/60">
                        <option value="">4 Stems</option>
                        <option value="vocals">Vocals</option>
                        <option value="drums">Drums</option>
                        <option value="bass">Bass</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-600 mb-1">MP3 Bitrate</label>
                    <select value={mp3Bitrate} onChange={e => setMp3Bitrate(Number(e.target.value))} className="w-full p-2 border rounded-xl bg-white/60">
                        <option value={128}>128 kbps</option>
                        <option value={192}>192 kbps</option>
                        <option value={256}>256 kbps</option>
                        <option value={320}>320 kbps</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-600 mb-1">MP3 Preset</label>
                    <select value={mp3Preset} onChange={e => setMp3Preset(Number(e.target.value))} className="w-full p-2 border rounded-xl bg-white/60">
                        <option value={2}>2 (best quality)</option>
                        <option value={5}>5 (default)</option>
                        <option value={7}>7 (fastest)</option>
                    </select>
                </div>
            </div>

            {uploadedFile && (
                <div className="mb-4">
                    <button
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                        onClick={handleStart}
                    >
                        Bắt đầu tách nhạc
                    </button>
                </div>
            )}
        </>
    );


    return (
        <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 backdrop-blur-md border border-blue-200/30 rounded-3xl p-6 shadow-xl h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 flex-shrink-0">
                <span className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-sm text-white font-semibold">
                    1
                </span>
                Upload & Tách nhạc
            </h3>

            <div className="flex-grow flex flex-col justify-center">
                {isSuccess ? <SuccessView /> : isSeparating ? <ProcessingView /> : <UploadForm />}
            </div>

            {/* Error Display */}
            {error && !isSeparating && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    <strong>Lỗi:</strong> {error}
                </div>
            )}
        </div>
    );
}
