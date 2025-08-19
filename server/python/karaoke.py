import argparse
import json
import os
from datetime import timedelta

# Đảm bảo bạn đã cài đặt: pip install stable-ts
import stable_whisper

def write_karaoke_json(result, path: str):
    """
    Xuất kết quả phiên âm ra file JSON với word-level timestamps.
    Đây là định dạng chuẩn mới cho tính năng karaoke.
    """
    karaoke_data = []
    for seg in result.segments:
        segment_text = getattr(seg, 'text', '').strip()
        if not segment_text:
            continue

        segment_info = {
            'text': segment_text,
            'start': getattr(seg, 'start', 0.0),
            'end': getattr(seg, 'end', 0.0),
            'words': []
        }

        words_in_segment = getattr(seg, 'words', [])
        for word_data in words_in_segment:
            word_text = getattr(word_data, 'word', '').strip()
            if word_text:
                segment_info['words'].append({
                    'word': word_text,
                    'start': getattr(word_data, 'start', 0.0),
                    'end': getattr(word_data, 'end', 0.0)
                })
        
        # Fallback: Nếu không có word-level timestamps, tạo một "từ" duy nhất
        # cho cả câu để tránh lỗi ở frontend.
        if not segment_info['words'] and segment_text:
             segment_info['words'].append({
                  'word': segment_text,
                  'start': segment_info['start'],
                  'end': segment_info['end']
             })

        karaoke_data.append(segment_info)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(karaoke_data, f, ensure_ascii=False, indent=2)

def main():
    parser = argparse.ArgumentParser(description='Karaoke transcription using stable-ts (stable_whisper).')
    parser.add_argument('--input', required=True, help='Đường dẫn file âm thanh đầu vào')
    parser.add_argument('--output_dir', required=True, help='Thư mục xuất kết quả')
    parser.add_argument('--model', default='large-v3-turbo', help='Model: tiny|base|small|medium|large-v3|large-v3-turbo')
    parser.add_argument('--language', default='auto', help='Mã ngôn ngữ, ví dụ: vi|en|auto')
    parser.add_argument('--device', default=None, help='cpu|cuda')
    parser.add_argument('--formats', default='json', help='Định dạng đầu ra: json (khuyến nghị) | srt | lrc')
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    print("Đang tải mô hình stable-ts...", flush=True)
    model = stable_whisper.load_model(args.model, device=args.device)

    print(f"Đang phiên âm: {args.input}", flush=True)
    kw = {}
    if args.language and args.language != 'auto':
        kw['language'] = args.language
        
    # Yêu cầu word-level timestamps từ A.I. - Đây là chìa khóa cho karaoke
    result = model.transcribe(args.input, word_timestamps=True, **kw)

    json_path = os.path.join(args.output_dir, 'lyrics.json')

    # Chỉ xử lý định dạng được yêu cầu, mặc định là json
    if 'json' in args.formats:
        write_karaoke_json(result, json_path)

    # Trả về một JSON object chứa thông tin về các file đã tạo
    out = {
        'status': 'success',
        'files': {
            'json': json_path if os.path.exists(json_path) else None
        }
    }
    print(json.dumps(out), flush=True)

if __name__ == '__main__':
    main()
