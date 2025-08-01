import fastify, { type FastifyRequest } from "fastify";
import fastifyWebsocket, { type WebSocket } from "@fastify/websocket";
import RoomManager from "../game/classes/RoomManager.ts";
import PlayerSession from "../game/classes/PlayerSession.ts";
import Ball from "../game/classes/Ball.ts";
import Game from "../game/classes/GameClass.ts";
import GameRoom from "../game/classes/GameRoom.ts";
import TournamentManager from "../game/classes/TournamentManager.ts";
import { pingResponse } from "../game/helpers/pingResponse.ts";

interface GameWsQuery {
	userId: string;
	roomId?: string;
}

interface payload {
	direction?: string;
	value?: number;
}

interface ClientMessage {
	type: string;
	payload?: payload;
}

interface CreateWsHandlerParams {
	mode:
	| "remote"
	| "friend_host"
	| "friend_join"
	| "local"
	| "computer"
	| "tournament";
	manager: RoomManager | TournamentManager;
}

export function createWsHandler({ mode, manager }: CreateWsHandlerParams) {
	return (
		socket: WebSocket,
		req: FastifyRequest<{ Querystring: GameWsQuery }>
	) => {
		const query = req.query;

		console.log(`User ID: ${query.userId}`);

		if (!query.userId) {
			socket.send(
				JSON.stringify({ type: "403", message: "Unauthorized user" })
			);
			socket.close();
			return;
		}

		if (manager.getSession(query.userId)) {
			socket.send(
				JSON.stringify({
					type: "ignored",
					message: "Already in an active session",
				})
			);
			socket.close();
			return;
		}

		let session: PlayerSession;

		if (mode === "friend_join") {
			if (!query.roomId) {
				socket.send(JSON.stringify({ type: "400", message: "Missing roomId" }));
				socket.close();
				return;
			}

			session = manager.assignPlayer(socket, {
				userId: query.userId,
				mode,
				roomId: query.roomId,
			});
		} else if (mode === "computer") {
			session = manager.assignPlayer(socket, {
				userId: query.userId,
				mode: "computer",
			});
		} else if (mode === "tournament") {
			session = new PlayerSession(socket, query.userId);
			(manager as TournamentManager).assignTournamentPlayer(session);
		} else if (mode === "local") {
			session = manager.assignPlayer(socket, {
				userId: query.userId,
				mode: "local"
			});
		} else if (mode === "friend_host") {
			session = manager.assignPlayer(socket, {
				userId: query.userId,
				mode: "friend_host",
			});
		} else {
			session = manager.assignPlayer(socket, {
				userId: query.userId,
				mode: "remote",
			});
		}

		console.log(
			`Player connected to room ${session.getRoom()?.id} as ${query.userId}`
		);

		socket.on("message", (msg) => {
			if (msg.toString() === "ping!") {
				socket.send("pong!");
				return;
			}
			try {
				const { type, payload }: ClientMessage = JSON.parse(msg.toString());
				if (
					type === "ball" &&
					payload?.direction &&
					payload.direction == "launch"
				) {
					let ball: Ball | undefined = session.getRoom()?.getGame().getBall();
					ball?.launch();
				} else if (type === "move" && payload?.direction) {
					const paddle = session.getPaddle();

					if (paddle) {
						if (payload.direction === "up" || payload.direction === "down") {
							paddle.setMoveDirection(payload.direction);
						} else if (payload.direction === "stop") {
							paddle.setMoveDirection(null);
						}
					}
				} else if (type === "disconnect") {
					socket.close();
				} else if (type === "pingRequest") {
					pingResponse(session, mode, payload?.value);
				} else if (mode === "local" && type === "move2" && payload?.direction) {
					const room = session.getRoom();
					if (room) {
						const p2Paddle = room.players[1].getPaddle();
						if (p2Paddle) {
							if (payload.direction === "up" || payload.direction === "down") {
								p2Paddle.setMoveDirection(payload.direction);
							} else if (payload.direction === "stop") {
								p2Paddle.setMoveDirection(null);
							}
						}
					}
				}
			} catch (err) {
				console.error("Invalid message from client:", err);
			}
		});

		socket.on("close", () => {
			console.log(`User: ${query.userId} disconnected.`);
			manager.removeSession(session);
		});
	};
}
