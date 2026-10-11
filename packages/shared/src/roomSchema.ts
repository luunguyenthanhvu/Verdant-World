import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class InventorySchema extends Schema {
	@type("number") carrot = 0;
	@type("number") tomato = 0;
	@type("number") corn = 0;
}

export class PlotSchema extends Schema {
	@type("number") id = 0;
	@type("string") ownerId = "";
	@type("string") cropType = "";
	@type("number") plantedAt = 0;
	@type("boolean") watered = false;
	@type("number") growth = 0;
	@type("string") status = "empty";
}

export class PlayerSchema extends Schema {
	@type("string") id = "";
	@type("string") nickname = "";
	@type("number") x = 455;
	@type("number") y = 145;
	@type("number") coins = 80;
	@type(InventorySchema) seeds = new InventorySchema();
	@type(InventorySchema) inventory = new InventorySchema();
	@type([PlotSchema]) plots = new ArraySchema<PlotSchema>();
	@type("number") lastActionAt = 0;
}

export class GameState extends Schema {
	@type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}
