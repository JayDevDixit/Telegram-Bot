import { tryCatchWrapper, upsertUser, welcomeMessage } from "../utility/utils.js";
import { connectVM, executecmd, streamcmd } from "../connection/ssh.connect.js";

export const userSessions = new Map(); // Map{userId: { ssh,cwd }}

const getSession = tryCatchWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  return session;
});

const sessionValidate = tryCatchWrapper(async (ctx) => {
  const session = await getSession(ctx);
  if (!session || !session.ssh.isConnected()) {
    ctx.reply(`First connect with vm using \n/connect ip username password`);
    return false;
  }
  return true;
});

const formatOutput = tryCatchWrapper(async (ctx, output) => {
  const session = await getSession(ctx);
  let reply_msg = `ip: ${session["host"]}  `;
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

export const setBotCommand = tryCatchWrapper(async (bot) => {
  bot.start(
    tryCatchWrapper(async (ctx) => {
      // console.log(ctx)
      // console.log({from:ctx.from,chat:ctx.chat,entities:ctx.entities[0]});
      ctx.reply(welcomeMessage);
    })
  );

  bot.command(
    "connect",
    tryCatchWrapper(async (ctx) => {
      const [host, username, password] = ctx.payload.trim().split(/\s+/); // in js regex written in /.../    \s = single space  + for one or more consecutive space
      if (!host || !username || !password)
        return ctx.reply(
          `Invalid input\nCorrect usage is:\n/connect ip username password`
        );
      const ssh = await connectVM({ host, username, password });
      const userId = ctx.from.id;
      if (ssh) {
        userSessions.set(userId, { host, cwd: "/root", ssh });
        ctx.reply(
          `✅ Connection to vm ${
            userSessions.get(userId)["host"]
          } is successfull\nCurrent working directory is ${
            userSessions.get(userId)["cwd"]
          }`
          
        );
        const userDetails = {
          fullname: ctx.from.first_name + (ctx.from.last_name ? ' '+ctx.from.last_name : ''),
          username: ctx.from.username || '',
          userId: ctx.from.id.toString(),
        }
        upsertUser(userDetails,{host,username,password});


      } else {
        ctx.reply(`❌ Error connecting vm ${host}`);
      }
    })
  );

    bot.command(
    "disconnect",
    tryCatchWrapper(async (ctx) => {
      if (!(await sessionValidate(ctx))) return;
      const session = await getSession(ctx);
      session['ssh'].dispose();
      userSessions.delete(ctx.from.id);
      ctx.reply('Disconnected from vm successfully');
    })
  );

bot.command("stream",tryCatchWrapper(async (ctx)=>{
    if (!(await sessionValidate(ctx))) return;
    const session = await getSession(ctx);
    const cmd = ctx.payload.trim();
    await streamcmd(ctx,cmd,session['cwd'],session['ssh']);
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
      //   console.log(ctx);
      const output = await execute(ctx);
      const reply_msg = await formatOutput(ctx, output);
      ctx.reply(reply_msg);
    })
  );


});
