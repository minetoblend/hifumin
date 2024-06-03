import {DiscordUser} from "../entities/discordUser.js";
import {db} from "../db.js";
import {DataSource} from "typeorm";
import {EntityManager} from "typeorm/entity-manager/EntityManager.js";
import {InventoryEntry} from "../entities/inventoryEntry.js";

export class ItemService {

    static async getItemCount(
        user: DiscordUser,
        itemId: string,
        tx: DataSource | EntityManager = db
    ) {
        const result = await tx.getRepository(InventoryEntry).findOne({
            where: {
                user: {
                    id: user.id
                },
                item: {
                    id: itemId
                }
            }
        })

        return result?.amount ?? 0
    }

    static async changeItemCount(
        user: DiscordUser,
        itemId: string,
        amount: number,
        tx: EntityManager
    ) {
        const repository = tx.getRepository(InventoryEntry)
        const result = await repository.findOne({
            where: {
                user: {
                    id: user.id
                },
                item: {
                    id: itemId
                }
            }
        })

        amount = Math.floor(amount)

        if((result?.amount ?? 0) + amount < 0) {
            throw new Error('Insufficient items')
        }

        if(result) {
            await repository.update(result, {
                amount: () => 'amount + ' + amount
            })
        } else {
            await repository.insert({
                user,
                item: {
                    id: itemId
                },
                amount: amount
            })
        }


        return result?.amount ?? 0
    }

}