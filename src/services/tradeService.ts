import {TradeOffer, TradeSession} from "../entities/tradeSession.js";
import {DiscordUser} from "../entities/discordUser.js";
import {db} from "../db.js";
import {DataSource} from "typeorm";
import {EntityManager} from "typeorm/entity-manager/EntityManager.js";
import {Card} from "../entities/card.js";
import {InventoryItem} from "../entities/inventoryItem.js";
import {ItemService} from "./itemService.js";

export class TradeService {

    static async startSession(user1: DiscordUser, user2: DiscordUser, confirmTrade?: () => Promise<boolean>): Promise<TradeSession | null> {
        if (user1.id === user2.id) {
            throw new Error('Cannot trade with yourself');
        }

        return await db.transaction('SERIALIZABLE', async (tx) => {
            const repo = tx.getRepository(TradeSession)

            if (await this.getActiveSession(user1, tx)) {
                throw new Error('You are already in a trade session');
            }

            if (await this.getActiveSession(user2, tx)) {
                throw new Error('The other user is already in a trade session');
            }

            if (confirmTrade) {
                if (!await confirmTrade()) {
                    return null
                }
            }

            return await repo.save({
                user1,
                user2,
            });
        })
    }

    static async getActiveSession(user: DiscordUser, tx: DataSource | EntityManager = db) {
        return tx.getRepository(TradeSession)
            .createQueryBuilder('trade_session')
            .leftJoinAndSelect('trade_session.user1', 'user1')
            .leftJoinAndSelect('trade_session.user2', 'user2')
            .leftJoinAndSelect('trade_session.offers', 'offers')
            .leftJoinAndSelect('offers.card', 'card')
            .leftJoinAndSelect('card.owner', 'owner')
            .where('user1.id = :user_id OR user2.id = :user_id', {user_id: user.id})
            .getOne();
    }

    static async cancelSession(
        user: DiscordUser,
    ) {
        await db.transaction('SERIALIZABLE', async (tx) => {
            const session = await this.getActiveSession(user, tx);
            if (!session) {
                throw new Error('No active trade session found');
            }
            if (session.user1.id !== user.id && session.user2.id !== user.id) {
                throw new Error('You are not part of this trade session');
            }
            await tx.getRepository(TradeSession).remove(session);
        })
    }

    static async addCard(
        user: DiscordUser,
        cardId: string,
    ) {
        await db.transaction('SERIALIZABLE', async (tx) => {
            const card = (await tx.getRepository(Card).findOne({
                where: {
                    id: cardId
                }
            }))!;

            if (card.burned) {
                throw new Error('This card has been burned');
            }
            if (card.owner?.id !== user.id) {
                throw new Error('You do not own this card');
            }

            const session = await this.getActiveSession(user, tx);
            if (!session) {
                throw new Error('No active trade session found');
            }
            if (session.user1.id !== user.id && session.user2.id !== user.id) {
                throw new Error('You are not part of this trade session');
            }

            if (await tx
                .getRepository(TradeOffer)
                .existsBy({
                    tradeSession: session,
                    type: 'card',
                    card: card,
                    user: user,
                })
            ) {
                throw new Error('You have already added this card to the trade session');
            }


            const offer = await tx.getRepository(TradeOffer).save({
                tradeSession: session,
                user: user,
                type: 'card',
                card: card,
                item: null,
                quantity: 1,
            })

            session.offers.push(offer)
        })
    }

    static async removeCard(
        user: DiscordUser,
        card: Card,
    ) {
        await db.transaction('SERIALIZABLE', async (tx) => {
            card = (await tx.getRepository(Card).findOne({
                where: {
                    id: card.id
                }
            }))!;

            const session = await this.getActiveSession(user, tx);
            if (!session) {
                throw new Error('No active trade session found');
            }
            if (session.user1.id !== user.id && session.user2.id !== user.id) {
                throw new Error('You are not part of this trade session');
            }

            return !!(
                await tx
                    .getRepository(TradeOffer)
                    .delete({
                        user: user,
                        tradeSession: session,
                        card: card,
                        type: 'card',
                    })
            ).affected
        })
    }

