import {
	CROP_CONFIG,
	CROP_TYPES,
	DEFAULT_COINS,
	DEFAULT_INVENTORY,
	DEFAULT_SEEDS,
	PLOT_COUNT,
	type CropType,
} from "@mocgioi/game-config";

export type PlotStatus = "empty" | "planted" | "ready";

export interface PlotState {
	id: number;
	ownerId: string | null;
	cropType: CropType | null;
	plantedAt: number;
	watered: boolean;
	growth: number;
	status: PlotStatus;
}

export interface CropInventory {
	carrot: number;
	tomato: number;
	corn: number;
}

export interface PlayerState {
	id: string;
	nickname: string;
	x: number;
	y: number;
	coins: number;
	seeds: CropInventory;
	inventory: CropInventory;
	plots: PlotState[];
	lastActionAt: number;
}

export type ActionType = "buy-seed" | "plant" | "water" | "harvest" | "sell";

export interface ActionMessage {
	type: ActionType;
	plotId?: number;
	cropType?: CropType;
	requestId?: string;
}

export const createInitialPlot = (id: number, ownerId: string | null = null): PlotState => ({
	id,
	ownerId,
	cropType: null,
	plantedAt: 0,
	watered: false,
	growth: 0,
	status: "empty",
});

export const createInitialPlayer = (
	id: string,
	nickname: string,
): PlayerState => ({
	id,
	nickname,
	x: 455,
	y: 145,
	coins: DEFAULT_COINS,
	seeds: { ...DEFAULT_SEEDS },
	inventory: { ...DEFAULT_INVENTORY },
	plots: Array.from({ length: PLOT_COUNT }, (_, index) =>
		createInitialPlot(index, id),
	),
	lastActionAt: 0,
});

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function getCropProgress(plot: PlotState, now: number): number {
	if (!plot.cropType || plot.plantedAt <= 0) {
		return 0;
	}

	const config = CROP_CONFIG[plot.cropType];
	const effectiveGrowMs =
		config.growMinutes * 60 * 1000 * (plot.watered ? 0.8 : 1);
	const elapsed = Math.max(0, now - plot.plantedAt);
	return clamp((elapsed / effectiveGrowMs) * 100, 0, 100);
}

export function derivePlotStatus(plot: PlotState, now: number): PlotStatus {
	if (!plot.cropType) {
		return "empty";
	}

	const progress = getCropProgress(plot, now);
	return progress >= 100 ? "ready" : "planted";
}

export function refreshPlotState(plot: PlotState, now: number): void {
	plot.growth = getCropProgress(plot, now);
	plot.status = derivePlotStatus(plot, now);
}

export function formatInventory(inventory: CropInventory): string {
	return CROP_TYPES.map(
		(cropType) => `${CROP_CONFIG[cropType].icon} ${inventory[cropType] ?? 0}`,
	).join(" · ");
}

export function createEmptyInventory(): CropInventory {
	return { ...DEFAULT_INVENTORY };
}

export * from "./roomSchema.js";
