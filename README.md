# Mộc Giới Online

MVP game nông trại online 2D pixel-art chạy trên trình duyệt. Đây là thiết kế riêng, lấy cảm hứng từ cảm giác chăm vườn và gặp gỡ người chơi của các game xã hội nông trại, không sử dụng tên, hình ảnh hay mã nguồn của game khác.

## Chạy local trên Windows PowerShell

Yêu cầu: Node.js 22+, pnpm 10+, và Docker Desktop nếu muốn dùng PostgreSQL.

```powershell
pnpm install
Copy-Item .env.example .env
Copy-Item .env apps/server/.env
pnpm db:up
pnpm dev
```

Mở `http://localhost:5173`. Dòng copy thứ hai giúp Prisma CLI đọc được `DATABASE_URL` khi chạy từ `apps/server`. Nếu chưa bật Docker, server vẫn khởi động và game chạy bằng phiên tạm; để lưu lâu dài hãy bật PostgreSQL và chạy migration:

```powershell
pnpm --dir apps/server db:generate
pnpm --dir apps/server db:migrate
```

Chạy riêng:

```powershell
pnpm client   # Vite tại cổng 5173
pnpm server   # Colyseus/WebSocket + health tại cổng 2567
```

Kiểm tra:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Health check: `http://localhost:2567/health`.

## Cách chơi

1. Nhập biệt danh và bấm **Vào vườn**.
2. Di chuyển bằng WASD hoặc phím mũi tên.
3. Bấm một trong 12 ô đất màu nâu.
4. Chọn cà rốt, cà chua hoặc bắp rồi gieo hạt; có thể mua thêm hạt bằng xu.
5. Tưới một lần, chờ cây lớn theo thời gian server, thu hoạch rồi bán nông sản.
6. Mở hai tab cùng địa chỉ để thấy hai người chơi di chuyển trong phòng Colyseus chung. Mỗi tab nên có guest ID riêng trong `sessionStorage`.

Thời gian lớn: cà rốt 2 phút, cà chua 3 phút, bắp 4 phút. Tưới nước giúp giảm 20% thời gian lớn. Tiền, hạt, kho, quyền sở hữu ô đất và thời gian cây đều được server quyết định.

## Cấu trúc

- `apps/client`: Phaser 3, Vite, giao diện tiếng Việt và renderer pixel-art vẽ bằng code.
- `apps/server`: Express health check, Colyseus room, kiểm tra yêu cầu, rate limit, request dedupe, reconnect và persistence.
- `packages/shared`: kiểu dữ liệu và công thức tiến độ cây dùng chung.
- `packages/game-config`: cấu hình cây, giá, số ô và vị trí bản đồ.
- `apps/server/prisma`: schema PostgreSQL và migration save khách.
- `docs`: hướng dẫn deploy và giới hạn môi trường.

## Chế độ khách và giới hạn MVP

Guest ID được tạo trong tab trình duyệt và gửi lên server. Khi có PostgreSQL, tiến trình được lưu theo ID đó; guest chưa có email, password, khôi phục tài khoản hoặc chống giả mạo danh tính. Xóa dữ liệu trình duyệt, đổi tab hoặc dùng thiết bị khác có thể làm mất đường truy cập tới save cũ. Khi PostgreSQL chưa cấu hình, tiến trình chỉ sống trong room/server hiện tại.

Chưa làm thanh toán, giao dịch người chơi, thú cưng, bang hội, event, matchmaking riêng, moderation, analytics hay hệ thống tài khoản production.

## Asset và giấy phép

MVP không tải asset bên thứ ba: nền, nhà, cây, avatar, ô đất và họa tiết đều được vẽ bằng primitive của Phaser trong `apps/client/src/main.ts`. Font Google Fonts là tùy chọn trình duyệt; nếu không tải được, CSS dùng fallback hệ thống. Vì vậy repository không có asset bản quyền cần phân phối.

## GitHub

Workspace hiện có remote `origin` trỏ tới một repository GitHub đã tồn tại, nhưng Codex không tự push thay đổi. Kiểm tra `git status`, review diff rồi commit/push bằng quyền GitHub của bạn. Nếu cần repository mới, tạo repository trống tên `mocgioi-online`, thêm remote và push branch chính.
