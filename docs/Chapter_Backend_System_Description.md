\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[vietnamese]{babel}
\usepackage{geometry}
\usepackage{fancyhdr}
\usepackage{graphicx}
\usepackage{listings}
\usepackage{xcolor}
\usepackage{hyperref}
\usepackage{amsmath}
\usepackage{amssymb}

\geometry{
    top=2.5cm,
    bottom=2.5cm,
    left=3cm,
    right=2cm
}

\lstset{
    basicstyle=\ttfamily\footnotesize,
    backgroundcolor=\color{gray!10},
    frame=single,
    breaklines=true,
    captionpos=b
}

\title{\textbf{CHƯƠNG IV: MÔ TẢ CHI TIẾT HỆ THỐNG BACKEND}}
\author{}
\date{}

\begin{document}
\maketitle

\begin{abstract}
Chương này tập trung phân tích và mô tả chi tiết kiến trúc và hoạt động của hệ thống backend trong dự án Music Streaming. Backend đóng vai trò trung tâm trong việc xử lý logic nghiệp vụ, quản lý xác thực người dùng, tương tác với các dịch vụ bên ngoài như Spotify API, và đặc biệt là điều phối quá trình tách nguồn âm nhạc sử dụng mô hình AI Demucs.
\end{abstract}

\section{Tổng Quan Kiến Trúc Backend}
\label{sec:backend-overview}

Hệ thống backend được xây dựng dựa trên Node.js và framework Express.js, lựa chọn này mang lại một môi trường phát triển đồng nhất với frontend (React.js) và tận dụng được ưu thế xử lý bất đồng bộ của Node.js cho các tác vụ I/O và mạng.

Kiến trúc tổng thể của backend bao gồm các module chính sau:

\begin{itemize}
    \item \textbf{Module Xác thực (Authentication Module)}: Xử lý toàn bộ quy trình OAuth 2.0 với Spotify API, bao gồm việc đăng nhập, trao đổi token, làm mới token và kiểm tra thông tin tài khoản người dùng.
    \item \textbf{Module API Demucs (Demucs API Module)}: Quản lý việc tiếp nhận file âm thanh từ người dùng, khởi chạy và theo dõi tiến trình con Python thực thi mô hình Demucs, xử lý kết quả stems trả về, và cung cấp các API cho client để tương tác với tính năng tách nhạc.
    \item \textbf{Module Phục vụ File Tĩnh (Static File Serving Module)}: Sử dụng \texttt{express.static} để cung cấp các file audio đã được xử lý (stems, có thể cả các file mixed) cho client.
    \item \textbf{Hệ thống File (File System)}: Backend tương tác trực tiếp với file system của server để lưu trữ file audio gốc do người dùng tải lên (\texttt{server/uploads/}), các stems đã được tách bởi Demucs (\texttt{server/output/\{trackId\}/}), và dự kiến cho các file audio đã được mix lại.
\end{itemize}

Sơ đồ kiến trúc backend và các tương tác chính:

\begin{lstlisting}[language=bash, caption=Sơ đồ kiến trúc backend (Mermaid)]
graph TD
    subgraph "User Domain"
        A[React Client (Frontend)]
    end

    subgraph "Application Server Domain (Node.js Backend)"
        B[Express.js Application]
        B_Auth["Spotify Auth Module (/auth)"]
        B_DemucsAPI["Demucs API Module (/api)"]
        B_Static["Static File Server (/output, /mixer)"]
        FStore[File System (server/uploads, server/output)]

        B --> B_Auth
        B --> B_DemucsAPI
        B --> B_Static
        B_DemucsAPI ----> FStore
        B_Static ----> FStore
    end

    subgraph "AI Processing Domain (Local Subprocess)"
        C[Python Demucs (Child Process)]
    end
    
    subgraph "External Services"
        D[Spotify Web API]
    end

    A -- "HTTP Requests (Login, Upload, Start Separation, Get Progress, Get Stems)" --> B
    B_Auth -- "Redirect/Token Exchange/API Calls" --> D
    B_DemucsAPI -- "spawn()" --> C
    C -- "Reads audio from / Writes stems to" --> FStore
\end{lstlisting}

