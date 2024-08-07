import { Command } from "@sapphire/framework";
import { db } from "../db.js";
import { Card } from "../entities/card.js";
import { renderCard } from "../services/cardRenderer.js";
import { MessageBuilder } from "@sapphire/discord.js-utilities";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { unlink } from "fs/promises";

export class ViewCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {...options});
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
        builder.setName('view').setDescription('View a card')
            .addStringOption(option => option.setName('card').setDescription('The card to view').setRequired(true))
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const id = interaction.options.getString('card')!

    if(id.length != 4) {
      await interaction.reply({
        content: 'Invalid card code',
        ephemeral: true
      })
      return;
    }

    const card = await db
        .getRepository(Card)
        .findOne({
          where: {
            id,
            burned: false,
          },
          relations: ['owner', 'condition', 'mapper']
        })

    if(!card || !card.owner) {
      await interaction.reply({
        content: 'Card not found',
        ephemeral: true
      })
      return;
    }

    const file = await renderCard(card)
    const attachmentFilename = file.endsWith('.gif') ? 'card.gif' : 'card.png'

    await interaction.reply(new MessageBuilder()
        .addFile(
            new AttachmentBuilder(file)
                .setName(attachmentFilename),
        )
        .setEmbeds([
            new EmbedBuilder()
                .setTitle(`\`${card.id}\` - ${card.mapper.username}`)
                .setImage('attachment://' + attachmentFilename)
                .addFields([
                  {
                    name: 'Owner',
                    value: card.owner!.username,
                  },
                  {
                    name: 'Condition',
                    value: card.condition.id,
                  },
                  {
                    name: 'Burn Value',
                    value: card.burnValue + ' Gold'
                  }
                ])
        ])
    )

    await unlink(file)
  }
}