import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity('discord_user')
export class DiscordUser {
    @PrimaryColumn('bigint', {unsigned: true})
    id!: string;
    @Column({type: 'varchar', length: 32})
    username!: string;
    @Column({type: 'boolean', default: false, nullable: false})
    reminderEnabled!: boolean;
    @Column({type: 'boolean', default: false, nullable: false})
    gamblingWarningShown!: boolean;
}