\section{Công Nghệ và Thư Viện Sử Dụng Phía Backend}
\label{sec:backend-technologies}

\subsection{Nền tảng và Framework Chính}
\label{subsec:main-platform}

\begin{itemize}
    \item \textbf{Node.js}: Môi trường thực thi JavaScript phía server, cho phép xây dựng các ứng dụng mạng hiệu suất cao với mô hình I/O không chặn (non-blocking I/O). Phiên bản hỗ trợ ES Modules được ưu tiên.
    \item \textbf{Express.js}: Một micro-framework phổ biến và linh hoạt cho Node.js, cung cấp các tính năng cơ bản để xây dựng ứng dụng web và API, nổi bật với kiến trúc middleware.
\end{itemize}

\subsection{Các Thư Viện Hỗ Trợ Quan Trọng}
\label{subsec:supporting-libraries}

\begin{itemize}
    \item \textbf{\texttt{cors}}: Middleware cho phép Cross-Origin Resource Sharing, cần thiết để frontend (chạy trên một port khác) có thể gửi yêu cầu đến backend. Được cấu hình để chỉ chấp nhận request từ origin của frontend.
    \item \textbf{\texttt{dotenv}}: Giúp quản lý các biến môi trường một cách an toàn và tiện lợi, tách biệt cấu hình nhạy cảm (như API keys) ra khỏi mã nguồn. File \texttt{.env} chứa các biến như \texttt{SPOTIFY\_CLIENT\_ID}, \texttt{SPOTIFY\_CLIENT\_SECRET}, \texttt{REDIRECT\_URI}.
    \item \textbf{\texttt{axios}}: HTTP client dựa trên Promise, được sử dụng phía server để thực hiện các yêu cầu đến Spotify API (ví dụ: trao đổi token, lấy thông tin người dùng).
    \item \textbf{\texttt{multer}}: Middleware chuyên xử lý \texttt{multipart/form-data}, được sử dụng để quản lý việc tải file âm thanh từ client lên server. File được lưu vào thư mục tạm (\texttt{server/uploads/}) trước khi được xử lý.
    \item \textbf{\texttt{uuid}}: Thư viện để tạo ra các định danh duy nhất toàn cục (Universally Unique Identifiers), được sử dụng để tạo \texttt{trackId} cho mỗi file audio được upload, đảm bảo không có sự trùng lặp khi đặt tên file và thư mục.
    \item \textbf{\texttt{querystring}}: Module tích hợp sẵn của Node.js, hữu ích cho việc parse và stringify các URL query strings, thường dùng khi tương tác với các API theo chuẩn OAuth 2.0 như Spotify.
    \item \textbf{\texttt{child\_process}}: Module tích hợp sẵn của Node.js, cung cấp khả năng tạo và quản lý các tiến trình con. Trong dự án này, \texttt{spawn()} từ module này được sử dụng để thực thi script Python của Demucs.
\end{itemize}

\section{Module Xác Thực Với Spotify}
\label{sec:spotify-auth}

Module này chịu trách nhiệm cho toàn bộ luồng tương tác với Spotify API liên quan đến xác thực và ủy quyền người dùng (\texttt{server/index.js}).

\subsection{Luồng OAuth 2.0 Authorization Code Flow}
\label{subsec:oauth-flow}

\begin{enumerate}
    \item \textbf{Yêu cầu Ủy quyền (\texttt{GET /auth/login})}:
        \begin{itemize}
            \item Client (frontend) điều hướng người dùng đến endpoint này.
            \item Backend tạo một \texttt{state} ngẫu nhiên (để chống CSRF) và redirect người dùng đến trang \texttt{/authorize} của Spotify.
            \item Các \texttt{scope} cần thiết (ví dụ: \texttt{streaming}, \texttt{user-read-playback-state}, \texttt{user-library-read}, etc.) được yêu cầu để ứng dụng có thể truy cập các tài nguyên và tính năng tương ứng của Spotify.
        \end{itemize}
    
    \item \textbf{Trao đổi Token (\texttt{POST /auth/token})}:
        \begin{itemize}
            \item Sau khi người dùng đồng ý ủy quyền trên Spotify, Spotify sẽ redirect người dùng trở lại \texttt{REDIRECT\_URI} đã đăng ký, kèm theo một \texttt{authorization\_code} và \texttt{state}.
        \end{itemize}
    *   Client gửi `authorization_code` này đến endpoint `/auth/token` của backend.
    *   Backend thực hiện một POST request đến `https://accounts.spotify.com/api/token` của Spotify, gửi kèm `code`, `redirect_uri`, `grant_type='authorization_code'`, và `Authorization` header (chứa `client_id` và `client_secret` đã được base64 encode).
    *   Nếu thành công, Spotify trả về `access_token`, `refresh_token`, và `expires_in`. Backend trả JSON này về cho client.
