const mongoose = require("mongoose")

const playlistSchema = mongoose.Schema({
   name:{
    type:String,
    required:true
   },
    songs:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"songs",
       
    }],
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user",
        required:true
    },
  poster:{
    type:String,
    default:"./images/note_audio_music_3097.webp"
  }
})
module.exports = mongoose.model("playlist",playlistSchema)