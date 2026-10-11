# AGENTS.md

## Mục tiêu project

Mộc Giới Online là game nông trại online 2D pixel-art chạy trên browser, dùng TypeScript, pnpm workspace, Phaser 3 ở client, Colyseus ở server và PostgreSQL/Prisma cho save khách. Ưu tiên vòng chơi nhỏ nhưng chạy được local, code rõ để tiếp tục phát triển startup.

## Quy ước thay đổi

- Không xóa hoặc ghi đè công việc hiện có nếu chưa có xác nhận rõ ràng.
- Giữ cấu trúc `apps/client`, `apps/server`, `packages/shared`, `packages/game-config`, `docs`.
- Dùng TypeScript strict mode.
- Tiền, vật phẩm, quyền sở hữu ô đất, cooldown và thời gian lớn của cây phải do server quyết định.
- Dữ liệu dùng chung ở `packages/shared`, cấu hình ở `packages/game-config`, server logic ở `apps/server`, rendering và input ở `apps/client`.
- Không thêm asset chưa rõ giấy phép. MVP hiện tại vẽ pixel primitive trực tiếp bằng Phaser.
- Không commit `.env`, password, token, API key hoặc connection string thật.

## Chạy local Windows PowerShell

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm --dir apps/server db:generate
pnpm --dir apps/server db:migrate
pnpm dev
```

Nếu không có Docker/PostgreSQL, server vẫn chạy fallback tạm thời nhưng save không bền sau khi server dừng.

## Kiểm tra bắt buộc

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## Kiến trúc gameplay

- Client gửi `move`/`action`, không tự sửa coins, inventory hoặc plot state.
- Room kiểm tra loại cây, ID request, cooldown, payload và ownerId.
- Guest ID đến từ `sessionStorage` để hai tab mới có thể là hai người chơi; PostgreSQL lưu save theo ID này.
- Colyseus room giữ state multiplayer; reconnect giữ client trong room trong một cửa sổ ngắn.

## Bàn giao

Khi thay đổi behavior, cập nhật README, test logic và `docs/deployment.md`. Không báo deploy thành công nếu chỉ mới build client; cần kiểm tra cả health check và WebSocket backend.
