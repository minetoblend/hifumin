import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity('inventory_item')
export class InventoryItem {
    @PrimaryColumn('varchar', {length: 32})
    id!: string;

    @Column('varchar', {length: 32, nullable: false})
    name!: string;

    @Column('int', {nullable: true})
    order!: number | null;

    @Column('varchar', {length: 128})
    icon!: string | null;
}