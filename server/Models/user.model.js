import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
    },
    username: {
        type: String,
        required: true,
    },
    userId: {
        type: String,
        required: true,
    },
    lastLoginTime: {
        type: Date,
    },
    loginCount: {
        type: Number,
        default: 0,
    },
    vm: [
        {
            host: {type: String, required: true},
            username: {type: String, required: true},
            password: {type: String, required: true},
        },
    ],

},{timestamps:true});

const User = mongoose.model("User",userSchema);
export default User;