    static async addItem(
        user: DiscordUser,
        itemId: string,
        quantity: number,
    ) {
        if (quantity <= 0)
            throw new Error('Quantity must be greater than 0');

        await db.transaction('SERIALIZABLE', async (tx) => {
            const item = (await tx.getRepository(InventoryItem).findOne({
                where: {
                    id: itemId
                }
            }))!;

            if (!item) {
                throw new Error('Item not found');
            }

            const ownedItemCount = await ItemService.getItemCount(user, item.id, tx);

            if (ownedItemCount < quantity) {
                throw new Error('You do not have enough of this item');
            }

            const session = await this.getActiveSession(user, tx);
            if (!session) {
                throw new Error('No active trade session found');
            }
            if (session.user1.id !== user.id && session.user2.id !== user.id) {
                throw new Error('You are not part of this trade session');
            }

            const existing = await tx
                .getRepository(TradeOffer)
                .findOne({
                    where: {
                        tradeSession: session,
                        user: user,
                        type: 'item',
                        item: item,
                    },
                });

            if (existing) {
                await tx.getRepository(TradeOffer).update({
                    id: existing.id
                }, {
                    quantity: existing.quantity + quantity
                });
            } else {
                await tx.getRepository(TradeOffer).save({
                    tradeSession: session,
                    user: user,
                    type: 'item',
                    card: null,
                    item: item,
                    quantity: quantity,
                })
            }
        })
    }

    static removeItem(
        user: DiscordUser,
        item: InventoryItem,
        quantity?: number,
    ) {
        return db.transaction('SERIALIZABLE', async (tx) => {
            const session = await this.getActiveSession(user, tx);
            if (!session) {
                throw new Error('No active trade session found');
            }
            if (session.user1.id !== user.id && session.user2.id !== user.id) {
                throw new Error('You are not part of this trade session');
            }

            const offer = await tx.getRepository(TradeOffer).findOne({
                where: {
                    tradeSession: session,
                    user: user,
                    type: 'item',
                    item: item,
                },
            });

            if (!offer) {
                throw new Error('You have not added this item to the trade session');
            }

            if (quantity && offer.quantity < quantity) {
                throw new Error('You cannot remove more items than you have added');
            }

            if (quantity && offer.quantity > quantity) {
                await tx.getRepository(TradeOffer).update({
                    id: offer.id
                }, {
                    quantity: offer.quantity - quantity
                });
            } else {
                await tx.getRepository(TradeOffer).delete({
                    id: offer.id
                });
            }
        })
    }

    static async executeTrade(
        trade: TradeSession,
    ) {
        return db.transaction('SERIALIZABLE', async (tx) => {
            trade = (await tx.getRepository(TradeSession).findOne({
                where: {
                    id: trade.id
                },
                relations: ['offers', 'offers.card', 'offers.item', 'offers.user']
            }))!

            if (!trade) {
                throw new Error('No active trade session found');
            }

            const user1 = trade.user1;
            const user2 = trade.user2;

            for (const offer of trade.offers) {
                if (offer.type === 'card') {
                    if (offer.card?.owner?.id !== offer.user.id) {
                        throw new Error('Card ownership has changed');
                    }
                } else {
                    const ownedItemCount = await ItemService.getItemCount(offer.user, offer.item!.id, tx);
                    if (ownedItemCount < offer.quantity) {
                        throw new Error('Item ownership has changed');
                    }
                }
            }

            for (const offer of trade.offers) {
                const newOwner = offer.user === user1 ? user2 : user1;
                const oldOwner = offer.user === user1 ? user1 : user2;

                if (offer.type === 'card') {
                    await tx.getRepository(Card).update({
                        id: offer.card!.id
                    }, {
                        owner: newOwner
                    })
                } else {
                    await ItemService.changeItemCount(oldOwner, offer.item!.id, -offer.quantity, tx)
                    await ItemService.changeItemCount(newOwner, offer.item!.id, offer.quantity, tx)
                }
            }

            await tx.getRepository(TradeSession).remove(trade);
        })
    }
}