3.  **Làm mới Token (`POST /auth/refresh_token`)**:
    *   Khi `access_token` hết hạn, client gửi `refresh_token` đến endpoint này.
    *   Backend gửi một POST request đến `https://accounts.spotify.com/api/token` với `grant_type='refresh_token'` và `refresh_token`.
    *   Spotify trả về một `access_token` mới (có thể kèm hoặc không kèm `refresh_token` mới). Backend trả JSON này về cho client.

### 3.2. Kiểm Tra Thông Tin Người Dùng (`GET /auth/check-premium`)
*   Endpoint này yêu cầu client gửi `access_token` (nhận được từ Spotify) trong `Authorization: Bearer <token>` header.
*   Backend sử dụng token này để gọi API `https://api.spotify.com/v1/me` của Spotify.
*   Kết quả trả về chứa thông tin người dùng, bao gồm `product` (ví dụ: "premium", "free"), `id`, `display_name`, `email`, và `images`.
*   Backend trả về cho client một JSON chứa `isPremium: Boolean` và thông tin `user`.

## 4. Module Tích Hợp Demucs và Xử Lý Âm Thanh (`server/demucs-api.js`)

Đây là module cốt lõi cho tính năng tách nhạc AI, được mount tại prefix `/api`.

### 4.1. Quản Lý File Upload
*   **Endpoint `POST /api/upload`**:
    *   Sử dụng `multer` để nhận file audio (field tên `audio` trong `multipart/form-data`).
    *   Nếu không có file, trả lỗi 400.
    *   File gốc được lưu tạm bởi Multer, sau đó được đổi tên sử dụng một `trackId` (UUID) mới và phần mở rộng gốc, rồi lưu vào `server/uploads/{trackId}.{ext}`.
    *   Một thư mục output `server/output/{trackId}` cũng được tạo ra để chứa các stems sau này.
    *   Thông tin về track (ID, tên gốc, đường dẫn file, thư mục output) được lưu vào một biến cục bộ trên server là `uploadedTracks[trackId]`.
    *   Trả về `{ message, trackId, originalName }` cho client.

### 4.2. Khởi Chạy Tiến Trình Demucs
*   **Endpoint `POST /api/start-demucs`**:
    *   Yêu cầu `trackId` trong request body.
    *   Kiểm tra `trackId` có hợp lệ và track có tồn tại trong `uploadedTracks` không.
    *   Xác định lệnh Python để chạy (`python` hoặc `python3` tùy theo `process.platform`).
    *   Chuẩn bị các tham số cho Demucs:
        *   `-m demucs.separate`: Chạy Demucs như một module Python.
        *   `-n {model}`: Model sử dụng (ví dụ: `htdemucs`).
        *   `--mp3`: Chỉ định output là file MP3.
        *   `-o {outputDir}`: Đường dẫn đến thư mục `server/output/{trackId}`.
        *   `{filePath}`: Đường dẫn đến file audio gốc trong `server/uploads/{trackId}.{ext}`.
    *   Sử dụng `spawn()` từ `child_process` để chạy lệnh Demucs với các tham số trên. Tiến trình này chạy bất đồng bộ.
        *   `windowsHide: true`: Ẩn cửa sổ console trên Windows.
        *   `env: process.env`: Truyền các biến môi trường hiện tại.
    *   Khởi tạo `demucsProgress[trackId] = { log: "", percent: 0, done: false, error: null }`.
    *   Trả về response `{ message: "Bắt đầu tách nhạc", trackId }` ngay lập tức cho client.

