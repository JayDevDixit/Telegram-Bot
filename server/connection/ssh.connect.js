import { NodeSSH } from "node-ssh";
import { tryCatchsshWrapper } from "../../utility/utils.js";

export const connectVM = tryCatchsshWrapper(async (credential)=>{
    const ssh = new NodeSSH();
    await ssh.connect(credential);
    return ssh;

})

export const executecmd = tryCatchsshWrapper(async (cmd,cwd,ssh)=>{
    let output = await ssh.execCommand(cmd,{cwd})
    return output;
})