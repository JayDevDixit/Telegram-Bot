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
        validate: {
            validator: async function (value){
                if(!this.isNew){
                    const existing = await this.constructor.findById(this._id);
                    if(existing && existing.lastLoginTime && value <= existing.lastLoginTime)
                        return false;
                }
                return true;
            },
            message: 'Last login time must be greater than previous one',
        }
    },
    loginCount: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} is not an integer",
        }
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