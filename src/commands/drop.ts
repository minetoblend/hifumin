import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ChatInputCommandInteraction } from 'discord.js';
import { DiscordUserService } from '../services/discordUserService.js';
import '../services/cardRenderer.js';
import { renderCards } from '../services/cardRenderer.js';
import { db } from '../db.js';
import { Mapper } from '../entities/mapper.js';
import { Card } from '../entities/card.js';
import { CardCondition } from '../entities/cardCondition.js';
import { ApplyOptions } from '@sapphire/decorators';
import { getTimeout, TimeoutType } from '../services/timeout.js';
import { getNextCardId } from '../services/getNextCardId.js';
import { GuildSettings } from '../entities/guildSettings.js';
import { EventLogService } from '../services/eventLogService.js';
import { unlink } from 'fs/promises';
import { stringId } from '../lib/utils.js';

@ApplyOptions<Command.Options>({
	description: 'Drops 3 cards'
})
export class DropCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('drop').setDescription('Drops 3 cards'));
	}

	override async chatInputRun(interaction: ChatInputCommandInteraction) {
		const user = await DiscordUserService.findOrCreate(interaction.user);

		const isTestChannel = interaction.channelId === '1206534692761894953';

		const count = Math.random() < 0.05 ? 5 : 3;

		const randomMappers = await db
			.getRepository(Mapper)
			.createQueryBuilder('mapper')
			.leftJoin('mapper.wishlistEntries', 'wishlistEntry', 'wishlistEntry.user.id = :userId', { userId: user.id })
			.select()
			.where('mapper.deleted = false')
			.orderBy('-LOG(RAND()) / (1.0 - (rarity / 133.0 + CASE WHEN wishlistEntry.id is not null then 0.15 else 0 end))')
			.limit(count)
			.getMany();

		const ids = await getNextCardId(count);

		const response = await interaction.deferReply();

		const cardResponse = await db.transaction(async (tx) => {
			const ratelimit = await getTimeout(user, TimeoutType.Drop, tx);
			if (ratelimit.expired && !isTestChannel) {
				const duration =
					ratelimit.remainingTime > 60_000
						? `${Math.ceil(ratelimit.remainingTime / 60_000)} minutes`
						: `${Math.round(ratelimit.remainingTime / 1000)} seconds`;
				await response.edit({
					content: `You need to wait ${duration} before dropping more cards!`
				});
				return;
			}

			const conditions = ['BadlyDamaged', 'BadlyDamaged', 'Poor', 'Poor', 'Poor', 'Good', 'Good', 'Mint'];

			const cards: Card[] = [];

			const repository = tx.getRepository(Card);

			for (const mapper of randomMappers) {
				const condition = conditions[Math.floor(Math.random() * conditions.length)];
				const card = new Card();
				card.id = stringId(ids.shift()!);
				card.mapper = mapper;
				card.username = mapper.username;
				card.avatarUrl = mapper.avatarUrl;
				card.condition = (await db.getRepository(CardCondition).findOneBy({ id: condition }))!!;
				card.droppedBy = user;
				card.createdAt = new Date();

				if (Math.random() < 0.05) card.foil = true;

				cards.push(card);

				card.calculateBurnValue()

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

			await repository.save(cards);

			EventLogService.logEvent(user, 'drop', { 
				cards: cards.map((card) => {
					return {
						id: card.id,
						mapper: card.mapper.username,
					}
				})
			 });

			const frame = await renderCards(cards);

			setTimeout(async () => {
				await unlink(frame)
			}, 10_000)

			const buttons = cards.map((card) => {
				let name = card.mapper.username;

				if (card.foil) {
					name += ' (Foil)';
				}

				return new ButtonBuilder().setCustomId(`claim:${card.id}`).setLabel(name).setStyle(ButtonStyle.Primary);
			});

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

			if (!isTestChannel) await ratelimit.consume();

			return {
				content: `<@${user.id}> Dropping ${count} cards...`,
				components: [row],
				files: [
					{
						attachment: frame,
						name: 'cards.png'
					}
				]
			};
		});

		if (cardResponse) {
			const message = await response.edit(cardResponse);

			setTimeout(async () => {
				try {
					await message.edit({
						components: []
					});
				} catch (e) {
					console.error('Failed to remove components', e);
				}
			}, 1000 * 60);

			if (user.reminderEnabled) {
				setTimeout(async () => {
				    try {
				        await interaction.user.send('Your drop is now off cooldown!')
				    } catch (e) {
				        console.error('Failed to send reminder', e)
				    }
				}, 1000 * 60 * 32)
			}
		}

		try {
			const guildId = interaction.guildId;
			const channelId = interaction.channelId;
			if (!guildId || !channelId || interaction.channel?.type !== ChannelType.GuildText) return;

			db.transaction('SERIALIZABLE', async (tx) => {
				let settings = await tx.getRepository(GuildSettings).findOneBy({ guildId });
				if (!settings) {
					settings = await tx.getRepository(GuildSettings).create({
						guildId,
						postedSettingsHint: false
					});
				}

				if (!settings.postedSettingsHint && !settings.channelId) {
					settings.postedSettingsHint = true;
					await tx.getRepository(GuildSettings).save(settings);

					const channel = await interaction.guild?.channels.fetch(channelId);

					if (channel && channel.isTextBased() && channel.permissionsFor(interaction.client.user!)?.has('SendMessages')) {
						console.log(`Posting settings hint for ${channel.guild.name}[${channel.guildId}]`);

						await channel.send({
							content: [
								'**Hello, quick (single time) announcement!**',
								'You can now set a dedicated bot channel for this bot with the `/settings setchannel` command.',
								'The bot will automatically post updates about new features to that channel.',
								'If the command does not show up, you might have to restart Discord (`Ctrl + R`)',
								'You can also use `/changelog` at any time from now on to see the latest changes.'
							].join('\n')
						});
					} else {
						console.error('Failed to fetch channel');
					}
				}
			});
		} catch (e) {
			console.error('Failed to post settings hint', e);
		}
	}
}
