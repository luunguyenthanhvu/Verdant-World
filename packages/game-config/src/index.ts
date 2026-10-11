export const PLOT_COUNT = 12;
export const PLAYER_SPEED = 150;
export const DEFAULT_COINS = 80;
export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;

export type CropType = "carrot" | "tomato" | "corn";
export const CROP_TYPES: CropType[] = ["carrot", "tomato", "corn"];

export interface CropConfig {
	name: string;
	seedCost: number;
	sellPrice: number;
	growMinutes: number;
	color: number;
	icon: string;
}

export const CROP_CONFIG: Record<CropType, CropConfig> = {
	carrot: {
		name: "Cà rốt",
		seedCost: 12,
		sellPrice: 26,
		growMinutes: 2,
		color: 0xf28c28,
		icon: "🥕",
	},
	tomato: {
		name: "Cà chua",
		seedCost: 18,
		sellPrice: 36,
		growMinutes: 3,
		color: 0xe64a45,
		icon: "🍅",
	},
	corn: {
		name: "Bắp",
		seedCost: 24,
		sellPrice: 58,
		growMinutes: 4,
		color: 0xf4d35e,
		icon: "🌽",
	},
};

export const DEFAULT_SEEDS: Record<CropType, number> = {
	carrot: 4,
	tomato: 3,
	corn: 2,
};

export const DEFAULT_INVENTORY: Record<CropType, number> = {
	carrot: 0,
	tomato: 0,
	corn: 0,
};

export function isCropType(value: unknown): value is CropType {
	return typeof value === "string" && CROP_TYPES.includes(value as CropType);
}

export function getPlotWorldPosition(index: number): { x: number; y: number } {
	const col = index % 4;
	const row = Math.floor(index / 4);
	return {
		x: 140 + col * 105,
		y: 245 + row * 82,
	};
}
