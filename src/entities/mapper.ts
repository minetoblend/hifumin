import {Column, Entity, OneToMany, PrimaryColumn} from "typeorm";
import {WishlistEntry} from "./wishlistEntry.js";

@Entity('mapper')
export class Mapper {
    @PrimaryColumn('int')
    id!: number;
    @Column({type: 'varchar', length: 32, nullable: false})
    username!: string;
    @Column({type: 'varchar', length: 255, nullable: false})
    avatarUrl!: string;
    @Column({type: 'int', nullable: false})
    rarity!: number;
    @OneToMany(() => WishlistEntry, entry => entry.mapper)
    wishlistEntries!: typeof WishlistEntry[];
}