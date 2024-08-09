import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, ComponentType, EmbedBuilder, StringSelectMenuInteraction } from 'discord.js';
import { LazyPaginatedMessage, PaginatedMessage } from '@sapphire/discord.js-utilities';
import { DiscordUserService } from '../services/discordUserService.js';
import { Card } from '../entities/card.js';
import { db } from '../db.js';

export class CollectionCommand extends Command {
	registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('collection')
				.setDescription('Show your card collection')
				.addUserOption((option) => option.setName('user').setDescription('User to show the collection for').setRequired(false))
		);
	}

	async chatInputRun(interaction: ChatInputCommandInteraction) {
		const user = await DiscordUserService.findOrCreate(interaction.options.getUser('user') ?? interaction.user);

		const repository = db.getRepository(Card);

		const total = await repository.count({
			where: {
				owner: {
					id: user.id
				},
				burned: false
			}
		});

		const message = new LazyPaginatedMessage();

		let orderBy = 'card.createdAt';
		let orderByReadable = 'date';

		if(total === 0) {
			await interaction.reply(`No cards found for ${user.username}`);
			return;
		}

		for (let i = 0; i < Math.min(total, 250); i += 10) {
			message.addAsyncPageBuilder(async (builder) => {
				let query = repository
					.createQueryBuilder('card')
					.leftJoinAndSelect('card.condition', 'condition')
					.leftJoinAndSelect('card.mapper', 'mapper')
					.leftJoinAndSelect('mapper.wishlistEntries', 'wishlist')
					.addSelect('mapper.rarity * condition.multiplier * 5 as burn_value')
					.where('card.owner.id = :userId', { userId: user.id })
					.andWhere('card.burned = false')
					.orderBy(orderBy, 'DESC')
					.skip(i)
					.take(10);

				const cards = await query.getMany();

				const embed = new EmbedBuilder().setTitle(`Card collection for ${user.username}`).setDescription(
					cards
						.map((card) => {
							let conditionEmoji: string;

							switch (card.condition.id) {
								case 'Mint':
									conditionEmoji = '🤩';
									break;
								case 'Good':
									conditionEmoji = '🙂';
									break;
								case 'Poor':
									conditionEmoji = '😕';
									break;
								default:
									conditionEmoji = '😡';
									break;
							}

							let wishlist = '';

							if (card.mapper.wishlistEntries.length > 0) {
								wishlist = ` · ◆${card.mapper.wishlistEntries.length} `;
							}

							return `\`${card.id}\` · ${conditionEmoji} ${wishlist}· ${card.mapper.username} (${card.burnValue} gold)`;
						})
						.join('\n') + `\n\nSorting by: \`${orderByReadable}\``
				);

				return builder.setContent(`Page ${i / 10 + 1}/${Math.ceil(total / 10)}`).setEmbeds([embed]);
			});
		}

		message.actions.delete('@sapphire/paginated-messages.goToPage');

		message.addAction({
			type: ComponentType.StringSelect,
			customId: 'sort',
			placeholder: 'Sort by',
			options: [
				{
					label: 'By date',
					value: 'date'
				},
				{
					label: 'By condition',
					value: 'condition'
				},
				{
					label: 'By username',
					value: 'username'
				},
				{
					label: 'By rarity',
					value: 'rarity'
				}
			],
			async run(ctx) {
				const selection = (ctx.interaction as StringSelectMenuInteraction).values[0];

				orderBy =
					{
						condition: 'condition.multiplier',
						username: 'mapper.username',
						date: 'card.createdAt',
						rarity: 'mapper.rarity',
						price: 'burn_value'
					}[selection as 'condition' | 'username' | 'date' | 'rarity' | 'price'] ?? 'card.createdAt';

				orderByReadable = selection;

				await message.updateCurrentPage(message.pages[message.index]);
				message.messages = [];
			}
		});

		await message.run(interaction, interaction.user);
	}
}
