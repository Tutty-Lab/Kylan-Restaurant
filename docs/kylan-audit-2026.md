# Kylan: kiểm tra 12 tháng năm 2026

Dữ liệu 7 nhân viên Kylan lấy ngày 23/10/2026: tổng định mức 788h/tháng. Giữ nguyên ngày nghỉ và quy định riêng của chủ quán.

Giờ: T3–T6 11:00–15:00, 17:00–22:00; T7/CN 13:00–22:00; ngày lễ 15:00–22:00; thứ Hai đóng cửa.

Kiểm tra cùng seed mặc định, không thay định mức để làm đẹp kết quả. Độ phủ là số người có mặt theo ca; chưa trừ thời điểm nghỉ vì dữ liệu chỉ có tổng phút nghỉ.

| Tháng | Giờ xếp / định mức | Lỗi cứng | Ngày lệch cao điểm | Ngày có khung trống |
|---|---|---|---|---|
| 1/2026 | 788/788h | 0 | 1 | 1 |
| 2/2026 | 788/788h | 0 | 0 | 0 |
| 3/2026 | 788/788h | 0 | 0 | 0 |
| 4/2026 | 788/788h | 0 | 0 | 0 |
| 5/2026 | 788/788h | 0 | 1 | 1 |
| 6/2026 | 788/788h | 0 | 0 | 0 |
| 7/2026 | 788/788h | 0 | 3 | 3 |
| 8/2026 | 788/788h | 0 | 0 | 0 |
| 9/2026 | 788/788h | 0 | 0 | 0 |
| 10/2026 | 788/788h | 0 | 2 | 1 |
| 11/2026 | 788/788h | 0 | 0 | 0 |
| 12/2026 | 788/788h | 0 | 0 | 0 |

Lỗi cứng gồm giờ công, chồng ca, giới hạn giờ/ngày, số ngày/tuần, 6 ngày liên tiếp, khung giờ, ngày nghỉ và availability. Cảnh báo độ phủ được báo riêng; không coi lịch đủ giờ là đã phủ đủ.

Local review: http://localhost:5178/?debug=kylan · mật khẩu mặc định 1991. Debug dùng bộ nhớ local riêng, tắt đồng bộ Supabase, không ghi vào lịch thật. UI debug đã bỏ; chạy kiểm tra 12 tháng bằng `npm test -- src/lib/__tests__/kylanYear.test.ts`.

Full suite: 133/133 test qua; test năm sau lần chỉnh cuối: 15/15 qua; TypeScript và Vite build qua.
