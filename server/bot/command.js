import {
  inputHost,
  inputPassword,
  inputUsername,
  replyPreserveFormatting,
  startLoginWizard,
  tryCatchWrapper,
  upsertUser,
  welcomeMessage,
} from "../utility/utils.js";
import {
  connectVM,
  downloadFileFromVM,
  executecmd,
  streamcmd,
  uploadFileToVM,
} from "../connection/ssh.connect.js";
import User from "../Models/user.model.js";
import { Markup, Scenes, session as sessionMiddleware } from "telegraf";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import axios from "axios";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
export const userSessions = new Map(); // Map{userId: { ssh,cwd }}
const { WizardScene, Stage } = Scenes;
const loginWizard = new WizardScene(
  "login-wizard",
  startLoginWizard,
  inputHost,
  inputUsername,
  inputPassword
);
const stage = new Stage([loginWizard]);

const getdirPath = tryCatchWrapper(async (ctx) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const user = ctx.from.username || ctx.from.id;
  const dirPath = join(__dirname, "..", "files", user);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
});

const downloadFile = tryCatchWrapper(async (ctx) => {
  const fileId = ctx.message.document.file_id;
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const filePath = join(await getdirPath(ctx),ctx.message.document.file_name);
  const writer = createWriteStream(filePath);
  const response = await axios.get(fileLink.href, { responseType: "stream" });
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on("finish", () => {
      writer.close();
      console.log(`file downloaded ${filePath}`);
      resolve(filePath);
    });
    writer.on("error", (err) => {
      fs.unlink(filePath, () => {});
      console.log(`Error downloading file ${err.message} ${filePath}`);
      reject(err);
    });
  });
  return filePath;
});

const showSavedvms = tryCatchWrapper(async (ctx) => {
  const userDetail = await User.findOne({ userId: ctx.from.id });
  const buttons = [
    [
      Markup.button.callback(
        `🖥️ Connect New Virtual Machine`,
        JSON.stringify({ NewConnection: true })
      ),
    ],
  ];
  if (!userDetail || !userDetail.vm || userDetail.vm.length < 1)
    return Markup.inlineKeyboard(buttons);
  userDetail.vm.sort((vm1, vm2) => {
    if (vm2.loginCount != vm1.loginCount)
      return vm2.loginCount - vm1.loginCount;
    else return new Date(vm2.lastLoginTime) - new Date(vm1.lastLoginTime);
  });
  for (let vm of userDetail.vm.slice(0, 10)) {
    if (!vm.host || !vm.username || !vm.password) continue;
    buttons.push([
      Markup.button.callback(
        `💻 Connect ${vm.username}@${vm.host}`,
        JSON.stringify({
          host: vm.host,
          username: vm.username,
          password: vm.password,
        })
      ),
    ]);
  }
  return Markup.inlineKeyboard(buttons);
});

export const showWelcomeMessage = tryCatchWrapper(async (ctx) => {
  const keyboard = await showSavedvms(ctx);
  if (ctx.message)
    ctx.reply(welcomeMessage, {
      reply_markup: keyboard.reply_markup,
      reply_to_message_id: ctx.message.message_id,
    });
});

const getSession = tryCatchWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  return session;
});

