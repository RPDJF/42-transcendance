import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { httpReply } from '../../../../libs/helpers/httpResponse.ts';
import { jwt } from '../../managers/JwtManager.ts';
import checkRequestAuthorization from '../../managers/AuthorizationManager.ts';
import axios from 'axios';
import https from 'https';
import DatabaseSDK from '../../../../libs/helpers/databaseSdk.ts';
import FixedSizeMap from '../../../../libs/interfaces/FixedSizeMap.ts'
import * as fs from 'fs';
import path from 'path';

interface TwoFaProps {
	Code: string;
	ClientId: string;
}

export interface TwoFaLogUser {
	Code: string;
	PlayerID: string;
	nbrOfTry: number;
}

export var codeUser = new FixedSizeMap<string, TwoFaLogUser>(500);

const emailPath = path.join(import.meta.dirname, '/email.html');
export const template = fs.readFileSync(emailPath, 'utf8');

export default async function twoFaReceiptEndpoint(app: FastifyInstance, opts: FastifyPluginOptions) {
	app.post('/2fa', async (request, reply) => {
		const authorization = checkRequestAuthorization(request, reply);
		if (authorization)
			return authorization;

		const body = request.body as TwoFaProps;
		const client: TwoFaLogUser | undefined = codeUser.get(body.ClientId);

		if (client === undefined)
			return reply.code(404).send("No 2fa code associated with this ClientID");
		if (client?.nbrOfTry >= 3) {
			return httpReply({
				detail: "Too much retry",
				status: 401,
				module: "usermanager",
			}, reply, request);
		}

		client.nbrOfTry++;
		if (codeUser.get(body.ClientId)?.Code !== body.Code)
			return httpReply({
				detail: "Invalid 2fa code",
				status: 401,
				module: "usermanager",
			}, reply, request);

		const user: string | undefined = codeUser.get(body.ClientId)?.PlayerID;
		if (user === undefined)
			return httpReply({
				detail: `Invalid undefiend PlayerId with '${body.ClientId}' client id`,
				status: 401,
				module: "usermanager",
			}, reply, request);

		const db_sdk = new DatabaseSDK();

		let loggedUser = (await db_sdk.get_user(user, "PlayerID")).data;
		const jwtToken = jwt.createJwtToken({
			sub: loggedUser.PlayerID,
			data: {
				DisplayName: loggedUser.DisplayName,
				EmailAddress: loggedUser.EmailAddress,
			},
		});
		return reply.status(200).send({ token: jwtToken.token, ...jwtToken.payload });
	});
}
