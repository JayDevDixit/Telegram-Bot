
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