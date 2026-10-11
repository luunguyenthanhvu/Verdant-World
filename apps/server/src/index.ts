import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./room.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 2567);
const configuredOrigins = (process.env.CLIENT_URL ?? "http://localhost:5173")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

app.use(
	cors({
		credentials: true,
		origin: (origin, callback) => {
			if (!origin || configuredOrigins.includes("*") || configuredOrigins.includes(origin)) {
				callback(null, true);
				return;
			}
			callback(new Error("Origin không được phép."));
		},
	}),
);
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
	res.json({
		ok: true,
		service: "mocgioi-online-server",
		databaseConfigured: Boolean(process.env.DATABASE_URL),
		timestamp: Date.now(),
	});
});

const gameServer = new Server({
	transport: new WebSocketTransport({ server: createServer(app) }),
});

gameServer.define("mocgioi-room", GameRoom);

void Promise.resolve(gameServer.listen(port)).then(() => {
	console.log(`Mộc Giới Online server đang chạy tại cổng ${port}.`);
});
