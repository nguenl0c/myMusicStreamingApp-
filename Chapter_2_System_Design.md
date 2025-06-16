# CHƯƠNG 2.1: THIẾT KẾ HỆ THỐNG

## 2.1.1 Luồng Làm Việc Của Player (`/player`)

Phần này mô tả chi tiết luồng hoạt động của tính năng Player trong ứng dụng Music Streaming, từ khi người dùng tương tác đến khi âm nhạc được phát.

### 1. Tổng Quan Kiến Trúc Player

Hệ thống Player được thiết kế theo kiến trúc module hóa với các thành phần React component chính, đảm bảo tính dễ bảo trì và mở rộng:

-   **`Players.jsx`**: Đây là screen chính, đóng vai trò container, quản lý giao diện tổng thể của trang Player và các state cốt lõi liên quan đến danh sách bài hát, bài hát hiện tại, và trạng thái phát nhạc.
-   **`AudioPlayer.jsx`**: Là component trung tâm xử lý logic phát nhạc. Nó chịu trách nhiệm tương tác với Spotify Web Playback SDK (cho người dùng Premium) hoặc HTML5 Audio API (cho người dùng Free để phát preview). Component này quản lý việc play, pause, seek, và các sự kiện liên quan đến audio.
-   **`Controls.jsx`**: Component này cung cấp các nút điều khiển cho người dùng, bao gồm play/pause, skip next/previous, thanh trượt tiến trình (progress bar), và điều chỉnh âm lượng. Nó nhận trạng thái từ `AudioPlayer.jsx` và gửi các hành động của người dùng ngược lại.
-   **`Queue.jsx`**: Hiển thị danh sách các bài hát đang chờ phát. Người dùng có thể thấy các bài hát tiếp theo và chọn một bài hát bất kỳ từ hàng đợi để phát ngay.
-   **`UnifiedPlayer.jsx`**: Một phiên bản nâng cao hơn của trình phát, được thiết kế để xử lý việc phát nhạc từ nhiều nguồn một cách thống nhất, bao gồm cả nhạc từ Spotify và các file nhạc local do người dùng tải lên.

### 2. Luồng Khởi Tạo Player

Luồng khởi tạo Player bắt đầu khi người dùng thực hiện một hành động dẫn đến việc phát nhạc, ví dụ như chọn một bài hát từ kết quả tìm kiếm, một playlist, hoặc một album.

```mermaid
graph TD
    A[Người dùng chọn bài hát/playlist/album] --> B[Ứng dụng điều hướng đến route `/players`]
    B --> C[Component `Players.jsx` được render và nhận dữ liệu qua `location.state`]
    C --> D{Kiểm tra loại dữ liệu đầu vào?}
    D -- "Là một Track đơn lẻ" --> E[Xử lý thông tin track đơn lẻ, có thể kèm theo context (ví dụ: album chứa track đó)]
    D -- "Là một Playlist" --> F[Gọi Spotify API để lấy danh sách tracks thuộc playlist]
    D -- "Là một Album" --> G[Gọi Spotify API để lấy danh sách tracks thuộc album]
    E --> H[Cập nhật state: `currentTrack` (bài hát hiện tại) và `tracks` (danh sách bài hát đầy đủ cho hàng đợi)]
    F --> H
    G --> H
    H --> I[Khởi tạo và truyền props cho component `AudioPlayer.jsx`]
    I --> J[Giao diện Player được hiển thị với thông tin bài hát đầu tiên]
```

**Giải thích chi tiết:**

1.  **Hành động người dùng**: Người dùng có thể click vào một bài hát, một playlist, hoặc một album từ các màn hình khác như `Search.jsx` hoặc `Library.jsx`.
2.  **Điều hướng**: Ứng dụng React Router sẽ điều hướng người dùng đến trang `/players`. Dữ liệu cần thiết (ID của playlist/album, thông tin track cụ thể, context) được truyền qua `location.state`.
3.  **Nhận dữ liệu**: `Players.jsx` đọc `location.state` để xác định nội dung cần phát.
4.  **Xử lý dữ liệu**:
    *   Nếu là một track đơn lẻ, `Players.jsx` có thể cần lấy thêm các bài hát liên quan (ví dụ, các bài hát khác trong cùng album) để tạo hàng đợi.
    *   Nếu là playlist hoặc album, `Players.jsx` sẽ sử dụng `apiKit` (một instance của Axios đã được cấu hình) để gọi đến các endpoint tương ứng của Spotify API (`/playlists/{id}/tracks` hoặc `/albums/{id}/tracks`) và lấy về danh sách bài hát.
5.  **Cập nhật State**: Sau khi có được danh sách bài hát (`tracks`) và bài hát hiện tại (`currentTrack`), các state này được cập nhật.
6.  **Khởi tạo `AudioPlayer`**: `Players.jsx` truyền các state cần thiết (như `currentTrack`, `tracks`, `isPremium`, `isPlaying`) xuống cho `AudioPlayer.jsx`.

