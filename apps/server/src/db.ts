import { Prisma, PrismaClient } from "@prisma/client";
import {
	createInitialPlayer,
	type CropInventory,
	type PlayerState,
	type PlotState,
} from "@mocgioi/shared";

export const prisma = new PrismaClient();

function numberOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readInventory(value: unknown, fallback: CropInventory): CropInventory {
	const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
	return {
		carrot: Math.max(0, Math.floor(numberOr(record.carrot, fallback.carrot))),
		tomato: Math.max(0, Math.floor(numberOr(record.tomato, fallback.tomato))),
		corn: Math.max(0, Math.floor(numberOr(record.corn, fallback.corn))),
	};
}

function readPlots(value: unknown, guestId: string): PlotState[] | null {
	if (!Array.isArray(value) || value.length !== 12) return null;
	return value.map((raw, index) => {
		const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
		const cropType = record.cropType === "carrot" || record.cropType === "tomato" || record.cropType === "corn"
			? record.cropType
			: null;
		return {
			id: index,
			ownerId: guestId,
			cropType,
			plantedAt: numberOr(record.plantedAt, 0),
			watered: record.watered === true,
			growth: Math.min(100, Math.max(0, numberOr(record.growth, 0))),
			status: cropType && record.status === "ready" ? "ready" : cropType ? "planted" : "empty",
		};
	});
}

export async function loadGuestSave(guestId: string): Promise<PlayerState | null> {
	if (!process.env.DATABASE_URL) return null;

	const record = await prisma.guestSave.findUnique({ where: { guestId } });
	if (!record) return null;

	const fallback = createInitialPlayer(guestId, record.nickname);
	return {
		...fallback,
		nickname: record.nickname,
		x: numberOr(record.x, fallback.x),
		y: numberOr(record.y, fallback.y),
		coins: Math.max(0, Math.floor(numberOr(record.coins, fallback.coins))),
		seeds: readInventory(record.seeds, fallback.seeds),
		inventory: readInventory(record.inventory, fallback.inventory),
		plots: readPlots(record.plots, guestId) ?? fallback.plots,
		lastActionAt: record.updatedAt.getTime(),
	};
}

export async function saveGuestSave(player: PlayerState): Promise<void> {
	if (!process.env.DATABASE_URL) return;

	const seeds = player.seeds as unknown as Prisma.InputJsonValue;
	const inventory = player.inventory as unknown as Prisma.InputJsonValue;
	const plots = player.plots as unknown as Prisma.InputJsonValue;

	await prisma.guestSave.upsert({
		where: { guestId: player.id },
		update: {
			nickname: player.nickname,
			coins: player.coins,
			seeds,
			inventory,
			plots,
			x: player.x,
			y: player.y,
		},
		create: {
			guestId: player.id,
			nickname: player.nickname,
			coins: player.coins,
			seeds,
			inventory,
			plots,
			x: player.x,
			y: player.y,
		},
	});
}
