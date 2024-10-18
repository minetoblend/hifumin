import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';
import { db } from '../db.js';
import { Card } from '../entities/card.js';
import { DiscordUserService } from '../services/discordUserService.js';
import { getTimeout, TimeoutType } from '../services/timeout.js';
import { EventLogService } from '../services/eventLogService.js';

export class ButtonHandler extends InteractionHandler {
	public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (interaction.customId.startsWith('claim:')) {
			return this.some(interaction.customId.slice('claim:'.length));
		}

		return this.none();
	}

	public async run(interaction: ButtonInteraction, id: string) {
		const user = await DiscordUserService.findOrCreate(interaction.user);

		const response = await interaction.deferReply()
		
		await db.transaction(async (tx) => {
			const ratelimit = await getTimeout(user, TimeoutType.Claim, tx);
			if (ratelimit.expired) {
				const duration =
					ratelimit.remainingTime > 60_000
						? `${Math.ceil(ratelimit.remainingTime / 60_000)} minutes`
						: `${Math.round(ratelimit.remainingTime / 1000)} seconds`;
				await response.edit({
					content: `<@${user.id}> You need to wait ${duration} before claiming another card!`
				});
				return;
			}

			const repository = tx.getRepository(Card);
			const card = await repository.findOne({
				where: { id, burned: false },
				relations: {
					owner: true,
					mapper: true,
					claimedBy: true,
					droppedBy: true,
					condition: true
				},
				lock: {
					mode: 'pessimistic_write'
				}
			});

			if (!card) {
				await response.edit({
					content: 'Card not found',
				});
				return;
			}

			const age = Date.now() - card.createdAt.getTime();
			if (age > 1000 * 60) {
				await response.edit({
					content: 'This card has expired!'
				});
				return;
			}

			if (card.owner && card.owner.id === user.id) {
				await response.edit({
					content: `<@${user.id}> You already own this card!`
				});
			} else if (card.owner && card.droppedBy?.id === user.id) {
				if (Math.random() < 0.75) {
					await repository.update(card.id, {
						owner: user,
						claimedBy: user
					});

                    EventLogService.logEvent(user, 'claim', {
                        card: {
                            id: card.id,
                            mapper: card.mapper.username,
                        },
                        fought: {
                            id: card.owner.id,
                            username: card.owner.username,
                        }
                    })

					await response.edit({
						content: `<@${user.id}> You fought <@${card.owner!!.id}> for this card and came out on top!`
					});
					await ratelimit.consume();
				} else {
					await response.edit({
						content: `<@${user.id}> You fought <@${card.owner!!.id}> for this card but unfortunately lost!`
					});
					await ratelimit.consume();
				}
			} else if (card.owner) {
				await response.edit({
					content: `<@${user.id}> This card is already claimed!`
				});
			} else {
				await repository.update(card.id, {
					owner: user,
					claimedBy: user
				});

                EventLogService.logEvent(user, 'claim', {
                    card: {
                        id: card.id,
                        mapper: card.mapper.username,
                    }
                })

				let conditionText = '';
				switch (card.condition.id) {
					case 'BadlyDamaged':
						conditionText = 'Unfortunately, it is badly damaged.';
						break;
					case 'Poor':
						conditionText = 'It is in poor condition.';
						break;
					case 'Good':
						conditionText = 'It is in good condition.';
						break;
					case 'Mint':
						conditionText = 'It is in mint condition!';
						break;
				}

				await ratelimit.consume();

				await response.edit({
					content: `<@${user.id}> You claimed the *${card.mapper.username}* card \`${card.id}\`! ${conditionText}`
				});
			}
		});
	}
}