### 3. Luồng Xử Lý Đa Nguồn (Premium vs. Free)

Ứng dụng phân biệt giữa người dùng Spotify Premium và Free để cung cấp trải nghiệm phù hợp:

-   **Đối với tài khoản Premium**:
    *   Ứng dụng sử dụng `SpotifyWebPlayer` component từ thư viện `react-spotify-web-playback`.
    *   Component này yêu cầu một access token hợp lệ và danh sách URI của các bài hát Spotify.
    *   Nó cho phép phát toàn bộ bài hát trực tiếp từ Spotify, với đầy đủ các tính năng như play, pause, seek, và nhận các callback về trạng thái phát nhạc.
    *   Mã nguồn liên quan:
        ```jsx
        // Trong AudioPlayer.jsx (hoặc UnifiedPlayer.jsx cho Spotify tracks)
        {isPremium && token && (
          <SpotifyWebPlayer
            token={token} // Access token của người dùng
            uris={getTrackUris()} // Mảng URI của các bài hát Spotify
            play={isPlaying && !userPaused} // Trạng thái phát/dừng
            offset={currentIndex} // Vị trí bài hát bắt đầu trong danh sách uris
            callback={(state) => { // Callback nhận trạng thái từ Spotify SDK
              // Xử lý thay đổi trạng thái (ví dụ: tự động dừng, lỗi)
              if (!userPaused) setIsPlaying(!state.paused);
              if (!state.paused && !userPaused) {
                setTrackProgress(state.position / 1000);
                setDuration(state.duration / 1000);
                // Xử lý khi bài hát kết thúc
                if (state.position >= state.duration - 500) {
                  handleTrackEnd();
                }
              }
            }}
            // ... các props khác
          />
        )}
        ```

-   **Đối với tài khoản Free**:
    *   Do hạn chế của Spotify API cho tài khoản Free, ứng dụng không thể phát toàn bộ bài hát.
    *   Thay vào đó, `Players.jsx` sẽ cố gắng lấy `preview_url` (một đoạn nhạc mẫu 30 giây) cho mỗi bài hát thông qua một lệnh gọi API bổ sung đến endpoint `/tracks/{id}` của Spotify.
    *   Đoạn preview này được phát bằng cách sử dụng thẻ `<audio>` chuẩn của HTML5.
    *   Mã nguồn liên quan:
        ```jsx
        // Trong Players.jsx, hàm fetchPreviewUrl
        const fetchPreviewUrl = async (trackId) => {
          // ... Gọi API Spotify /tracks/{trackId} để lấy preview_url ...
        };

        // Trong AudioPlayer.jsx
        {!isPremium && previewUrl && (
          <audio
            ref={audioRef} // Ref để điều khiển audio element
            src={previewUrl} // URL của đoạn nhạc preview
            onEnded={handleTrackEnd} // Xử lý khi preview kết thúc
            onTimeUpdate={() => { // Cập nhật tiến trình phát
              if (audioRef.current && isPlaying && !userPaused) {
                setTrackProgress(audioRef.current.currentTime);
                setDuration(audioRef.current.duration || 30);
              }
            }}
            // ... các event listeners khác
          />
        )}
        ```
    *   Một thông báo thường được hiển thị cho người dùng Free, giải thích về giới hạn này và khuyến khích nâng cấp lên Premium.

### 4. Quản Lý State Chính

Việc quản lý trạng thái (state) là rất quan trọng để đảm bảo Player hoạt động chính xác và đồng bộ. Các state chính được quản lý trong `Players.jsx` và `AudioPlayer.jsx` (hoặc `UnifiedPlayer.jsx`):

-   **`tracks` (Array)**: Mảng chứa danh sách các đối tượng bài hát (metadata) sẽ được phát trong hàng đợi.
-   **`currentTrack` (Object)**: Đối tượng chứa metadata của bài hát đang được phát hoặc được chọn.
-   **`currentIndex` (Number)**: Chỉ số của `currentTrack` trong mảng `tracks`.
-   **`isPlaying` (Boolean)**: Trạng thái cho biết nhạc có đang phát (`true`) hay không (`false`).
-   **`userPaused` (Boolean)**: Cờ này được đặt thành `true` khi người dùng chủ động nhấn nút pause. Điều này giúp phân biệt giữa việc nhạc tự động dừng (ví dụ: do SDK của Spotify) và việc người dùng muốn dừng. Nó ngăn việc nhạc tự động phát lại không mong muốn.
-   **`previewUrl` (String | null)**: Lưu URL của đoạn nhạc preview cho người dùng Free.
-   **`trackProgress` (Number)**: Thời gian hiện tại của bài hát đang phát (tính bằng giây).
-   **`duration` (Number)**: Tổng thời lượng của bài hát đang phát (tính bằng giây).
-   **`token` (String)**: Spotify access token.
-   **`activeDevice` (String | null)**: (Chủ yếu cho Premium) ID của thiết bị Spotify đang hoạt động.
-   **`activeSource` (Enum: `PLAYER_SOURCE.SPOTIFY` | `PLAYER_SOURCE.LOCAL`)**: Trong `UnifiedPlayer.jsx`, cho biết nguồn phát hiện tại của bài hát.

