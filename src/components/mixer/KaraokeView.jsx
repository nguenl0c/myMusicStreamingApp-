// src/components/mixer/KaraokeView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { fetchLyrics, saveLyrics } from '../../services/mixerApi';
import { useStemPlayer } from '../../hooks/useStemPlayer'; // Tái sử dụng hook player

// Hàm tiện ích để phân tích nội dung file .srt
const parseSrt = (srtText) => {
    if (!srtText || typeof srtText !== 'string') return [];
    const lines = srtText.trim().split(/\r?\n/);
    const entries = [];
    let currentEntry = {};

    const timeToSeconds = (timeStr) => {
        const [h, m, s] = timeStr.split(':');
        const [sec, ms] = s.split(',');
        return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(sec, 10) + parseInt(ms, 10) / 1000;
    };

    for (let i = 0; i < lines.length; i++) {
        if (!isNaN(parseInt(lines[i], 10)) && lines[i + 1]?.includes('-->')) {
            if (currentEntry.text) entries.push(currentEntry);
            currentEntry = {
                id: parseInt(lines[i], 10),
                startTime: timeToSeconds(lines[i + 1].split(' --> ')[0]),
                endTime: timeToSeconds(lines[i + 1].split(' --> ')[1]),
                text: ''
            };
            i++;
        } else if (currentEntry.id && lines[i].trim() !== '') {
            currentEntry.text += (currentEntry.text ? '\n' : '') + lines[i];
        }
    }
    if (currentEntry.text) entries.push(currentEntry);
    return entries;
};


export default function KaraokeView({ song, onClose }) {
    const [lyrics, setLyrics] = useState([]);
    const [rawSrt, setRawSrt] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editedSrt, setEditedSrt] = useState('');
    const [error, setError] = useState(null);

    const player = useStemPlayer();
    const activeLineRef = useRef(null);

    // Lấy và phân tích lời bài hát khi component được tải
    useEffect(() => {
        const loadLyrics = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const srtContent = await fetchLyrics(song.songFolderName);
                setRawSrt(srtContent);
                setEditedSrt(srtContent);
                setLyrics(parseSrt(srtContent));
            } catch (err) {
                setError("Không thể tải lời bài hát. Hãy thử trích xuất lại.");
            } finally {
                setIsLoading(false);
            }
        };
        loadLyrics();
    }, [song.songFolderName]);

    // Tự động cuộn đến dòng đang hát
    useEffect(() => {
        if (activeLineRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [player.masterCurrentTime]);

    const handleSave = async () => {
        try {
            await saveLyrics(song.songFolderName, editedSrt);
            setRawSrt(editedSrt);
            setLyrics(parseSrt(editedSrt));
            setIsEditing(false);
        } catch (err) {
            alert("Lưu thất bại!");
        }
    };

    // Tìm dòng lyric hiện tại
    const activeLine = lyrics.find(line =>
        player.masterCurrentTime >= line.startTime && player.masterCurrentTime <= line.endTime
    );

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="w-11/12 max-w-4xl h-5/6 bg-gray-800 text-white rounded-2xl shadow-2xl flex flex-col p-6">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold">{song.song} - Karaoke</h2>
                    <div>
                        <button onClick={() => setIsEditing(!isEditing)} className="mr-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                            {isEditing ? 'Hủy' : 'Chỉnh sửa'}
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">Đóng</button>
                    </div>
                </div>

                <div className="flex-grow min-h-0">
                    {isLoading && <p>Đang tải lời bài hát...</p>}
                    {error && <p className="text-red-400">{error}</p>}

                    {isEditing ? (
                        <div className="h-full flex flex-col">
                            <textarea
                                value={editedSrt}
                                onChange={(e) => setEditedSrt(e.target.value)}
                                className="w-full h-full bg-gray-900 text-white p-4 rounded-lg font-mono text-sm"
                            />
                            <button onClick={handleSave} className="mt-4 w-full py-2 bg-green-600 rounded-lg hover:bg-green-700">Lưu thay đổi</button>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto text-center p-8 scrollbar-thin scrollbar-thumb-gray-600">
                            {lyrics.map(line => (
                                <p
                                    key={line.id}
                                    ref={activeLine?.id === line.id ? activeLineRef : null}
                                    className={`text-3xl font-bold transition-all duration-300 p-2
                                        ${activeLine?.id === line.id ? 'text-yellow-300 scale-110' : 'text-gray-400'}`
                                    }
                                >
                                    {line.text}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
