import { NodeSSH } from "node-ssh";
import { tryCatchsshWrapper, tryCatchWrapper } from "../utility/utils.js";

export const connectVM = tryCatchsshWrapper(async (credential) => {
  const ssh = new NodeSSH();
  await ssh.connect(credential);
  return ssh;
});

export const executecmd = tryCatchsshWrapper(async (cmd, cwd, ssh) => {
  let output = await ssh.execCommand(cmd, { cwd });
  return output;
});

export const streamcmd = tryCatchWrapper(async (ctx, cmd, cwd, ssh) => {
  ssh.connection.exec(`cd ${cwd} && ${cmd}`, (err, stream) => {
    if (err) throw err;
    stream.on("data", (chunk) => {
      ctx.reply(`✅ Success\n${chunk.toString()}`);
    });
    stream.stderr.on("data", (chunk) => {
      ctx.reply(`❌ Error\n${chunk.toString()}`);
    });
    stream.on("close", (code) => {
      ctx.reply(`command finished with exit code ${code}`);
    });
  });
});

export const uploadFile = tryCatchsshWrapper(
  async (locatfilePath, remotefilepath, ssh) => {
    await ssh.putFile(locatfilePath, remotefilepath);
  }
);
