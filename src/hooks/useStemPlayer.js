//src/hooks/useStemPlayer.js
//Quản lý phát nhạc Stem
import { useState, useEffect, useRef } from "react";

export function useStemPlayer() {
    const [selectedStems, setSelectedStems] = useState({});
    const [masterCurrentTime, setMasterCurrentTime] = useState(0);
    const [masterDuration, setMasterDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const audioRefs = useRef({});
    const progressInterval = useRef(null);

    const stopAllAudio = () => {
        Object.values(audioRefs.current).forEach((audio) => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
        setIsPlaying(false);
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
        }
    };

    const playAllSelected = () => {
        stopAllAudio(); // Dừng trước khi phát mới
        const stemsToPlay = Object.values(selectedStems)
            .map((stem) => audioRefs.current[stem.key])
            .filter(Boolean);
        if (stemsToPlay.length === 0) return;

        stemsToPlay.forEach((audio) => {
            audio.currentTime = masterCurrentTime;
            audio.play().catch(console.error);
        });
        setIsPlaying(true);

        progressInterval.current = setInterval(() => {
            const referenceAudio = stemsToPlay[0];
            if (referenceAudio) {
                setMasterCurrentTime(referenceAudio.currentTime);
                if (referenceAudio.ended) {
                    stopAllAudio();
                    setMasterCurrentTime(0);
                }
            }
        }, 100);
    };

    const seekAll = (time) => {
        Object.values(selectedStems).forEach((stem) => {
            const audio = audioRefs.current[stem.key];
            if (audio) audio.currentTime = time;
        });
        setMasterCurrentTime(time);
    };

    // Cập nhật duration khi selection thay đổi
    useEffect(() => {
        const audioElements = Object.values(selectedStems)
            .map((stem) => audioRefs.current[stem.key])
            .filter(Boolean);
        if (audioElements.length > 0) {
            // Chờ metadata load xong
            setTimeout(() => {
                const maxDuration = Math.max(
                    ...audioElements.map((audio) => audio.duration || 0)
                );
                setMasterDuration(maxDuration);
            }, 100);
        } else {
            setMasterDuration(0);
        }
    }, [selectedStems]);

    const handleSelectStem = (song, stemType, url) => {
        stopAllAudio();
        const key = `${song.song}_${stemType}`;
        setSelectedStems((prev) => {
            const newSelected = { ...prev };
            if (newSelected[key]) {
                delete newSelected[key]; // Deselect
            } else {
                newSelected[key] = { key, song: song.song, type: stemType, url }; // Select
            }
            return newSelected;
        });
    };

    return {
        selectedStems,
        masterCurrentTime,
        masterDuration,
        isPlaying,
        audioRefs, // Component vẫn cần ref để gán   vào thẻ audio
        handleSelectStem,
        playAllSelected,
        stopAllAudio,
        seekAll,
    };
}
