var express = require('express');
const passport = require('passport');
var router = express.Router();
var usermodel = require('../modals/usermodel');
var playlistmodel = require('../modals/playlist');
var songmodel = require('../modals/song');
var localStrategy = require("passport-local");
var { Readable } = require("stream")
var crypto = require("crypto")
require('dotenv').config();
// node -i3 ek package he ye hue song ke buufer codde se poster nikle ke deta he  is mean bufer code se koi bhi dta 

var id3 = require("node-id3")
var multer = require("multer")
passport.use(new localStrategy(usermodel.authenticate()))
var mongoose = require("mongoose");
const uri = process.env.MONGODB_URI;
const { stringify } = require('querystring');

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
  console.log("user connectd successfuly")
}).catch(err => {
  console.log(err)
})

const conn = mongoose.connection
var gfsBucket, gfsBucketPoster
conn.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "audio"
  })
  gfsBucketPoster = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "poster"
  })
})
/* GET home page. */
router.post("/register", async function (req, res, next) {
  try {
    var newUSer = new usermodel({
      username: req.body.username,
      email: req.body.email
    });
    const registeredUser = await usermodel.register(newUSer, req.body.password);
    await passport.authenticate('local')(req, res, async function () {
      const songs = await songmodel.find();
      const defaultPlaylist = await playlistmodel.create({
        name: "defaultPlaylist",
        owner: req.user._id,
        songs: songs.map(song => song._id)
      });
      let newUser = await usermodel.findOne({ _id: req.user._id });
      newUser.playlist.push(defaultPlaylist._id);
      await newUser.save();
      res.redirect('/');
    });
  } catch (error) {
    console.error("Error in registration:", error);
    res.status(500).send("Internal Server Error");
  }
});


router.post('/login', passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login"
}), function (req, res, next) {
});
router.get("/login", function (req, res, next) {
  res.render("login")
})
router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

router.get("/", islogedIn, async function (req, res, next) {
  const currentUser = await usermodel.findOne({ _id: req.user._id })
    .populate("playlist").populate({
      path: "playlist",
      populate: {
        path: "songs",
        model: "song"
      }
    })
  res.render("index", { currentUser })
})

router.get('/poster/:postername', (req, res, next) => {
  gfsBucketPoster.openDownloadStreamByName(req.params.postername).pipe(res)
})
router.get("/stream/:musicname", async (req, res, next) => {
  const currentSong = await songmodel.findOne({ filename: req.params.musicname })
  const stream = gfsBucket.openDownloadStreamByName(req.params.musicname)
  // console.log(currentSong)
  res.set('Content-Type', 'audio/mpeg')
  res.set('content-Length', currentSong.size + 1)
  res.set('content-Range', `bytes 0-${currentSong.size - 1}/${currentSong.size}`)
  res.set('content-Ranges', 'bytes')
  res.status(206)

  stream.pipe(res)
})
router.get("/search", islogedIn, async (req, res, next) => {
  let currentUser = await usermodel.findOne({ username: req.session.passport.user })
    .populate("playlist")
  res.render("search", { currentUser })
})
router.post("/search", async (req, res, next) => {
  const searchMusic = await songmodel.find({
    title: { $regex: req.body.search }
  })
  res.json({
    song: searchMusic
  })
})


//ye he data base  me upload karne ke liye memory storage
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

router.post('/uploadmusic', islogedIn, isAdmin, upload.array("song"), async function (req, res, next) {

  await Promise.all(req.files.map(async file => {
    const randomName = crypto.randomBytes(20).toString("hex")
    const songData = id3.read(file.buffer)

    Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(randomName))
    Readable.from(songData.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(randomName + 'poster'))
    // console.log(songData)

    await songmodel.create({
      title: songData.title,
      artist: songData.artist,
      album: songData.album,
      size: file.size,
      poster: randomName + 'poster',
      filename: randomName
    })

  }))

  res.send("upload")

})

router.get("/uploadmusic", islogedIn, isAdmin, function (req, res, next) {
  res.render("uploadmusic")
})

router.post("/createplaylist", islogedIn, async (req, res, next) => {
  let user = await usermodel.findOne({ username: req.session.passport.user })

  if (user.playlist.length < 2) {
    let playlist = await playlistmodel.create({
      name: req.body.filename,
      owner: req.user._id
    })
    user.playlist.push(playlist._id)
    user.save()
    res.redirect("back")
  }


})
router.get('/save/:id', islogedIn, async (req, res, next) => {
  let user = await usermodel.findOne({ username: req.session.passport.user })
  let song = await songmodel.findOne({ _id: req.params.id })
  if (user.favorateSong.indexOf(song._id) === -1) {
    user.favorateSong.push(song._id)
  } else {
    user.favorateSong.splice(user.favorateSong.indexOf(song._id), 1)
  }
  await user.save()
  res.redirect("back")

})

router.get("/like/:id", islogedIn, (req, res, next) => {
  usermodel.findOne({ username: req.session.passport.user })
    .then(function (user) {
      songmodel.findOne({ _id: req.params.id })
        .then(function (song) {
          if (song.likes.indexOf(user._id) && user.liked.indexOf(song._id) === -1) {
            song.likes.push(user._id)
            user.liked.push(song._id)
          }
          else {
            song.likes.splice(song.likes.indexOf(user._id), 1)
            user.liked.splice(user.liked.indexOf(song._id), 1)
          }
          console.log(song.likes)
          console.log(user.liked)
          user.save()
          song.save()
            .then(function () {
              res.redirect("back")
            })
        })
    })
})
router.get("/badal", islogedIn, async (req, res, next) => {
  let user = await usermodel.findOne({ username: req.session.passport.user })
    .populate("favorateSong")
  res.render("badal", { user })
})
router.get("/delete/:id", islogedIn, async (req, res, next) => {
  let user = await usermodel.findOne({ username: req.session.passport.user })
  user.playlist = user.playlist.filter(playlist => playlist._id != req.params.id);

  let playlist = await playlistmodel.findOneAndDelete({ _id: req.params.id })
  user.favorateSong = []
  await user.save()
  res.redirect("back")
})
function islogedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.redirect('/login')
  }
}
function isAdmin(req, res, next) {
  if (req.user.isAdmin) {
    return next()
  }
  else return res.redirect("/")
}
module.exports = router;
