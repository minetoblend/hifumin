import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder } from 'discord.js';
import { DiscordUserService } from '../services/discordUserService.js';
import { db } from '../db.js';
import { Card } from '../entities/card.js';
import { renderCards } from '../services/cardRenderer.js';
import { EventLogService } from '../services/eventLogService.js';
import { unlink } from 'fs/promises';
import { CardService } from '../services/cardService.js';

export class TradeCommand extends Command {
	registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('trade')
				.setDescription('Trade a card with another user')
				.addUserOption((option) => option.setName('user').setDescription('User to trade with').setRequired(true))
				.addStringOption((option) => option.setName('offer').setDescription('Card to offer').setRequired(true))
				.addStringOption((option) => option.setName('receive').setDescription('Card to trade').setRequired(true))
		);
	}

	async chatInputRun(interaction: ChatInputCommandInteraction) {
		const user1 = await DiscordUserService.findOrCreate(interaction.user);
		const user2 = await DiscordUserService.findOrCreate(interaction.options.getUser('user')!);

		if (user1.id === user2.id) {
			await interaction.reply({
				content: 'You cannot trade with yourself'
			});
			return;
		}

		const card1 = await db.getRepository(Card).findOne({
			where: {
				id: interaction.options.getString('offer')!,
				burned: false
			},
			relations: {
				owner: true,
				mapper: true,
				condition: true
			}
		});

		const card2 = await db.getRepository(Card).findOne({
			where: {
				id: interaction.options.getString('receive')!,
				burned: false
			},
			relations: {
				owner: true,
				mapper: true,
				condition: true
			}
		});

		if (!card1 || !card2 || !card1.owner || !card2.owner) {
			await interaction.reply({
				content: 'Card not found',
				ephemeral: true
			});
			return;
		}

		if (card1.owner?.id !== user1.id) {
			await interaction.reply({
				content: 'You do not own this card',
				ephemeral: true
			});
			return;
		}

		if (card2.owner?.id !== user2.id) {
			await interaction.reply({
				content: `${user2.username} does not own this card`,
				ephemeral: true
			});
			return;
		}

		switch (await CardService.getCardUsage(db.createEntityManager(), card1.id)) {
			case 'job_slot': {
				await interaction.reply({
					content: `Cannot trade ${card1.username}, it is currently assigned to a job`
				});
				return;
			}
			default: {
			}
		}

		switch (await CardService.getCardUsage(db.createEntityManager(), card2.id)) {
			case 'job_slot': {
				await interaction.reply({
					content: `Cannot trade ${card2.username}, it is currently assigned to a job`
				});
				return;
			}
			default: {
			} // don't ask me why but typescript refuses to compile this without adding a default statement
		}

		const frame = await renderCards([card1, card2]);

		const msg = await interaction.reply({
			content: `Trade with <@${user2.id}>`,
			allowedMentions: {
				users: [user1.id, user2.id]
			},
			files: [
				{
					attachment: frame,
					name: 'cards.png'
				}
			],
			embeds: [
				new EmbedBuilder()
					.setTitle('Trade')
					.setDescription(`${user1.username} wants to trade \`${card1.id}\` for \`${card2.id}\` with ${user2.username}`)
					.setImage('attachment://cards.png')
					.setFields([
						{
							name: 'Offer',
							value: `Condition: ${card1.condition.id}\nRarity: ${card1.mapper.rarity}`,
							inline: true
						},
						{
							name: 'Receive',
							value: `Condition: ${card2.condition.id}\nRarity: ${card2.mapper.rarity}`,
							inline: true
						}
					])
					.setFooter({ text: 'Agreed: 0/2' })
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId(`cancel`).setEmoji('❌').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId(`accept`).setEmoji('✅').setStyle(ButtonStyle.Secondary)
				)
			]
		});

		await unlink(frame);

		const agreed = new Set<string>();

		for (let i = 0; i < 2; i++) {
			const result = await msg.awaitMessageComponent({
				componentType: ComponentType.Button,
				filter: (interaction) => {
					return interaction.user.id === user1.id || interaction.user.id === user2.id;
				}
			});

			if (result.customId === 'cancel' && !agreed.has(result.user.id)) {
				await msg.edit({
					embeds: [
						new EmbedBuilder()
							.setTitle('Trade')
							.setDescription(`${user1.username} cancelled the trade with ${user2.username}`)
							.setImage('attachment://cards.png')
							.setFooter({ text: 'Trade cancelled' })
							.setColor('Red')
					],
					components: []
				});
				await result.reply({
					content: 'You canceled the trade',
					ephemeral: true
				});
				return;
			}

			agreed.add(result.user.id);

			await msg.edit({
				embeds: [
					new EmbedBuilder()
						.setTitle('Trade')
						.setDescription(`${user1.username} wants to trade \`${card1.id}\` for \`${card2.id}\` with ${user2.username}`)
						.setImage('attachment://cards.png')
						.setFooter({ text: `Agreed: ${agreed.size}/2` })
				]
			});
			await result.reply({
				content: 'You agreed to the trade',
				ephemeral: true
			});
		}

		if (agreed.size !== 2) {
			return;
		}

		await db.transaction(async (tx) => {
			const carda = await tx.getRepository(Card).findOne({
				where: {
					id: card1.id,
					burned: false
				},
				relations: {
					owner: true,
					mapper: true,
					condition: true
				}
			});

			const cardb = await tx.getRepository(Card).findOne({
				where: {
					id: card2.id,
					burned: false
				},
				relations: {
					owner: true,
					mapper: true,
					condition: true
				}
			});

			switch (await CardService.getCardUsage(tx, carda.id)) {
				case 'job_slot': {
					await (
						await msg.fetch()
					).reply({
						content: `Cannot trade ${card1.username}, it is currently assigned to a job`
					});
					return;
				}
				default: {
				}
			}

			switch (await CardService.getCardUsage(tx, cardb.id)) {
				case 'job_slot': {
					await (
						await msg.fetch()
					).reply({
						content: `Cannot trade ${card2.username}, it is currently assigned to a job`
					});
					return;
				}
				default: {
				} // don't ask me why but typescript refuses to compile this without adding a default statement
			}

			if (!carda || !cardb || carda.owner?.id !== user1.id || cardb.owner?.id !== user2.id) {
				await (
					await msg.fetch()
				).reply({
					content: 'Trade failed'
				});
				return;
			}

			await tx.getRepository(Card).update(carda.id, {
				owner: cardb.owner
			});

			await tx.getRepository(Card).update(cardb.id, {
				owner: carda.owner
			});

			EventLogService.logEvent(user1, 'trade', {
				tradeWith: {
					id: user2.id,
					username: user2.username
				},
				offer: {
					id: card1.id,
					mapper: card1.mapper.username
				},
				receive: {
					id: card2.id,
					mapper: card2.mapper.username
				}
			});

			await (
				await msg.fetch()
			).reply({
				content: 'Trade successful'
			});
		});
	}
}
