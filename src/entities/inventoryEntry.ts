import {Column, Entity, JoinColumn, ManyToOne, PrimaryColumn} from "typeorm";
import {DiscordUser} from "./discordUser.js";
import {InventoryItem} from "./inventoryItem.js";

@Entity('inventory_entry')
export class InventoryEntry {
    @PrimaryColumn('bigint', {name: 'user_id', unsigned: true})
    userId!: string;

    @PrimaryColumn('varchar', {name: 'item_id', length: 32})
    itemId!: string;

    @ManyToOne(() => DiscordUser, {nullable: false})
    @JoinColumn({name: 'user_id'})
    user!: DiscordUser;

    @ManyToOne(() => InventoryItem, {nullable: false, eager: true})
    @JoinColumn({name: 'item_id'})
    item!: InventoryItem;

    @Column('int', {nullable: false})
    amount!: number;
}