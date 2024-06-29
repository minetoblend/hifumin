import {CommandTimeout} from "../entities/commandTimeout.js";
import {DiscordUser} from "../entities/discordUser.js";
import {UserEffect} from "../entities/userEffect.js";
import {ItemService} from "./itemService.js";
import {EntityManager} from "typeorm/entity-manager/EntityManager.js";

export const enum TimeoutType {
    Drop = 'DROP',
    Claim = 'CLAIM',
    Daily = 'DAILY'
}

export async function getTimeout(
    user: DiscordUser,
    type: TimeoutType,
    tx: EntityManager,
) {
    const timeout = await tx.getRepository(CommandTimeout)
        .findOne({
            where: {
                userId: user.id,
                type,
            },
            lock: {
                mode: 'pessimistic_write'
            }
        })

    let multiplier = 1
    let hasItem = false

    switch (type) {
        case TimeoutType.Drop: {
            const effect = await tx.getRepository(UserEffect).findOne({
                where: {
                    userId: user.id,
                    effect: 'drop speedup'
                }
            })
            if (effect && effect.activeUntil > new Date()) {
                multiplier = 0.5
            }
            break;
        }
        case TimeoutType.Claim: {
            const effect = await tx.getRepository(UserEffect).findOne({
                where: {
                    userId: user.id,
                    effect: 'claim speedup'
                }
            })
            if (effect && effect.activeUntil > new Date()) {
                multiplier = 0.5
            }
            const item = await ItemService.getItemCount(user, 'free claim')
            if (item > 0) {
                hasItem = true
            }

            break;
        }
    }


    return {
        get expired() {
            return this.remainingTime > 0;
        },
        get remainingTime() {
            const time = this.actualRemainingTime;

            if (hasItem) {
                return 0
            }

            return time
        },
        get actualRemainingTime() {
            if (!timeout) return 0;

            let duration: number = 0

            switch (type) {
                case TimeoutType.Drop:
                    duration = 60 * 30 * 1000;
                    break;
                case TimeoutType.Claim:
                    duration = 60 * 10 * 1000
                    break;
                case TimeoutType.Daily:
                    // resets daily at 00:00

                    const lastUsed = timeout.lastUsed
                    lastUsed.setHours(0, 0, 0, 0)

                    const now = new Date()
                    now.setHours(0, 0, 0, 0)

                    if(now.getTime() > lastUsed.getTime()) {
                        return 0
                    }

                    return 24 * 60 * 60 * 1000 - (Date.now() - timeout.lastUsed.getTime())

                    break;
            }

            duration *= multiplier

            return duration - (Date.now() - timeout.lastUsed.getTime())
        },
        async consume() {
            if (this.expired) {
                throw new Error('Timeout expired');
            }

            if (hasItem && this.actualRemainingTime > 0) {
                const item = await ItemService.getItemCount(user, 'free claim')
                if (item <= 0) {
                    throw new Error('Insufficient items')
                }

                await ItemService.changeItemCount(user, 'free claim', -1, tx)

            } else {
                const timeout = new CommandTimeout();
                timeout.userId = user.id;
                timeout.type = type;
                timeout.lastUsed = new Date();

                await tx.getRepository(CommandTimeout)
                    .save(timeout)
            }
        }
    }
}