const sessionValidate = tryCatchWrapper(async (ctx) => {
  const session = await getSession(ctx);
  if (!session || !session.ssh.isConnected()) {
    await showWelcomeMessage(ctx);
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

export const buildConnection = tryCatchWrapper(
  async (ctx, { host, username, password }) => {
    if ((!host || !username || !password) && ctx.message)
      return await ctx.reply(
        `❌ Invalid input\n💡 Correct usage:\n/connect ip username password`,
        {
          reply_to_message_id: ctx.message.message_id,
        }
      );
    const ssh = await connectVM({ host, username, password });
    const userId = ctx.from.id;
    if (ssh) {
      userSessions.set(userId, { host, cwd: "/", ssh });
      ctx.reply(
        `✅ Connection to VM ${
          userSessions.get(userId)["host"]
        } is successful!\n🖥️ Current working directory: ${
          userSessions.get(userId)["cwd"]
        }`
      );
      const userDetails = {
        fullname:
          ctx.from.first_name +
          (ctx.from.last_name ? " " + ctx.from.last_name : ""),
        username: ctx.from.username || "",
        userId: ctx.from.id.toString(),
      };
      upsertUser(userDetails, { host, username, password });
    } else {
      ctx.reply(`❌ Error connecting to VM ${host}`);
    }
  }
);

export const setBotCommand = tryCatchWrapper(async (bot) => {
  bot.use(sessionMiddleware());
  bot.use(stage.middleware());

  bot.start(
    tryCatchWrapper(async (ctx) => {
      await showWelcomeMessage(ctx);
    })
  );

  bot.command(
    "connect",
    tryCatchWrapper(async (ctx) => {
      const [host, username, password] = ctx.payload?.trim().split(/\s+/) || [];
      if (host && username && password)
        await buildConnection(ctx, { host, username, password });
      else ctx.scene.enter("login-wizard");
    })
  );

  bot.command(
    "disconnect",
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) return;
      const session = await getSession(ctx);
      session["ssh"].dispose();
      userSessions.delete(ctx.from.id);
      if (ctx.message)
        ctx.reply(`🛑 Disconnected from VM ${session["host"]} successfully`, {
          reply_to_message_id: ctx.message.message_id,
        });
    })
  );

  bot.command(
    "stream",
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) return;
      const session = await getSession(ctx);
      const cmd = ctx.payload.trim();
      await streamcmd(ctx, cmd, session["cwd"], session["ssh"]);
    })
  );

  bot.command("download",tryCatchWrapper(async (ctx)=>{
      if (!(await sessionValidate(ctx))) return;
      const filename = ctx.payload.trim();
      const session = await getSession(ctx);
      const checkFileExistcmd = `test -f ${filename} && echo 'Exist' || echo 'Not Exist'`
      const output = await executecmd(checkFileExistcmd,session['cwd'],session['ssh']);
      if(output.stdout=='Not Exist'){
        ctx.reply(`File ${filename} not exist in current directory ${session['cwd']}`);
        return;
      }
      const remotefilepath = join(session['cwd'],filename);
      const localfilePath = join(await getdirPath(ctx),filename);
      await downloadFileFromVM(localfilePath,remotefilepath,session['ssh']);
      await ctx.replyWithDocument({
        source:localfilePath, filename
      })
  }))

  bot.on(
    "callback_query",
    tryCatchWrapper(async (ctx) => {
      const data = JSON.parse(ctx.callbackQuery.data);
      if (!data) {
        console.log("Error in parsing callback query data");
        return;
      }
      if (data["NewConnection"]) {
        ctx.scene.enter("login-wizard");
      } else {
        await buildConnection(ctx, {
          host: data["host"],
          username: data["username"],
          password: data["password"],
        });
      }
    })
  );

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
      await ctx.reply(reply_msg);
    })
  );

  bot.on(
    "text",
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) return;
      const output = await execute(ctx);
      const reply_msg = await formatOutput(ctx, output);
      await replyPreserveFormatting(ctx, reply_msg);
    })
  );

  bot.on(
    "document",
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) {
        ctx.reply(`First connect with any virtual Machine to upload files`);
        return;
      }
      const localfilePath = await downloadFile(ctx);
      const fileName = path.basename(localfilePath);
      const session = await getSession(ctx);
      const remotefilepath = path.posix.join(session["cwd"], fileName);
      await uploadFileToVM(localfilePath, remotefilepath, session["ssh"]);
      ctx.reply(`File Uploaded successfully in directory ${session["cwd"]}`);
    })
  );

  bot.catch(
    tryCatchWrapper(async (err, ctx) => {
      if (ctx.message)
        ctx.reply("⚠️ An error occurred", {
          reply_to_message_id: ctx.message.message_id,
        });
      console.error("Error while handling user request", err.message);
    })
  );
});
