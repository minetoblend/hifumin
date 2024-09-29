import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../db.js';
import { ItemService } from '../services/itemService.js';
import { DiscordUserService } from '../services/discordUserService.js';
import { UserEffect } from '../entities/userEffect.js';
import { Mapper } from '../entities/mapper.js';
import { Card } from '../entities/card.js';
import { CardCondition } from '../entities/cardCondition.js';
import { renderCards } from '../services/cardRenderer.js';
import { DiscordUser } from '../entities/discordUser.js';
import { getNextCardId } from '../services/getNextCardId.js';
import { EventLogService } from '../services/eventLogService.js';
import { unlink } from 'fs/promises';
import { stringId } from '../lib/utils.js';

export class UseCommand extends Command {
	registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) => {
			builder
				.setName('use')
				.setDescription('Use an item')
				.addStringOption((option) => option.setName('item').setDescription('Item to use').setRequired(true));
		});
	}

	async chatInputRun(interaction: ChatInputCommandInteraction) {
		const itemId = interaction.options.getString('item')!;
		const user = await DiscordUserService.findOrCreate(interaction.user);

		await db.transaction('SERIALIZABLE', async (tx) => {
			const itemCount = await ItemService.getItemCount(user, itemId, tx);

			if (itemCount === 0) {
				const msg = await interaction.reply({
					content: `<@${interaction.user.id}> You do not have this item`
				});
				setTimeout(() => {
					msg.delete();
				}, 15000);
				return;
			}

			EventLogService.logEvent(user, 'use', { item: itemId });

			switch (itemId) {
				case 'claim speedup':
				case 'drop speedup':
					const repo = tx.getRepository(UserEffect);
					const existing = await repo.findOne({
						where: {
							userId: user.id,
							effect: itemId
						}
					});

					if (existing) {
						await repo.update(existing, {
							activeUntil:
                                existing.activeUntil > new Date() ?
                                new Date(existing.activeUntil.getTime() + /* 6 hours */ 6 * 60 * 60 * 1000) :
                                new Date(Date.now() + /* 6 hours */ 6 * 60 * 60 * 1000)
						});
					} else {
						await repo.insert({
							userId: user.id,
							effect: itemId,
							activeUntil: new Date(Date.now() + /* 6 hours */ 6 * 60 * 60 * 1000)
						});
					}

					break;
				case 'superdrop':
					await this.superdrop(interaction, user);
					break;
				default:
					const msg = await interaction.reply({
						content: `Item \`${itemId}\` cannot be used`
					});
					setTimeout(async () => {
						try {
                            msg.delete();
                        } catch(e) {
                        }
					}, 15000);
					return;
			}

			await ItemService.changeItemCount(user, itemId, -1, tx);

			if (!interaction.deferred) {
				await interaction.reply({
					content: `Successfully used \`${itemId}\``
				});
			}
		});
	}

	private async superdrop(interaction: ChatInputCommandInteraction, user: DiscordUser) {
		const reply = await interaction.deferReply();

		const randomMappers = await db
			.getRepository(Mapper)
			.createQueryBuilder('mapper')
			.leftJoin('mapper.wishlistEntries', 'wishlistEntry', 'wishlistEntry.user.id = :userId', { userId: user.id })
			.select()
			.where('mapper.deleted = false')
			.orderBy('-LOG(RAND()) / (1.0 - (rarity / 200.0 + CASE WHEN wishlistEntry.id is not null then 0.15 else 0 end))')
			.limit(10)
			.getMany();

		if (!randomMappers.some((it) => it.rarity >= 40)) {
			randomMappers[Math.floor(Math.random() * randomMappers.length)] = (await db
				.getRepository(Mapper)
				.createQueryBuilder('mapper')
				.select()
				.leftJoin('mapper.wishlistEntries', 'wishlistEntry', 'wishlistEntry.user.id = :userId', { userId: user.id })
				.where('rarity >= 40')
				.orderBy('-LOG(RAND()) / (1.0 - (rarity / 200.0 + CASE WHEN wishlistEntry.id is not null then 0.15 else 0 end))')
				.getOne())!;
		}

		const conditions = ['BadlyDamaged', 'BadlyDamaged', 'Poor', 'Poor', 'Poor', 'Good', 'Good', 'Mint'];

		const cards: Card[] = [];

		await db.manager.transaction('SERIALIZABLE', async (tx) => {
			const repository = tx.getRepository(Card);
			const ids = await getNextCardId(10)

			for (const mapper of randomMappers) {
				const condition = conditions[Math.floor(Math.random() * conditions.length)];
				const card = new Card();
				card.id = stringId(ids.shift()!);
				card.mapper = mapper;
				card.username = mapper.username;
				card.avatarUrl = mapper.avatarUrl;
				card.condition = (await tx.findOneBy(CardCondition, { id: condition }))!!;
				card.droppedBy = user;
				card.createdAt = new Date();
				if (Math.random() < 0.05) card.foil = true;

				await repository.save(card);

				cards.push(card);

				console.log(JSON.stringify({
					event: 'create_card',
					card: {
						username: card.username,
						burnValue: card.burnValue,
						rarity: mapper.rarity,
						condition: card.condition,
						condition_multiplier: card.condition.multiplier,
					},
				}))
			}
		});

		const frame = await renderCards(cards, { perRow: 5 });

		const buttons = cards.map((card) => {
			let name = card.mapper.username;

			if (card.foil) {
				name += ' (Foil)';
			}

			return new ButtonBuilder().setCustomId(`claim:${card.id}`).setLabel(name).setStyle(ButtonStyle.Primary);
		});

		const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(0, 5));
		const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(5));

		const message = await reply.edit({
			components: [row1, row2],
			files: [
				{
					attachment: frame,
					name: 'cards.png'
				}
			]
		});

		await unlink(frame)

		setTimeout(async () => {
			try {
                await message.edit({
                    components: []
                });
            } catch(e) {}
		}, 1000 * 60);
	}
}