### 4.3. Theo Dõi Tiến Trình Demucs
*   **Sự kiện từ Child Process**:
    *   `child.stdout.on('data', callback)`: Lắng nghe output chuẩn từ Demucs. Dữ liệu được nối vào `demucsProgress[trackId].log`. Cố gắng parse phần trăm hoàn thành từ output (ví dụ: tìm pattern `XX%` hoặc `Progress: XX`).
    *   `child.stderr.on('data', callback)`: Lắng nghe output lỗi từ Demucs. Dữ liệu cũng được nối vào log và parse phần trăm (vì đôi khi Demucs ghi tiến trình ra stderr).
    *   `child.on('error', callback)`: Bắt lỗi nếu không thể spawn được tiến trình (ví dụ: không tìm thấy lệnh `python`). Cập nhật `demucsProgress` với thông tin lỗi.
    *   `child.on('close', (code) => callback)`: Xử lý khi tiến trình Demucs kết thúc.
        *   `demucsProgress[trackId].done = true`.
        *   Nếu `code !== 0`, có lỗi xảy ra, cập nhật `demucsProgress[trackId].error`.
        *   Nếu `code === 0` (thành công):
            *   Demucs thường tạo output trong một thư mục con có tên là model (ví dụ: `server/output/{trackId}/htdemucs/`).
            *   Backend sẽ di chuyển các file stems (ví dụ: `vocals.mp3`, `drums.mp3`) từ thư mục con này lên thư mục `server/output/{trackId}/`.
            *   Sau đó, xóa thư mục con của model.
*   **Endpoint `GET /api/demucs-progress/:trackId`**:
    *   Client gọi API này để lấy trạng thái hiện tại của quá trình tách nhạc.
    *   Backend trả về đối tượng `demucsProgress[trackId]` (hoặc một đối tượng mặc định nếu chưa có thông tin).

### 4.4. Truy Xuất và Quản Lý Stems
*   **Endpoint `GET /api/stems`**:
    *   Đọc nội dung thư mục `server/output/`.
    *   Với mỗi thư mục con (tương ứng một `trackId`), đọc các file stems (`vocals.mp3`, `drums.mp3`, `bass.mp3`, `other.mp3`).
    *   Trả về một mảng các đối tượng, mỗi đối tượng chứa `trackId`, `originalName` (lấy từ `uploadedTracks` hoặc tên file gốc), và một object `stems` chứa URL, kích thước, ngày sửa đổi cho từng stem.
*   **Endpoint `GET /api/stems/:trackId`**:
    *   Tương tự như trên nhưng chỉ cho một `trackId` cụ thể.
*   **Phục vụ file stem tĩnh**: Các URL của stem (ví dụ: `/output/{trackId}/vocals.mp3`) được phục vụ thông qua `express.static(path.join(__dirname, 'server', 'output'))`.
*   **Endpoint `DELETE /api/delete-track/:trackId`**:
    *   Xóa file gốc trong `server/uploads/{trackId}.{ext}`.
    *   Xóa toàn bộ thư mục `server/output/{trackId}` và nội dung bên trong.
    *   Xóa entry khỏi `uploadedTracks[trackId]` và `demucsProgress[trackId]`.
    *   Trả về thông báo thành công hoặc lỗi.

## 5. Cấu Trúc File System Phía Backend
```
/prj-music-streaming
  └── /server/
      ├── .env                     # Biến môi trường (SPOTIFY_CLIENT_ID, etc.) - KHÔNG COMMIT
      ├── index.js                 # Entry point, Spotify Auth routes, static serving setup
      ├── demucs-api.js            # Router cho các API liên quan đến Demucs và file
      ├── /uploads/                # Thư mục lưu file audio gốc do người dùng tải lên
      │   └── {trackId}.mp3
      │   └── {trackId}.wav
      │   └── ...
      ├── /output/                 # Thư mục lưu các stems đã được tách bởi Demucs
      │   └── /{trackId}/          # Mỗi trackId có một thư mục riêng
      │       ├── vocals.mp3
      │       ├── drums.mp3
      │       ├── bass.mp3
      │       └── other.mp3
      ├── /mixer/                  # (Dự kiến) Thư mục lưu các file audio đã được mix lại
      │   └── {mixId}.mp3
      ├── node_modules/            # (Tạo bởi npm install)
      └── package.json             # (Có thể có package.json riêng cho server)
      └── (các file cấu hình khác nếu có)
```
**Lưu ý quan trọng**: Việc lưu trữ trạng thái (`uploadedTracks`, `demucsProgress`) trong biến cục bộ của server Node.js có nghĩa là dữ liệu này sẽ bị mất mỗi khi server khởi động lại. Đối với một ứng dụng production, cần một giải pháp lưu trữ bền vững hơn (ví dụ: database hoặc Redis). Tương tự, việc lưu file trên file system cục bộ của server sẽ gặp vấn đề nếu triển khai theo mô hình đa instance (horizontal scaling); khi đó cần giải pháp lưu trữ file chia sẻ (NFS) hoặc cloud storage (S3, Google Cloud Storage).

