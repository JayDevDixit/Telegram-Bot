import { userSessions } from "../server/bot/command.js";

export const tryCatchWrapper = (fn) => async (ctx, ...args)=>{
    try{
        return await fn(ctx,...args);
    } catch(error){
        console.error('Exception occured:',error.message);
        ctx.reply('An error occured while processing your request');
    }
}


export const tryCatchsshWrapper = (fn) => async (...args)=>{
    try{
        return await fn(...args);
    } catch(error){
        console.error('Exception occured:',error.message);
        // ctx.reply('An error occured while processing your request');
    }
}

export const stopBotCleanup = tryCatchsshWrapper(async ()=>{
    console.log('Running Cleanups')
    const dispose = [];
    userSessions.forEach((session,userId)=>{
        if(session['ssh'] && session['ssh'].isConnected()) dispose.push(session['ssh'].dispose());
        userSessions.delete(userId);
    })
    await Promise.all(dispose);
})