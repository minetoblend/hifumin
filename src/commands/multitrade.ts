import {ApplicationCommandRegistry} from "@sapphire/framework";
import {Subcommand} from "@sapphire/plugin-subcommands";
import {DiscordUserService} from "../services/discordUserService.js";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    CommandInteraction,
    InteractionResponse
} from "discord.js";
import {TradeService} from "../services/tradeService.js";
import {db} from "../db.js";
import {InventoryItem} from "../entities/inventoryItem.js";
import {Card} from "../entities/card.js";
import {TradeSession} from "../entities/tradeSession.js";

export class Multitrade extends Subcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: 'multitrade',
            subcommands: [
                {
                    name: 'start',
                    chatInputRun: 'chatInputStart'
                },
                {
                    name: 'add',
                    chatInputRun: 'chatInputAdd'
                },
                {
                    name: 'remove',
                    chatInputRun: 'chatInputRemove'
                },
                {
                    name: 'cancel',
                    chatInputRun: 'chatInputCancel'
                }
            ]
        });
    }

    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            builder =>
                builder.setName('multitrade')
                    .setDescription('Trade multiple cards at once')
                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName('start')
                                .setDescription('Stard a new trading session')
                                .addUserOption(option =>
                                    option
                                        .setName('user')
                                        .setDescription('The user to trade with')
                                        .setRequired(true)
                                )
                    )
                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName('add')
                                .setDescription('Offer a card or item')
                                .addStringOption(option =>
                                    option
                                        .setName('id')
                                        .setDescription('The card code or item ID to offer')
                                        .setRequired(true)
                                )
                                .addIntegerOption(option =>
                                    option
                                        .setName('quantity')
                                        .setDescription('The quantity, when offering an item')
                                        .setRequired(false)
                                )
                    )
                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName('remove')
                                .setDescription('Remove a card or item from the offer')
                                .addStringOption(option =>
                                    option
                                        .setName('id')
                                        .setDescription('The card code or item ID to remove')
                                        .setRequired(true)
                                )
                    )
                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName('cancel')
                                .setDescription('Cancel the trading session')
                    )
        )
    }

    async chatInputStart(interaction: ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user)
        const user2 = await DiscordUserService.findOrCreate(interaction.options.getUser('user', true)!)

        try {
            await TradeService.startSession(user, user2, async () => {

                const msg = await interaction.reply({
                    content: `<@${user2.id}> has been invited to trade with <@${user.id}>`,
                    allowedMentions: {users: [user.id, user2.id]},
                    components: [
                        new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('accept')
                                    .setLabel('Accept')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('decline')
                                    .setLabel('Decline')
                                    .setStyle(ButtonStyle.Danger)
                            )
                    ]
                })

                const response = await msg.awaitMessageComponent({
                    filter: (i) => i.user.id === user2.id,
                })

                return response.customId === 'accept'
            })
        } catch (e) {
            if(e instanceof Error) {
                await interaction.reply({
                    content: e.message,
                    ephemeral: true
                })
            }
        }
    }

    async chatInputAdd(interaction: ChatInputCommandInteraction) {
        // Add a card or item to the offer
        const user = await DiscordUserService.findOrCreate(interaction.user)

        const response = await interaction.deferReply()

        const id = interaction.options.getString('id', true)!
        const quantity = interaction.options.getInteger('quantity') ?? 1

        const item = await db.getRepository(InventoryItem).findOneBy({ id })
        const card = await db.getRepository(Card).findOneBy({ id } )

        try {
            if(item) {
                await TradeService.addItem(user, item.id, quantity)
                const session = await TradeService.getActiveSession(user)
                await this.renderTradeSession(session!, response)
            } else if(card) {
                await TradeService.addCard(user, card.id)
                const session = await TradeService.getActiveSession(user)
                await this.renderTradeSession(session!, response)
            } else {
                await interaction.reply({
                    content: 'Item or card not found',
                    ephemeral: true
                })
            }
        } catch (e) {
            if(e instanceof Error) {
                await interaction.reply({
                    content: e.message,
                    ephemeral: true
                })
            }
        }
    }

    //@ts-ignore
    async chatInputRemove(interaction: ChatInputCommandInteraction) {
        // Remove a card or item from the offer
    }

    //@ts-ignore
    async chatInputCancel(interaction: CommandInteraction) {
        // Cancel the trading session
    }

    //@ts-ignore
    private async renderTradeSession(session: TradeSession, response: InteractionResponse<boolean>) {
        await response.edit({
            content: 'Trade session wip',
        })
    }
}