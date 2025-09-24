import { userSessions } from "../bot/command.js";
import User from "../Models/user.model.js";

export const tryCatchWrapper =
  (fn) =>
  async (ctx, ...args) => {
    try {
      return await fn(ctx, ...args);
    } catch (error) {
      console.error("Exception occured:", error.message);
      ctx.reply("An error occured while processing your request");
    }
  };

export const tryCatchsshWrapper =
  (fn) =>
  async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error("Exception occured:", error.message);
      // ctx.reply('An error occured while processing your request');
    }
  };

export const stopBotCleanup = tryCatchsshWrapper(async () => {
  console.log("Running Cleanups");
  const dispose = [];
  userSessions.forEach((session, userId) => {
    if (session["ssh"] && session["ssh"].isConnected())
      dispose.push(session["ssh"].dispose());
    userSessions.delete(userId);
  });
  await Promise.all(dispose);
});

export const upsertUser = tryCatchsshWrapper(async (userDetails,newVM) => {
  // upsert to create new one | new to return document
  const timeStamp = DateTime.now().setZone('Asia/Kolkata').toJSDate();
  await User.findOneAndUpdate(
    { userId: userDetails.userId },
    {
      $set: { ...userDetails, lastLoginTime: timeStamp },
      $inc: { loginCount: 1 },
      $addToSet: {vm: newVM},
    },
    { upsert: true, new: true }
  );
});

export const welcomeMessage = `
👋 Welcome to *SSH VM Connector Bot*!

This bot allows you to connect to your virtual machines via SSH and run commands directly from Telegram.

💡 *Usage:*
• Connect to a VM:
  \`/connect <ip> <username> <password>\`

• Disconnect from a VM:
  \`/disconnect\`

• Stream a command in real-time:
  \`/stream <command>\`

⚠️ Make sure your VM is accessible and the credentials are correct.

Happy SSH-ing! 🚀
`;
