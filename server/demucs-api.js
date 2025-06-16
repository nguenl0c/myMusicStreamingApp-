import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import process from "process";
import crypto from "crypto";

// Function để chuẩn hóa tên file tiếng Việt thành không dấu
function normalizeVietnamese(str) {
  // Sử dụng Unicode normalization để tách dấu khỏi ký tự
  let normalized = str.normalize('NFD');
  
  // Loại bỏ các dấu (combining characters)
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  
  // Xử lý các ký tự đặc biệt của tiếng Việt
  const vietnameseMap = {
    'đ': 'd', 'Đ': 'D',
    'ð': 'd', 'Ð': 'D' // Fallback cho một số encoding
  };
  
  // Thay thế các ký tự đặc biệt
  normalized = normalized.replace(/[đĐðÐ]/g, char => vietnameseMap[char] || char);
  
  // Loại bỏ các ký tự không phải chữ cái, số, khoảng trắng, dấu gạch ngang, underscore, dấu chấm
  normalized = normalized.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');
  
  // Thay khoảng trắng bằng underscore
  normalized = normalized.replace(/\s+/g, '_');
  
  // Loại bỏ underscore liên tiếp
  normalized = normalized.replace(/_{2,}/g, '_');
  
  // Loại bỏ underscore đầu và cuối
  normalized = normalized.replace(/^_|_$/g, '');
  
  return normalized;
}

// Function để tạo tên folder duy nhất
function createUniqueDirectoryName(baseName, outputBaseDir) {
  let normalizedName = normalizeVietnamese(baseName);
  
  // Loại bỏ extension nếu có
  normalizedName = normalizedName.replace(/\.[^/.]+$/, "");
  
  // Đảm bảo tên không rỗng
  if (!normalizedName || normalizedName.trim() === '') {
    normalizedName = 'untitled_song';
  }
  
  // Loại bỏ khoảng trắng đầu cuối
  normalizedName = normalizedName.trim();
  
  // Giới hạn độ dài tên (để tránh lỗi filesystem)
  if (normalizedName.length > 50) {
    normalizedName = normalizedName.substring(0, 50).replace(/_+$/, ''); // Loại bỏ underscore cuối
  }
  
  // Đảm bảo tên không bắt đầu hoặc kết thúc bằng dấu chấm (Windows không cho phép)
  normalizedName = normalizedName.replace(/^\.+|\.+$/g, '');
  
  // Nếu sau khi xử lý mà tên rỗng, dùng tên mặc định
  if (!normalizedName) {
    normalizedName = 'untitled_song';
  }
  
  let finalName = normalizedName;
  let counter = 1;
  
  // Kiểm tra trùng lặp và thêm số thứ tự
  while (fs.existsSync(path.join(outputBaseDir, finalName))) {
    finalName = `${normalizedName}_(${counter})`;
    counter++;
    
    // Tránh vòng lặp vô hạn
    if (counter > 1000) {
      finalName = `${normalizedName}_${Date.now()}`;
      break;
    }
  }
  
  return finalName;
}

const router = express.Router();
const __dirname = path.resolve();
const upload = multer({ dest: path.join(__dirname, "server", "uploads") });
const demucsProgress = {};
const uploadedTracks = {}; // Lưu thông tin các track đã upload

// API upload file và lấy metadata (không tách nhạc)
router.post("/upload", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath = req.file.path;
  const trackId = uuidv4();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const uploadsDir = path.join(__dirname, "server", "uploads");
  const outputBaseDir = path.join(__dirname, "server", "output");
  
  // Tạo tên folder dựa trên tên bài hát
  const songFolderName = createUniqueDirectoryName(req.file.originalname, outputBaseDir);
  const newInputPath = path.join(uploadsDir, `${trackId}${ext}`);

  // Rename file với trackId (giữ nguyên để tránh conflict)
  fs.renameSync(inputPath, newInputPath);

  // Tạo thư mục output với tên bài hát
  const outputDir = path.join(outputBaseDir, songFolderName);
  fs.mkdirSync(outputDir, { recursive: true });

  // Lưu thông tin track
  uploadedTracks[trackId] = {
    id: trackId,
    originalName: req.file.originalname,
    songFolderName: songFolderName, // Thêm tên folder
    filePath: newInputPath,
    outputDir: outputDir,
    uploadedAt: new Date().toISOString(),
  };

  console.log(`[upload] File uploaded: "${req.file.originalname}" -> "${songFolderName}" (${trackId})`);

  res.json({
    message: "Upload thành công",
    trackId: trackId,
    originalName: req.file.originalname,
    songFolderName: songFolderName,
    // Có thể thêm metadata khác như duration nếu cần
  });
});

