//Một Playlist nhỏ trong library
// src/components/PlaylistItem.jsx
import React from "react";
import { IconContext } from "react-icons";
import { AiFillPlayCircle } from "react-icons/ai";

// Ảnh mặc định có thể import từ local
import DefaultArt from "../assets/SoundWave.jfif";

export default function PlaylistItem({ playlist, onPlay }) {
    const imageUrl = playlist.images?.[0]?.url || DefaultArt;

    return (
        <div
            className="group relative w-50 h-70 rounded-2xl p-2 mb-[2%]
                    bg-[rgb(40,58,88)]
                    cursor-pointer transition-all duration-200 hover:scale-[1.05]"
            onClick={() => onPlay(playlist.id)}
        >
            <img
                src={imageUrl}
                className="w-full aspect-square rounded-md"
                alt="Playlist-Art   "
                onError={(e) => { e.target.src = DefaultArt; }}
            />
            <p className="font-extrabold text-base text-[#c4d0e3] my-[10px] overflow-hidden text-ellipsis truncate">
                {playlist.name || "Unnamed Playlist"}
            </p>
            <p className="font-normal text-xs m-0 text-[#c4d0e37c]">
                {playlist.tracks?.total || 0} Songs
            </p>
            <div className="absolute right-0 bottom-0 opacity-0 w-full h-[30%] rounded-[20px] 
                        bg-gradient-to-t from-[rgba(54,69,98,1)] via-[rgba(54,69,98,0.5)] to-[rgba(54,69,98,0)] 
                        flex items-end justify-end p-[8%] 
                        transition-all duration-500 group-hover:opacity-100">
                <IconContext.Provider value={{ size: "40px", color: "white" }}>
                    <AiFillPlayCircle />
                </IconContext.Provider>
            </div>
        </div>
    );
}