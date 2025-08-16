// server/demucs-api.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import process from "process";
import { Buffer } from "buffer";

// ====================================================================
// PHẦN 1: CÁC HÀM TIỆN ÍCH XỬ LÝ TÊN FILE
// ====================================================================

/**
 * Cố gắng sửa lỗi mã hóa (mojibake) khi tên file UTF-8 bị đọc sai.
 * @param {string} str - Chuỗi đầu vào.
 * @returns {string} Chuỗi đã được sửa (nếu có thể).
 */
function maybeFixMojibake(str) {
  if (!str) return str;
  if (/[ÃÂáºá»Ð]/.test(str)) { // Heuristic để phát hiện lỗi
    try {
      const repaired = Buffer.from(str, 'latin1').toString('utf8');
      if (/[ăâêôơưđÁÀẢÃẠÂĂÊÔƠƯĐ]/i.test(repaired)) {
        return repaired;
      }
    } catch { /* Bỏ qua lỗi */ }
  }
  return str;
}

/**
 * Chuẩn hóa tên file tiếng Việt: loại bỏ ký tự cấm, giới hạn độ dài.
 * @param {string} str - Tên file gốc.
 * @returns {string} Tên file đã được chuẩn hóa.
 */
function normalizeVietnamese(str) {
  if (!str) return 'untitled_song';
  let name = maybeFixMojibake(String(str)).trim();
  const ext = path.extname(name);
  let base = ext ? name.slice(0, -ext.length) : name;
  base = base.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) base = 'untitled_song';
  if (base.length > 80) base = base.slice(0, 80).trim();
  return base.replace(/ /g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '') || 'untitled_song';
}

/**
 * Tạo ra một tên thư mục duy nhất dựa trên tên bài hát, tránh trùng lặp.
 * @param {string} baseName - Tên bài hát gốc.
 * @param {string} outputBaseDir - Thư mục output chính.
 * @returns {string} Tên thư mục cuối cùng, duy nhất.
 */
function createUniqueDirectoryName(baseName, outputBaseDir) {
  let normalizedName = normalizeVietnamese(baseName).replace(/\.[^/.]+$/, "");
  if (!normalizedName) normalizedName = 'untitled_song';

  let finalName = normalizedName;
  let counter = 1;
  while (fs.existsSync(path.join(outputBaseDir, finalName))) {
    finalName = `${normalizedName}_(${counter})`;
    counter++;
    if (counter > 1000) { // Tránh vòng lặp vô hạn
      finalName = `${normalizedName}_${Date.now()}`;
      break;
    }
  }
  return finalName;
}

// ====================================================================
// PHẦN 2: ĐỊNH NGHĨA CÁC API ENDPOINTS
// ====================================================================

const router = express.Router();
const __dirname = path.resolve();
const upload = multer({ dest: path.join(__dirname, "server", "uploads") });

// Lưu trạng thái trong bộ nhớ (sẽ mất khi server khởi động lại)
const demucsProgress = {};
// Exported so other routers (e.g., Whisper) can share upload state
export const uploadedTracks = {};

/**
 * API: Upload file nhạc.
 * Chỉ lưu file và thông tin, không xử lý gì thêm.
 */
router.post("/upload", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const trackId = uuidv4();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const newPath = path.join(req.file.destination, `${trackId}${ext}`);
  fs.renameSync(req.file.path, newPath);

  const fixedOriginalName = maybeFixMojibake(req.file.originalname);

  uploadedTracks[trackId] = {
    id: trackId,
    originalName: fixedOriginalName,
    filePath: newPath,
  };

  res.json({
    message: "Upload thành công",
    trackId: trackId,
    originalName: fixedOriginalName,
  });
});

/**
 * API: Bắt đầu quá trình tách nhạc.
 */
