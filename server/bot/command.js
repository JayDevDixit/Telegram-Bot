import { inputHost, inputPassword, inputUsername, startLoginWizard, tryCatchWrapper, upsertUser, welcomeMessage } from "../utility/utils.js";
import { connectVM, executecmd, streamcmd } from "../connection/ssh.connect.js";
import User from "../Models/user.model.js";
import { Markup, Scenes, session as sessionMiddleware } from 'telegraf';

export const userSessions = new Map(); // Map{userId: { ssh,cwd }}
const { WizardScene, Stage } = Scenes;
const loginWizard = new WizardScene('login-wizard', startLoginWizard, inputHost, inputUsername, inputPassword);
const stage = new Stage([loginWizard]);

const showSavedvms = tryCatchWrapper(async (ctx) => {
  const userDetail = await User.findOne({ userId: ctx.from.id });
  const buttons = [[Markup.button.callback(`🖥️ Connect New Virtual Machine`, JSON.stringify({ 'NewConnection': true }))]];
  if (!userDetail || !userDetail.vm || userDetail.vm.length < 1) return buttons;
  for (let vm of userDetail.vm) {
    if (!vm.host || !vm.username || !vm.password) continue;
    buttons.push(
      [Markup.button.callback(`💻 Connect ${vm.username}@${vm.host}`, JSON.stringify({ 'host': vm.host, 'username': vm.username, 'password': vm.password }))]
    );
  }
  return Markup.inlineKeyboard(buttons);
});

const getSession = tryCatchWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  return session;
});

const sessionValidate = tryCatchWrapper(async (ctx) => {
  const session = await getSession(ctx);
  if (!session || !session.ssh.isConnected()) {
    const keyboard = await showSavedvms(ctx);
    if (keyboard)
      ctx.reply(`🔌 Connect with a VM using \n/connect ip username password`, keyboard);
    else
      ctx.reply(`🔌 Connect with a VM using \n/connect ip username password`);
    return false;
  }
  return true;
});

const formatOutput = tryCatchWrapper(async (ctx, output) => {
  const session = await getSession(ctx);
  let reply_msg = `🌐 IP: ${session["host"]}  `;
  reply_msg += output.code == 0 ? "✅ Success\n" : "❌ Error\n";
  reply_msg += `\n${output.stdout}\n`;
  reply_msg += `${output.stderr}`;
  return reply_msg;
});

const execute = tryCatchWrapper(async (ctx) => {
  const session = await getSession(ctx);
  const output = await executecmd(
    ctx.text.trim(),
    session["cwd"],
    session["ssh"]
  );
  return output;
});

export const buildConnection = tryCatchWrapper(async (ctx, { host, username, password }) => {
  if (!host || !username || !password)
    return await ctx.reply(
      `❌ Invalid input\n💡 Correct usage:\n/connect ip username password`
    );
  const ssh = await connectVM({ host, username, password });
  const userId = ctx.from.id;
  if (ssh) {
    userSessions.set(userId, { host, cwd: "/root", ssh });
    ctx.reply(
      `✅ Connection to VM ${userSessions.get(userId)["host"]} is successful!\nCurrent working directory: ${userSessions.get(userId)["cwd"]} 🖥️`
    );
    const userDetails = {
      fullname: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : ''),
      username: ctx.from.username || '',
      userId: ctx.from.id.toString(),
    }
    upsertUser(userDetails, { host, username, password });
  } else {
    ctx.reply(`❌ Error connecting to VM ${host}`);
  }
})

export const setBotCommand = tryCatchWrapper(async (bot) => {

  bot.use(sessionMiddleware());
  bot.use(stage.middleware());

  bot.start(
    tryCatchWrapper(async (ctx) => {
      ctx.reply(welcomeMessage);
    })
  );

  bot.command(
    "connect",
    tryCatchWrapper(async (ctx) => {
      const [host, username, password] = ctx.payload?.trim().split(/\s+/) || [];
      if (host && username && password)
        await buildConnection(ctx, { host, username, password });
      else
        ctx.scene.enter('login-wizard');
    })
  );

  bot.command(
    "disconnect",
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) return;
      const session = await getSession(ctx);
      session['ssh'].dispose();
      userSessions.delete(ctx.from.id);
      ctx.reply('🛑 Disconnected from VM successfully');
    })
  );

  bot.command("stream", tryCatchWrapper(async (ctx) => {
    if (!(await sessionValidate(ctx))) return;
    const session = await getSession(ctx);
    const cmd = ctx.payload.trim();
    await streamcmd(ctx, cmd, session['cwd'], session['ssh']);
  }))

  bot.on('callback_query', tryCatchWrapper(async (ctx) => {
    const data = JSON.parse(ctx.callbackQuery.data);
    if (!data) {
      console.log('Error in parsing callback query data');
      return;
    }
    if (data['NewConnection']) {
      ctx.scene.enter('login-wizard');
    } else {
      await buildConnection(ctx, { host: data['host'], username: data['username'], password: data['password'] });
    }
  }))

  bot.hears(
    /^\s*cd\s+.+/,
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) return;
      const output = await execute(ctx);
      if (output.code == 0 && output.stderr == "") {
        const session = await getSession(ctx);
        const path = ctx.text.trim().split(/\s+/)[1];
        session["cwd"] = path;
      }
      const reply_msg = await formatOutput(ctx, output);
      ctx.reply(reply_msg);
    })
  );

  bot.on(
    "text",
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) return;
      const output = await execute(ctx);
      const reply_msg = await formatOutput(ctx, output);
      ctx.reply(reply_msg);
    })
  );

  bot.catch(tryCatchWrapper(async (err, ctx) => {
    ctx.reply('⚠️ An error occurred');
    console.error('Error while handling user request', err.message);
  }));

});
