import { BeforeInsert, BeforeUpdate, Column, Entity, Generated, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Mapper } from './mapper.js';
import { DiscordUser } from './discordUser.js';
import { CardCondition } from './cardCondition.js';

@Entity('card')
export class Card {
	@PrimaryColumn('char', { length: 4 })
	id!: string;

	@ManyToOne(() => Mapper, { eager: false, nullable: false })
	@JoinColumn({ name: 'mapper_id' })
	mapper!: Mapper;

	@ManyToOne(() => DiscordUser, { eager: false, nullable: true })
	@JoinColumn({ name: 'owner_id' })
	owner?: DiscordUser;

	@ManyToOne(() => DiscordUser, { eager: false, nullable: false })
	@JoinColumn({ name: 'dropped_by_id' })
	droppedBy!: DiscordUser;

	@ManyToOne(() => DiscordUser, { eager: false, nullable: true })
	@JoinColumn({ name: 'claimed_by_id' })
	claimedBy!: DiscordUser;

	@Column({ type: 'varchar', length: 30 })
	username!: string;

	@Column({ type: 'varchar', length: 255 })
	avatarUrl!: string;

	@Column({ type: 'datetime' })
	createdAt!: Date;

	@ManyToOne(() => CardCondition, { eager: false, nullable: false })
	@JoinColumn({ name: 'condition' })
	condition!: CardCondition;

	@Column('boolean', { default: false, nullable: false })
	burned!: boolean;

	@Column('boolean', { default: false, nullable: false })
	foil!: boolean;

	@Column('int', { name: 'frame_id', nullable: true })
	frameId!: number;

	@Column('int', { name: 'burn_value', default: 0, nullable: false })
	burnValue!: number;

	@Column('int', { name: 'job_base_effort', default: 0, nullable: false })
	jobBaseEffort!: number;

	@Column('int', { name: 'job_motivation', default: 7, nullable: false })
	jobMotivation!: number;

	@Column('datetime', { name: 'job_mindblocked_until', nullable: true })
	jobMindblockedUntil!: Date | null;

	@BeforeInsert()
	@BeforeUpdate()
	calculateBurnValue() {
		let value = this.mapper.rarity * this.condition.multiplier * 5;

		if (this.foil) {
			value = value * 2;
		}

		this.burnValue = Math.ceil(value);
	}

	get dustValue() {
		return Math.ceil(this.mapper.rarity * 0.1);
	}

	get dustType(): string {
		return {
			BadlyDamaged: 'damaged dust',
			Poor: 'poor dust',
			Good: 'good dust',
			Mint: 'mint dust'
		}[this.condition.id]!;
	}

	get attributes() {
		const attributes: string[] = [];

		if (this.foil) attributes.push('Foil');

		return attributes;
	}

	get jobEffort() {
		return Math.round(
			this.jobBaseEffort * this.jobMotivation * 0.1 * (this.jobMindblocked ? 0.5 : 1)
		)
	}

	get jobMindblocked() {
		return !!this.jobMindblockedUntil && Date.now() < this.jobMindblockedUntil.getTime()
	}
}
