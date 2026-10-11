import Phaser from "phaser";
import { Client, type Room } from "colyseus.js";
import {
	CROP_CONFIG,
	CROP_TYPES,
	getPlotWorldPosition,
	type CropType,
} from "@mocgioi/game-config";
import { GameState } from "@mocgioi/shared";
import "./style.css";

type AnyRoom = Room<any>;
type AnyState = any;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Không tìm thấy vùng ứng dụng.");

app.innerHTML = `
  <header class="topbar">
    <div class="brand-mark" aria-hidden="true">✦</div>
    <div>
      <div class="eyebrow">VÙNG ĐẤT GIAO LƯU</div>
      <h1>Mộc Giới Online</h1>
    </div>
    <div class="topbar-note">Một khu vườn nhỏ, nhiều câu chuyện 🌿</div>
  </header>
  <main>
    <section id="setup" class="setup-card">
      <div>
        <span class="eyebrow">BẮT ĐẦU PHIÊN KHÁCH</span>
        <h2>Chào mừng đến thung lũng</h2>
        <p>Đặt biệt danh, gieo những hạt đầu tiên và gặp người chơi khác trong cùng khu vườn.</p>
      </div>
      <div class="join-form">
        <label for="nickname">Biệt danh</label>
        <div class="join-row">
          <input id="nickname" maxlength="18" value="Mộc Thần" placeholder="Nhập biệt danh" autocomplete="nickname" />
          <button id="join" class="primary">Vào vườn <span>→</span></button>
        </div>
        <small>Chế độ khách: tiến trình gắn với trình duyệt hiện tại.</small>
      </div>
    </section>

    <section id="game-shell" class="game-shell" aria-label="Khu vườn Mộc Giới">
      <div class="game-heading">
        <div>
          <span class="eyebrow">KHU VƯỜN CHUNG</span>
          <h2>Suối Mây</h2>
        </div>
        <div class="connection-status"><span id="connection-dot"></span><span id="connection-text">Chưa kết nối</span></div>
      </div>
      <div class="game-layout">
        <div id="phaser-root" class="phaser-root"></div>
        <aside class="side-panel">
          <div class="profile-card">
            <div class="avatar-chip">✿</div>
            <div id="playerInfo"><strong>Đang chờ vào vườn…</strong><span>Biệt danh và tiền xu sẽ hiện ở đây.</span></div>
          </div>

          <div class="resource-grid">
            <div class="resource-card"><span class="resource-icon coin">✦</span><span><small>TIỀN XU</small><strong id="coins">—</strong></span></div>
            <div class="resource-card"><span class="resource-icon bag">▣</span><span><small>Ô ĐẤT</small><strong>12 ô riêng</strong></span></div>
          </div>

          <div class="panel-block selected-block">
            <div class="block-title"><span>Ô đất đang chọn</span><span id="selectedPlot">Chưa chọn</span></div>
            <p id="plotHint">Bấm vào một ô đất trong bản đồ để bắt đầu.</p>
          </div>

          <div class="panel-block">
            <div class="block-title"><span>Hạt giống</span><span class="hint">mua bằng xu</span></div>
            <div id="seeds" class="inventory-row">—</div>
          </div>

          <div class="action-block">
            <label for="cropSelect">Chọn cây</label>
            <select id="cropSelect"></select>
            <div class="action-grid">
              <button id="plantBtn" class="action primary" disabled>🌱 Gieo hạt</button>
              <button id="waterBtn" class="action" disabled>💧 Tưới nước</button>
              <button id="harvestBtn" class="action" disabled>🧺 Thu hoạch</button>
              <button id="buyBtn" class="action" disabled>＋ Mua hạt</button>
            </div>
            <button id="sellBtn" class="sell-button" disabled>◆ Bán cây đã thu hoạch</button>
          </div>

          <div class="panel-block inventory-block">
            <div class="block-title"><span>Kho nông sản</span><span class="hint">bán theo loại đang chọn</span></div>
            <div id="inventory" class="inventory-row">—</div>
          </div>

          <div class="help-box"><strong>Hướng dẫn nhanh</strong><span>WASD / phím mũi tên để di chuyển</span><span>Bấm ô đất → gieo → tưới → chờ chín → thu hoạch</span><span>Xu và nông sản do server quyết định</span></div>
          <div class="log-box"><div class="block-title"><span>Nhật ký vườn</span></div><div id="log" aria-live="polite"></div></div>
        </aside>
      </div>
    </section>
  </main>
  <footer>Pixel art tự vẽ bằng code · Tên và thiết kế riêng của Mộc Giới Online · MVP thử nghiệm</footer>
`;

