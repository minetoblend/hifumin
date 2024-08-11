import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export class ChangelogCommand extends Command {
	static readonly changelog = [
		{
			id: 0,
			date: new Date('2024-06-06'),
			description: ['Cards will now also produce some dust when burned.', 'There is no use for dust yet, but that will change soon!']
		},
		{
			id: 1,
			date: new Date('2024-06-07'),
			description: [
				'Added ability to set guild channel for bot commands.',
				'Use the `/settings setchannel` command to set the channel and `/settings unsetchannel` to unset it.'
			]
		},
		{
			id: 2,
			date: new Date('2024-06-07'),
			description: ['Bot automaticaly posts new changes in servers with configured bot channel now.']
		},
		{
			id: 3,
			date: new Date('2024-06-07'),
			description: [
				'Bot can pin new change announcements in the bot channel now.',
				'Use the `/settings pinchanges` command to toggle pinning of new change announcements.'
			]
		},
		{
			id: 4,
			date: new Date('2024-06-07'),
			description: ['Buffed drop speedup.', 'Might revert if it turns out to be overpowered.']
		},
		{
			id: 5,
			date: new Date('2024-06-07'),
			description: ['Added `/gamble` command which lets you bet some gold.']
		},
		{
			id: 6,
			date: new Date('2024-06-07'),
			description: ['`/cooldown` now shows the daily cooldown.']
		},
		{
			id: 7,
			date: new Date('2024-06-07'),
			description: ['`/daily` now resets at midnight (UTC+2).']
		},
		{
			id: 8,
			date: new Date('2024-06-07'),
			description: ['Drop reminders are enabled again now. Use `/reminder` to toggle them.', "Make sure the bot can dm you or it won't work!"]
		},
		{
			id: 9,
			date: new Date('2024-06-08'),
			description: [
				'The `/gamble` command has been reworked.',
				'You can now get much higher rewards, however the chance of getting a win is lower.',
				'Use `/slotrewards` to see the possible winning combinations.',
				'Shoutout to visionary for coding this!'
			]
		},
		{
			id: 10,
			date: new Date('2024-08-11'),
			description: [
				'Added a job system where you can force your poor cards to make maps (And earn you gold).',
				'Use `/jobs assign` to assign cards to job slots.',
				'Use `/jobs work` to put your cards to work.',
				'Job outcome can affect your mappers motivation, so watch out.'
			]
		}
	];

	static get latestChangelogId() {
		return ChangelogCommand.changelog[ChangelogCommand.changelog.length - 1].id;
	}

	registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('changelog').setDescription('Show the changelog'));
	}

	async chatInputRun(interaction: ChatInputCommandInteraction) {
		await interaction.reply({
			embeds: [new EmbedBuilder().setTitle('Changelog').setDescription(ChangelogCommand.renderChangelog(ChangelogCommand.changelog.reverse()))]
		});
	}

	static renderChangelog(changes: { id: number; date: Date; description: string[] }[]): string {
		return changes
			.map((change) => {
				return `**${change.date.toLocaleDateString('en-US', {
					month: 'long',
					day: 'numeric'
				})}**\n${change.description.join('\n')}`;
			})
			.join('\n\n');
	}
}