router.post("/start-demucs", async (req, res) => {
  const { trackId, model: reqModel, ...options } = req.body;

  if (!trackId || !uploadedTracks[trackId]) {
    return res.status(400).json({ error: "Track không hợp lệ" });
  }

  const trackInfo = uploadedTracks[trackId];
  const model = reqModel || "htdemucs";
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  // --- CHIẾN LƯỢC XỬ LÝ UNICODE ---
  // Bước 1: Tạo thư mục output tạm thời với tên đơn giản (trackId) để demucs làm việc.
  const tempOutputDir = path.join(__dirname, "server", "output", trackId);
  fs.mkdirSync(tempOutputDir, { recursive: true });

  const demucsArgs = ["-m", "demucs.separate", "-n", model, "--mp3"];
  if (options.twoStems) demucsArgs.push(`--two-stems=${options.twoStems}`);
  if (options.mp3Bitrate) demucsArgs.push("--mp3-bitrate", String(options.mp3Bitrate));
  if (options.mp3Preset) demucsArgs.push("--mp3-preset", String(options.mp3Preset));
  demucsArgs.push("-o", tempOutputDir, trackInfo.filePath);

  const runDemucs = (cmd, callback) => {
    console.log(`[demucs] Running: ${cmd} ${demucsArgs.join(" ")}`);

    const child = spawn(cmd, demucsArgs, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    demucsProgress[trackId] = { log: "", percent: 0, done: false, error: null };

    child.stderr.on("data", (data) => {
      const str = data.toString();
      demucsProgress[trackId].log += str;
      console.error("[demucs stderr]", str.trim());
      // Cố gắng đọc tiến trình từ stderr
      const percentMatch = str.match(/(\d{1,3})%/i);
      if (percentMatch) {
        demucsProgress[trackId].percent = parseInt(percentMatch[1]);
      }
    });

    child.on("close", (code) => {
      demucsProgress[trackId].done = true;
      if (code !== 0) {
        demucsProgress[trackId].error = `Tách nhạc thất bại (exit code: ${code})`;
        fs.rm(tempOutputDir, { recursive: true, force: true }, () => { }); // Dọn dẹp
        callback(new Error(`Demucs failed with exit code ${code}`));
      } else {
        demucsProgress[trackId].percent = 100;
        callback(null);
      }
    });
  };

  // SỬA LỖI: Hàm mới để đổi tên với cơ chế chờ và thử lại
  const renameWithRetry = async (source, destination, retries = 5, delay = 200) => {
    for (let i = 0; i < retries; i++) {
      try {
        fs.renameSync(source, destination);
        console.log(`[rename] Success on attempt ${i + 1}`);
        return; // Thành công, thoát khỏi hàm
      } catch (err) {
        if (err.code === 'EPERM' && i < retries - 1) {
          console.warn(`[rename] Attempt ${i + 1} failed with EPERM. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Nếu không phải lỗi EPERM hoặc đã hết lần thử, ném lỗi ra ngoài
          throw err;
        }
      }
    }
  };

  // Bắt đầu tiến trình trong nền
  runDemucs(pythonCmd, async (error) => { // Chuyển callback sang async
    if (error) {
      console.error("Demucs process failed:", error.message);
      return;
    }

    try {
      // Bước 3: Gom các file stem về một thư mục duy nhất mang tên bài hát (không cần thư mục mô hình)
      const outputBaseDir = path.join(__dirname, "server", "output");
      const finalFolderName = createUniqueDirectoryName(trackInfo.originalName, outputBaseDir);
      const finalOutputDir = path.join(outputBaseDir, finalFolderName);
      fs.mkdirSync(finalOutputDir, { recursive: true });

      const modelDir = path.join(tempOutputDir, model);
      if (fs.existsSync(modelDir)) {
        // Demucs thường tạo thêm 1 thư mục con theo tên file đầu vào bên trong thư mục model
        const modelEntries = fs.readdirSync(modelDir, { withFileTypes: true });
        const firstDir = modelEntries.find((e) => e.isDirectory());
        const innerDir = firstDir ? path.join(modelDir, firstDir.name) : modelDir;

        const files = fs.existsSync(innerDir) ? fs.readdirSync(innerDir) : [];
        console.log('[demucs] Found output files:', files);

        for (const f of files) {
          const src = path.join(innerDir, f);
          const dest = path.join(finalOutputDir, f); // Không đổi tên, chỉ di chuyển
          try {
            await renameWithRetry(src, dest);
          } catch {
            try {
              fs.copyFileSync(src, dest);
              try { fs.unlinkSync(src); } catch (unlinkErr) { console.warn('[demucs] unlink fallback failed:', unlinkErr?.message); }
            } catch (copyErr) {
              console.error('[demucs] Failed to move/copy file:', copyErr);
            }
          }
        }
      } else {
        console.error(`[demucs] Error: Model directory not found: ${modelDir}`);
      }

      // Lưu tên thư mục cuối vào uploadedTracks để các API khác nhận diện đúng
      uploadedTracks[trackId].songFolderName = finalFolderName;

      // Dọn dẹp thư mục tạm
      try { fs.rmSync(tempOutputDir, { recursive: true, force: true }); } catch (rmErr) { console.warn('[demucs] cleanup temp dir failed:', rmErr?.message); }

      console.log(`[demucs] Success! Finalized output folder: ${finalFolderName}`);
    } catch (finalErr) {
      console.error(`[demucs] Finalization error:`, finalErr);
      demucsProgress[trackId].error = "Tách nhạc thành công nhưng không thể hoàn tất di chuyển file.";
    }
  });

  // Trả về response ngay lập tức
  res.json({ message: "Bắt đầu tách nhạc", trackId });
});

// API lấy tiến trình tách nhạc
router.get("/demucs-progress/:trackId", (req, res) => {
  const { trackId } = req.params;
  const progress = demucsProgress[trackId];
  if (!progress) return res.json({ percent: 0, log: "", done: false });
  res.json(progress);
});

// API lấy danh sách stems đã tách
router.get("/stems", (req, res) => {
  const outputBaseDir = path.join(__dirname, "server", "output");
  const songs = [];

  if (!fs.existsSync(outputBaseDir)) {
    return res.json([]);
  }

  const songDirs = fs.readdirSync(outputBaseDir);
  songDirs.forEach((songFolderName) => {
    const songDir = path.join(outputBaseDir, songFolderName);
    if (fs.statSync(songDir).isDirectory()) {
      const stems = {};
      // List all audio files exactly as named (no canonical remapping)
      const files = fs.readdirSync(songDir);
      for (const f of files) {
        if (!/\.(mp3|wav|flac|m4a)$/i.test(f)) continue;
        const base = f.replace(/\.[^.]+$/, '');
        const filePath = path.join(songDir, f);
        const stats = fs.statSync(filePath);
        // Ensure unique keys if duplicates somehow occur
        let key = base;
        let suffix = 1;
        while (stems[key]) {
          key = `${base}_${suffix++}`;
        }
        stems[key] = {
          url: `/output/${songFolderName}/${encodeURIComponent(f)}`,
          size: stats.size,
          modified: stats.mtime,
        };
      }

      if (Object.keys(stems).length > 0) {
        // Tìm trackId tương ứng từ uploadedTracks
        let trackId = null;
        let originalName = songFolderName;
        
        // Tìm trackId từ uploadedTracks dựa trên songFolderName
        for (const [id, trackInfo] of Object.entries(uploadedTracks)) {
          if (trackInfo.songFolderName === songFolderName) {
            trackId = id;
            originalName = trackInfo.originalName;
            break;
          }
        }
        
        // Nếu không tìm thấy trong uploadedTracks, sử dụng songFolderName làm trackId
        if (!trackId) {
          trackId = songFolderName;
          // Cố gắng chuyển đổi tên folder về tên gốc
          originalName = songFolderName.replace(/_/g, ' ').replace(/\(\d+\)$/, '').trim();
        }

        songs.push({
          trackId: trackId,
          song: originalName,
          displayName: originalName,
          songFolderName: songFolderName,
          folderName: songFolderName,
          stems,
          stemCount: Object.keys(stems).length,
          createdAt: Math.min(
            ...Object.values(stems).map((s) => new Date(s.modified).getTime())
          ),
          totalSize: Object.values(stems).reduce(
            (total, s) => total + s.size,
            0
          ),
        });
      }
    }
  });

  // Sắp xếp theo thời gian tạo (mới nhất trước)
  songs.sort((a, b) => b.createdAt - a.createdAt);

  res.json(songs);
});

// API lấy danh sách bài hát đã ghép
router.get("/mixed-songs", (req, res) => {
  const mixerDir = path.join(__dirname, "server", "mixer");
  const mixedSongs = [];

  if (!fs.existsSync(mixerDir)) {
    return res.json([]);
  }

  try {
    const files = fs.readdirSync(mixerDir);
    
    files.forEach((filename) => {
      const filePath = path.join(mixerDir, filename);
      const stats = fs.statSync(filePath);
      
      // Chỉ lấy file audio
      if (stats.isFile() && /\.(mp3|wav|m4a|flac)$/i.test(filename)) {
        // Tách tên bài hát từ filename (loại bỏ UUID và extension)
        let songName = filename;
        
        // Loại bỏ UUID pattern (_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) nếu có
        songName = songName.replace(/_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i, '');
        
        // Loại bỏ extension
        songName = songName.replace(/\.[^.]+$/, '');
        
        mixedSongs.push({
          name: songName || filename, // Fallback to full filename if parsing fails
          path: `/mixer/${filename}`,
          size: stats.size,
          createdAt: stats.birthtime || stats.mtime, // Use birthtime if available, fallback to mtime
          filename: filename
        });
      }
    });

    // Sắp xếp theo thời gian tạo (mới nhất trước)
    mixedSongs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(mixedSongs);
  } catch (error) {
    console.error("[mixed-songs] Error reading mixer directory:", error);
    res.status(500).json({ 
      error: "Không thể đọc danh sách bài hát đã ghép",
      detail: error.message 
    });
  }
});

// API ghép stems thành bài hát mới
router.post("/mix", async (req, res) => {
  const { stemPaths, songName } = req.body;

  if (!stemPaths || !Array.isArray(stemPaths) || stemPaths.length < 2) {
    return res.status(400).json({ 
      error: "Cần ít nhất 2 stem paths để ghép nhạc" 
    });
  }

  if (!songName || songName.trim() === "") {
    return res.status(400).json({ 
      error: "Vui lòng nhập tên bài hát" 
    });
  }

  try {
    // Tạo thư mục mixer nếu chưa có
    const mixerDir = path.join(__dirname, "server", "mixer");
    if (!fs.existsSync(mixerDir)) {
      fs.mkdirSync(mixerDir, { recursive: true });
    }

    const mixId = crypto.randomUUID();
    const cleanSongName = songName.trim().replace(/[<>:"/\\|?*]/g, "_"); // Remove invalid filename characters
    const outputPath = path.join(mixerDir, `${cleanSongName}_${mixId}.mp3`);

    // Chuyển đổi stem paths thành file paths thực tế
    const inputFiles = stemPaths.map(stemPath => {
      // stemPath có dạng "/output/trackId/stemType.mp3"
      return path.join(__dirname, "server", stemPath.replace(/^\//, ""));
    });

    // Kiểm tra tất cả file có tồn tại không
    for (const filePath of inputFiles) {
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ 
          error: `File không tồn tại: ${path.basename(filePath)}` 
        });
      }
    }

    // Sử dụng ffmpeg để ghép các stems
    const ffmpegCmd = process.platform === "win32" ? "ffmpeg" : "ffmpeg";
    
    // Build ffmpeg command
    const ffmpegArgs = [];
    
    // Add input files
    inputFiles.forEach(file => {
      ffmpegArgs.push("-i", file);
    });
    
    // Add filter to mix all inputs
    const filterComplex = `amix=inputs=${inputFiles.length}:duration=longest`;
    ffmpegArgs.push("-filter_complex", filterComplex);
    ffmpegArgs.push("-y"); // Overwrite output file
    ffmpegArgs.push(outputPath);

    console.log(`[mix] Running ffmpeg: ${ffmpegCmd} ${ffmpegArgs.join(" ")}`);

    const child = spawn(ffmpegCmd, ffmpegArgs, {
      windowsHide: true,
      env: process.env,
    });

    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        // Thành công
        const relativePath = `/mixer/${path.basename(outputPath)}`;
        res.json({ 
          success: true,
          mixPath: relativePath,
          songName: cleanSongName,
          message: "Ghép nhạc thành công!"
        });
      } else {
        console.error("[mix] FFmpeg error:", stderr);
        res.status(500).json({ 
          error: "Ghép nhạc thất bại", 
          detail: stderr.slice(-500) 
        });
      }
    });

    child.on("error", (err) => {
      console.error("[mix] FFmpeg spawn error:", err);
      if (err.code === "ENOENT") {
        res.status(500).json({ 
          error: "FFmpeg không được tìm thấy. Vui lòng cài đặt FFmpeg." 
        });
      } else {
        res.status(500).json({ 
          error: "Lỗi khi chạy FFmpeg", 
          detail: err.message 
        });
      }
    });

  } catch (error) {
    console.error("[mix] Error:", error);
    res.status(500).json({ 
      error: "Lỗi server khi ghép nhạc", 
      detail: error.message 
    });
  }
});

// API xóa stems theo trackId
router.delete("/stems/:trackId", (req, res) => {
  const { trackId } = req.params;

  try {
    // Tìm songFolderName từ trackId
    let songFolderName = null;
    let actualTrackId = trackId;
    
    // Tìm trong uploadedTracks
    for (const [id, trackInfo] of Object.entries(uploadedTracks)) {
      if (id === trackId) {
        songFolderName = trackInfo.songFolderName;
        break;
      }
    }
    
    // Nếu không tìm thấy, có thể trackId chính là songFolderName
    if (!songFolderName) {
      songFolderName = trackId;
      // Tìm trackId thực từ songFolderName
      for (const [id, trackInfo] of Object.entries(uploadedTracks)) {
        if (trackInfo.songFolderName === trackId) {
          actualTrackId = id;
          break;
        }
      }
    }

    const outputDir = path.join(__dirname, "server", "output", songFolderName);
    const uploadsDir = path.join(__dirname, "server", "uploads");

    // Xóa thư mục output
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    // Xóa file upload gốc
    const possibleExtensions = [".mp3", ".wav", ".m4a", ".flac"];
    for (const ext of possibleExtensions) {
      const originalFile = path.join(uploadsDir, `${actualTrackId}${ext}`);
      if (fs.existsSync(originalFile)) {
        fs.unlinkSync(originalFile);
        break;
      }
    }

    // Xóa khỏi memory
    delete uploadedTracks[actualTrackId];
    delete demucsProgress[actualTrackId];

    console.log(`[delete] Removed track: ${songFolderName} (${actualTrackId})`);
    res.json({ message: "Xóa thành công", trackId: actualTrackId, songFolderName });
  } catch (error) {
    console.error("Error deleting track:", error);
    res.status(500).json({ error: "Không thể xóa track" });
  }
});

// API lấy thông tin chi tiết một track
router.get("/stems/:trackId", (req, res) => {
  const { trackId } = req.params;
  const outputDir = path.join(__dirname, "server", "output", trackId);

  if (!fs.existsSync(outputDir)) {
    return res.status(404).json({ error: "Track not found" });
  }

  const stems = {};
  ["vocals", "drums", "bass", "other"].forEach((stem) => {
    const stemFile = path.join(outputDir, `${stem}.mp3`);
    if (fs.existsSync(stemFile)) {
      const stats = fs.statSync(stemFile);
      stems[stem] = {
        url: `/output/${trackId}/${stem}.mp3`,
        size: stats.size,
        modified: stats.mtime,
        sizeFormatted: formatFileSize(stats.size),
      };
    }
  });

  const originalName = uploadedTracks[trackId]?.originalName || trackId;

  res.json({
    trackId,
    originalName,
    stems,
    stemCount: Object.keys(stems).length,
    totalSize: Object.values(stems).reduce((total, s) => total + s.size, 0),
  });
});

// Helper function để format file size
// API xóa bài hát đã ghép
router.delete("/mixed-songs/:filename", (req, res) => {
  const { filename } = req.params;
  
  try {
    const mixerDir = path.join(__dirname, "server", "mixer");
    const filePath = path.join(mixerDir, filename);
    
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: "File không tồn tại" 
      });
    }
    
    // Kiểm tra file có phải trong thư mục mixer không (security check)
    const resolvedPath = path.resolve(filePath);
    const resolvedMixerDir = path.resolve(mixerDir);
    if (!resolvedPath.startsWith(resolvedMixerDir)) {
      return res.status(403).json({ 
        error: "Không được phép xóa file này" 
      });
    }
    
    // Xóa file
    fs.unlinkSync(filePath);
    
    res.json({ 
      success: true,
      message: "Xóa bài hát thành công" 
    });
    
  } catch (error) {
    console.error("[delete-mixed-song] Error:", error);
    res.status(500).json({ 
      error: "Lỗi khi xóa bài hát",
      detail: error.message 
    });
  }
});

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default router;
// Export utility for reuse (e.g., Whisper router)
export { createUniqueDirectoryName };