const nicknameInput = document.querySelector<HTMLInputElement>("#nickname")!;
const joinButton = document.querySelector<HTMLButtonElement>("#join")!;
const cropSelect = document.querySelector<HTMLSelectElement>("#cropSelect")!;
const plantButton = document.querySelector<HTMLButtonElement>("#plantBtn")!;
const waterButton = document.querySelector<HTMLButtonElement>("#waterBtn")!;
const harvestButton = document.querySelector<HTMLButtonElement>("#harvestBtn")!;
const sellButton = document.querySelector<HTMLButtonElement>("#sellBtn")!;
const buyButton = document.querySelector<HTMLButtonElement>("#buyBtn")!;
const playerInfo = document.querySelector<HTMLDivElement>("#playerInfo")!;
const coinsNode = document.querySelector<HTMLElement>("#coins")!;
const inventoryNode = document.querySelector<HTMLDivElement>("#inventory")!;
const seedsNode = document.querySelector<HTMLDivElement>("#seeds")!;
const logNode = document.querySelector<HTMLDivElement>("#log")!;
const selectedPlotNode = document.querySelector<HTMLSpanElement>("#selectedPlot")!;
const plotHintNode = document.querySelector<HTMLParagraphElement>("#plotHint")!;
const connectionDot = document.querySelector<HTMLSpanElement>("#connection-dot")!;
const connectionText = document.querySelector<HTMLSpanElement>("#connection-text")!;

for (const cropType of CROP_TYPES) {
	const option = document.createElement("option");
	option.value = cropType;
	option.textContent = `${CROP_CONFIG[cropType].icon} ${CROP_CONFIG[cropType].name} · ${CROP_CONFIG[cropType].growMinutes} phút`;
	cropSelect.append(option);
}

let room: AnyRoom | null = null;
let farmScene: FarmScene | null = null;
let selectedPlotId: number | null = null;
let selectedCrop: CropType = "carrot";
let reconnecting = false;

function appendLog(message: string): void {
	const line = document.createElement("div");
	line.textContent = message;
	logNode.prepend(line);
	while (logNode.children.length > 7) logNode.lastElementChild?.remove();
}

function setConnection(connected: boolean, message: string): void {
	connectionDot.classList.toggle("online", connected);
	connectionText.textContent = message;
}

function updateHud(player: any): void {
	if (!player) return;
	playerInfo.replaceChildren();
	const name = document.createElement("strong");
	name.textContent = player.nickname;
	const detail = document.createElement("span");
	detail.textContent = `Vị trí (${Math.round(player.x)}, ${Math.round(player.y)}) · khách`;
	playerInfo.append(name, detail);
	coinsNode.textContent = `${player.coins} xu`;
	inventoryNode.textContent = CROP_TYPES.map((cropType) => `${CROP_CONFIG[cropType].icon} ${player.inventory[cropType] ?? 0}`).join("   ");
	seedsNode.textContent = CROP_TYPES.map((cropType) => `${CROP_CONFIG[cropType].icon} ${player.seeds[cropType] ?? 0}`).join("   ");
	}

function describePlot(plot: any): void {
	if (!plot) {
		selectedPlotNode.textContent = "Chưa chọn";
		plotHintNode.textContent = "Bấm vào một ô đất trong bản đồ để bắt đầu.";
		return;
	}
	selectedPlotNode.textContent = `Ô ${plot.id + 1}`;
	if (!plot.cropType) {
		plotHintNode.textContent = "Ô đất trống · chọn loại cây rồi gieo hạt.";
	} else if (plot.status === "ready") {
		plotHintNode.textContent = `Cây ${CROP_CONFIG[plot.cropType as CropType].name} đã chín · sẵn sàng thu hoạch!`;
	} else {
		plotHintNode.textContent = `${CROP_CONFIG[plot.cropType as CropType].name} đang lớn ${Math.round(plot.growth)}%${plot.watered ? " · đã tưới" : " · cần tưới"}.`;
	}
}

