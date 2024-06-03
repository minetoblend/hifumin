import {Column, Entity, PrimaryColumn} from "typeorm";
import {TimeoutType} from "../services/timeout.js";

@Entity('command_timeout')
export class CommandTimeout {
    @PrimaryColumn('bigint', { unsigned: true })
    userId!: string;

    @PrimaryColumn('varchar', { name: 'command', length: 10 })
    type!: TimeoutType;

    @Column('datetime', { name: 'last_used'})
    lastUsed!: Date;
}