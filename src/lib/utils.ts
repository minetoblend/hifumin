import {
	container,
	type ChatInputCommandSuccessPayload,
	type Command,
	type ContextMenuCommandSuccessPayload,
	type MessageCommandSuccessPayload
} from '@sapphire/framework';
import { cyan } from 'colorette';
import { ChannelType, type APIUser, type Channel, type Guild, type User } from 'discord.js';

export function logSuccessCommand(payload: ContextMenuCommandSuccessPayload | ChatInputCommandSuccessPayload | MessageCommandSuccessPayload): void {
	let successLoggerData: ReturnType<typeof getSuccessLoggerData>;

	if ('interaction' in payload) {
		successLoggerData = getSuccessLoggerData(payload.interaction.guild, payload.interaction.channel, payload.interaction.user, payload.command);
	} else {
		successLoggerData = getSuccessLoggerData(payload.message.guild, payload.message.channel, payload.message.author, payload.command);
	}

	container.logger.debug(`${successLoggerData.shard} - ${successLoggerData.commandName} ${successLoggerData.author} ${successLoggerData.sentAt}`);
}

export function getSuccessLoggerData(guild: Guild | null, channel: Channel | null, user: User, command: Command) {
	const shard = getShardInfo(guild?.shardId ?? 0);
	const commandName = getCommandInfo(command);
	const author = getAuthorInfo(user);
	const sentAt = getGuildInfo(guild, channel);

	return { shard, commandName, author, sentAt };
}

function getShardInfo(id: number) {
	return `[${cyan(id.toString())}]`;
}

function getCommandInfo(command: Command) {
	return cyan(command.name);
}

function getAuthorInfo(author: User | APIUser) {
	return `${author.username}[${cyan(author.id)}]`;
}

function getGuildInfo(guild: Guild | null, channel: | Channel | null) {
	if (guild === null) return 'Direct Messages';
	let text = `${guild.name}[${cyan(guild.id)}]`;

	if(channel?.type === ChannelType.GuildText) {
		text += ` #${channel.name}[${cyan(channel.id)}]`;
	}

	return text
}

export function stringId(id: number) {
	let stringId = '';
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

	const is5Digit = id >= 36 ** 4;
	const length = is5Digit ? 5 : 4;
	if (is5Digit) id -= 36 ** 4;

	for (let i = 0; i < length; i++) {
		stringId += chars[id % chars.length];
		id = Math.floor(id / chars.length);
	}

	return stringId.split('').reverse().join('');
}
