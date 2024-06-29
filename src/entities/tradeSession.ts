import {Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn} from "typeorm";
import {DiscordUser} from "./discordUser.js";
import {Card} from "./card.js";
import {InventoryItem} from "./inventoryItem.js";

@Entity('trade_session')
export class TradeSession {
    @PrimaryGeneratedColumn('increment', {type: 'int'})
    id!: number;

    @ManyToOne(() => DiscordUser, {eager: true, nullable: false})
    @JoinColumn({name: 'user1_id'})
    user1!: DiscordUser

    @ManyToOne(() => DiscordUser, {eager: true, nullable: false})
    @JoinColumn({name: 'user2_id'})
    user2!: DiscordUser

    @OneToMany(() => TradeOffer, tradeOffer => tradeOffer.tradeSession, {
        onDelete: 'CASCADE',
    })
    offers!: TradeOffer[]

    @Column({ type: 'varchar', length: 20, nullable: false })
    channelID!: string

    @UpdateDateColumn({ type: 'datetime', nullable: false })
    lastUpdated!: Date

    @Column({ type: 'int', nullable: false, default: 0 })
    version!: number
}

@Entity('trade_offer')
export class TradeOffer {
    @PrimaryGeneratedColumn('increment', {type: 'int'})
    id!: number;

    @ManyToOne(() => TradeSession, {eager: true, nullable: false})
    @JoinColumn({name: 'trade_session_id'})
    tradeSession!: TradeSession

    @ManyToOne(() => DiscordUser, {eager: true, nullable: false})
    @JoinColumn({name: 'user_id'})
    user!: DiscordUser

    @Column({type: 'varchar', length: 10, nullable: false})
    type!: 'card' | 'item'

    @ManyToOne(() => Card, {eager: true, nullable: true})
    @JoinColumn({name: 'card_id'})
    card!: Card | null

    @ManyToOne(() => InventoryItem, {eager: true, nullable: true})
    @JoinColumn({name: 'item_id'})
    item!: InventoryItem | null

    @Column({type: 'int', nullable: false})
    quantity!: number
}

@Entity('trade_accept')
export class TradeAccept {
    @PrimaryGeneratedColumn('increment', {type: 'int'})
    id!: number;

    @ManyToOne(() => TradeSession, {nullable: false, onDelete: 'CASCADE'})
    @JoinColumn({name: 'trade_session_id'})
    tradeSession!: TradeSession

    @ManyToOne(() => DiscordUser, {nullable: false})
    @JoinColumn({name: 'user_id'})
    user!: DiscordUser

    @Column({ type: 'int', nullable: false })
    @Index()
    version!: number
}