function syncRoomState(state: AnyState): void {
	if (!state || !room) return;
	const currentPlayer = state.players.get(room.sessionId);
	updateHud(currentPlayer);
	describePlot(currentPlayer?.plots.get?.(selectedPlotId ?? -1) ?? currentPlayer?.plots[selectedPlotId ?? -1]);
	farmScene?.renderState(state);
}

function guestId(): string {
	const key = "mocgioi.guestId";
	const existing = sessionStorage.getItem(key);
	if (existing) return existing;
	const created = `guest-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
	sessionStorage.setItem(key, created);
	return created;
}

function requestId(): string {
	return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function serverUrl(): string {
	const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
	if (configured) return configured;
	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	return `${protocol}://${window.location.hostname}:2567`;
}

const client = new Client(serverUrl());

function sendAction(type: string, extras: Record<string, unknown> = {}): void {
	if (!room) {
		appendLog("Hãy vào vườn trước đã.");
		return;
	}
	room.send("action", { type, requestId: requestId(), ...extras });
}

function selectedPlotOrWarn(): number | null {
	if (selectedPlotId === null) appendLog("Hãy bấm chọn một ô đất trước.");
	return selectedPlotId;
}

function bindActionHandlers(): void {
	plantButton.onclick = () => {
		const plotId = selectedPlotOrWarn();
		if (plotId !== null) sendAction("plant", { plotId, cropType: selectedCrop });
	};
	waterButton.onclick = () => {
		const plotId = selectedPlotOrWarn();
		if (plotId !== null) sendAction("water", { plotId });
	};
	harvestButton.onclick = () => {
		const plotId = selectedPlotOrWarn();
		if (plotId !== null) sendAction("harvest", { plotId });
	};
	sellButton.onclick = () => sendAction("sell", { cropType: selectedCrop });
	buyButton.onclick = () => sendAction("buy-seed", { cropType: selectedCrop });
	cropSelect.onchange = () => {
		selectedCrop = cropSelect.value as CropType;
	};
}

class FarmScene extends Phaser.Scene {
	currentRoom: AnyRoom | null = null;
	plotGraphics = new Map<number, Phaser.GameObjects.Container>();
	playerGraphics = new Map<string, Phaser.GameObjects.Container>();
	private lastMoveAt = 0;
	private keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
	private lastState: AnyState = null;

	constructor() {
		super("farm-scene");
	}

	create(): void {
		this.drawWorld();
		this.keys = this.input.keyboard?.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key> | null;
	}

	private drawWorld(): void {
		this.add.rectangle(480, 300, 960, 600, 0x8bcf72);
		this.add.rectangle(480, 300, 944, 584, 0x6fae61).setStrokeStyle(8, 0x315c4c);
		for (let x = 24; x < 960; x += 32) this.add.rectangle(x, 86, 2, 500, 0x79bc6a, 0.25);
		for (let y = 90; y < 590; y += 32) this.add.rectangle(480, y, 944, 2, 0x5b9a5b, 0.23);
		this.add.rectangle(480, 145, 780, 58, 0xd9b76b).setStrokeStyle(4, 0xf3d98c);
		this.add.rectangle(480, 205, 780, 8, 0xb98d52);
		this.add.rectangle(792, 174, 200, 112, 0x58a9c4).setStrokeStyle(4, 0xb5edf3);
		this.add.rectangle(792, 184, 160, 7, 0xd5fbfa, 0.45);
		this.add.text(750, 116, "SUỐI MÂY", { fontFamily: "monospace", fontSize: "14px", color: "#244d55" });
		this.drawHouse(68, 108);
		this.drawTree(850, 440);
		this.drawTree(65, 468);
		this.drawTree(875, 318);
		this.add.text(36, 564, "Vào vườn · gặp nhau · cùng lớn lên", { fontFamily: "monospace", fontSize: "12px", color: "#2f5b3b" });
	}

