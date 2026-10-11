import { type Client, Room } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
import { isCropType } from "@mocgioi/game-config";
import {
	createInitialPlayer,
	GameState,
	InventorySchema,
	PlayerSchema,
	PlotSchema,
	type CropInventory,
	type PlayerState,
	type PlotState,
} from "@mocgioi/shared";
import { loadGuestSave, saveGuestSave } from "./db.js";
import {
	ACTION_COOLDOWN_MS,
	applyMovement,
	buySeed,
	canPerformAction,
	harvestCrop,
	plantSeed,
	RequestTracker,
	sellInventory,
	tickPlayerPlots,
	waterPlot,
	type ActionResult,
} from "./gameLogic.js";

const MOVE_COOLDOWN_MS = 70;
const RECONNECT_SECONDS = 30;

type RawMessage = Record<string, unknown>;

function isRecord(value: unknown): value is RawMessage {
	return Boolean(value) && typeof value === "object";
}

function cleanNickname(value: unknown): string {
	const nickname = typeof value === "string" ? value : "Mộc Thần";
	return nickname.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 18) || "Mộc Thần";
}

function safeGuestId(value: unknown, fallback: string): string {
	if (typeof value !== "string") return `guest-${fallback}`;
	const candidate = value.trim();
	return /^[a-zA-Z0-9_-]{8,80}$/.test(candidate) ? candidate : `guest-${fallback}`;
}

function toSchemaInventory(value: CropInventory): InventorySchema {
	const inventory = new InventorySchema();
	inventory.carrot = value.carrot ?? 0;
	inventory.tomato = value.tomato ?? 0;
	inventory.corn = value.corn ?? 0;
	return inventory;
}

function toSchemaPlots(plots: PlotState[]): ArraySchema<PlotSchema> {
	const result = new ArraySchema<PlotSchema>();
	plots.forEach((plot) => {
		const item = new PlotSchema();
		item.id = plot.id;
		item.ownerId = plot.ownerId ?? "";
		item.cropType = plot.cropType ?? "";
		item.plantedAt = plot.plantedAt;
		item.watered = plot.watered;
		item.growth = plot.growth;
		item.status = plot.status;
		result.push(item);
	});
	return result;
}

function toPlayerSchema(player: PlayerState): PlayerSchema {
	const schema = new PlayerSchema();
	schema.id = player.id;
	schema.nickname = player.nickname;
	schema.x = player.x;
	schema.y = player.y;
	schema.coins = player.coins;
	schema.seeds = toSchemaInventory(player.seeds);
	schema.inventory = toSchemaInventory(player.inventory);
	schema.plots = toSchemaPlots(player.plots);
	schema.lastActionAt = player.lastActionAt;
	return schema;
}

function fromSchemaInventory(schema: InventorySchema): CropInventory {
	return {
		carrot: schema.carrot,
		tomato: schema.tomato,
		corn: schema.corn,
	};
}

function fromSchemaPlayer(schema: PlayerSchema): PlayerState {
	return {
		id: schema.id,
		nickname: schema.nickname,
		x: schema.x,
		y: schema.y,
		coins: schema.coins,
		seeds: fromSchemaInventory(schema.seeds),
		inventory: fromSchemaInventory(schema.inventory),
		plots: schema.plots.map((plot) => ({
			id: plot.id,
			ownerId: plot.ownerId || schema.id,
			cropType: isCropType(plot.cropType) ? plot.cropType : null,
			plantedAt: plot.plantedAt,
			watered: plot.watered,
			growth: plot.growth,
			status: plot.status === "ready" ? "ready" : plot.cropType ? "planted" : "empty",
		})),
		lastActionAt: schema.lastActionAt,
	};
}

function sendNotification(client: Client, result: ActionResult, requestId?: string): void {
	client.send("notification", { ...result, requestId });
}

export class GameRoom extends Room<GameState> {
	maxClients = 8;
	private readonly trackers = new Map<string, RequestTracker>();
	private readonly lastMoveAt = new Map<string, number>();

