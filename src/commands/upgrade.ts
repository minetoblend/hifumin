import {ApplicationCommandRegistry, Command} from "@sapphire/framework";
import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder
} from "discord.js";
import {Card} from "../entities/card.js";
import {db} from "../db.js";
import {DiscordUserService} from "../services/discordUserService.js";
import {renderCard} from "../services/cardRenderer.js";
import {InventoryEntry} from "../entities/inventoryEntry.js";
import { unlink } from "fs/promises";

export class UpgradeCommand extends Command {
    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('upgrade')
                .setDescription('Upgrade a card')
                .addStringOption(option =>
                    option.setName('card')
                        .setDescription('The card to upgrade')
                        .setRequired(false)
                )
        );
    }

    async chatInputRun(interaction: ChatInputCommandInteraction) {
        const cardId = interaction.options.getString('card');

        const user = await DiscordUserService.findOrCreate(interaction.user);

        let card: Card | null;
        if (cardId) {
            card = await db.getRepository(Card).findOne({
                where: {
                    id: cardId,
                },
                relations: ['mapper', 'owner', 'condition', 'condition.nextUpgrade', 'condition.previousUpgrade']
            });
        } else {
            card = await db.getRepository(Card).findOne({
                where: {
                    owner: {
                        id: user.id
                    },
                    burned: false
                },
                order: {
                    createdAt: 'DESC'
                },
                relations: ['mapper', 'owner', 'condition', 'condition.nextUpgrade', 'condition.previousUpgrade']
            });
        }

        if (!card) {
            await interaction.reply('Card not found');
            return;
        }

        if (card.owner?.id !== user.id) {
            await interaction.reply('You do not own this card');
            return;
        }

        let condition = card.condition;

        if (!condition.nextUpgrade) {
            await interaction.reply('This card cannot be upgraded!');
            return;
        }

        const upgradePrice = condition.upgradePrice * (card.foil ? 2 : 1);

        const imagePath = await renderCard(card, {cardCode: true})

        const attachment = new AttachmentBuilder(imagePath)
            .setName('card.png')

        const embed = new EmbedBuilder()
            .setTitle('Upgrade card')
            .setThumbnail('attachment://card.png')
            .setDescription([
                `Upgrading the \`${card.mapper.username}\` card from from **${condition.id}** to **${condition.nextUpgrade.id}** has a ${Math.floor(condition.upgradeChance * 100)}% chance of success.`,
                condition.previousUpgrade ? `If the upgrade fails, there is a 50% chance the card will be downgraded to **${condition.previousUpgrade.id}**` : `If the upgrade fails, nothing will happen.`,
                '',
                'Attempting to upgrade will cost',
                '```diff',
                `-${upgradePrice} Gold`,
                '```',
                'Use the :hammer: button to upgrade the card.'
            ].join('\n'))

        const msg = await interaction.reply({
            files: [attachment],
            embeds: [embed],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('cancel')
                            .setEmoji('❌')
                            .setStyle(ButtonStyle.Secondary)
                    )
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('upgrade')
                            .setEmoji('🔨')
                            .setStyle(ButtonStyle.Secondary)
                    )
            ]
        });

        await unlink(imagePath)

        const response = await msg.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (interaction) => interaction.user.id === user.id,
        })

        if (response.customId === 'cancel') {
            await response.update({
                embeds: [
                    embed.setFooter({text: 'Upgrade cancelled',})
                        .setColor('Red')
                ],
                components: []
            });
            return;
        } else {
            await db.transaction('SERIALIZABLE', async (tx) => {
                const currentCard = await tx.getRepository(Card).findOne({
                    where: {
                        id: card.id
                    },
                    relations: ['condition', 'owner', 'mapper'],
                })

                if (currentCard?.owner?.id !== user.id || condition.id !== card.condition.id || !condition.nextUpgrade) {
                    return;
                }

                const currentGold = await tx.getRepository(InventoryEntry).findOne({
                    where: {
                        userId: user.id,
                        itemId: 'gold'
                    }
                })

                if ((currentGold?.amount ?? 0) < upgradePrice) {
                    await response.update({
                        components: [],
                        embeds: [
                            embed.setFooter({text: 'You do not have enough gold to upgrade this card',})
                                .setColor('Red')
                        ]
                    })
                    return;
                }

                condition = currentCard.condition

                if(!condition.nextUpgrade) {
                    await response.update({
                        components: [],
                        embeds: [
                            embed.setFooter({text: 'You cannot upgrade this card',})
                                .setColor('Red')
                        ]
                    })
                    return;
                }

                const random = Math.random();
                const success = random < condition.upgradeChance;
                const downgrade = !success && Math.random() < 0.5;
                if (success) {
                    currentCard.condition = condition.nextUpgrade;
                } else {
                    if (condition.previousUpgrade && downgrade) {
                        currentCard.condition = condition.previousUpgrade;
                    }
                }

                await tx.getRepository(InventoryEntry).update({
                    userId: user.id,
                    itemId: 'gold'
                }, {
                    amount: () => `amount - ${upgradePrice}`
                });
                
                await tx.getRepository(Card).save(currentCard);



                if(success) {
                    await response.update({
                        embeds: [
                            embed.setFooter({text: 'Upgrade successful',})
                                .setColor('Green')
                        ],
                        components: []
                    });
                } else {
                    await response.update({
                        embeds: [
                            embed.setFooter({text: 'Upgrade failed' + (downgrade && condition.previousUpgrade ? '. Card is now `' + condition.previousUpgrade.id + '`' : '') ,})
                                .setColor('Red')
                        ],
                        components: []
                    });
                }
            })
        }

    }
}