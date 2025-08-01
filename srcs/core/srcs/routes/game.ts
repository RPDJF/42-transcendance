import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify'
import UsersSdk from '../../../libs/helpers/usersSdk.ts';
import type { UsersSdkAuthorizeResponse } from '../../../libs/helpers/usersSdk.ts';
import Logger from "../../../libs/helpers/loggers.ts";
import { WebSocket } from "ws";
import https from "https";

const usersSdk = new UsersSdk();

async function handleToken(req: FastifyRequest, client: WebSocket) {
	let token: UsersSdkAuthorizeResponse | undefined;
	try {
		token = await usersSdk.enforceAuthorize(req);
	} catch (err) {
		if (err.status === 401) {
			Logger.warn(`WebSocket connection request received without authorization for ${req.url}`);
			client.close(401, JSON.stringify({ error: 'Unauthorized', message: 'You must be logged in to access this resource.' }));
		}
		else if (err.status === 403) {
			Logger.warn(`WebSocket connection request received with forbidden access for ${req.url}`);
			client.close(403, JSON.stringify({ error: 'Forbidden', message: 'You do not have permission to access this resource.' }));
		}
		else {
			Logger.error(`WebSocket connection request received with an error for ${req.url}: ${err.message}`);
			client.close(500, JSON.stringify({ error: 'Internal Server Error', message: 'An error occurred while processing the WebSocket connection.' }));
		}
		return null;
	}
	if (!token) {
		Logger.warn(`WebSocket connection request received with invalid token for ${req.url}`);
		client.close(500, JSON.stringify({ error: 'Internal Server Error', message: 'An error occurred while processing the WebSocket connection.' }));
		return null;
	}
	client.send(JSON.stringify({ message: 'Authorization successful.' }));
	return token;
}

export default async function game_routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
	Logger.info("WebSocket routes loaded");
	fastify.get('/*', { websocket: true }, async (client, request) => {
		const wildcardMatch = request.url.split("/game/")[1] || request.url;
		Logger.info(`WebSocket connection request received on ${request.url} for ${wildcardMatch}`);
		const token = await handleToken(request, client);
		if (!token)
			return;
		const url = new URL(`wss://pong:1337/game/${wildcardMatch}`);
		url.searchParams.delete('userId');
		url.searchParams.append('userId', token.sub);
		const proxySocket = new WebSocket(url, {
			agent: new https.Agent({ rejectUnauthorized: !(process.env.IGNORE_TLS?.toLowerCase() === "true") }),
		});

		proxySocket.on("open", () => {
			Logger.info(`WebSocket connection established with ${request.url}`);
			client.send(JSON.stringify({ message: 'WebSocket connection established.' }));
		});

		client.on("message", async (message) => {
			if (proxySocket.readyState === WebSocket.OPEN) {
				proxySocket.send(message.toString());
			} else {
				Logger.warn('Proxy WebSocket is not open, cannot send message.');
				return;
			}
		});

		proxySocket.on("message", async (message) => {
			if (client.readyState !== WebSocket.OPEN) {
				Logger.warn('Client WebSocket is not open, cannot send message.');
				return;
			}
			client.send(message.toString());
		});

		proxySocket.on("error", (error) => {
			Logger.error(`WebSocket proxy error\n${error}`);
			client.send(JSON.stringify({
				type: "close-socket",
				message: "Proxy closed",
			}));
			client.close(1011, JSON.stringify({ error: 'Internal Server Error', message: 'An error occurred while processing the WebSocket connection.' }));
		});

		client.on("error", (error) => {
			Logger.error(`Client client WebSocket error\n${error}`);
			proxySocket.close(1011, JSON.stringify(error));
		});

		proxySocket.on("close", (code, reason) => {
			if (code === 1006) {
				client.send(JSON.stringify({
					type: "close-socket",
					message: "Proxy closed",
				}));
			}
			if (client.readyState === WebSocket.OPEN)
				client.close();
		});

		client.on("close", (code, reason) => {
			Logger.error(`Client ${token.sub} closed with ${code}: ${reason}`);
			proxySocket.close();
		});

		proxySocket.on("ping", () => client.ping());
		proxySocket.on("pong", () => client.pong());

		client.on("ping", () => proxySocket.ping());
		client.on("pong", () => proxySocket.pong());
	});
}