	onCreate(): void {
		this.setState(new GameState());
		this.setSimulationInterval(() => {
			const now = Date.now();
			this.state.players.forEach((schemaPlayer, sessionId) => {
				const player = fromSchemaPlayer(schemaPlayer);
				tickPlayerPlots(player, now);
				this.state.players.set(sessionId, toPlayerSchema(player));
			});
		}, 1000);

		this.onMessage("move", (client, message: unknown) => {
			const schemaPlayer = this.state.players.get(client.sessionId);
			if (!schemaPlayer || !isRecord(message)) return;

			const now = Date.now();
			const previous = this.lastMoveAt.get(client.sessionId) ?? 0;
			if (now - previous < MOVE_COOLDOWN_MS) return;

			const dx = Math.max(-1, Math.min(1, Number(message.x ?? 0)));
			const dy = Math.max(-1, Math.min(1, Number(message.y ?? 0)));
			if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
			this.lastMoveAt.set(client.sessionId, now);

			const player = fromSchemaPlayer(schemaPlayer);
			applyMovement(player, dx, dy);
			this.state.players.set(client.sessionId, toPlayerSchema(player));
		});

		this.onMessage("action", (client, message: unknown) => {
			const schemaPlayer = this.state.players.get(client.sessionId);
			if (!schemaPlayer || !isRecord(message)) return;

			const player = fromSchemaPlayer(schemaPlayer);
			const tracker = this.trackers.get(client.sessionId) ?? new RequestTracker();
			this.trackers.set(client.sessionId, tracker);
			const requestId = typeof message.requestId === "string" ? message.requestId.slice(0, 80) : undefined;
			const previousResult = tracker.get(requestId);
			if (previousResult) {
				sendNotification(client, previousResult, requestId);
				return;
			}

			const now = Date.now();
			if (!canPerformAction(player.lastActionAt, now)) {
				const result = { ok: false, message: `Hãy chờ ${ACTION_COOLDOWN_MS}ms giữa các thao tác.` };
				tracker.remember(requestId, result);
				sendNotification(client, result, requestId);
				return;
			}
			player.lastActionAt = now;

			const actionType = typeof message.type === "string" ? message.type : "";
			const cropType = message.cropType;
			const plotId = Number(message.plotId ?? -1);
			let result: ActionResult;

			if (actionType === "buy-seed" && isCropType(cropType)) {
				result = buySeed(player, cropType);
			} else if (actionType === "plant" && isCropType(cropType)) {
				result = plantSeed(player, plotId, cropType, now);
			} else if (actionType === "water") {
				result = waterPlot(player, plotId, now);
			} else if (actionType === "harvest") {
				result = harvestCrop(player, plotId, now);
			} else if (actionType === "sell" && isCropType(cropType)) {
				result = sellInventory(player, cropType);
			} else if ((actionType === "buy-seed" || actionType === "plant" || actionType === "sell") && cropType !== undefined && !isCropType(cropType)) {
				result = { ok: false, message: "Loại cây không hợp lệ." };
			} else {
				result = { ok: false, message: "Thao tác không hợp lệ." };
			}

			tracker.remember(requestId, result);
			this.state.players.set(client.sessionId, toPlayerSchema(player));
			sendNotification(client, result, requestId);
			if (result.ok) {
				void this.persistPlayer(player);
				this.broadcast("system", { message: `${player.nickname}: ${result.message}` }, { except: client });
			}
		});
	}

	onJoin(client: Client, options: { nickname?: unknown; guestId?: unknown } | undefined): void {
		const guestId = safeGuestId(options?.guestId, client.sessionId);
		const nickname = cleanNickname(options?.nickname);
		const player = createInitialPlayer(guestId, nickname);
		this.state.players.set(client.sessionId, toPlayerSchema(player));
		this.trackers.set(client.sessionId, new RequestTracker());
		this.broadcast("system", { message: `${nickname} đã vào vườn.` }, { except: client });
		void this.restoreGuestSave(client.sessionId, guestId, nickname);
	}

	async onLeave(client: Client, consented: boolean): Promise<void> {
		if (!consented) {
			try {
				await this.allowReconnection(client, RECONNECT_SECONDS);
				return;
			} catch {
				// The reconnect window expired; continue with a durable save and cleanup.
			}
		}

		const schemaPlayer = this.state.players.get(client.sessionId);
		if (schemaPlayer) await this.persistPlayer(fromSchemaPlayer(schemaPlayer));
		this.state.players.delete(client.sessionId);
		this.trackers.delete(client.sessionId);
		this.lastMoveAt.delete(client.sessionId);
		this.broadcast("system", { message: "Một người chơi đã rời vườn." });
	}

	async onDispose(): Promise<void> {
		await Promise.all(Array.from(this.state.players.values(), (player) => this.persistPlayer(fromSchemaPlayer(player))));
	}

	private async persistPlayer(player: PlayerState): Promise<void> {
		try {
			await saveGuestSave(player);
		} catch (error) {
			console.warn(`Không thể lưu tiến trình khách ${player.id}.`, error instanceof Error ? error.message : error);
		}
	}

	private async restoreGuestSave(sessionId: string, guestId: string, nickname: string): Promise<void> {
		try {
			const loaded = await loadGuestSave(guestId);
			const current = this.state.players.get(sessionId);
			if (!loaded || !current) return;
			loaded.id = guestId;
			loaded.nickname = nickname;
			loaded.plots = loaded.plots.slice(0, 12);
			while (loaded.plots.length < 12) loaded.plots.push({
				id: loaded.plots.length,
				ownerId: guestId,
				cropType: null,
				plantedAt: 0,
				watered: false,
				growth: 0,
				status: "empty",
			});
			loaded.plots.forEach((plot, index) => {
				plot.id = index;
				plot.ownerId = guestId;
			});
			this.state.players.set(sessionId, toPlayerSchema(loaded));
		} catch (error) {
			console.warn("Không thể đọc save PostgreSQL; dùng phiên tạm thời.", error instanceof Error ? error.message : error);
		}
	}
}