// API bắt đầu tách nhạc
router.post("/start-demucs", async (req, res) => {
  const { trackId } = req.body;

  if (!trackId || !uploadedTracks[trackId]) {
    return res
      .status(400)
      .json({ error: "Invalid trackId or track not found" });
  }

  const trackInfo = uploadedTracks[trackId];
  const model = "htdemucs";

  // Sử dụng python thay vì python3 trên Windows
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const fallbackPythonCmd = process.platform === "win32" ? "python3" : "python";

  const demucsArgs = [
    "-m",
    "demucs.separate",
    "-n",
    model,
    "--mp3",
    "-o",
    trackInfo.outputDir,
    trackInfo.filePath,
  ];

  function runDemucsWithProgress(cmd, cb) {
    console.log(`[demucs] Trying to run: ${cmd} ${demucsArgs.join(" ")}`);
    const child = spawn(cmd, demucsArgs, {
      windowsHide: true,
      env: process.env,
    });
    demucsProgress[trackId] = { log: "", percent: 0, done: false, error: null };    child.stdout.on("data", (data) => {
      const str = data.toString();
      demucsProgress[trackId].log += str;
      console.log("[demucs stdout]", str);
      
      // Cải thiện cách đọc phần trăm từ output
      const percentMatch = str.match(/(\d{1,3})%|Progress: (\d{1,3})/i);
      if (percentMatch) {
        // Lấy giá trị phần trăm từ bất kỳ nhóm nào có giá trị
        const percent = parseInt(percentMatch[1] || percentMatch[2]);
        if (!isNaN(percent) && percent >= 0 && percent <= 100) {
          demucsProgress[trackId].percent = percent;
          console.log(`[demucs] Updated progress: ${percent}%`);
        }
      } else if (str.includes("Done")) {
        // Nếu thấy từ "Done", đặt tiến trình là 100%
        demucsProgress[trackId].percent = 100;
        console.log('[demucs] Process completed, setting progress to 100%');
      }
    });    child.stderr.on("data", (data) => {
      const str = data.toString();
      demucsProgress[trackId].log += str;
      console.error("[demucs stderr]", str);
      
      // Nhiều khi thông tin tiến trình xuất hiện trong stderr thay vì stdout
      const percentMatch = str.match(/(\d{1,3})%|Progress: (\d{1,3})/i);
      if (percentMatch) {
        // Lấy giá trị phần trăm từ bất kỳ nhóm nào có giá trị
        const percent = parseInt(percentMatch[1] || percentMatch[2]);
        if (!isNaN(percent) && percent >= 0 && percent <= 100) {
          demucsProgress[trackId].percent = percent;
          console.log(`[demucs stderr] Updated progress: ${percent}%`);
        }
      }
      // Nếu tìm thấy chuỗi thông báo hoàn thành, đặt tiến độ 100%
      else if (str.includes("Separated") || str.includes("Done") || str.includes("complete")) {
        demucsProgress[trackId].percent = 100;
      }
    });

    // Xử lý error event để tránh crash server
    child.on("error", (error) => {
      console.error(`[demucs error] Command: ${cmd}, Error:`, error.message);
      demucsProgress[trackId].done = true;
      demucsProgress[trackId].error = `Lỗi chạy lệnh: ${error.message}`;
      cb(error);
    });

    child.on("close", (code) => {
      console.log(`[demucs] Process closed with code: ${code}`);
      demucsProgress[trackId].done = true;
      if (code !== 0) {
        demucsProgress[
          trackId
        ].error = `Tách nhạc thất bại (exit code: ${code})`;
        cb(new Error(`Demucs failed with exit code ${code}`));
      } else {
        cb(null);
      }
    });
  }

  function tryDemucs(cb) {
    runDemucsWithProgress(pythonCmd, (err) => {
      if (err) {
        console.error(
          `[demucs] Primary command failed: ${pythonCmd}`,
          err.message
        );
        // Thử fallback command nếu lỗi liên quan đến không tìm thấy python
        if (
          err.code === "ENOENT" ||
          err.message.toLowerCase().includes("not found")
        ) {
          console.log(`[demucs] Trying fallback command: ${fallbackPythonCmd}`);
          runDemucsWithProgress(fallbackPythonCmd, cb);
        } else {
          cb(err);
        }
      } else {
        cb(null);
      }
    });
  }

  // Bắt đầu tiến trình tách nhạc ở background
  tryDemucs((error) => {
    if (error) {
      console.error("Demucs failed:", error);
      return;
    }

    // Xử lý kết quả sau khi tách xong
    const stemsPath = path.join(trackInfo.outputDir, model, trackId);
    if (fs.existsSync(stemsPath)) {
      const stems = {};
      ["vocals", "drums", "bass", "other"].forEach((stem) => {
        const src = path.join(stemsPath, `${stem}.mp3`);
        const dest = path.join(trackInfo.outputDir, `${stem}.mp3`);
        if (fs.existsSync(src)) {
          fs.renameSync(src, dest);
          stems[stem] = `/output/${trackInfo.songFolderName}/${stem}.mp3`;
        }
      });
      // Xóa thư mục model sau khi move file
      fs.rmSync(path.join(trackInfo.outputDir, model), {
        recursive: true,
        force: true,
      });
      console.log(`Tách nhạc thành công cho: ${trackInfo.songFolderName} (${trackId})`);
    }
  });

  // Trả về response ngay lập tức
  res.json({
    message: "Bắt đầu tách nhạc",
    trackId,
  });
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
      ["vocals", "drums", "bass", "other"].forEach((stem) => {
        const stemFile = path.join(songDir, `${stem}.mp3`);
        if (fs.existsSync(stemFile)) {
          const stats = fs.statSync(stemFile);
          stems[stem] = {
            url: `/output/${songFolderName}/${stem}.mp3`,
            size: stats.size,
            modified: stats.mtime,
          };
        }
      });

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
          song: originalName,
          trackId: trackId,
          songFolderName: songFolderName, // Thêm tên folder để dễ quản lý
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
