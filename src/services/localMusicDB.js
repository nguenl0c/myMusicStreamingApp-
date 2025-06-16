// Sử dụng IndexedDB để lưu trữ file âm thanh và metadata
const DB_NAME = "local-music-db";
const DB_VERSION = 1;
const TRACKS_STORE = "tracks";
const METADATA_STORE = "metadata";

// Hàm khởi tạo database
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Không thể mở database");

    request.onsuccess = (event) => resolve(event.target.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store cho file âm thanh
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE);
      }

      // Store cho metadata (artits, album, title...)
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metadataStore = db.createObjectStore(METADATA_STORE, {
          keyPath: "id",
        });
        metadataStore.createIndex("title", "title");
        metadataStore.createIndex("artist", "artist");
        metadataStore.createIndex("addedAt", "addedAt");
      }
    };
  });
};

// Lưu bài hát và metadata
export const saveTrack = async (file) => {
  try {
    const db = await initDB();
    const id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Lưu file audio
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACKS_STORE], "readwrite");
      const store = transaction.objectStore(TRACKS_STORE);

      const request = store.put(file, id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject("Lỗi khi lưu file");
    });

    // Trích xuất metadata từ audio file
    const metadata = await extractMetadata(file);

    // Lưu metadata
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readwrite");
      const store = transaction.objectStore(METADATA_STORE);

      const trackMetadata = {
        id,
        title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.artist || "Unknown Artist",
        album: metadata.album || "Unknown Album",
        duration: metadata.duration || 0,
        type: file.type,
        size: file.size,
        addedAt: new Date().toISOString(),
      };

      const request = store.put(trackMetadata);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject("Lỗi khi lưu metadata");
    });

    return id;
  } catch (error) {
    console.error("Error saving track:", error);
    throw error;
  }
};

// Trích xuất metadata từ file âm thanh
const extractMetadata = (file) => {
  return new Promise((resolve) => {
    const metadata = {
      title: "",
      artist: "",
      album: "",
      duration: 0,
    };

    // Đọc độ dài bài hát bằng Audio API
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.src = url;

    audio.addEventListener("loadedmetadata", () => {
      metadata.duration = audio.duration;
      URL.revokeObjectURL(url);
      resolve(metadata);
    });

    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(metadata);
    });
  });
};

// Lấy danh sách các bài hát đã lưu
export const getAllTracks = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject("Lỗi khi lấy danh sách bài hát");
    });
  } catch (error) {
    console.error("Error getting tracks:", error);
    throw error;
  }
};

// Lấy một bài hát theo ID
export const getTrackById = async (id) => {
  try {
    const db = await initDB();

    // Lấy metadata
    const metadata = await new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);

      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject("Không tìm thấy metadata");
    });

    if (!metadata) {
      throw new Error("Track not found");
    }

    // Lấy file audio
    const audioFile = await new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACKS_STORE], "readonly");
      const store = transaction.objectStore(TRACKS_STORE);

      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject("Không tìm thấy file audio");
    });

    if (!audioFile) {
      throw new Error("Audio file not found");
    }

    // Tạo URL từ Blob
    const url = URL.createObjectURL(audioFile);

    return {
      ...metadata,
      url,
    };
  } catch (error) {
    console.error("Error getting track:", error);
    throw error;
  }
};

// Xóa một bài hát
export const deleteTrack = async (id) => {
  try {
    const db = await initDB();

    // Xóa file audio
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([TRACKS_STORE], "readwrite");
      const store = transaction.objectStore(TRACKS_STORE);

      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject("Lỗi khi xóa file audio");
    });

    // Xóa metadata
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readwrite");
      const store = transaction.objectStore(METADATA_STORE);

      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject("Lỗi khi xóa metadata");
    });

    return true;
  } catch (error) {
    console.error("Error deleting track:", error);
    throw error;
  }
};
