# Đóng gói thành app cài được trên Android

## Tại sao cách hiện tại không cài được

Bạn đang mở app bằng `http://192.168.123.128:5178`. Tôi đã kiểm tra chính địa chỉ đó:

| | `http://localhost:5178` | `http://192.168.123.128:5178` |
|---|---|---|
| Secure context | ✅ true | ❌ **false** |
| Service worker | ✅ có | ❌ **API không tồn tại** |
| Cài được app | ✅ | ❌ |

Android chỉ cho cài app web (PWA) khi trang chạy trên **HTTPS** hoặc `localhost`. Địa chỉ
IP nội bộ chạy `http` thì trình duyệt **chặn service worker** — mà không có service worker
thì Chrome không hiện nút "Cài đặt ứng dụng". Đây là quy định bảo mật của trình duyệt,
không phải lỗi cấu hình, và không thể lách bằng cách chỉnh app.

Vậy có **2 đường**. Tôi đã chuẩn bị sẵn cả hai.

---

## Cách 1 — Đưa lên hosting miễn phí rồi cài như app (dễ nhất, 5 phút)

Phù hợp nếu bạn chấp nhận cần mạng lúc mở app lần đầu.

App này **không có server, không có database** — toàn bộ dữ liệu nằm trong máy người dùng.
Nên chỉ cần đưa thư mục `dist/` lên bất kỳ hosting tĩnh nào là xong.

### Bước 1 — Build

```bash
npm run build
```

Kết quả nằm trong thư mục `dist/`.

### Bước 2 — Kéo thả lên Netlify

1. Mở https://app.netlify.com/drop
2. Kéo nguyên **thư mục `dist`** thả vào trang đó
3. Netlify trả về một địa chỉ HTTPS, ví dụ `https://taekine-abc123.netlify.app`

Không cần đăng ký tài khoản cho lần đầu. Muốn giữ địa chỉ cố định thì đăng ký (miễn phí).

### Bước 3 — Cài lên điện thoại

1. Mở địa chỉ đó bằng **Chrome trên Android**
2. Bấm menu `⋮` → **"앱 설치"** (Cài đặt ứng dụng) hoặc **"홈 화면에 추가"**
3. Icon xuất hiện ngoài màn hình chính, mở lên chạy toàn màn hình như app thật

Sau lần đầu, service worker đã cache toàn bộ app nên **mở được cả khi mất mạng**.

**Lưu ý:** ai có địa chỉ đó đều mở được app. Dữ liệu thì không chia sẻ (mỗi máy một kho
riêng), nhưng nếu bạn không muốn người lạ thấy giao diện thì dùng Cách 2.

---

## Cách 2 — Build file APK thật (hoàn toàn offline, không cần server)

Phù hợp nếu bạn muốn app nằm hẳn trong máy, không phụ thuộc mạng và không ai khác mở được.

Tôi đã **dựng sẵn project Android** trong thư mục `android/` bằng Capacitor. Bạn chỉ cần
cài công cụ rồi bấm build.

### Bước 1 — Cài Android Studio

Tải tại https://developer.android.com/studio và cài đặt (khoảng 1GB, một lần duy nhất).
Android Studio đã kèm sẵn JDK và Android SDK, không phải cài riêng.

> Máy bạn hiện **chưa có** Java / Android SDK / Gradle — tôi đã kiểm tra. Đây là lý do
> tôi không thể build file APK hộ bạn ngay tại đây.

### Bước 2 — Mở project

```bash
npm run android:sync
npm run android:open
```

- `android:sync` = build lại web rồi copy vào project Android
- `android:open` = mở project bằng Android Studio

Lần đầu Android Studio sẽ tự tải Gradle và các thư viện (khoảng 5–10 phút, cần mạng).

### Bước 3 — Build APK

Trong Android Studio: menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**

File APK nằm ở:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Bước 4 — Cài lên điện thoại

1. Copy file APK sang điện thoại (USB, KakaoTalk gửi cho chính mình, Google Drive...)
2. Mở file trên điện thoại
3. Android hỏi cho phép cài từ nguồn không xác định → đồng ý
4. Cài xong, app nằm ngoài màn hình chính

**Bản debug APK đủ dùng nội bộ trong quán.** Chỉ khi nào muốn đưa lên Google Play mới cần
ký release và tạo keystore.

### Mỗi lần sửa code

```bash
npm run android:sync
```

rồi build lại trong Android Studio.

---

## Nên chọn cách nào

| | Cách 1 (PWA) | Cách 2 (APK) |
|---|---|---|
| Thời gian chuẩn bị | ~5 phút | ~1 giờ lần đầu |
| Cần cài gì | Không | Android Studio |
| Cần mạng | Lần đầu | Không bao giờ |
| Cần bật máy tính | Không | Không |
| Người lạ mở được | Có (nếu biết link) | Không |
| Cập nhật app | Tự động | Phải build và cài lại |

**Gợi ý:** dùng **Cách 1 trước** để chạy thử ngay trong quán. Nếu thấy ổn và muốn app
gọn gàng, không phụ thuộc mạng thì làm Cách 2 sau. Hai cách không xung đột nhau.

---

## Điều quan trọng cần biết trước khi triển khai

**Dữ liệu nằm riêng trên từng máy.** App lưu vào `localStorage` của chính thiết bị đó.
Nghĩa là điện thoại của bạn và điện thoại nhân viên sẽ có **hai kho hàng khác nhau**,
không tự đồng bộ.

Với quán chỉ một người quản lý kho thì không sao. Nhưng nếu muốn nhiều người cùng nhập
và thấy chung một số liệu thì **phải thêm server và database** — đó là một hạng mục riêng,
không phải chỉnh vài dòng. Khi nào cần thì báo tôi.

Trong lúc chưa có server, hãy dùng `설정 → 데이터 관리 → 백업 파일 내려받기` định kỳ để
tránh mất dữ liệu khi đổi máy hoặc xoá dữ liệu trình duyệt.

**API key của Claude** cũng lưu trên từng máy. Nếu cài cho nhiều nhân viên, mỗi máy phải
nhập key riêng — hoặc chuyển sang chế độ `기기 내 인식` (Tesseract) cho máy nhân viên.