Các state này được truyền xuống các component con (như `AudioPlayer`, `Controls`, `Queue`) dưới dạng props và được cập nhật thông qua các hàm callback.

### 5. Luồng Chuyển Bài Hát (Next/Previous/Select from Queue)

Khi người dùng chuyển bài hát:

1.  **Hành động**: Người dùng click nút "Next", "Previous", hoặc chọn một bài hát từ `Queue.jsx`.
2.  **Cập nhật `currentIndex`**:
    *   `Players.jsx` (hoặc `UnifiedPlayer.jsx`) cập nhật state `currentIndex`. Ví dụ:
        ```javascript
        // Trong AudioPlayer.jsx (hoặc component cha)
        const handleSkipNext = () => {
          if (currentIndex < tracks.length - 1) {
            setCurrentIndex(currentIndex + 1);
          } else {
            setCurrentIndex(0); // Quay lại bài đầu tiên nếu hết danh sách
          }
          setUserPaused(false); // Reset userPaused để bài mới có thể tự động phát
        };
        ```
3.  **`useEffect` theo dõi `currentIndex`**: Một `useEffect` hook trong `Players.jsx` (hoặc `UnifiedPlayer.jsx`) sẽ theo dõi sự thay đổi của `currentIndex` và `tracks`.
    ```javascript
    // Trong Players.jsx
    useEffect(() => {
      const updateCurrentTrack = async () => {
        if (tracks && tracks.length > 0 && currentIndex >= 0 && currentIndex < tracks.length) {
          const trackToPlay = tracks[currentIndex].track || tracks[currentIndex]; // Lấy đúng đối tượng track
          setCurrentTrack(trackToPlay);
          setIsPlaying(true); // Mặc định là phát khi chuyển bài (có thể tùy chỉnh)
          setUserPaused(false);

          if (!isPremium) { // Nếu là Free user, lấy preview URL mới
            const url = await fetchPreviewUrl(trackToPlay.id);
            setPreviewUrl(url);
          }
          // Nếu là UnifiedPlayer, cần xác định lại activeSource và chuẩn bị player tương ứng
        }
      };
      updateCurrentTrack();
    }, [currentIndex, tracks, isPremium]); // Dependency array
    ```
4.  **Cập nhật `currentTrack`**: Bài hát mới được đặt làm `currentTrack`.
5.  **Tải và Phát**:
    *   **Premium**: `SpotifyWebPlayer` tự động xử lý việc phát bài hát mới dựa trên `uris` và `offset` (hoặc `currentTrackIndex`).
    *   **Free**: `AudioPlayer.jsx` cập nhật `src` của thẻ `<audio>` với `previewUrl` mới và gọi `audioRef.current.play()`.
    *   **UnifiedPlayer**: Logic phức tạp hơn để dừng player cũ, xác định nguồn của track mới (Spotify hay Local), và khởi tạo player tương ứng.
        ```javascript
        // Trong UnifiedPlayer.jsx, useEffect theo dõi currentTrackIndex
        // ...
        // await stopAllPlayers(); // Dừng tất cả các trình phát hiện tại
        // const track = tracks[currentTrackIndex];
        // setCurrentTrack(track);
        // setActiveSource(track.type === "spotify" ? PLAYER_SOURCE.SPOTIFY : PLAYER_SOURCE.LOCAL);
        // if (track.type === "local") {
        //   audioRef.current.src = track.url;
        //   audioRef.current.load();
        //   // ... set up event listeners for local audio
        // } else if (track.type === "spotify" && token) {
        //   // SpotifyWebPlayer sẽ được kích hoạt với URI mới
        // }
        // setIsPlaying(true); // Bắt đầu phát bài mới
        // ...
        ```

### 6. Luồng Điều Khiển Play/Pause

Việc xử lý play/pause cần phải tính đến `userPaused` để tránh xung đột giữa hành động của người dùng và các cập nhật trạng thái tự động từ SDK.

