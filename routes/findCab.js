const express = require("express");
const router = express.Router();

const redis = require("redis");

const client = redis.createClient(6379);

const S2 = require("s2-geometry").S2;

const async = require("async");

const mitt = require("mitt");

// var lat = 23.673944;
// var lng = 86.952393;
const level = 15;

// var lat1 = 23.673945;
// var lng1 = 86.952393;

const emitter = mitt();

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function now(ms) {
  await sleep(1000);
}

router.get("/", async function (req, res) {

  return res.send("Hello");
});

router.post("/", function (req, res) {
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
              const latlng = S2.keyToLatLng(value);
              cb(null, latlng);
            } else cb();
          });
        },
        function (error, results) {
          if (error) return console.log(error);

          // removing null values from the results array

          const output = results.filter(function (el) {
            return el != null;
          });

          console.log(output);

          for(let i = 0; i<output.length; i++) {
            const response = "";
            now(ms);
          }

          return res.json({ providers: output });
        }
      );
    }
  });
});

module.exports = router;

// st.patricks : 23.6875954,86.9605866
// divisional hospital: 23.6875954,86.9605866
// hawkers market: 23.6873792,86.9638911
// bus stand: 23.6873792,86.9638911
// divisional stadium: 23.6910621,86.9610022
// varanasi central jail: 25.3481726,82.9614155
