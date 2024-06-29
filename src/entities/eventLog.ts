import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { DiscordUser } from './discordUser.js';

@Entity('event_log')
export class EventLog {
	@PrimaryColumn('int')
	id!: number;
	@Column('datetime')
	timestamp!: Date;
	@ManyToOne(() => DiscordUser, { nullable: false })
	user!: DiscordUser;
	@Column({ type: 'varchar', length: 32, nullable: false })
	username!: string;
	@Column({ type: 'varchar', length: 32, nullable: false })
	action!: string;
	@Column({ type: 'json', nullable: true })
	info: any = {};
}
