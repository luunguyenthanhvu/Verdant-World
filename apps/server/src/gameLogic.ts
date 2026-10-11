import {
	CROP_CONFIG,
	PLOT_COUNT,
	isCropType,
	type CropType,
} from "@mocgioi/game-config";
import {
	clamp,
	createInitialPlayer,
	getCropProgress,
	type CropInventory,
	type PlayerState,
} from "@mocgioi/shared";

export const ACTION_COOLDOWN_MS = 250;

export interface ActionResult {
	ok: boolean;
	message: string;
}

export function canPerformAction(lastActionAt: number, now: number): boolean {
	return lastActionAt <= 0 || now - lastActionAt >= ACTION_COOLDOWN_MS;
}

export class RequestTracker {
	private readonly results = new Map<string, ActionResult>();

	get(requestId: string | undefined): ActionResult | undefined {
		return requestId ? this.results.get(requestId) : undefined;
	}

	remember(requestId: string | undefined, result: ActionResult): void {
		if (!requestId) return;
		this.results.set(requestId, result);
		if (this.results.size > 100) {
			const oldest = this.results.keys().next().value;
			if (oldest) this.results.delete(oldest);
		}
	}
}

function invalidCrop(cropType: unknown): ActionResult | null {
	return isCropType(cropType)
		? null
		: { ok: false, message: "Loại cây không hợp lệ." };
}

function getOwnedPlot(player: PlayerState, plotId: number) {
	if (!Number.isInteger(plotId) || plotId < 0 || plotId >= PLOT_COUNT) {
		return { plot: null, error: "Vị trí ô đất không hợp lệ." };
	}
	const plot = player.plots[plotId];
	if (!plot) return { plot: null, error: "Không tìm thấy ô đất." };
	if (plot.ownerId !== player.id) {
		return { plot: null, error: "Bạn không sở hữu ô đất này." };
	}
	return { plot, error: null };
}

export function canBuySeed(player: PlayerState, cropType: CropType): ActionResult {
	const invalid = invalidCrop(cropType);
	if (invalid) return invalid;
	const cost = CROP_CONFIG[cropType].seedCost;
	if (player.coins < cost) {
		return { ok: false, message: `Không đủ xu để mua ${CROP_CONFIG[cropType].name}.` };
	}
	return { ok: true, message: `Mua ${CROP_CONFIG[cropType].name} thành công.` };
}

export function buySeed(player: PlayerState, cropType: CropType): ActionResult {
	const check = canBuySeed(player, cropType);
	if (!check.ok) return check;
	const cost = CROP_CONFIG[cropType].seedCost;
	player.coins -= cost;
	player.seeds[cropType] += 1;
	return { ok: true, message: `Bạn đã mua 1 hạt ${CROP_CONFIG[cropType].name}.` };
}

export function plantSeed(
	player: PlayerState,
	plotId: number,
	cropType: CropType,
	now: number,
): ActionResult {
	const invalid = invalidCrop(cropType);
	if (invalid) return invalid;
	const owned = getOwnedPlot(player, plotId);
	if (!owned.plot) return { ok: false, message: owned.error };
	const plot = owned.plot;
	if (plot.cropType) return { ok: false, message: "Ô đất này đã có cây." };
	if ((player.seeds[cropType] ?? 0) <= 0) {
		return { ok: false, message: `Bạn chưa có hạt ${CROP_CONFIG[cropType].name}.` };
	}

	player.seeds[cropType] -= 1;
	plot.cropType = cropType;
	plot.plantedAt = now;
	plot.watered = false;
	plot.status = "planted";
	plot.growth = 0;
	return { ok: true, message: `Bạn đã gieo ${CROP_CONFIG[cropType].name}.` };
}

export function waterPlot(player: PlayerState, plotId: number, now: number): ActionResult {
	const owned = getOwnedPlot(player, plotId);
	if (!owned.plot) return { ok: false, message: owned.error };
	const plot = owned.plot;
	if (!plot.cropType) return { ok: false, message: "Ô đất này chưa gieo hạt." };
	if (plot.watered) return { ok: false, message: "Ô đất này đã được tưới nước." };

	plot.watered = true;
	plot.status = "planted";
	plot.growth = getCropProgress(plot, now);
	return { ok: true, message: "Bạn đã tưới nước cho ô đất." };
}

export function harvestCrop(player: PlayerState, plotId: number, now: number): ActionResult {
	const owned = getOwnedPlot(player, plotId);
	if (!owned.plot) return { ok: false, message: owned.error };
	const plot = owned.plot;
	if (!plot.cropType) return { ok: false, message: "Ô đất này chưa có cây để thu hoạch." };

	const progress = getCropProgress(plot, now);
	if (progress < 100) {
		return { ok: false, message: `Cây chưa chín. Hiện tại ${Math.floor(progress)}%.` };
	}

	const cropType = plot.cropType;
	player.inventory[cropType] += 1;
	plot.cropType = null;
	plot.plantedAt = 0;
	plot.watered = false;
	plot.growth = 0;
	plot.status = "empty";
	return { ok: true, message: `Thu hoạch thành công: ${CROP_CONFIG[cropType].name}.` };
}

export function sellInventory(player: PlayerState, cropType: CropType): ActionResult {
	const invalid = invalidCrop(cropType);
	if (invalid) return invalid;
	const amount = player.inventory[cropType] ?? 0;
	if (amount <= 0) {
		return { ok: false, message: `Bạn không có ${CROP_CONFIG[cropType].name} để bán.` };
	}

	const total = amount * CROP_CONFIG[cropType].sellPrice;
	player.inventory[cropType] = 0;
	player.coins += total;
	return { ok: true, message: `Bạn đã bán ${amount} ${CROP_CONFIG[cropType].name} và nhận ${total} xu.` };
}

export function applyMovement(player: PlayerState, dx: number, dy: number): void {
	const length = Math.hypot(dx, dy);
	if (!Number.isFinite(length) || length === 0) return;
	const normalizedX = dx / Math.max(1, length);
	const normalizedY = dy / Math.max(1, length);
	player.x = clamp(player.x + normalizedX * 12, 64, 896);
	player.y = clamp(player.y + normalizedY * 12, 94, 548);
}

export function tickPlayerPlots(player: PlayerState, now: number): void {
	for (const plot of player.plots) {
		if (!plot.cropType) continue;
		const progress = getCropProgress(plot, now);
		plot.growth = progress;
		plot.status = progress >= 100 ? "ready" : "planted";
	}
}

export function createDefaultPlayerState(nickname: string): PlayerState {
	return createInitialPlayer(`guest-${Date.now()}`, nickname);
}

export type { CropInventory };
