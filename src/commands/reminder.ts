import {ApplicationCommandRegistry, Command} from "@sapphire/framework";
import {ChatInputCommandInteraction} from "discord.js";
import {DiscordUserService} from "../services/discordUserService.js";
import {db} from "../db.js";
import {DiscordUser} from "../entities/discordUser.js";

export class ReminderCommand extends Command {

    registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('reminder')
                .setDescription('Enable or disable reminder')
        );
    }

    async chatInputRun(interaction: ChatInputCommandInteraction) {
        const user = await DiscordUserService.findOrCreate(interaction.user);

        user.reminderEnabled = !user.reminderEnabled;

        await db.getRepository(DiscordUser).update(user.id, {
            reminderEnabled: user.reminderEnabled
        });

        await interaction.reply({
            content: `Reminder ${user.reminderEnabled ? 'enabled' : 'disabled'}`,
            ephemeral: true
        });
    }

}