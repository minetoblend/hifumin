import {Subcommand} from "@sapphire/plugin-subcommands";
import {ChatInputCommandInteraction, EmbedBuilder} from "discord.js";
import {db} from "../db.js";
import {WishlistEntry} from "../entities/wishlistEntry.js";
import {DiscordUserService} from "../services/discordUserService.js";
import {Mapper} from "../entities/mapper.js";

export class WishlistCommand extends Subcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: 'wishlist',
            subcommands: [
                {
                    name: 'show',
                    chatInputRun: 'chatInputShow',
                    default: true
                },
                {
                    name: 'add',
                    chatInputRun: 'chatInputAdd'
                },
                {
                    name: 'remove',
                    chatInputRun: 'chatInputRemove'
                }
            ]
        });
    }

    registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('wishlist')
                .setDescription('Mapper wishlist')
                .addSubcommand((command) => command.setName('show').setDescription('Show wishlist'))
                .addSubcommand((command) =>
                    command
                        .setName('add')
                        .setDescription('Add a mapper to wishlist')
                        .addStringOption((option) =>
                            option.setName('username').setDescription('mapper to add to wishlist').setRequired(true)
                        )
                )
                .addSubcommand((command) =>
                    command
                        .setName('remove')
                        .setDescription('Remove a mapper from wishlist')
                        .addStringOption((option) =>
                            option.setName('username').setDescription('mapper to remove from wishlist').setRequired(true)
                        )
                )
        );
    }

    async chatInputShow(interaction: ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user);
        const entries = await db.getRepository(WishlistEntry)
            .createQueryBuilder('entry')
            .select()
            .innerJoinAndSelect('entry.mapper', 'mapper')
            .where('entry.user.id = :userId', {userId: user.id})
            .orderBy('entry.createdAt', 'ASC')
            .getMany();

        if (entries.length === 0) {
            await interaction.reply({
                content: 'Your wishlist is empty',
            });
            return;
        }

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Wishlist for ' + interaction.user.username)
                    .setDescription(entries.map((entry, index) => `${index + 1} · \`${entry.mapper.username}\``).join('\n'))
                    .setFooter({ text: 'Mappers on the wishlist have a 15% increased chance of dropping' })
            ]
        })
    }

    async chatInputAdd(interaction: ChatInputCommandInteraction) {
        const username = interaction.options.getString('username')!;
        const user = await DiscordUserService.findOrCreate(interaction.user);

        const repository = db.getRepository(WishlistEntry);

        const total = await repository.count({
            where: {
                user: {id: user.id},
            },
        });

        if (total >= 10) {
            await interaction.reply({
                content: 'You can only have 10 mappers in your wishlist',
            });
            return;
        }

        const mapper = await db.getRepository(Mapper)
            .createQueryBuilder('mapper')
            .select()
            .where('LOWER(mapper.username) = :id', {id: username.toLowerCase()})
            .getOne();

        if (!mapper) {
            await interaction.reply({
                content: 'Mapper not found',
            });
            return;
        }

        const existing = await repository.findOne({
            where: {
                user: {id: user.id},
                mapper: {id: mapper.id},
            },
        });

        if (existing) {
            await interaction.reply({
                content: `You already have \`${username}\` in your wishlist`,
            });
            return;
        }

        await repository.insert({
            user,
            mapper,
        });

        await interaction.reply({
            content: `Added \`${username}\` to your wishlist`,
        });
    }

    async chatInputRemove(interaction: ChatInputCommandInteraction) {
        const username = interaction.options.getString('username')!;
        const user = await DiscordUserService.findOrCreate(interaction.user);

        const mapper = await db.getRepository(Mapper)
            .createQueryBuilder('mapper')
            .select()
            .where('LOWER(mapper.username) = :id', {id: username.toLowerCase()})
            .getOne();

        if (!mapper) {
            await interaction.reply({
                content: 'Mapper not found',
            });
            return;
        }

        const repository = db.getRepository(WishlistEntry);
        const entry = await repository.findOne({
            where: {
                user: {id: user.id},
                mapper: {id: mapper.id},
            },
        });

        if (!entry) {
            await interaction.reply({
                content: `You do not have \`${username}\` in your wishlist`,
            });
            return;
        }

        await repository.remove(entry);

        await interaction.reply({
            content: `Removed \`${username}\` from your wishlist`,
        });
    }
}