## 6. Các Khía Cạnh Vận Hành

### 6.1. Bảo Mật (Security Considerations)
*   **Xác thực Spotify OAuth 2.0**: Đảm bảo an toàn trong việc ủy quyền truy cập tài nguyên Spotify. Sử dụng `state` parameter để chống CSRF (cần đảm bảo `state` được validate khi Spotify redirect về).
*   **Quản lý Credentials**: `SPOTIFY_CLIENT_ID` và `SPOTIFY_CLIENT_SECRET` được lưu trong biến môi trường (`.env`) và không hardcode trong mã nguồn.
*   **Bảo mật API Backend**:
    *   Các API của Demucs (`/api/*`) hiện tại chưa có cơ chế bảo vệ riêng (ví dụ: JWT của ứng dụng). Bất kỳ ai biết endpoint đều có thể gọi. Đây là một điểm cần cải thiện cho môi trường production, bằng cách yêu cầu token xác thực của ứng dụng và liên kết `trackId` với `userId`.
*   **An toàn File Upload**:
    *   `multer` có thể được cấu hình để giới hạn kích thước file và loại file được chấp nhận (hiện chưa rõ trong code).
    *   Sử dụng UUID làm tên file/thư mục trên server thay vì tên file gốc từ người dùng giúp tránh các vấn đề liên quan đến ký tự đặc biệt hoặc path traversal.
*   **An toàn Child Process**: Các tham số truyền cho `spawn` (đặc biệt là đường dẫn file) phải được kiểm soát chặt chẽ. Trong trường hợp này, các đường dẫn được backend tạo ra dựa trên UUID, giảm thiểu rủi ro command injection.
*   **CORS**: Cấu hình `cors` để chỉ cho phép request từ các origin đã biết (frontend).
*   **Rate Limiting**: Chưa được triển khai. Cần thiết cho các API tốn tài nguyên (`/api/start-demucs`, `/api/upload`) để chống lạm dụng và DoS.

### 6.2. Khả Năng Mở Rộng (Scalability Considerations)
*   **Vertical Scaling**: Node.js có thể tận dụng tài nguyên (CPU, RAM) của một server đơn lẻ. Việc tách nhạc bằng Demucs là tác vụ nặng, nên nâng cấp server (CPU, RAM, và đặc biệt là GPU nếu Demucs được cấu hình để sử dụng) sẽ cải thiện hiệu năng.
*   **Horizontal Scaling Challenges**:
    *   **Stateful In-memory Storage**: Như đã đề cập, `uploadedTracks` và `demucsProgress` lưu trong bộ nhớ làm backend stateful. Cần giải pháp lưu trữ ngoài (Redis, database) để hỗ trợ đa instance.
    *   **File System Dependency**: Cần giải pháp lưu trữ file chia sẻ hoặc cloud storage.
*   **Bottlenecks chính**:
    *   **AI Processing (Demucs)**: Tiêu tốn nhiều thời gian và tài nguyên nhất.
    *   **Concurrent Demucs Processes**: Chạy quá nhiều tiến trình Demucs đồng thời sẽ làm cạn kiệt tài nguyên server.
*   **Giải pháp tiềm năng cho khả năng mở rộng**:
    *   **Job Queue System (ví dụ: RabbitMQ, BullMQ)**: Đưa các yêu cầu tách nhạc vào một hàng đợi. Các worker process (có thể là các Node.js instance riêng hoặc server chuyên dụng cho AI) sẽ lấy job từ queue để xử lý, giúp kiểm soát tải và độ ưu tiên.
    *   **Dedicated AI Processing Nodes/Services**: Tách phần xử lý AI ra thành các service riêng biệt có thể scale độc lập và tối ưu hóa (ví dụ: sử dụng server có GPU).

