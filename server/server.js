import dotenv from "dotenv";
dotenv.config();
import { Telegraf } from "telegraf";
import { setBotCommand } from "./bot/command.js";
import { stopBotCleanup } from "./utility/utils.js";
import { connectDB } from "./db/connection1.db.js";
import express from 'express';
import {tunnelmole} from 'tunnelmole';

const PORT = process.env.PORT || 5000;

if (!process.env.BOT_TOKEN_sshvm101Bot || !process.env.DOMAIN) {
  console.log("Error in getting .env variables");
  process.exit(1);
}
const app = express();
app.use(express.json());


// const DOMAIN = process.env.DOMAIN;


const WEBHOOK_PATH = `/telegraf/${process.env.BOT_TOKEN_sshvm101Bot}`;

// const agent = new https.Agent({ keepAlive: process.env.ENVIRONMENT == 'production' });
const bot = new Telegraf(process.env.BOT_TOKEN_sshvm101Bot);

connectDB();
setBotCommand(bot);

app.use(bot.webhookCallback(WEBHOOK_PATH));
app.get('/',(req,res)=>{
  res.send('Server is Running');
})
app.listen(PORT,async()=>{
  console.log(`Server is running on port ${PORT}`);
})

const url = await tunnelmole({port: PORT});
const DOMAIN = url;

const info = await bot.telegram.setWebhook(`${DOMAIN}${WEBHOOK_PATH}`);
// bot.launch();
console.log("bot running",info);


process.once("SIGINT", () => {
  bot.stop("SIGINT");
  stopBotCleanup()
  // agent.destroy();
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  stopBotCleanup();
  // agent.destroy();
});
