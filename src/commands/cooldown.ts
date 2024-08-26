import {Command} from "@sapphire/framework";
import {getTimeout, TimeoutType} from "../services/timeout.js";
import {DiscordUserService} from "../services/discordUserService.js";
import {EmbedBuilder} from "discord.js";
import {ItemService} from "../services/itemService.js";
import {UserEffect} from "../entities/userEffect.js";
import {db} from "../db.js";
import { InventoryItem } from "../entities/inventoryItem.js";
import { MoreThan } from "typeorm";

export class CooldownCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('cooldown').setDescription('View your cooldowns')
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user)

        const { dropCooldown, claimCooldown, dailyCooldown } = await db.transaction(async (tx) => {
            const dropCooldown = (await getTimeout(user, TimeoutType.Drop, tx)).remainingTime
            const claimCooldown = (await getTimeout(user, TimeoutType.Claim, tx)).actualRemainingTime
            const dailyCooldown = (await getTimeout(user, TimeoutType.Daily, tx)).actualRemainingTime

            console.log({ dropCooldown, claimCooldown, dailyCooldown})
            return { dropCooldown, claimCooldown, dailyCooldown}
        })

        const [effects, freeClaimCount] = await Promise.all([
            await db.getRepository(UserEffect).find({
              where: {
                userId: user.id,
                activeUntil: MoreThan(new Date())
              }
            }),
            ItemService.getItemCount(user, 'free claim')
          ])

        const embedBuilder = 
            new EmbedBuilder()
                .setTitle('Cooldowns')
                .addFields([
                    {
                        name: 'Drop',
                        value: dropCooldown <= 0 ? 'Ready to use' : this.getFormattedCooldown(dropCooldown) + ' remaining',
                    },
                    {
                        name: 'Claim',
                        value: (claimCooldown <= 0 ? 'Ready to use' : this.getFormattedCooldown(claimCooldown)) + (freeClaimCount > 0 ? ` (+${freeClaimCount} free claim${freeClaimCount > 1 ? 's' : ''})` : ''),
                    },
                    {
                        name: 'Daily',
                        value: dailyCooldown <= 0 ? 'Ready to use' : this.getFormattedCooldown(dailyCooldown) + ' remaining',
                    }
                ])
        

        if (effects.length > 0) {
            for (var effect of effects) {
                const duration: number = effect.activeUntil.getTime() - Date.now()
                const durationValue = this.getFormattedCooldown(duration) + ' remaining'
                
                const name = await this.getEffectName(effect)
                
                embedBuilder.addFields({
                    name: name,
                    value: durationValue,
                })
            }
        }

        await interaction.reply({
            embeds: [embedBuilder]
        });
    }

    private async getEffectName(effect: UserEffect) {
            switch (effect.effect) {
                case "claim speedup": 
                    return "Claim Speedup";
                case "drop speedup":
                    return "Drop Speedup";
                default:
                    let item = await db.getRepository(InventoryItem).findOne({
                        where: {
                            id: effect.effect
                        }
                    })
                    return item?.name ?? effect.effect;
            }
    }

    private getFormattedCooldown(cooldown: number) {
        if (cooldown >= 60 * 60_000)
            return `${Math.ceil(cooldown / (60 * 60_000))} hours`
          
        if (cooldown >= 60_000)
            return `${Math.ceil(cooldown / 60_000)} minutes`
          
        return `${Math.ceil(cooldown / 1000)} seconds`
    }
}