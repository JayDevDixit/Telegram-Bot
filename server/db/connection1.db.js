import mongoose from 'mongoose';

export const connectDB = async ()=>{
    try{
        const MONGODB_URL = process.env.MONGODB_URL;
        if(!MONGODB_URL) return console.error(`Error importing MongoDB url from .env`);
        const instance = await mongoose.connect(MONGODB_URL);
        console.log(`MongoDB Connnected`)
    } catch(error){
        console.error(`Error connecting MongoDB ${error.message}`);
    }
}