import { db } from "../db.js";
import { DiscordUser } from "../entities/discordUser.js";
import { EventLog } from "../entities/eventLog.js";

export class EventLogService {
  static logEvent(user: DiscordUser, action: string, info = {}) {
    try {
      const log = new EventLog()
      log.user = user
      log.username = user.username
      log.action = action
      log.info = info
      log.timestamp = new Date()
      db.getRepository(EventLog).save(log)
    } catch (e) {
      console.error('Failed to log event', e)
    }
  }
}