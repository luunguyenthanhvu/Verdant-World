import { describe, expect, it } from "vitest";
import { CROP_CONFIG } from "../packages/game-config/src/index";
import { createInitialPlayer, getCropProgress } from "../packages/shared/src/index";
import {
	ACTION_COOLDOWN_MS,
	buySeed,
	canPerformAction,
	harvestCrop,
	plantSeed,
	RequestTracker,
	sellInventory,
	waterPlot,
} from "../apps/server/src/gameLogic";

describe("vòng lặp trồng trọt authoritative", () => {
	it("khởi tạo đúng 12 ô và khóa quyền sở hữu theo khách", () => {
		const player = createInitialPlayer("guest-a", "Nắng");

		expect(player.plots).toHaveLength(12);
		expect(player.plots.every((plot) => plot.ownerId === "guest-a")).toBe(true);
	});

	it("mua hạt rồi gieo và tưới được đúng một lần", () => {
		const player = createInitialPlayer("guest-b", "Mây");
		const now = Date.now();

		expect(buySeed(player, "carrot").ok).toBe(true);
		expect(player.coins).toBe(80 - CROP_CONFIG.carrot.seedCost);
		expect(plantSeed(player, 0, "carrot", now).ok).toBe(true);
		expect(player.seeds.carrot).toBe(4);
		expect(waterPlot(player, 0, now + 10).ok).toBe(true);
		expect(waterPlot(player, 0, now + 20).ok).toBe(false);
	});

	it("không cho phép chạm vào ô không thuộc người chơi", () => {
		const player = createInitialPlayer("guest-c", "Lúa");
		player.plots[0].ownerId = "guest-other";

		const result = plantSeed(player, 0, "carrot", Date.now());

		expect(result.ok).toBe(false);
		expect(result.message).toContain("không sở hữu");
	});

	it("chỉ thu hoạch cây đã chín và bán cộng xu theo giá server", () => {
		const player = createInitialPlayer("guest-d", "Gió");
		const now = Date.now();
		player.plots[0].cropType = "tomato";
		player.plots[0].plantedAt = now - CROP_CONFIG.tomato.growMinutes * 60 * 1000 - 1;

		expect(getCropProgress(player.plots[0], now)).toBe(100);
		expect(harvestCrop(player, 0, now).ok).toBe(true);
		expect(player.inventory.tomato).toBe(1);
		expect(sellInventory(player, "tomato").ok).toBe(true);
		expect(player.inventory.tomato).toBe(0);
		expect(player.coins).toBe(80 + CROP_CONFIG.tomato.sellPrice);
	});

	it("chặn thao tác quá nhanh và chống xử lý request hai lần", () => {
		const tracker = new RequestTracker();
		const result = { ok: true, message: "đã xử lý" };
		tracker.remember("request-1", result);

		expect(canPerformAction(1000, 1000 + ACTION_COOLDOWN_MS - 1)).toBe(false);
		expect(canPerformAction(1000, 1000 + ACTION_COOLDOWN_MS)).toBe(true);
		expect(tracker.get("request-1")).toEqual(result);
	});
});
