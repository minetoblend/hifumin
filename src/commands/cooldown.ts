import {Command} from "@sapphire/framework";
import {getTimeout, TimeoutType} from "../services/timeout.js";
import {DiscordUserService} from "../services/discordUserService.js";
import {EmbedAssertions, EmbedBuilder, User} from "discord.js";
import {ItemService} from "../services/itemService.js";
import {UserEffect} from "../entities/userEffect.js";
import {db} from "../db.js";
import { InventoryItem } from "../entities/inventoryItem.js";
import { LessThan, MoreThan } from "typeorm";

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

            return { dropCooldown, claimCooldown, dailyCooldown}
        })

        const effects: UserEffect[] = await db.getRepository(UserEffect).find({
            where: {
                userId: user.id,
                activeUntil: MoreThan(new Date())
            }
        })

        const freeClaimCount = await ItemService.getItemCount(user, 'free claim')

        const embedBuilder = 
            new EmbedBuilder()
                .setTitle('Cooldowns')
                .addFields([
                    {
                        name: 'Drop',
                        value: dropCooldown <= 0 ? 'Ready to use' : `${dropCooldown < 60_000 ? Math.ceil(dropCooldown / 1000) + 'seconds' : Math.ceil(dropCooldown / 60_000) + 'minutes'} remaining`,
                    },
                    {
                        name: 'Claim',
                        value: (claimCooldown <= 0 ? 'Ready to use' : `${claimCooldown < 60_000 ? Math.ceil(claimCooldown / 1000) + 'seconds' : Math.ceil(claimCooldown / 60_000) + 'minutes'} remaining`) +
                            (freeClaimCount > 0 ? ` (+${freeClaimCount} free claim${freeClaimCount > 1 ? 's' : ''})` : ''),
                    },
                    {
                        name: 'Daily',
                        value: dailyCooldown <= 0 
                        ? 'Ready to use' 
                        : `${dailyCooldown < (60_000 * 60) ? Math.ceil(dailyCooldown / 60_000) + ' minutes' : Math.ceil(dailyCooldown / (60_000 * 60)) + ' hours'} remaining`,
                    }
                ])
        

        if (effects.length > 0) {
            for (var effect of effects) {
                const duration: number = effect.activeUntil.getTime() - Date.now()
                
                let name = "";
                switch (effect.effect) {
                    case "claim speedup": 
                        name = "Claim Speedup";
                        break;
                    case "drop speedup":
                        name = "Drop Speedup";
                        break;
                    default:
                        let item = await db.getRepository(InventoryItem).findOne({
                            where: {
                                id: effect.effect
                            }
                        })
                        name = item.name
                }

                embedBuilder.addFields({
                    name: name,
                    value: `${duration < (60_000 * 60) ? Math.ceil(duration / 60_000) + ' minutes' : Math.ceil(duration / (60_000 * 60)) + ' hours'} remaining`,
                })
            }
        }

        const embeds = [embedBuilder]

        await interaction.reply({
            embeds
        });
    }
}