1.  **Hành động**: Người dùng click nút Play/Pause trên `Controls.jsx`.
2.  **Callback `onPlayPause`**: `Controls.jsx` gọi hàm `onPlayPause` được truyền từ `AudioPlayer.jsx`.
3.  **Cập nhật State trong `AudioPlayer.jsx`**:
    ```javascript
    // Trong AudioPlayer.jsx
    const handlePlayPauseClick = () => {
      if (isPlaying) { // Nếu đang phát -> muốn dừng
        setIsPlaying(false);
        setUserPaused(true); // Đánh dấu người dùng chủ động dừng
        // Gọi API/method để dừng (pauseOnDevice() cho Premium, audioRef.current.pause() cho Free)
      } else { // Nếu đang dừng -> muốn phát
        setIsPlaying(true);
        setUserPaused(false); // Reset cờ này
        // Gọi API/method để phát (playOnDevice() cho Premium, audioRef.current.play() cho Free)
      }
    };
    ```
4.  **`useEffect` theo dõi `isPlaying` và `userPaused`**:
    *   Một `useEffect` trong `AudioPlayer.jsx` sẽ phản ứng với sự thay đổi của `isPlaying` (và `userPaused`, `previewUrl`, `activeDevice` cho Premium).
    *   Nếu `isPlaying` là `true` VÀ `userPaused` là `false`:
        *   **Premium**: Gọi hàm `playOnDevice()` để yêu cầu Spotify SDK phát nhạc trên thiết bị đã chọn.
        *   **Free**: Gọi `audioRef.current.play()` để phát preview.
    *   Nếu `isPlaying` là `false`:
        *   **Premium**: Gọi hàm `pauseOnDevice()` để yêu cầu Spotify SDK dừng nhạc.
        *   **Free**: Gọi `audioRef.current.pause()`.
    *   Việc kiểm tra `userPaused` đảm bảo rằng nếu người dùng đã nhấn pause, nhạc sẽ không tự động phát lại chỉ vì một thay đổi trạng thái khác (ví dụ: callback từ `SpotifyWebPlayer`).

### 7. Luồng Cập Nhật Tiến Trình (Progress Tracking)

-   **Đối với Spotify Premium (thông qua `SpotifyWebPlayer` hoặc polling)**:
    *   `SpotifyWebPlayer` component cung cấp callback `state` chứa thông tin `position` (tiến trình hiện tại) và `duration` (tổng thời lượng).
    *   `AudioPlayer.jsx` cập nhật state `trackProgress` và `duration` dựa trên callback này.
    *   Ngoài ra, dự án có thể sử dụng polling (gọi API `/v1/me/player/currently-playing` định kỳ) để lấy trạng thái phát nhạc hiện tại nếu `SpotifyWebPlayer` không được sử dụng hoặc để đồng bộ hóa chính xác hơn.
        ```javascript
        // Trong callback của SpotifyWebPlayer hoặc interval polling
        // setTrackProgress(state.position / 1000); // Chuyển từ ms sang s
        // setDuration(state.duration / 1000);
        ```

-   **Đối với tài khoản Free (thẻ `<audio>` HTML5)**:
    *   Sử dụng sự kiện `onTimeUpdate` của thẻ `<audio>`.
    *   Khi sự kiện này được kích hoạt, `audioRef.current.currentTime` và `audioRef.current.duration` được dùng để cập nhật state `trackProgress` và `duration`.
        ```javascript
        // Trong AudioPlayer.jsx, thẻ <audio>
        // onTimeUpdate={() => {
        //   if (audioRef.current && isPlaying && !userPaused) {
        //     setTrackProgress(audioRef.current.currentTime);
        //     setDuration(audioRef.current.duration || 30); // Preview thường 30s
        //   }
        // }}
        ```

-   **Hiển thị Tiến Trình**: `Controls.jsx` nhận `trackProgress` và `duration` làm props, tính toán phần trăm hoàn thành và hiển thị trên thanh trượt (progress bar). Thanh trượt này cũng cho phép người dùng click hoặc kéo để tua (seek) bài hát.
    *   Khi người dùng tua, `onProgressChange` callback được gọi, cập nhật `trackProgress` ở `AudioPlayer.jsx`.
    *   `AudioPlayer.jsx` sau đó sẽ gọi API seek của Spotify (cho Premium) hoặc `audioRef.current.currentTime = newPosition` (cho Free).

### 8. Tương Tác Giữa Các Component Chính

