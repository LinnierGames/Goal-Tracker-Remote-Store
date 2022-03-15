var dot = require('dotenv'); dot.config();
var counter  = require('counter');
var express = require('express');
var fs = require('fs');
var multer  = require('multer');
var path = require('path');
const { env } = require('process');
var router = express.Router();

var DI = require('../src/DI');
var FileStore = require('../src/FileStore');
var MQTT = require('../src/MQTT');
const mqtt = new MQTT('localhost');

const dataDirectory = new FileStore(DI.dataDirectory(), { create: true });
const reportsDirectory = new FileStore(DI.reportsDirectory(), { create: true });

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get(
  '/data', 

  protected,

  // Handle loading all filenames stored in the user directory.
  function(req, res) {
    var imageScale = 1;
    const requestingImageScale = req.query.scale;
    if (requestingImageScale !== undefined) {
      imageScale = requestingImageScale
    }
    const filenames = dataDirectory.filenames();

    const protocol = req.protocol;
    const host = req.headers.host;
    var thumbnails = filenames.map((filename) => {
      return {
        filename: filename,
        url: encodeURI(`${protocol}://${host}/data/${filename}`),
      }
    });

    res
      .status(200)
      .json(thumbnails);
  }
);

router.get(
  '/data/:filename', 
  // "/Sleep.csv"

  protected,

  // Handle loading and servering images.
  function(req, res) {
    const filename = req.params.filename;
    if (!dataDirectory.doesFilenameExist(filename)) {
      return res.status(404).json({ message: `filename not found: ${filename}` })
    }

    res
      .status(200)
      .sendFile(path.join(DI.dataDirectory(), filename));
  }
);

/* Upload csv files to be stored locally. */
router.post(
  '/data', 

  protected,

  // Handle multipart upload.
  (req, res, next) => {
    const upload = multer({ dest: path.join(DI.dataDirectory(), ".temp/") });
    upload.array("data") (req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.log("A Multer error occurred when uploading: ", err);
      } else if (err) {
        console.log("An unknown error occurred when uploading: ", err);
      }

      // Everything went fine.
      next();
    });
  }, 

  // Handle uploaded image and notifying photos did-update event.
  function(req, res) {
    if (req.files === undefined) {
      res
        .status(400)
        .json({ message: "format is incorrect" });
      return;
    }
    if (req.files.length == 0) {
      res
        .status(400)
        .json({ message: "no files" });
      return;
    }

    var savedFilenames = [];
    var renamingCount = counter(0);
    var errors = [];

    for (const file of req.files) {
      renamingCount.value += 1;

      const tempPath = file.path;
      const targetPath = path.join(DI.dataDirectory(), file.originalname);

      fs.rename(tempPath, targetPath, (err) => {
        if (err) errors.push(err);
        savedFilenames.push(file.originalname);
        renamingCount.value -= 1;
      });
    }

    renamingCount.once('target', function() {
      if (errors.length != 0) {
        return res
          .status(500)
          .json({ message: "something went wrong", errors: errors });
      }

      mqtt.publish("NEW FILES", '/goals/new-data');

      res
        .status(201)
        .json({ message: "Success!", filenames: savedFilenames });
    }).start();
  }
);

/* Upload PDF file to be stored locally. */
router.post(
  '/reports', 

  protected,

  // Handle multipart upload.
  multer({ dest: path.join(DI.reportsDirectory(), ".temp/") }).single("report"), 

  // Handle uploaded image and notifying photos did-update event.
  function(req, res) {
    if (req.file === undefined) {
      res
        .status(400)
        .json({ message: "format is incorrect" });
      return;
    }

    const file = req.file;
    const tempPath = file.path;
    const targetPath = path.join(DI.reportsDirectory(), file.originalname);

    fs.rename(tempPath, targetPath, (err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "something went wrong", error: err });
      }
  
      publishAPNS();
  
      res
        .status(201)
        .json({ message: "Success!", filenames: targetPath });
    });
  }
);

function publishAPNS() {
  var apn = require('node-apn');

  var options = {
    token: { // Name: Habit Tracker APNS
      key: "/Users/esericksanc/Developer/My-Projects/Habits/Remote Store/src/AuthKey_5Q9264PR5S.p8",
      keyId: "5Q9264PR5S",
      teamId: "8U3L6K9JA6"
    },
    production: false
  };
  
  var apnProvider = new apn.Provider(options);


  var note = new apn.Notification();

  let deviceToken = "e5ba155e45f67e622a4a635452ba20a7780588a9367a21f971cfd7a54ea55733"
  note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
  note.badge = 3;
  note.sound = "ping.aiff";
  note.alert = "Your report is available to view";
  note.payload = {'messageFrom': 'John Appleseed'};
  note.topic = "com.linniergames.Habit-Tracker";

  apnProvider.send(note, deviceToken).then( (result) => {
    // see documentation for an explanation of result
    console.log("STUF", result)
  });
}

router.get(
  '/reports', 

  protected,

  // Handle loading all filenames stored in the user directory.
  function(req, res) {
    var imageScale = 1;
    const requestingImageScale = req.query.scale;
    if (requestingImageScale !== undefined) {
      imageScale = requestingImageScale
    }
    const filenames = reportsDirectory.filenames();

    const protocol = req.protocol;
    const host = req.headers.host;
    var thumbnails = filenames.map((filename) => {
      return {
        filename: filename,
        url: encodeURI(`${protocol}://${host}/reports/${filename}`),
      }
    });

    res
      .status(200)
      .json(thumbnails);
  }
);

router.get(
  '/reports/:filename', 
  // "/Sleep.csv"

  protected,

  // Handle loading and servering images.
  function(req, res) {
    const filename = req.params.filename;
    if (!reportsDirectory.doesFilenameExist(filename)) {
      return res.status(404).json({ message: `filename not found: ${filename}` })
    }

    res
      .status(200)
      .sendFile(path.join(DI.reportsDirectory(), filename));
  }
);

function protected(req, res, next) {
  const key = req.headers["key"]
  if (key) {
    if (key == process.env["KEY"]) {
      next()
    } else {
      res.status(401).send("")
    }
  } else {
    res.status(401).send("")
  }
}

module.exports = router;
