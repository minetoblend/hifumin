import {DataSource} from "typeorm";
import {DiscordUser} from "./entities/discordUser.js";
import {Mapper} from "./entities/mapper.js";
import {SnakeNamingStrategy} from 'typeorm-naming-strategies';
import {Card} from "./entities/card.js";
import {CardCondition} from "./entities/cardCondition.js";
import {InventoryEntry} from "./entities/inventoryEntry.js";
import {InventoryItem} from "./entities/inventoryItem.js";
import {WishlistEntry} from "./entities/wishlistEntry.js";
import {CommandTimeout} from "./entities/commandTimeout.js";
import {ShopItem, ShopPrice} from "./entities/shopItem.js";
import {UserEffect} from "./entities/userEffect.js";
import {OptOut} from "./entities/optOut.js";
import {TradeAccept, TradeOffer, TradeSession} from "./entities/tradeSession.js";
import { CardSequence } from "./entities/cardSequence.js";
import { GuildSettings } from "./entities/guildSettings.js";
import { EventLog } from "./entities/eventLog.js";
import { SupportRequest } from "./entities/report.js";
import { JobAssignment } from "./entities/job_assignment.js";

function reportMissingEnv(name: string): never {
    throw new Error(`Missing environment variable: ${name}`)
}

export const db = new DataSource({
	type: "mysql",
	host: process.env.MYSQL_HOST ?? reportMissingEnv("MYSQL_HOST"),
	port: parseInt(process.env.MYSQL_PORT ?? reportMissingEnv("MYSQL_PORT")),
	username: process.env.MYSQL_USER ?? reportMissingEnv("MYSQL_USER"),
	password: process.env.MYSQL_PASSWORD ?? reportMissingEnv("MYSQL_PASSWORD"),
	database: process.env.MYSQL_DATABASE ?? reportMissingEnv("MYSQL_DATABASE"),
	timezone: '+02:00',
	// synchronize: true,
	// logging: true,
	entities: [
		DiscordUser,
		Mapper,
		Card,
		CardCondition,
		InventoryItem,
		InventoryEntry,
		WishlistEntry,
		CommandTimeout,
		ShopItem,
		UserEffect,
		OptOut,
		TradeSession,
		TradeOffer,
		CardSequence,	
		GuildSettings,
		EventLog,
		TradeAccept,
		SupportRequest,
		JobAssignment,
		ShopPrice,
	],
	subscribers: [],
	migrations: [],
	namingStrategy: new SnakeNamingStrategy()
});