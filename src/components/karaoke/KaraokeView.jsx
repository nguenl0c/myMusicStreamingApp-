// src/components/karaoke/KaraokeView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { fetchLyrics } from '../../services/mixerApi';
import { useStemPlayer } from '../../hooks/useStemPlayer';

/**
 * LÝ THUYẾT & CHỨC NĂNG: Component `Word`
 * - Chức năng: Component này chịu trách nhiệm hiển thị một từ duy nhất trong câu hát.
 * - Lý thuyết: Nó nhận vào thông tin của từ (chữ, thời gian bắt đầu, kết thúc) và
 * thời gian hiện tại của bài hát. Dựa vào đó, nó tính toán xem từ này đã được hát qua,
 * đang được hát, hay sắp được hát.
 * - Hiệu ứng "chạy chữ":
 * 1. Dùng 2 thẻ `<span>` chồng lên nhau bằng `position: absolute`.
 * 2. `<span>` nền (màu xám) luôn hiển thị đầy đủ chữ.
 * 3. `<span>` nổi (màu vàng) có `overflow: hidden` và chiều rộng (width) được
 * tính toán động. Khi từ đang được hát, `width` sẽ tăng dần từ 0% đến 100%,
 * tạo ra hiệu ứng màu vàng tô dần lên chữ xám.
 */
const Word = ({ wordData, currentTime }) => {
    const { word, start, end } = wordData;

    // Xác định trạng thái của từ
    const isPast = currentTime >= end;
    const isActive = currentTime >= start && currentTime < end;

    // Tính toán tiến độ (progress) cho từ đang được hát
    let progress = 0;
    if (isActive) {
        const duration = end - start;
        // Tránh chia cho 0
        progress = duration > 0 ? ((currentTime - start) / duration) * 100 : 100;
    }

    return (
        // `whitespace-nowrap` để các từ trong một dòng không bị xuống hàng
        <span className="relative inline-block mr-2 whitespace-nowrap">
            {/* Lớp nền màu xám, luôn hiển thị */}
            <span className="absolute inset-0 text-gray-400">{word}</span>
            {/* Lớp màu vàng "chạy chữ", chiều rộng được tính toán động */}
            <span
                className="absolute inset-0 text-yellow-300 overflow-hidden"
                style={{ width: isPast ? '100%' : `${progress}%` }}
            >
                {word}
            </span>
            {/* Lớp ẩn này chỉ dùng để giữ đúng kích thước của container */}
            <span className="opacity-0">{word}</span>
        </span>
    );
};


export default function KaraokeView({ song, onClose }) {
    // State `lyrics` giờ đây sẽ lưu mảng các object từ file JSON
    const [lyrics, setLyrics] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Bỏ các state liên quan đến chỉnh sửa SRT vì việc sửa JSON phức tạp hơn
    // và không nằm trong phạm vi yêu cầu hiện tại.

    const player = useStemPlayer();
    const activeLineRef = useRef(null);

    // Lấy và phân tích lời bài hát khi component được tải
    useEffect(() => {
        const loadLyrics = async () => {
            try {
                setIsLoading(true);
                setError(null);
                // `fetchLyrics` giờ sẽ tự động parse JSON nếu nhận được
                const lyricData = await fetchLyrics(song.songFolderName);

                // Kiểm tra kiểu dữ liệu trả về để biết đó là JSON mới hay SRT cũ
                if (Array.isArray(lyricData) && lyricData.length > 0) {
                    // Nếu là mảng (từ JSON), set state bình thường
                    setLyrics(lyricData);
                } else {
                    // Nếu không phải, có thể là file SRT cũ hoặc file rỗng.
                    // Thông báo cho người dùng cần trích xuất lại để có hiệu ứng mới.
                    setError("Không tìm thấy lời bài hát chi tiết. Vui lòng thử 'Trích lời' lại bài hát này để có hiệu ứng karaoke mới.");
                    setLyrics([]); // Xóa lời cũ nếu có
                }
            } catch (err) {
                setError("Không thể tải lời bài hát. Hãy thử trích xuất lại.");
                console.error("Load lyrics failed:", err);
            } finally {
                setIsLoading(false);
            }
        };
        if (song?.songFolderName) {
            loadLyrics();
        }
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


    const currentTime = player.masterCurrentTime;
    // Tìm index của dòng đang được hát để focus và cuộn
    const activeLineIndex = lyrics.findIndex(line =>
        currentTime >= line.start && currentTime <= line.end
    );

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="w-11/12 max-w-4xl h-5/6 bg-gray-800 text-white rounded-2xl shadow-2xl flex flex-col p-6">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold truncate" title={song.song}>{song.song} - Karaoke</h2>
                    <button onClick={onClose} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">Đóng</button>
                </div>

                <div className="flex-grow min-h-0">
                    {isLoading && <div className="flex items-center justify-center h-full">Đang tải lời bài hát...</div>}
                    {error && <div className="flex items-center justify-center h-full text-red-400 text-center">{error}</div>}

                    {/* Phần hiển thị lời mới */}
                    {!isLoading && !error && (
                        <div className="h-full overflow-y-auto text-center p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-600 flex flex-col justify-center">
                            {lyrics.map((line, index) => (
                                <p
                                    key={index}
                                    ref={activeLineIndex === index ? activeLineRef : null}
                                    className={`text-2xl md:text-4xl font-bold transition-all duration-300 p-2 transform
                                        ${activeLineIndex === index
                                            ? 'text-yellow-300 scale-110' // Dòng active
                                            : (index < activeLineIndex ? 'text-gray-500 scale-90' : 'text-gray-300 scale-90') // Dòng đã qua và sắp tới
                                        }`
                                    }
                                >
                                    {/* Render từng từ bằng component Word */}
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