```mermaid
graph LR
    PlayersScreen[Players.jsx (Screen)]
    AudioPlayerComp[AudioPlayer.jsx / UnifiedPlayer.jsx]
    ControlsComp[Controls.jsx]
    QueueComp[Queue.jsx]

    PlayersScreen -- "props (currentTrack, tracks, isPremium, etc.)" --> AudioPlayerComp
    AudioPlayerComp -- "props (isPlaying, trackProgress, duration)" --> ControlsComp
    ControlsComp -- "callbacks (onPlayPause, onSkipNext, onProgressChange)" --> AudioPlayerComp
    
    PlayersScreen -- "props (tracks, currentIndex, isPlaying)" --> QueueComp
    QueueComp -- "callbacks (setCurrentIndex, onPlayPause)" --> PlayersScreen 
    QueueComp -- "callbacks (setCurrentIndex, onPlayPause)" --> AudioPlayerComp

    subgraph "Player Core Logic"
        AudioPlayerComp
        ControlsComp
    end

    subgraph "Playlist Display"
        QueueComp
    end
    
    PlayersScreen --> QueueComp
```
-   `Players.jsx` là component cha, quản lý state chính và điều phối dữ liệu.
-   `AudioPlayer.jsx` (hoặc `UnifiedPlayer.jsx`) nhận dữ liệu bài hát và trạng thái từ `Players.jsx`, xử lý logic phát nhạc, và truyền trạng thái xuống `Controls.jsx`.
-   `Controls.jsx` hiển thị các nút điều khiển và thanh tiến trình, gửi các hành động của người dùng (play, pause, skip, seek) trở lại `AudioPlayer.jsx` thông qua callbacks.
-   `Queue.jsx` nhận danh sách bài hát từ `Players.jsx`, hiển thị chúng, và cho phép người dùng chọn bài hát mới (gọi callback `setCurrentIndex` của `Players.jsx`).

### 9. Quản Lý Hàng Đợi (`Queue.jsx`)

-   `Queue.jsx` hiển thị danh sách `tracks`.
-   Mỗi item trong queue có thể được click để phát bài hát đó. Khi click, nó gọi `setCurrentIndex(index)` (prop từ `Players.jsx`).
-   Bài hát đang phát hiện tại (`currentIndex`) được làm nổi bật trong queue.
-   Nút play/pause nhỏ có thể được hiển thị bên cạnh mỗi bài hát trong queue, cho phép phát/dừng trực tiếp bài hát đó hoặc phát/dừng bài hát hiện tại nếu bài đó đang được chọn.

### 10. Xử Lý Lỗi (Error Handling)

-   **Lỗi API**: Các lệnh gọi API (Spotify, server backend) được bọc trong `try...catch` blocks. Lỗi được bắt và hiển thị thông báo cho người dùng (ví dụ: "Không thể tải playlist", "Lỗi khi lấy preview URL").
-   **Lỗi Phát Nhạc**:
    *   `SpotifyWebPlayer` cung cấp callback `onError`.
    *   Thẻ `<audio>` HTML5 có thể gặp lỗi khi tải hoặc phát.
    *   Các lỗi này được bắt và có thể hiển thị thông báo như "Không có preview cho bài hát này" hoặc "Không thể phát nhạc, vui lòng thử lại".
-   **State Lỗi**: Một state `error` được duy trì trong `Players.jsx` hoặc `AudioPlayer.jsx` để lưu trữ thông điệp lỗi và hiển thị nó trên UI.

### 11. Thiết Kế Giao Diện Người Dùng (UI) và Trải Nghiệm Người Dùng (UX)

-   **Giao diện chính của Player (`Players.jsx`) thường bao gồm**:
    *   **Panel Trái (hoặc trung tâm)**: Hiển thị ảnh bìa album/track lớn, tên bài hát, tên nghệ sĩ. Bên dưới là component `Controls.jsx`.
    *   **Panel Phải (tùy chọn)**: Có thể hiển thị lời bài hát (lyrics) - trong dự án này là "Coming Soon" hoặc thông tin chi tiết hơn về bài hát/album.
    *   **Panel Dưới (hoặc cuộn ngang)**: Component `Queue.jsx` hiển thị danh sách các bài hát tiếp theo.
-   **Responsive Design**: Giao diện được thiết kế để tương thích trên các kích thước màn hình khác nhau sử dụng Tailwind CSS.
-   **Feedback Người Dùng**:
    *   Hiển thị trạng thái loading khi đang tải dữ liệu.
    *   Thông báo lỗi rõ ràng.
    *   Visual feedback cho các nút (ví dụ: thay đổi icon play/pause).
    *   Bài hát đang phát được làm nổi bật trong Queue.

### 12. Các Tính Năng Chính Của Player Tổng Hợp

1.  **Hỗ trợ Dual Mode**: Tự động phát hiện loại tài khoản (Premium/Free) và điều chỉnh phương thức phát nhạc cho phù hợp.
2.  **Lưu Trữ Trạng Thái Phát**: Giữ lại vị trí phát khi người dùng tạm dừng và tiếp tục.
3.  **Điều Hướng Hàng Đợi**: Cho phép người dùng dễ dàng chọn bài hát từ hàng đợi. Trong `UnifiedPlayer.jsx`, có hỗ trợ kéo thả để sắp xếp lại hàng đợi.
4.  **Điều Khiển Tiến Trình**: Thanh trượt (seek bar) cho phép người dùng tua đến bất kỳ vị trí nào trong bài hát.
5.  **Điều Khiển Âm Lượng**: Thanh trượt âm lượng và nút mute/unmute.
6.  **Phím Tắt (Keyboard Shortcuts)**: Hỗ trợ các phím tắt cơ bản như Spacebar để play/pause, phím mũi tên để chuyển bài.
7.  **Tính năng Shuffle và Repeat**: (Trong `Controls.jsx`) cho phép phát ngẫu nhiên và lặp lại bài hát/playlist.