### 6.3. Giám Sát và Ghi Log (Monitoring and Logging)
*   **Hiện trạng**: Chủ yếu sử dụng `console.log()` và `console.error()` để ghi log các sự kiện và lỗi. Phù hợp cho development nhưng không đủ cho production.
*   **Cải thiện cho Production**:
    *   **Structured Logging (ví dụ: Winston, Pino)**: Tạo log có cấu trúc (JSON), với các level (info, warn, error), timestamp.
    *   **Log Aggregation (ví dụ: ELK Stack, Grafana Loki)**: Tập trung log từ nhiều nguồn để dễ dàng tìm kiếm, phân tích, và tạo cảnh báo.
    *   **API Endpoint Monitoring**: Theo dõi số lượng request, thời gian phản hồi, tỷ lệ lỗi của các API.
    *   **Resource Monitoring**: Theo dõi CPU, RAM, Disk I/O của server, đặc biệt khi Demucs đang chạy.
    *   **Error Tracking (ví dụ: Sentry, Bugsnag)**: Tích hợp dịch vụ theo dõi lỗi để nhận thông báo ngay khi có lỗi nghiêm trọng.

## 7. API Endpoints Chi Tiết Của Backend

### 7.1. Authentication Endpoints (Prefix: `/auth`)
*   `GET /login`: Chuyển hướng người dùng đến trang đăng nhập của Spotify.
    *   *Response*: Redirect đến Spotify.
*   `POST /token`: Trao đổi `authorization_code` lấy `access_token` và `refresh_token`.
    *   *Request Body*: `{ code: "spotify_auth_code" }`
    *   *Response*: Spotify token object (`{ access_token, refresh_token, ... }`)
*   `POST /refresh_token`: Làm mới `access_token`.
    *   *Request Body*: `{ refresh_token: "spotify_refresh_token" }`
    *   *Response*: Spotify token object (`{ access_token, ... }`)
*   `GET /check-premium`: Kiểm tra trạng thái tài khoản người dùng.
    *   *Headers*: `Authorization: Bearer <spotify_access_token>`
    *   *Response*: `{ isPremium: Boolean, user: { id, name, email, image, product } }`

### 7.2. Demucs & File Processing Endpoints (Prefix: `/api`)
*   `POST /upload`: Tải lên file âm thanh.
    *   *Request*: `multipart/form-data` (field `audio`).
    *   *Response*: `{ message: string, trackId: string, originalName: string }`
*   `POST /start-demucs`: Bắt đầu quá trình tách nhạc Demucs.
    *   *Request Body*: `{ trackId: string }`
    *   *Response*: `{ message: string, trackId: string }` (Asynchronous)
*   `GET /demucs-progress/:trackId`: Lấy tiến trình tách nhạc.
    *   *URL Params*: `trackId`
    *   *Response*: `{ percent: number, log: string, done: boolean, error: string | null }`
*   `GET /stems`: Lấy danh sách tất cả các track đã tách và thông tin stems.
    *   *Response*: `Array<Object>` (mỗi object chứa `trackId`, `originalName`, và `stems` object với URL, size, modified date cho từng stem).
*   `GET /stems/:trackId`: Lấy thông tin stems của một track cụ thể.
    *   *URL Params*: `trackId`
    *   *Response*: Tương tự một phần tử trong array của `/api/stems`.
*   (Implicit) `GET /output/:trackId/:stemName.mp3`: Tải file stem (phục vụ tĩnh).
*   `DELETE /delete-track/:trackId`: Xóa track và các stems liên quan.
    *   *URL Params*: `trackId`
    *   *Response*: `{ message: string }`

Chương này đã cung cấp một cái nhìn chi tiết về hệ thống backend, từ kiến trúc, công nghệ, các module chính, đến các vấn đề vận hành. Các phân tích này là nền tảng để hiểu rõ hơn về cách ứng dụng hoạt động và các hướng phát triển, cải thiện tiềm năng trong tương lai. 