	private drawHouse(x: number, y: number): void {
		this.add.rectangle(x + 55, y + 48, 112, 70, 0xf5dfaa).setStrokeStyle(4, 0x8a5740);
		this.add.triangle(x + 55, y - 2, 0, 70, 110, 70, 55, 0, 0xc86d5a).setStrokeStyle(4, 0x78483f);
		this.add.rectangle(x + 55, y + 67, 26, 48, 0x6b4e4b);
		this.add.rectangle(x + 25, y + 45, 20, 20, 0x7cc9c7).setStrokeStyle(3, 0x3f7f84);
		this.add.text(x + 14, y + 128, "Nhà chung", { fontFamily: "monospace", fontSize: "11px", color: "#315b43" });
	}

	private drawTree(x: number, y: number): void {
		this.add.rectangle(x, y + 26, 13, 38, 0x805339);
		this.add.circle(x, y, 25, 0x2f8055).setStrokeStyle(3, 0x215842);
		this.add.circle(x - 18, y + 10, 18, 0x3d9a5c);
		this.add.circle(x + 17, y + 10, 18, 0x3a9256);
	}

	private selectPlot(plotId: number): void {
		selectedPlotId = plotId;
		const player = this.currentRoom?.state?.players?.get(this.currentRoom.sessionId);
		const plot = player?.plots.get?.(plotId) ?? player?.plots[plotId];
		describePlot(plot);
		this.renderState(this.lastState);
	}

	renderState(state: AnyState): void {
		if (!state || !this.currentRoom) return;
		this.lastState = state;
		this.plotGraphics.forEach((container) => container.destroy());
		this.plotGraphics.clear();
		this.playerGraphics.forEach((container) => container.destroy());
		this.playerGraphics.clear();

		const currentPlayer = state.players.get(this.currentRoom.sessionId);
		if (currentPlayer) {
			currentPlayer.plots.forEach((plot: any) => {
				const position = getPlotWorldPosition(plot.id);
				const container = this.add.container(position.x, position.y).setDepth(4);
				const soilColor = plot.cropType ? (plot.watered ? 0x735238 : 0x805737) : 0x9b6a42;
				const tile = this.add.rectangle(0, 0, 86, 62, soilColor).setStrokeStyle(3, plot.id === selectedPlotId ? 0xfff2a6 : 0xd7b177);
				tile.setInteractive({ useHandCursor: true });
				tile.on("pointerdown", () => this.selectPlot(plot.id));
				container.add(tile);
				const crop = plot.cropType ? CROP_CONFIG[plot.cropType as CropType] : null;
				const icon = this.add.text(0, -7, crop ? crop.icon : "·", { fontFamily: "Segoe UI Emoji, sans-serif", fontSize: crop ? "24px" : "28px", color: "#fff4cf" }).setOrigin(0.5);
				const status = this.add.text(0, 22, crop ? `${Math.round(plot.growth)}%${plot.watered ? "  💧" : ""}` : `Ô ${plot.id + 1}`, { fontFamily: "monospace", fontSize: "10px", color: "#fff4cf" }).setOrigin(0.5);
				container.add([icon, status]);
				this.plotGraphics.set(plot.id, container);
			});
		}

		state.players.forEach((player: any, sessionId: string) => {
			const container = this.add.container(player.x, player.y).setDepth(10);
			const shadow = this.add.ellipse(0, 11, 30, 10, 0x2c5b40, 0.35);
			const body = this.add.rectangle(0, 2, 22, 25, sessionId === this.currentRoom?.sessionId ? 0x6b5bd5 : 0x3e93b5).setStrokeStyle(3, 0xffffff, 0.8);
			const head = this.add.circle(0, -13, 10, 0xffd3a0).setStrokeStyle(2, 0x78483f);
			const hat = this.add.rectangle(0, -23, 25, 5, sessionId === this.currentRoom?.sessionId ? 0xf0b44b : 0x70c48a);
			const label = this.add.text(0, -43, player.nickname.slice(0, 12), { fontFamily: "monospace", fontSize: "11px", color: "#fffbed", backgroundColor: "#244b43" }).setOrigin(0.5);
			container.add([shadow, body, head, hat, label]);
			this.playerGraphics.set(sessionId, container);
		});
	}

