import { buildConnection, userSessions } from "../bot/command.js";
import User from "../Models/user.model.js";

export const tryCatchWrapper =
  (fn) =>
  async (ctx, ...args) => {
    try {
      return await fn(ctx, ...args);
    } catch (error) {
      console.error("Exception occured:", error.message);
      ctx.reply("⚠️ An error occured while processing your request");
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
  console.log("🧹 Running Cleanups");
  const dispose = [];
  userSessions.forEach((session, userId) => {
    if (session["ssh"] && session["ssh"].isConnected())
      dispose.push(session["ssh"].dispose());
    userSessions.delete(userId);
  });
  await Promise.all(dispose);
});

export const upsertUser = tryCatchsshWrapper(async (userDetails, newVM) => {
  const user = await User.findOne({ userId: userDetails.userId });
  if (user) {
    user.lastLoginTime = new Date();
    user.loginCount += 1;
    let existingVM = user.vm.find(
      (v) => v.host == newVM.host && v.username == newVM.username
    );
    if (existingVM) {
      if (existingVM.password != newVM.password)
        existingVM.password = newVM.password;
    } else {
      user.vm.push(newVM);
    }
    await user.save();
  } else {
    await User.create({
      ...userDetails,
      vm: [newVM],
      lastLoginTime: new Date(),
      loginCount: 1,
    });
  }
});

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
export const validateipv4 = tryCatchsshWrapper(async (ip) => {
  return ipv4Regex.test(ip);
});

export const startLoginWizard = tryCatchWrapper(async (ctx) => {
  ctx.reply("👋 Welcome! Let's login.\n\n🖥️ Enter the IP Address of your Virtual Machine:");
  return ctx.wizard.next();
});

export const inputHost = tryCatchWrapper(async (ctx) => {
  const host = ctx.message.text.trim();
  if (host.toLowerCase() == "exit") {
    ctx.reply(welcomeMessage);
    return ctx.scene.leave();
  }

  if (await validateipv4(host)) {
    ctx.reply("🧑 Enter the username for the VM:");
    ctx.wizard.state.host = host;
    return ctx.wizard.next();
  }
  ctx.reply(
    "❌ Invalid IP Address. Type *exit* to close this wizard.\n\n🖥️ Enter IP Address of Virtual Machine"
  );
  return;
});

export const inputUsername = tryCatchWrapper(async (ctx) => {
  ctx.wizard.state.username = ctx.message.text;
  ctx.reply("🔑 Enter the Password for the VM:");
  return ctx.wizard.next();
});

export const loginvm = tryCatchWrapper(async (ctx) => {
  const credential = {
    host: ctx.wizard.state.host,
    username: ctx.wizard.state.username,
    password: ctx.wizard.state.password,
  };
  await buildConnection(ctx, credential);
});

export const inputPassword = tryCatchWrapper(async (ctx) => {
  ctx.wizard.state.password = ctx.message.text;
  ctx.reply("⏳ Connecting to Virtual Machine...");
  await loginvm(ctx);
  return ctx.scene.leave();
});

export const welcomeMessage = `
👋 Welcome to *SSH VM Connector Bot*! 🚀

This bot allows you to connect to your virtual machines via SSH and run commands directly from Telegram.

💡 *Usage:*
• Connect to a VM:
  \`/connect <ip> <username> <password>\`

• Disconnect from a VM:
  \`/disconnect\`

• Stream a command in real-time:
  \`/stream <command>\`

⚠️ Make sure your VM is accessible and the credentials are correct.

Happy SSH-ing! 🖥️✨
`;