### 13. Tối Ưu Hóa Hiệu Năng (Performance Optimizations)

-   **Code Splitting / Lazy Loading**: React.lazy và Suspense có thể được sử dụng để chỉ tải các component khi chúng thực sự cần thiết, giảm kích thước bundle ban đầu.
-   **Debouncing/Throttling**: Đối với các sự kiện như thay đổi kích thước cửa sổ hoặc input trên thanh tìm kiếm (không trực tiếp trong Player nhưng liên quan đến UX tổng thể), debouncing hoặc throttling được sử dụng để hạn chế số lần gọi API hoặc tính toán lại.
-   **Memoization**: Sử dụng `React.memo`, `useMemo`, `useCallback` để tránh re-render không cần thiết của các component và tính toán lại các giá trị phức tạp.
-   **Quản lý Memory**: Đảm bảo các event listeners và intervals được dọn dẹp (cleanup) khi component unmount để tránh rò rỉ bộ nhớ (memory leaks), ví dụ như `clearInterval` trong `useEffect` cleanup function.

Luồng làm việc này minh họa cách ứng dụng xử lý việc phát nhạc một cách linh hoạt, từ việc lấy dữ liệu, quản lý trạng thái, đến việc tương tác với các API bên ngoài và cung cấp một giao diện người dùng trực quan và dễ sử dụng. 

## 2.1.2 Luồng Làm Việc Của Tính Năng Mixer (`/mixer`) và Mô Hình Demucs

Tính năng Mixer là một điểm nhấn độc đáo của ứng dụng, cho phép người dùng tách các thành phần âm thanh (stems) từ một bài hát bằng công nghệ AI, cụ thể là mô hình Demucs. Sau đó, người dùng có thể điều chỉnh âm lượng của từng thành phần để tạo ra các bản phối mới.

### 1. Giới Thiệu Mô Hình Demucs

Demucs (Deep Music Source Separation) là một mô hình học sâu (deep learning) tiên tiến được phát triển bởi Facebook AI Research (nay là Meta AI), chuyên cho nhiệm vụ **tách nguồn âm nhạc (Music Source Separation - MSS)**. Mục tiêu chính của Demucs là tách một bản nhạc hoàn chỉnh (một file audio) thành các thành phần nhạc cụ riêng lẻ.

**Các đặc điểm nổi bật của Demucs:**

-   **Kiến trúc Mạng Nơ-ron Sâu**: Demucs thường sử dụng kiến trúc dựa trên mạng nơ-ron tích chập (Convolutional Neural Networks - CNNs), đặc biệt là các kiến trúc lai hoặc lấy cảm hứng từ U-Net, có thể kết hợp cả Transformers trong các phiên bản mới. Kiến trúc này giúp mô hình nắm bắt cả thông tin cục bộ và toàn cục của âm thanh.
-   **Đầu Vào và Đầu Ra**:
    -   **Đầu vào**: Một file audio chứa bản nhạc hỗn hợp (ví dụ: MP3, WAV, FLAC).
    -   **Đầu ra**: Nhiều file audio riêng biệt (stems). Phổ biến nhất là 4 stems: `Vocals` (Giọng hát), `Drums` (Trống), `Bass` (Tiếng bass), và `Other` (Các nhạc cụ/âm thanh còn lại).
-   **Quá Trình Huấn Luyện**: Demucs được huấn luyện trên các bộ dữ liệu âm nhạc lớn (như MUSDB18), nơi có sẵn cả bản nhạc hỗn hợp và các stems riêng lẻ của chúng.
-   **Ưu điểm**:
    -   **Chất lượng tách cao**: Là một trong những mô hình hàng đầu về chất lượng tách nguồn.
    -   **Mã nguồn mở**: Cho phép tích hợp và tùy chỉnh.
    -   **Linh hoạt**: Có thể chạy trên CPU (chậm hơn) hoặc GPU (nhanh hơn).
-   **Tích hợp trong dự án**: Backend Node.js của ứng dụng sẽ gọi một script Python chạy mô hình Demucs để xử lý file âm thanh do người dùng tải lên.

### 2. Quy Trình Xử Lý File Âm Thanh Trong Tính Năng Mixer