	update(): void {
		if (!this.currentRoom || !this.keys) return;
		let dx = 0;
		let dy = 0;
		if (this.keys.W.isDown || this.input.keyboard?.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP))) dy -= 1;
		if (this.keys.S.isDown || this.input.keyboard?.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN))) dy += 1;
		if (this.keys.A.isDown || this.input.keyboard?.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT))) dx -= 1;
		if (this.keys.D.isDown || this.input.keyboard?.checkDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT))) dx += 1;
		if ((dx || dy) && Date.now() - this.lastMoveAt > 75) {
			this.currentRoom.send("move", { x: dx, y: dy });
			this.lastMoveAt = Date.now();
		}
	}
}

function ensureGame(connectedRoom: AnyRoom): void {
	if (!farmScene) {
		farmScene = new FarmScene();
		const game = new Phaser.Game({
			type: Phaser.AUTO,
			width: 960,
			height: 600,
			parent: "phaser-root",
			backgroundColor: "#8bcf72",
			pixelArt: true,
			scene: [farmScene],
			scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
		});
		void game;
	}
	farmScene.currentRoom = connectedRoom;
}

function attachRoom(connectedRoom: AnyRoom): void {
	room = connectedRoom;
	ensureGame(connectedRoom);
	bindActionHandlers();
	setConnection(true, "Đã kết nối");
	connectedRoom.onMessage("welcome", (message: { nickname: string }) => appendLog(`Chào ${message.nickname}! Vườn đã sẵn sàng.`));
	connectedRoom.onMessage("notification", (message: { message: string }) => appendLog(message.message));
	connectedRoom.onMessage("system", (message: { message: string }) => appendLog(message.message));
	connectedRoom.onStateChange((state: AnyState) => syncRoomState(state));
	connectedRoom.onLeave(() => {
		setConnection(false, "Mất kết nối · đang thử lại");
		appendLog("Kết nối bị gián đoạn. Đang thử kết nối lại…");
		void reconnectRoom(connectedRoom);
	});
	if (connectedRoom.state) syncRoomState(connectedRoom.state);
	for (const button of [plantButton, waterButton, harvestButton, sellButton, buyButton]) button.disabled = false;
}

async function reconnectRoom(previousRoom: AnyRoom): Promise<void> {
	if (reconnecting || !previousRoom.reconnectionToken) return;
	reconnecting = true;
	for (let attempt = 0; attempt < 5; attempt += 1) {
		await new Promise((resolve) => window.setTimeout(resolve, 800 * 2 ** attempt));
		try {
			const reconnected = await client.reconnect(previousRoom.reconnectionToken, GameState);
			attachRoom(reconnected);
			appendLog("Đã kết nối lại, tiến trình khách vẫn được giữ.");
			reconnecting = false;
			return;
		} catch {
			// Continue with exponential backoff; the server keeps a short reconnect window.
		}
	}
	reconnecting = false;
	setConnection(false, "Chưa kết nối");
	appendLog("Không thể kết nối lại. Hãy tải lại trang để vào phiên mới.");
}

joinButton.onclick = async () => {
	const nickname = nicknameInput.value.trim() || "Mộc Thần";
	joinButton.disabled = true;
	joinButton.textContent = "Đang vào…";
	try {
		const joined = await client.joinOrCreate("mocgioi-room", { nickname, guestId: guestId() }, GameState);
		attachRoom(joined);
		appendLog(`Đã vào vườn với biệt danh ${nickname}.`);
	} catch (error) {
		joinButton.disabled = false;
		joinButton.textContent = "Vào vườn →";
		setConnection(false, "Không thể kết nối");
		appendLog("Không thể kết nối server. Hãy kiểm tra pnpm dev và cổng 2567.");
		console.error(error);
	}
};

appendLog("Mẹo: bấm vào ô đất màu nâu để xem trạng thái.");
