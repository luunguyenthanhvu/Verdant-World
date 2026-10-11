# Deploy Mộc Giới Online

Mục tiêu triển khai MVP:

- Client Phaser/Vite tĩnh trên Cloudflare Pages.
- Server Node.js + Colyseus trên Render Web Service vì Render hỗ trợ WebSocket public.
- PostgreSQL cùng nhà cung cấp hoặc PostgreSQL managed khác.

Đây là cấu hình thử nghiệm/startup MVP, chưa phải kiến trúc production. Render Free Web Service có thể sleep sau thời gian không có traffic; Render Free Postgres có giới hạn 1 GB và hết hạn sau 30 ngày, nên không dùng làm nơi lưu dữ liệu người dùng thật lâu dài.

## 1. Chuẩn bị repository

Push workspace lên một repository GitHub mà bạn sở hữu. Codex không tự tạo tài khoản hay tự push nếu chưa được cấp quyền.

Build client và server ở local trước:

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## 2. PostgreSQL

Tùy chọn local:

```powershell
Copy-Item .env.example .env
Copy-Item .env apps/server/.env
docker compose up -d postgres
pnpm --dir apps/server db:generate
pnpm --dir apps/server db:migrate
```

Tùy chọn hosted: tạo PostgreSQL, lấy connection string private/internal nếu server cùng nhà cung cấp, rồi chạy migration một lần:

```powershell
$env:DATABASE_URL="postgresql://..."
pnpm --dir apps/server db:generate
pnpm --dir apps/server db:migrate
```

Không commit `.env` hoặc connection string.

## 3. Render Web Service cho server

Tạo **New → Web Service**, kết nối repository và dùng:

- Root Directory: để trống.
- Build Command: `pnpm install --frozen-lockfile && pnpm --dir apps/server db:generate && pnpm build`.
- Start Command: `pnpm --dir apps/server start`.
- Health Check Path: `/health`.

Environment variables:

```text
NODE_VERSION=22
PORT=10000                         # Render cấp PORT; app đã đọc process.env.PORT
CLIENT_URL=https://<ten-client>.pages.dev
DATABASE_URL=<connection-string-postgresql>
```

Render phải nhận WebSocket trên cùng public URL. Client production dùng `wss://`.

## 4. Cloudflare Pages cho client

Tạo **Workers & Pages → Create application → Pages → Import Git repository**. Vì đây là pnpm monorepo:

- Build command: `pnpm install --frozen-lockfile && pnpm --dir apps/client build`.
- Build output directory: `apps/client/dist`.
- Root directory: `/`.

Trong Pages Environment Variables đặt:

```text
VITE_SERVER_URL=wss://<ten-server>.onrender.com
```

Sau khi biết URL Pages, cập nhật lại `CLIENT_URL` trên Render và redeploy server. Nếu dùng nhiều domain, ngăn cách bằng dấu phẩy.

## 5. Kiểm tra sau deploy

```powershell
Invoke-WebRequest https://<ten-server>.onrender.com/health
```

Kết quả phải có `ok: true`. Mở URL Pages, vào game, sau đó mở tab thứ hai và kiểm tra hai avatar nhìn thấy nhau. Thử gieo/tưới/bán để chắc WebSocket, CORS và PostgreSQL đều hoạt động.

## 6. Lưu ý startup

- Free Web Service có cold start; người chơi có thể phải chờ server thức dậy.
- WebSocket public cần `wss://`, không dùng `ws://` trên HTTPS.
- Render Free Postgres không có backup và database free hết hạn sau 30 ngày; trước khi có người dùng thật nên chuyển sang database có backup/retention phù hợp.
- Một instance server là đủ cho MVP. Khi scale nhiều instance cần Colyseus presence/driver phù hợp để room và state không bị chia tách.
- Cloudflare Pages chỉ là client tĩnh; deploy riêng client không có nghĩa multiplayer backend đã deploy.

## Tài liệu dịch vụ đã tham khảo

- [Colyseus state synchronization](https://docs.colyseus.io/state)
- [Colyseus rooms và reconnect](https://docs.colyseus.io/room)
- [Render deploy miễn phí và giới hạn Postgres](https://render.com/docs/free)
- [Render WebSockets](https://render.com/docs/websocket)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
