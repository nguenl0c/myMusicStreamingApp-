import React, { useState, useEffect, useRef } from 'react';
import { fetchLyrics } from '../../services/mixerApi';
import { useStemPlayer } from '../../hooks/useStemPlayer';

// Component Word để render từng từ với hiệu ứng chạy chữ
const Word = ({ wordData, currentTime }) => {
    const { word, start, end } = wordData;
    const isPast = currentTime >= end;
    const isActive = currentTime >= start && currentTime < end;

    let progress = 0;
    if (isActive) {
        const duration = end - start;
        progress = duration > 0 ? ((currentTime - start) / duration) * 100 : 100;
    }

    return (
        <span className="relative inline-block mr-2 whitespace-nowrap">
            <span className="absolute inset-0 text-gray-400">{word}</span>
            <span
                className="absolute inset-0 text-yellow-300 overflow-hidden"
                style={{ width: isPast ? '100%' : `${progress}%` }}
            >
                {word}
            </span>
            <span className="opacity-0">{word}</span>
        </span>
    );
};

export default function KaraokeView({ song, onClose }) {
    const [lyrics, setLyrics] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const player = useStemPlayer();
    const activeLineRef = useRef(null);

    // Cập nhật logic để tải cả lời và nhạc khi component được hiển thị
    useEffect(() => {
        const loadKaraokeData = async () => {
            // Kiểm tra xem dữ liệu bài hát có đầy đủ không
            if (!song?.songFolderName || !song.stems) {
                setError("Dữ liệu bài hát không đầy đủ để bắt đầu karaoke.");
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // Sử dụng Promise.all để tải lời và nhạc cùng lúc cho nhanh hơn
                const [lyricData] = await Promise.all([
                    fetchLyrics(song.songFolderName),
                    // Sửa: dùng API đúng của player để tải và phát các stems
                    player.loadAndPlayAllStems(Object.values(song.stems))
                ]);

                if (Array.isArray(lyricData) && lyricData.length > 0) {
                    setLyrics(lyricData);
                } else {
                    setError("Không tìm thấy lời bài hát cho track này. Vui lòng thử trích xuất lại.");
                    setLyrics([]);
                }
            } catch (err) {
                console.error("Lỗi khi tải dữ liệu karaoke:", err);
                setError("Không thể tải lời hoặc nhạc. Hãy thử làm mới trang.");
            } finally {
                setIsLoading(false);
            }
        };

        loadKaraokeData();

        // CHỨC NĂNG DỌN DẸP:
        // Hàm này sẽ được gọi khi component bị đóng lại (unmount).
        // Nó đảm bảo nhạc sẽ dừng và tài nguyên được giải phóng.
        return () => {
            player.cleanup();
        };
    }, [song, player]); // useEffect sẽ chạy lại mỗi khi một bài hát `song` mới được chọn

    // Tự động cuộn đến dòng đang hát
    useEffect(() => {
        if (activeLineRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [player.masterCurrentTime]);

    const currentTime = player.masterCurrentTime;
    const activeLineIndex = lyrics.findIndex(line =>
        currentTime >= line.start && currentTime <= line.end
    );

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="w-11/12 max-w-4xl h-5/6 bg-gray-800 text-white rounded-2xl shadow-2xl flex flex-col p-6">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold truncate">{song.song} - Karaoke</h2>
                    <button onClick={onClose} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">Đóng</button>
                </div>

                <div className="flex-grow min-h-0">
                    {isLoading && <p className="flex items-center justify-center h-full">Đang tải nhạc và lời...</p>}
                    {error && <p className="flex items-center justify-center h-full text-red-400 text-center">{error}</p>}

                    {!isLoading && !error && lyrics.length > 0 && (
                        <div className="h-full overflow-y-auto text-center p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-600 flex flex-col justify-center">
                            {lyrics.map((line, index) => (
                                <p
                                    key={index}
                                    ref={activeLineIndex === index ? activeLineRef : null}
                                    className={`text-2xl md:text-4xl font-bold transition-all duration-300 p-2 transform ${activeLineIndex === index ? 'scale-110' : 'text-gray-300 scale-90'}`}
                                >
                                    {line.words.map((word, wordIndex) => (
                                        <Word key={wordIndex} wordData={word} currentTime={currentTime} />
                                    ))}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