```mermaid
graph TD
    A[Người dùng truy cập trang /mixer] --> B(Giao diện Mixer hiển thị)
    B --> C{Người dùng chọn file nhạc}
    C -- Kéo thả hoặc chọn từ File Picker --> D[Frontend: Người dùng tải lên file âm thanh]
    D --> E[Frontend: Kiểm tra sơ bộ file (định dạng, kích thước)]
    E -- File hợp lệ --> F[Frontend: Gửi file lên Server (HTTP POST, có theo dõi tiến trình upload)]
    E -- File không hợp lệ --> G[Frontend: Hiển thị thông báo lỗi]
    
    F --> H[Backend (Node.js/Express.js): Tiếp nhận file (sử dụng Multer)]
    H --> I[Backend: Lưu file vào thư mục tạm]
    I --> J[Backend: Kiểm tra chi tiết file (MIME type, kích thước tối đa, tính toàn vẹn)]
    J -- File hợp lệ --> K[Backend: Tạo Job ID (tùy chọn, để theo dõi)]
    J -- File không hợp lệ --> L[Backend: Xóa file tạm, gửi lỗi về Frontend]
    
    K --> M[Backend: Gọi tiến trình con (Child Process) để thực thi script Python với Demucs]
    M -- Đường dẫn file tạm --> N[Python Script (Demucs): Nhận file và bắt đầu xử lý]
    N --> O[Demucs: Phân tích và tách file audio thành các stems (vocals, drums, bass, other)]
    O --> P[Python Script: Lưu các stems đã tách thành các file audio riêng biệt (ví dụ: MP3) vào một thư mục output]
    P --> Q[Python Script: Thông báo hoàn thành (hoặc lỗi) cho tiến trình Backend Node.js]
    
    M -- Theo dõi tiến trình (stdout/stderr) --> R[Backend: Cập nhật trạng thái xử lý (có thể thông qua polling hoặc WebSocket cho Frontend)]
    
    Q -- Thành công, trả đường dẫn các stems --> S[Backend: Chuẩn bị URLs để Frontend truy cập các file stems]
    Q -- Thất bại --> T[Backend: Ghi nhận lỗi, gửi thông báo lỗi về Frontend]
    
    S --> U[Backend: Gửi thông báo hoàn thành và URLs của các stems về Frontend]
    
    U --> V[Frontend: Nhận URLs các stems]
    V --> W[Frontend: Hiển thị giao diện điều khiển Mixer với 4 channels (hoặc nhiều hơn)]
    W --> X[Frontend: Mỗi channel có Volume Slider, nút Mute, nút Solo cho từng stem]
    X --> Y[Frontend: Tích hợp trình phát (Audio Context API) để phát lại các stems theo thiết lập của người dùng]
    Y --> Z[Người dùng tương tác: Điều chỉnh âm lượng, mute/solo các stems để nghe bản phối mới]

    L --> G
    T --> G
    R --> B_Update[Frontend: Cập nhật giao diện với tiến trình xử lý (ví dụ: progress bar)]
```

### 3. Chi Tiết Các Bước Trong Luồng Mixer

1.  **Upload và Kiểm Tra Phía Client (Frontend)**:
    *   Người dùng tương tác với giao diện (`mixer.jsx`) để chọn hoặc kéo thả một file âm thanh.
    *   JavaScript phía client thực hiện các kiểm tra cơ bản:
        *   **Định dạng file**: Chỉ chấp nhận các định dạng được hỗ trợ (ví dụ: MP3, WAV, FLAC).
        *   **Kích thước file**: Giới hạn kích thước (ví dụ: 50MB) để tránh quá tải và đảm bảo hiệu suất xử lý.
    *   Nếu file không hợp lệ, hiển thị thông báo lỗi ngay lập tức.
    *   Nếu hợp lệ, file được gửi lên server thông qua một HTTP POST request. Giao diện có thể hiển thị thanh tiến trình (progress bar) để người dùng theo dõi quá trình upload.

2.  **Tiếp Nhận và Kiểm Tra Phía Server (Backend)**:
    *   API server (Node.js với Express.js) sử dụng middleware như `Multer` để xử lý `multipart/form-data` (dữ liệu file upload).
    *   File được lưu vào một thư mục tạm trên server với tên file duy nhất (ví dụ: sử dụng timestamp) để tránh xung đột.
    *   Thực hiện các kiểm tra bảo mật và tính toàn vẹn kỹ lưỡng hơn:
        *   Xác minh `MIME type` của file.
        *   Kiểm tra lại kích thước file.
        *   Sanitize tên file để tránh các lỗ hổng bảo mật như path traversal.
    *   Nếu file không đạt yêu cầu, file tạm sẽ bị xóa và một thông báo lỗi được gửi về cho client.

