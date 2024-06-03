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
import {ShopItem} from "./entities/shopItem.js";
import {UserEffect} from "./entities/userEffect.js";
import {OptOut} from "./entities/optOut.js";
import {TradeOffer, TradeSession} from "./entities/tradeSession.js";

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
    // synchronize: true,
    // logging: true,
    entities: [DiscordUser, Mapper, Card, CardCondition, InventoryItem, InventoryEntry, WishlistEntry, CommandTimeout, ShopItem, UserEffect, OptOut, TradeSession, TradeOffer],
    subscribers: [],
    migrations: [],
    namingStrategy: new SnakeNamingStrategy()
})
