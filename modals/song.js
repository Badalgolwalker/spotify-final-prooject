const mongoose = require("mongoose")

const songSchema = mongoose.Schema({
    title:String,
   artist:String,
   album:String,
   categories:[{
    type:String,
    enum:["punjabi","gujarati"]
   }],
  
    likes:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user"
    }],
  size:Number,
  poster:String,
  filename:{
    type:String,
    required:true
  }
})

module.exports = mongoose.model("song",songSchema)