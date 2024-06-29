import './lib/setup.js';

import {LogLevel, SapphireClient} from '@sapphire/framework';
import {GatewayIntentBits} from 'discord.js';
import {db} from "./db.js";

const client = new SapphireClient({
    defaultPrefix: '!',
    caseInsensitiveCommands: true,
    logger: {
        level: LogLevel.Debug
    },
    intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
    loadMessageCommandListeners: true
});

const main = async () => {
    await db.initialize()

    try {
        client.logger.info('Logging in');
        await client.login();
        client.logger.info('logged in');

        console.log(client.guilds.cache.keys(), client.guilds.cache.size)
    } catch (error) {
        client.logger.fatal(error);
        await client.destroy();
        process.exit(1);
    }
};

void main();