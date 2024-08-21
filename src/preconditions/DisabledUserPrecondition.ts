import { AllFlowsPrecondition, Precondition } from "@sapphire/framework";
import { ChatInputCommandInteraction } from "discord.js";
import { DiscordUserService } from "../services/discordUserService.js";



export class DisabledUserPrecondition extends AllFlowsPrecondition {
  
  public constructor(context: AllFlowsPrecondition.LoaderContext, options: AllFlowsPrecondition.Options) {
    super(context, {
      ...options,
      position: 20
    });
  }


  messageRun(): Precondition.Result {
    return this.ok();
  }

  contextMenuRun(): Precondition.Result {
    return this.ok();
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const user = await DiscordUserService.findById(interaction.user.id)

    if (user && user.deactivated) {
      return this.error({
        message: 'User has been deactivated.'
      })
    }
    
    return this.ok()
  }

}