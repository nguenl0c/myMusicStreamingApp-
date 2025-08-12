import { useState, useEffect, } from "react";
import { getAccessToken } from "../spotify"; // Đảm bảo đường dẫn đúng

/**
 * Custom Hook để quản lý và tương tác với Spotify Web Playback SDK.
 * Nó biến trình duyệt thành một thiết bị Spotify và cung cấp các trạng thái,
 * điều khiển cần thiết để xây dựng một trình phát nhạc.
 * @returns {object} Trả về một object chứa các thông tin và hàm điều khiển player.
 */
export default function useSpotifyPlayer() {
  const [player, setPlayer] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const token = getAccessToken();

  useEffect(() => {
    if (!token) {
      console.error("Không có token để khởi tạo Player.");
      return;
    }

    // Biến để kiểm tra xem script đã được thêm vào chưa
    const scriptId = "spotify-sdk-script";
    if (document.getElementById(scriptId)) {
      return;
    }

    // Nạp script của SDK vào trang
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    // Hàm này sẽ được gọi khi SDK đã sẵn sàng
    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: "My Music Streaming App", // Tên sẽ hiển thị trên các thiết bị Spotify khác
        getOAuthToken: (cb) => {
          cb(token);
        }, // Cung cấp token cho SDK
        volume: 0.5,
      });

      setPlayer(spotifyPlayer);

      // Lắng nghe sự kiện: SDK đã sẵn sàng và có device_id
      spotifyPlayer.addListener("ready", ({ device_id }) => {
        console.log("SDK đã sẵn sàng với Device ID:", device_id);
        setDeviceId(device_id);
        setIsReady(true);
      });

      // Lắng nghe sự kiện: Thiết bị đã offline
      spotifyPlayer.addListener("not_ready", ({ device_id }) => {
        console.log("Device ID đã offline:", device_id);
        setIsReady(false);
      });

      // Lắng nghe sự kiện quan trọng nhất: Trạng thái của player thay đổi
      // (play, pause, chuyển bài, thay đổi vị trí, v.v.)
      spotifyPlayer.addListener("player_state_changed", (state) => {
        if (!state) {
          console.warn("Trạng thái player không hợp lệ.");
          return;
        }
        setPlayerState(state);
      });

      // Lắng nghe các lỗi có thể xảy ra
      spotifyPlayer.addListener("initialization_error", ({ message }) => {
        console.error("Lỗi khởi tạo SDK:", message);
      });
      spotifyPlayer.addListener("authentication_error", ({ message }) => {
        console.error("Lỗi xác thực SDK:", message);
      });
      spotifyPlayer.addListener("account_error", ({ message }) => {
        console.error("Lỗi tài khoản SDK:", message);
      });

      // Bắt đầu kết nối SDK với Spotify
      spotifyPlayer.connect().then((success) => {
        if (success) {
          console.log("Đã kết nối thành công với Spotify Player!");
        }
      });
    };

    // Dọn dẹp khi component unmount
    return () => {
      // player có thể vẫn là null nếu component unmount trước khi SDK sẵn sàng
      if (player) {
        player.disconnect();
      }
    };
    // Chạy lại effect này nếu token thay đổi (ví dụ: sau khi refresh)
  }, [token]);

  // Trả về các giá trị cần thiết để component khác có thể sử dụng
  return {
    player, // Instance của player để gọi các hàm như .togglePlay(), .nextTrack()
    isReady, // Boolean: SDK đã sẵn sàng để nhận lệnh chưa?
    deviceId, // String: ID của thiết bị, cần để ra lệnh phát nhạc qua Web API
    playerState, // Object: Thông tin đầy đủ về trạng thái hiện tại của player
  };
}
