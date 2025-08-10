const express = require("express");
const request = require("request");
const querystring = require("querystring");
const fs = require("fs");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

let access_token = "";
let refresh_token = "";

app.get("/spotify/login", (req, res) => {
  const scope = "user-read-playback-state user-modify-playback-state user-read-currently-playing user-top-read user-follow-read";
  res.redirect("https://accounts.spotify.com/authorize?" +
    querystring.stringify({
      response_type: "code",
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI
    }));
});

app.get("/spotify/callback", (req, res) => {
  const code = req.query.code || null;
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code: code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      grant_type: "authorization_code"
    },
    headers: {
      "Authorization": "Basic " + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64"))
    },
    json: true
  };
  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      access_token = body.access_token;
      refresh_token = body.refresh_token;
      res.send("Spotify authentication successful! You can now visit /spotify");
    } else {
      res.send("Error getting tokens.");
    }
  });
});

function spotifyGet(endpoint, callback) {
  request.get({
    url: `https://api.spotify.com/v1/${endpoint}`,
    headers: { "Authorization": "Bearer " + access_token },
    json: true
  }, (err, res, body) => {
    callback(body);
  });
}

app.get("/spotify", (req, res) => {
  if (!access_token) return res.send("Not authenticated. Go to /spotify/login first.");

  let data = {};
  spotifyGet("me/top/tracks?limit=10", (topTracks) => {
    data.top_tracks = (topTracks.items && topTracks.items.length) ? topTracks.items : [
      { name: "Blinding Lights", artist: "The Weeknd", url: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b" },
      { name: "Levitating", artist: "Dua Lipa", url: "https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9" },
      { name: "Peaches", artist: "Justin Bieber", url: "https://open.spotify.com/track/4iJyoBOLtHqaGxP12qzhQI" },
      { name: "Save Your Tears", artist: "The Weeknd", url: "https://open.spotify.com/track/5QO79kh1waicV47BqGRL3g" }
    ];

    spotifyGet("me/player/currently-playing", (nowPlaying) => {
      data.now_playing = nowPlaying && Object.keys(nowPlaying).length ? nowPlaying : {
        message: "No song is currently playing."
      };

      spotifyGet("me/following?type=artist", (artists) => {
        data.followed_artists = (artists.artists && artists.artists.items && artists.artists.items.length) ?
          artists.artists.items : [
            { name: "The Weeknd", url: "https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ" },
            { name: "Dua Lipa", url: "https://open.spotify.com/artist/6M2wZ9GZgrQXHCFfjv46we" },
            { name: "Ed Sheeran", url: "https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V" }
          ];

        res.json(data);
      });
    });
  });
});

app.post("/spotify/stop", (req, res) => {
  request.put({
    url: "https://api.spotify.com/v1/me/player/pause",
    headers: { "Authorization": "Bearer " + access_token },
    json: true
  }, (err, response) => {
    res.sendStatus(response.statusCode);
  });
});

app.post("/spotify/play/:trackId", (req, res) => {
  request.put({
    url: "https://api.spotify.com/v1/me/player/play",
    headers: { "Authorization": "Bearer " + access_token },
    json: { uris: [`spotify:track:${req.params.trackId}`] }
  }, (err, response) => {
    res.sendStatus(response.statusCode);
  });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
