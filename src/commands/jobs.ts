import { Command } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { db } from '../db.js';
import { JobAssignment } from '../entities/job_assignment.js';
import { DiscordUserService } from '../services/discordUserService.js';
import { Card } from '../entities/card.js';
import { ChannelType, EmbedBuilder } from 'discord.js';
import { CardService } from '../services/cardService.js';
import { LessThan, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import { ItemService } from '../services/itemService.js';

export class JobsCommand extends Subcommand {
	public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
		super(context, {
			...options,
			name: 'jobs',
			subcommands: [
				{
					name: 'show',
					chatInputRun: 'chatInputShow'
				},
				{
					name: 'assign',
					chatInputRun: 'chatInputAssign'
				},
				{
					name: 'work',
					chatInputRun: 'chatInputWork'
				}
			]
		});

		setInterval(() => {
			this.updateJobs();
		}, 30_000);

		setInterval(() => {
			this.updateMotivation();
		}, 10 * 60_000);
	}

	registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('jobs')
				.setDescription('Jobs')
				.addSubcommand((command) => command.setName('show').setDescription('Show current job assignment'))
				.addSubcommand((command) => command.setName('work').setDescription('Put your cards to work'))
				.addSubcommand((command) =>
					command
						.setName('assign')
						.setDescription('Assign card to slot')
						.addStringOption((arg) =>
							arg.setName('card').setDescription('Card to assign').setRequired(true).setMaxLength(4).setMinLength(4)
						)
						.addStringOption((arg) =>
							arg
								.setName('slot')
								.setDescription('Slot to assign to')
								.setRequired(true)
								.setChoices(...this.slots.map((slot) => ({ name: slot.toUpperCase(), value: slot.toLowerCase() })))
						)
				)
		);
	}

	private get repository() {
		return db.getRepository(JobAssignment);
	}

	readonly slots = ['a', 'b', 'c', 'd'];

	async chatInputShow(interaction: Command.ChatInputCommandInteraction) {
		const user = await DiscordUserService.findOrCreate(interaction.user);

		try {
			const assignments = await this.repository.findBy({ user });

			const entries: JobBoardEntry[] = [];

			for (const slot of this.slots) {
				const assignment = assignments.find((it) => it.slot === slot);

				entries.push({
					slot,
					card: assignment?.card ?? null,
					assignment: assignment ?? null
				});
			}

			const totalEffort = entries.map((it) => it.card?.jobEffort ?? 0).reduce((a, b) => a + b, 0);

			await interaction.reply({
				embeds: [
					new EmbedBuilder().setTitle('Job board').setDescription(
						[
							`User: <@${user.id}>`,
							`Total effort: ${totalEffort}`,
							'',
							...entries.flatMap(({ card, slot, assignment }) => {
								if (!card) {
									return [`${this.renderSlot(slot)} Not assigned`, ''];
								}

								let cardText = `\`${card.id}\` ${card.username}`;

								if (card.jobMindblocked) {
									cardText += ` (*mindblocked*)`;
								}

								const lines = [
									`${this.renderSlot(slot)} ${cardText}`,
									`- Effort: \`${card.jobEffort}\` · Motivation: \`${card.jobMotivation}/10\` · ${Math.round(assignment.successChance * 100)}% success chance`
								];

								if (assignment?.isActive) {
									const numFilled = Math.round(assignment.progress * 10);

									const progressBar = '█'.repeat(numFilled) + '░'.repeat(10 - numFilled);

									const remainingMinutes = Math.ceil(assignment.timeRemaining / 60_000);

									lines.push(
										[
											'-',
											progressBar,
											Math.floor(assignment.progress * 100)
												.toString()
												.padStart(3, ' ') + '%',
											'·',
											remainingMinutes,
											remainingMinutes === 1 ? 'minute' : 'minutes',
											'remaining',
										].join(' ')
									);
								}

								lines.push('');

								return lines;
							})
						].join('\n')
					)
				]
			});
		} catch (e) {
			console.error(e);
		}
	}

	async chatInputAssign(interaction: Command.ChatInputCommandInteraction) {
		const user = await DiscordUserService.findOrCreate(interaction.user);

		const slot = interaction.options.getString('slot', true);
		const cardId = interaction.options.getString('card', true);

		const reply = await interaction.deferReply()

		try {
			await db.transaction('SERIALIZABLE', async (tx) => {
				const repository = tx.getRepository(JobAssignment);
	
				const cardResult = await CardService.getOwnedCard(tx, user, cardId);
	
				if (cardResult.isErr()) {
					await reply.edit({
						content: `<@${user.id}> ${cardResult.message}`
					});
					return;
				}
	
				const card = cardResult.value;
	
				const existingAssignment = await repository.findOne({
					where: {
						card: {
							id: card.id
						}
					}
				});
	
				if (existingAssignment) {
					await reply.edit(`<@${user.id}> This card is already assigned to a slot`);
					return;
				}
	
				const assignment = await repository.findOne({
					where: {
						user,
						slot
					},
					lock: {
						mode: 'pessimistic_write'
					}
				});
	
				if (assignment?.isActive) {
					await reply.edit(`<@${user.id}> This slot is currently active, wait until it has finished to reassign a new card.`);
					return;
				}
	
				await repository.upsert(
					{
						user,
						slot,
						card
					},
					['user', 'slot']
				);
	
				await reply.edit(
					`<@${user.id}> Successfully assigned \`${card.id}\` (${card.username}) to slot ${this.renderSlot(slot)}`
				);
			});
		} catch(e) {
			console.error(e)
			await reply.edit('An error ocurred')
		}
	}

	private renderSlot(slot: string) {
		return `:regional_indicator_${slot.toLowerCase()}:`;
	}

	async chatInputWork(interaction: Command.ChatInputCommandInteraction) {
		const user = await DiscordUserService.findOrCreate(interaction.user);

		const reply = await interaction.deferReply();

		try {
			await db.transaction('SERIALIZABLE', async (tx) => {
				const repository = tx.getRepository(JobAssignment);

				let assignments = await repository.find({
					where: {
						user
					}
				});

				if (assignments.length === 0) {
					reply.edit(`<@${user.id}> You have no cards assigned`);
					return;
				}

				assignments = assignments.filter((it) => !it.isActive);

				if (assignments.length === 0) {
					reply.edit(`<@${user.id}> All your cards are busy`);
					return;
				}

				for (const assignment of assignments) {
					let duration = 60 * 60 * 1000;

					duration *= 1 - (Math.random() * 0.3 + (assignment.card.jobEffort / 240) * 0.3);

					await repository.update(
						{
							user,
							slot: assignment.slot
						},
						{
							startedAt: new Date(),
							activeUntil: new Date(Date.now() + duration),
							guildId: interaction.guildId,
							channelId: interaction.channelId
						}
					);
				}

				await reply.edit(`<@${user.id}> Put ${assignments.length} ${assignments.length === 1 ? 'card' : 'cards'} to work`);
			});
		} catch (e) {
			console.error(e);
		}
	}

	private async updateJobs() {
		await db.transaction('SERIALIZABLE', async (tx) => {
			const repository = tx.getRepository(JobAssignment);

			const finishedJobs = await repository.find({
				where: {
					activeUntil: LessThanOrEqual(new Date())
				},
				relations: ['card', 'card.mapper', 'card.condition']
			});

			if (finishedJobs.length === 0) return;

			console.log(`Found ${finishedJobs.length} finished jobs`);

			for (const job of finishedJobs) {
				const success = Math.random() <= job.successChance;
				const card = job.card;

				let outcomeMessage: string[] = [];

				if (success) {
					const goldAmount = Math.max(job.card.jobEffort, 0);

					await ItemService.changeItemCount(job.user, 'gold', goldAmount, tx);

					const motivationIncrease = Math.random() < 0.7;

					outcomeMessage.push(
						`Your card \`${job.card.id}\` (${job.card.username}) just successfully ranked their map, you get ${goldAmount} gold`
					);

					if (motivationIncrease) {
						card.jobMotivation = Math.min(job.card.jobMotivation + 1, 10);

						await tx.getRepository(Card).save(card);

						outcomeMessage.push(
							`The map was very well received and ${card.username} gained a motivation boost and is now at \`${card.jobMotivation}/10\` motivation`
						);
					}
				} else {
					const messages = [
						`it was not good enough.`,
						`it got vetoed over excessive jumps.`,
						`it got vetoed over looking like it was AI-generated.`,
						`it got vetoed over looking like someone's first map.`,
						`it got vetoed as the gds were deemed to be content bloat.`,
						`it got vetoed and one of the the bns got kicked from bng over the nomination.`,
						`they are blacklisted by nearly every bn.`,
						`they insisted on using the most obnoxious keysounds.`,
						`the song was previous hit by a DMCA.`
					].map((reason) => `Your card \`${job.card.id}\` (${job.card.username}) unfortunately failed to rank their map because ${reason}`);

					outcomeMessage.push(messages[Math.floor(Math.random() * messages.length)]);

					if (Math.random() < 0.2) {
						card.jobMindblockedUntil = new Date(Date.now() + /* 12 hours */ 12 * 60 * 60 * 1000);
						card.jobMotivation = Math.max(1, Math.min(card.jobMotivation - 2, 4));

						await tx.getRepository(Card).save(card);

						outcomeMessage.push(`${card.username} has become mindblocked, their motivation is now at \`${card.jobMotivation}/10\``);
					} else if (Math.random() < 0.5) {
						card.jobMotivation = Math.max(job.card.jobMotivation - 1, 1);

						await tx.getRepository(Card).save(card);

						outcomeMessage.push(`${card.username} got demotivated and is now at \`${card.jobMotivation}/10\``);
					}
				}

				if (outcomeMessage.length > 0) {
					try {
						const client = this.container.client;
						if (job.guildId && job.channelId) {
							const guild = await client.guilds.fetch(job.guildId);
							const channel = await guild.channels.fetch(job.channelId);
							const user = await guild.members.fetch(job.user.id);

							if (channel.isTextBased()) {
								await channel.send(`<@${user.id}> ` + outcomeMessage.join('\n'));
							}
						} else {
							const user = await this.container.client.users.fetch(job.user.id);
							await user.send(outcomeMessage.join('\n'));
						}
					} catch (e) {
						console.error(e);
					}
				}
			}

			for (const job of finishedJobs) {
				await repository.update(
					{
						user: job.user,
						slot: job.slot
					},
					{
						activeUntil: null,
						startedAt: null
					}
				);
			}
		});
	}

	private async updateMotivation() {
		const repository = db.getRepository(Card)

		let cards = await repository.find({
			where: { jobMotivation: LessThan(7) }
		});

		cards = cards.filter((it) => !it.jobMindblocked);

		const alteredCards: Card[] = [];

		for (const card of cards) {
			if (card.jobMotivation < 7 && Math.random() < 0.2) {
				card.jobMotivation++;
				alteredCards.push(card);
			}
		}

		if(alteredCards.length === 0)
			return

		console.log(`Regenerating motivation for ${alteredCards.length} cards`)

		for(const card of cards) {
			await repository.update(card.id, {
				jobMotivation: card.jobMotivation
			})
		}
	}
}

interface JobBoardEntry {
	slot: string;
	card: Card | null;
	assignment: JobAssignment | null;
}
