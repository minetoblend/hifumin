import './lib/setup.js';

import {LogLevel, SapphireClient} from '@sapphire/framework';
import {GatewayIntentBits} from 'discord.js';
import {db} from "./db.js";
import { Card } from './entities/card.js';
import { IsNull, Not } from 'typeorm';
import { DiscordUser } from './entities/discordUser.js';

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

    setInterval(() => logMetrics(), 15_000)

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

async function logMetrics() {
    const numCards = await db.getRepository(Card).count()
    const numCardsBurned = await db.getRepository(Card).countBy({ burned: true })
    const numCardsOwned = await db.getRepository(Card).countBy({ burned: false, owner: Not(IsNull()) })
    const numUsers = await db.getRepository(DiscordUser).count()

    console.log({
        timestamp: Date.now(),
        cards_total: numCards,
        cards_total_burned: numCardsBurned,
        cards_total_owned: numCardsOwned,
        users_total: numUsers,
    })
}

void main();