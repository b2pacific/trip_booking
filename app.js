const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const expressWs = require("express-ws")(app);

const redis = require("redis");
const client = redis.createClient(6379);

const S2 = require("s2-geometry").S2;

const mitt = require("mitt");

const async = require("async");

const level = 15;

client.on("error", (err) => {
  console.log("Error: ", err);
});

const findCab = require("./routes/findCab");

const emitter = mitt();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// app.use("/find", findCab);

app.get("/find", async function (req, res) {
  for (let i = 0; i < 6; i++) {
    await sleep(1000);
    console.log(i);
  }
  return res.send("Hello World");
});

app.post("/find", function (req, res) {
  const lat = req.body.lat;
  const lng = req.body.lng;

  // finding key for the user coordinates and the neighbour keys for that coordinates

  const masterKey = S2.latLngToKey(lat, lng, level);
  const neighbour = S2.latLngToNeighborKeys(lat, lng, level);

  // getting all the keys from the cache

  client.keys("*", function (err, keys) {
    if (err) return console.log(err);
    if (keys) {
      async.map(
        keys,
        function (key, cb) {
          client.get(key, function (error, value) {
            if (error) return cb(error);
            console.log(key, value);

            // if the key matches the key of the user or any of the keys near that key then sending the coordinates of that key back

            if (value == masterKey || neighbour.includes(value)) {
              const info = { id: key, latlng: S2.keyToLatLng(value) };
              cb(null, info);
            } else cb();
          });
        },
        async function (error, results) {
          if (error) return console.log(error);

          // removing null values from the results array

          const output = results.filter(function (el) {
            return el != null;
          });

          console.log(output);
          let flag = true;

          for (let i = 0; i < output.length; i++) {
            await emitter.emit("customer", {
              id: output[i].id,
              user: { lat, lng },
            });
            await emitter.on("accepted", (type, e) => {
              if (type.provider === output[i].id) {
                client.get(type.provider, function (error, v) {
                  if (error) console.log(error);
                  flag = false;
                  emitter.off("accepted");
                  return res.json({
                    provider: type.provider,
                    latlng: S2.keyToLatLng(v),
                  });
                });
              }
            });
            console.log(i);
            if(!flag)
              break;
            await sleep(15000);
          }
          if (flag) return res.json({ message: 404 });
        }
      );
    }
  });
});

app.get("/", function (req, res) {
  res.send("Hello");
});

// ws code

app.ws("/", function (ws, req) {
  console.log("Connected");

  emitter.on("customer", (type, e) => {
    console.log("e", e);
    console.log("type", type);
    if (uid === type.id) ws.send("message", type.user);
  });

  let uid = "";

  // frontend sends the uid and coordinates with every message

  ws.on("message", function (package) {
    const data = JSON.parse(package);
    console.log(data);
    if (data.flag === "commit") {
      if (data.lat && data.lng && data.uid) {
        uid = data.uid;
        const key = S2.latLngToKey(data.lat, data.lng, level);
        client.setex(data.uid, 120, key);
      } else console.log("Values missing!");
    } else if (data.flag === "accepted") {
      emitter.emit("accepted", { provider: uid });
    } else {
      console.log("404");
    }
  });

  // on closing the connection we delete the entry from redis

  ws.on("close", function (msg) {
    client.del(uid, (err, response) => {
      if (err) console.log("Error: ", err);
      else {
        console.log("Response", response);
      }
    });
    emitter.off("customer");
  });
});

app.listen(3000, () => {
  console.log("Listening on 3000");
});
