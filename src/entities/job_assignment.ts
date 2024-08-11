import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { DiscordUser } from './discordUser.js';
import { Card } from './card.js';

@Entity('job_assignment')
export class JobAssignment {
  @PrimaryColumn('bigint', { name: 'user_id', unsigned: true })
  userId!: string;

  @Column({ type: 'char', length: 1, nullable: false })
  @PrimaryColumn('char', { length: 1 })
	slot!: string;

	@OneToOne(() => DiscordUser, { nullable: false, eager: true })
	@JoinColumn({ name: 'user_id' })
	user!: DiscordUser;

	@ManyToOne(() => Card, { nullable: true, eager: true })
	card!: Card | null;

	@Column('datetime', { name: 'active_until', nullable: true })
	activeUntil!: Date | null;

	@Column('datetime', { name: 'started_at', nullable: true })
	startedAt!: Date | null;

	@PrimaryColumn('varchar', { name: 'guild_id', length: 32 })
  guildId!: string;

	@PrimaryColumn('varchar', { name: 'channel_id', length: 32 })
  channelId!: string;

	get isActive() {
		return this.activeUntil !== null
	}

	get progress() {
		if(this.activeUntil === null || this.startedAt === null)
			return 0

		const activeUntil = this.activeUntil.getTime()
		const startedAt = this.startedAt.getTime()

		const duration = activeUntil - startedAt

		const activeDuration = Date.now() - startedAt

		const progress = activeDuration / duration

		if (progress > 1)
			return 1

		return progress
	}

	get timeRemaining() {
		const activeUntil = this.activeUntil.getTime()

		const remaining = activeUntil - Date.now()

		if(remaining < 0)
			return 0
		return remaining
	}

	get successChance() {
		let value = (this.card.jobMotivation / 10) * Math.pow(this.card.jobBaseEffort / 240, 0.25) // max_effort

		value = 0.3 + value * 0.7

		if (this.card.jobMindblocked) {
			value *= 0.5
		}

		if(value > 0.9)
			value = 0.9

		return value
	}
}
