import { Subcommand } from '@sapphire/plugin-subcommands';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../db.js';
import { Card } from '../entities/card.js';
import { LazyPaginatedMessage, PaginatedMessage } from '@sapphire/discord.js-utilities';
import { DiscordUserService } from '../services/discordUserService.js';

export class LeaderboardCommand extends Subcommand {
	public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
		super(context, {
			...options,
			name: 'leaderboard',
			subcommands: [
				{
					name: 'cards',
					chatInputRun: 'chatInputCards'
				},
				{
					name: 'collection',
					chatInputRun: 'chatInputCollection'
				},
				{
					name: 'wishlist',
					chatInputRun: 'chatInputWishlist'
				}
			]
		});
		this.updateCollectionLeaderboard();
	}

	registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('leaderboard')
				.setDescription('Cards')
				.addSubcommand((command) => command.setName('cards').setDescription('Show most valuable cards'))
				.addSubcommand((command) => command.setName('collection').setDescription('Show most valuable collections'))
				.addSubcommand((command) => command.setName('wishlist').setDescription('Show most wanted cards'))
		);
	}

	async chatInputCards(interaction: ChatInputCommandInteraction) {
		const [{ count }] = await db
			.createEntityManager()
			.query('select count(*) as count from card_leaderboard');

		const message = new LazyPaginatedMessage();

		for (let i = 0; i <= count && i < 250; i += 10) {
			message.addAsyncPageBuilder(async (builder) => {
				const cards: any[] = await db
					.createEntityManager()
					.query('SELECT * FROM card_leaderboard LIMIT 10 OFFSET ?', [i]);

				const embed = new EmbedBuilder().setTitle('Card Leaderboard');

				if (cards.length > 0)
					embed.setDescription(
						cards
							.map((card: any, index) => {
								return `${i + index + 1}. \`$${card.price}\` · ${card.username}${card.foil ? ' (Foil)' : ''} · *Owned by ${card.owner}*`;
							})
							.join('\n')
					);

				return builder.setContent(`Page ${i / 10 + 1}/${Math.ceil(count / 10)}`).setEmbeds([embed]);
			});
		}

		await message.run(interaction, interaction.user);
	}

	private collectionLeaderboard: any[] = [];

	private async updateCollectionLeaderboard() {
		while (true) {
			console.log('Updating collection leaderboard')
			try {
				this.collectionLeaderboard = await db.createEntityManager().query('SELECT * from networth_leaderboard');
			} catch (e) {
				console.error(e);
			}
			await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5));
		}
	}

	async chatInputCollection(interaction: ChatInputCommandInteraction) {
		const total = this.collectionLeaderboard.length;

		const user = await DiscordUserService.findOrCreate(interaction.user);

		try {
			let position = this.collectionLeaderboard.findIndex((entry) => entry.username === user.username);
			
			const message = new LazyPaginatedMessage();

			for (let i = 0; i <= total && i < 250; i += 10) {
				message.addAsyncPageBuilder(async (builder) => {
					try {
						const embed = new EmbedBuilder().setTitle('Collection Leaderboard');
						const results = this.collectionLeaderboard.slice(i, i + 10);

						if (results.length > 0)
							embed.setDescription(
								results
									.map((result, index) => {
										return `${i + index + 1}. \`${result.price}\` gold · ${result.username}`;
									})
									.join('\n')
							);

						if (position >= 0) {
							embed.setFooter({ text: `Your ranking: #${position + 1}` });
						}

						return builder.setContent(`Page ${i / 10 + 1}/${Math.ceil(total / 10)}`).setEmbeds([embed]);
					} catch (error) {
						console.log(error);
						throw error;
					}
				});
			}

			await message.run(interaction, interaction.user);
		} catch (error) {
			console.log(error);
		}
	}

	async chatInputWishlist(interaction: ChatInputCommandInteraction) {
		console.log('wishlist');
		try {
			const entries: any[] = await db.createEntityManager().query(`
                    SELECT mapper_id, COUNT(mapper_id) as count, mapper.id, mapper.username
                    FROM wishlist_entry
                    INNER JOIN mapper ON mapper.id = mapper_id
                    GROUP BY mapper_id
                    ORDER BY count DESC
                `);

			const message = new PaginatedMessage();
			console.log(entries);

			for (let i = 0; i <= entries.length && i < 250; i += 10) {
				message.addPageEmbed((builder) => {
					return builder.setTitle(`Wishlist Leaderboard`).setDescription(
						entries
							.slice(i, i + 10)
							.map((entry: any, index) => {
								return `${i + index + 1}. ${entry.count}◆ · ${entry.username}`;
							})
							.join('\n')
					);
				});
			}

			await message.run(interaction, interaction.user);
		} catch (error) {
			console.log(error);
		}
	}
}
