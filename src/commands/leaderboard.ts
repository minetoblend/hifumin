import {Subcommand} from "@sapphire/plugin-subcommands";
import {ChatInputCommandInteraction, EmbedBuilder} from "discord.js";
import {db} from "../db.js";
import {Card} from "../entities/card.js";
import {LazyPaginatedMessage} from "@sapphire/discord.js-utilities";

export class LeaderboardCommand extends Subcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: 'leaderboard',
            subcommands: [
                {
                    name: 'cards',
                    chatInputRun: 'chatInputCards'
                }
            ]
        });
    }

    registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('leaderboard')
                .setDescription('Cards')
                .addSubcommand((command) => command.setName('cards').setDescription('Show most valuable cards'))
        );
    }

    async chatInputCards(interaction: ChatInputCommandInteraction) {
        const total = await db.getRepository(Card)
            .createQueryBuilder('card')
            .where('card.owner IS NOT NULL')
            .andWhere('card.burned = false')
            .orderBy('mapper.rarity * condition.multiplier', 'DESC')
            .getCount()



        const message = new LazyPaginatedMessage()

        for (let i = 0; i <= total && i < 250; i += 10) {
            message.addAsyncPageBuilder(async (builder) => {
                //@ts-ignore
                const cards = await db.getRepository(Card)
                    .createQueryBuilder('card')
                    .innerJoinAndSelect('card.condition', 'condition')
                    .innerJoinAndSelect('card.mapper', 'mapper')
                    .innerJoinAndSelect('card.owner', 'owner')
                    .where('card.burned = false')
                    .orderBy('mapper.rarity * condition.multiplier', 'DESC')
                    .skip(i)
                    .limit(10)
                    .getMany()

                const embed = new EmbedBuilder()
                    .setTitle('Card Leaderboard')

                // if (cards.length > 0)
                //     embed
                //         .setDescription(
                //             cards.map((card, index) => {
                //                 return `${i + index + 1}. \`$${card.burnValue}\` · ${card.mapper.username} · *Owned by ${card.owner!.username}*`
                //             })
                //                 .join('\n')
                //         )

                return builder
                    .setContent(`Page ${i / 10 + 1}/${Math.ceil(total / 10)}`)
                    .setEmbeds([embed])
            })
        }

        await message.run(interaction, interaction.user)
    }
}