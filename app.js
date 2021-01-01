const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const expressWs = require("express-ws")(app);

const redis = require("redis");

const client = redis.createClient(6379);

const S2 = require("s2-geometry").S2;

const level = 15;

client.on("error", (err) => {
  console.log("Error: ", err);
});

const findCab = require("./routes/findCab");

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}));

// socket.io code

// io.on("connection", (socket) => {
//     console.log("Connected");

//     let uid = "";

//     socket.on("sendCoord", (package) => {
//         const key = S2.latLngToKey(package.coord.lat, package.coord.long, level);
//         client.setex(uid, 60, key);
//     });

//     socket.on("disconnect", () => {
//         client.del(uid, (err, response) => {
//             if(err)
//                 console.log("Error: ", err);
//             else
//             {
//                 console.log("Response", response);
//             }
//         })
//     });
// })

app.use("/find", findCab);

app.get("/", function (req, res) {
  res.send("Hello");
});

// ws code

app.ws("/", function (ws, req) {
  console.log("Connected");

  let uid = "";

// frontend sends the uid and coordinates with every message

  ws.on("message", function (package) {
    const data = JSON.parse(package);
    console.log(data);
    if (data.lat && data.lng && data.uid) {
      uid = data.uid;
      const key = S2.latLngToKey(data.lat, data.lng, level);
      client.setex(data.uid, 120, key);
    } else console.log("Values missing!");
  });

// on closing the connection we delete the entry from redis

  ws.on("close", function (msg) {
    client.del(uid, (err, response) => {
      if (err) console.log("Error: ", err);
      else {
        console.log("Response", response);
      }
    });
  });
});

app.listen(3000, () => {
  console.log("Listening on 3000");
});
