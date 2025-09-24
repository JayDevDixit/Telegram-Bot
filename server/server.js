import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import https from "https";
import { setBotCommand } from "./bot/command.js";
import { stopBotCleanup } from "../utility/utils.js";
dotenv.config();

const PORT = process.env.PORT || 5000;

if (!process.env.BOT_TOKEN_sshvm101Bot) {
  console.log("No bot token found in .env");
  process.exit(1);
}
const agent = new https.Agent({ keepAlive: process.env.ENVIRONMENT == 'production' });
const bot = new Telegraf(process.env.BOT_TOKEN_sshvm101Bot, {
  telegram: {
    agent,
  },
});

setBotCommand(bot);



bot.launch();
console.log("bot running");







process.once("SIGINT", () => {
  bot.stop("SIGINT");
  stopBotCleanup()
  agent.destroy();
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  stopBotCleanup();
  agent.destroy();
});
