# Hỗ trợ tiếng Việt trong Music Mixer Studio

## Tổng quan
Dự án đã được cải tiến để hỗ trợ đầy đủ tiếng Việt, bao gồm:
- Chuẩn hóa tên file tiếng Việt thành không dấu
- Font hiển thị tiếng Việt chính xác
- Tên folder có ý nghĩa thay vì UUID ngẫu nhiên

## Các cải tiến đã thực hiện

### 1. 🔤 Chuẩn hóa tên file tiếng Việt

**Function `normalizeVietnamese()`:**
- Sử dụng Unicode normalization (NFD) để tách dấu khỏi ký tự
- Loại bỏ các dấu combining characters
- Xử lý ký tự đặc biệt: đ → d, Đ → D
- Loại bỏ ký tự đặc biệt không hợp lệ cho tên folder
- Thay khoảng trắng bằng underscore

**Ví dụ chuyển đổi:**
```
"Bài hát tiếng Việt.mp3" → "Bai_hat_tieng_Viet"
"Nơi này có anh - Sơn Tùng MTP.mp3" → "Noi_nay_co_anh_-_Son_Tung_MTP"
"Đêm nay anh không về.mp3" → "Dem_nay_anh_khong_ve"
"Lạc trôi - Sơn Tùng MTP.mp3" → "Lac_troi_-_Son_Tung_MTP"
```

### 2. 📁 Tên folder có ý nghĩa

**Function `createUniqueDirectoryName()`:**
- Tạo tên folder dựa trên tên bài hát thay vì UUID
- Xử lý trùng lặp với số thứ tự: `(1)`, `(2)`, `(3)`...
- Giới hạn độ dài tên (50 ký tự) để tránh lỗi filesystem
- Xử lý edge cases: tên rỗng, chỉ có dấu chấm, ký tự đặc biệt

**Ví dụ xử lý trùng lặp:**
```
Bai_hat_tieng_Viet
Bai_hat_tieng_Viet_(1)
Bai_hat_tieng_Viet_(2)
```

### 3. 🎨 Font tiếng Việt

**Cập nhật `src/index.css`:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Noto+Sans:wght@400;500;600;700&display=swap');

/* Font tiếng Việt */
* {
  font-family: 'Inter', 'Noto Sans', 'Segoe UI', 'Roboto', 'Arial', 'Helvetica Neue', sans-serif;
}
```

**Font stack được tối ưu:**
- `Inter`: Font hiện đại, hỗ trợ tiếng Việt tốt
- `Noto Sans`: Font Google chuyên cho đa ngôn ngữ
- Fallback fonts: `Segoe UI`, `Roboto`, `Arial`

### 4. 🔧 Cập nhật API Backend

**Upload API (`/api/upload`):**
- Sử dụng `songFolderName` thay vì `trackId` cho tên folder
- Lưu mapping giữa `trackId` và `songFolderName`
- Logging chi tiết quá trình chuẩn hóa

**Stems API (`/api/stems`):**
- Đọc folder theo `songFolderName`
- Mapping ngược từ folder name về track info
- Backward compatibility với dữ liệu cũ

**Delete API (`/api/stems/:trackId`):**
- Hỗ trợ xóa theo cả `trackId` và `songFolderName`
- Tìm kiếm thông minh trong `uploadedTracks`

## Cấu trúc thư mục mới

**Trước:**
```
server/output/
├── a1b2c3d4-e5f6-7890-abcd-ef1234567890/
│   ├── vocals.mp3
│   ├── drums.mp3
│   ├── bass.mp3
│   └── other.mp3
```

**Sau:**
```
server/output/
├── Bai_hat_tieng_Viet/
│   ├── vocals.mp3
│   ├── drums.mp3
│   ├── bass.mp3
│   └── other.mp3
├── Noi_nay_co_anh_-_Son_Tung_MTP/
│   ├── vocals.mp3
│   ├── drums.mp3
│   ├── bass.mp3
│   └── other.mp3
```

## Xử lý Edge Cases

### Tên file đặc biệt:
- **Tên rỗng**: `""` → `"untitled_song"`
- **Chỉ có khoảng trắng**: `"   "` → `"untitled_song"`
- **Bắt đầu/kết thúc bằng dấu chấm**: `"...file..."` → `"file"`
- **Ký tự đặc biệt**: `"@#$%^&*()"` → loại bỏ hoàn toàn

### Giới hạn hệ thống:
- **Độ dài tên**: Tối đa 50 ký tự
- **Trùng lặp**: Tự động thêm số thứ tự
- **Vòng lặp vô hạn**: Giới hạn 1000 lần thử, sau đó dùng timestamp

## Backward Compatibility

Hệ thống vẫn hoạt động với:
- Dữ liệu cũ có UUID folder names
- API calls với trackId cũ
- Mixed songs đã tạo trước đó

## Testing

Đã test với các trường hợp:
- ✅ Tên tiếng Việt có dấu
- ✅ Ký tự đặc biệt
- ✅ Tên file rỗng/không hợp lệ
- ✅ Trùng lặp tên
- ✅ Độ dài tên quá dài
- ✅ Edge cases Windows filesystem

## Kết quả

🎯 **Trước:**
- Folder: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- Font lỗi: `Bà i há t tiá º ng Viá º t`

🎉 **Sau:**
- Folder: `Bai_hat_tieng_Viet`
- Font đẹp: `Bài hát tiếng Việt`

Người dùng giờ có thể dễ dàng quản lý và nhận biết các bài hát của mình! 