3.  **Xử Lý Bằng AI (Tích hợp Demucs)**:
    *   Nếu file hợp lệ, backend Node.js sẽ khởi chạy một tiến trình con (child process) để thực thi một script Python.
    *   Đường dẫn đến file âm thanh tạm được truyền làm tham số cho script Python.
    *   Script Python này sẽ:
        *   Import thư viện Demucs (hoặc sử dụng Demucs đã cài đặt như một công cụ dòng lệnh).
        *   Gọi hàm xử lý của Demucs, truyền vào file âm thanh đầu vào.
        *   Mô hình Demucs phân tích file, áp dụng các thuật toán học sâu để tách biệt các nguồn âm thanh (vocals, drums, bass, other).
        *   Các stems (thành phần) đã được tách sẽ được lưu dưới dạng các file audio riêng biệt (thường là MP3 hoặc WAV) vào một thư mục output được chỉ định trên server.
    *   Trong quá trình này, backend Node.js có thể theo dõi output (stdout, stderr) của tiến trình con để cập nhật trạng thái xử lý cho frontend (ví dụ: "Đang xử lý...", "Hoàn thành 50%...").

4.  **Chuẩn Bị và Trả Kết Quả**:
    *   Sau khi script Python hoàn thành việc tách stems:
        *   Nếu thành công: Script sẽ trả về thông tin về các file stems đã tạo (ví dụ: đường dẫn hoặc tên file) cho tiến trình Node.js cha.
        *   Nếu có lỗi trong quá trình xử lý của Demucs: Script sẽ báo lỗi.
    *   Backend Node.js nhận kết quả từ tiến trình con:
        *   Nếu thành công: Chuyển đổi các stems về định dạng mong muốn (ví dụ: MP3 với bitrate cụ thể nếu cần), tạo các URL tĩnh hoặc đường dẫn an toàn để frontend có thể truy cập và phát các file stems này.
        *   Gửi một response về cho client, chứa thông báo hoàn thành và danh sách các URL của các stems.
        *   Dọn dẹp file tạm ban đầu và có thể cả các file stems sau một khoảng thời gian nhất định hoặc theo một cơ chế quản lý lưu trữ.
        *   Nếu thất bại: Gửi thông báo lỗi chi tiết về cho client.

5.  **Hiển Thị và Tương Tác Trên Giao Diện Mixer (Frontend)**:
    *   Client (`mixer.jsx`) nhận được phản hồi từ server.
    *   Nếu thành công:
        *   Giao diện Mixer sẽ được cập nhật để hiển thị các kênh điều khiển (channels) tương ứng với từng stem đã tách (ví dụ: 4 channels cho Vocals, Drums, Bass, Other).
        *   Mỗi channel sẽ có:
            *   **Volume Slider**: Cho phép người dùng điều chỉnh âm lượng của stem đó từ 0% đến 100% (hoặc hơn).
            *   **Nút Mute**: Tắt tiếng hoàn toàn stem đó.
            *   **Nút Solo**: Chỉ phát duy nhất stem đó và tắt tiếng các stems còn lại.
            *   Có thể có thêm các visual feedback (ví dụ: màu sắc riêng cho từng stem, thanh đo mức âm lượng).
    *   Một trình phát nhạc tích hợp (có thể sử dụng Web Audio API để kiểm soát audio phức tạp hơn) cho phép người dùng:
        *   Play/Pause đồng thời tất cả các stems (đã được điều chỉnh âm lượng).
        *   Sử dụng thanh seek bar để nhảy đến các vị trí khác nhau trong bản nhạc.
        *   Điều chỉnh âm lượng tổng (master volume).
    *   Người dùng có thể tự do thử nghiệm bằng cách điều chỉnh âm lượng của từng stem, tạo ra các phiên bản remix, acapella (chỉ giọng hát), hoặc instrumental (chỉ nhạc nền) của bài hát gốc.
    *   Nếu có lỗi: Hiển thị thông báo lỗi cho người dùng.

### 4. Tối Ưu Hóa và Trải Nghiệm Người Dùng

-   **Theo dõi tiến trình**: Cung cấp phản hồi real-time cho người dùng về trạng thái upload và xử lý AI (có thể dùng WebSocket cho cập nhật tức thì hoặc polling nếu đơn giản hơn).
-   **Xử lý bất đồng bộ**: Toàn bộ quá trình từ upload đến xử lý AI là bất đồng bộ để không làm treo trình duyệt.
-   **Quản lý hàng đợi (Queue System)**: Nếu nhiều người dùng cùng lúc sử dụng tính năng, backend có thể cần một hệ thống hàng đợi để xử lý các yêu cầu AI tuần tự, tránh quá tải server. (Mục này được đề cập là "planned" trong tài liệu `Chapter_2_Implementation.md`).
-   **Dọn dẹp file**: Có cơ chế tự động xóa file tạm và file output sau một thời gian để tiết kiệm không gian lưu trữ trên server.
-   **Giao diện trực quan**: Thiết kế giao diện Mixer dễ hiểu, dễ sử dụng ngay cả với người không có kinh nghiệm về chỉnh sửa âm thanh.

Luồng làm việc này kết hợp sức mạnh xử lý của backend (Node.js và Python/Demucs) với giao diện tương tác người dùng phong phú của frontend (React) để mang lại một công cụ chỉnh sửa âm nhạc dựa trên AI mạnh mẽ và dễ tiếp cận. 