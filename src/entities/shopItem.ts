import {Column, Entity, JoinColumn, ManyToOne, PrimaryColumn} from "typeorm";
import {InventoryItem} from "./inventoryItem.js";

@Entity('shop_item')
export class ShopItem {
    @PrimaryColumn('varchar', { length: 32})
    id!: string;

    @Column('varchar', { length: 64 })
    name!: string;

    @ManyToOne(() => InventoryItem, { nullable: false})
    @JoinColumn({ name: 'item_id'})
    item!: InventoryItem;

    @Column('int')
    price!: number;
}