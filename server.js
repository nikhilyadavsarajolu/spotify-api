const express = require("express");
const request = require("request");
const querystring = require("querystring");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

let access_token = "";
let refresh_token = "";

// Root route
app.get("/", (req, res) => {
  res.send("Spotify API is live! Use /spotify/login to start authentication.");
});

// Spotify login
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

// Spotify callback
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
      res.status(400).send({ error: "Error getting tokens." });
    }
  });
});

// Helper function for GET requests
function spotifyGet(endpoint, callback) {
  if (!access_token) return callback(null); // handle unauthenticated
  request.get({
    url: `https://api.spotify.com/v1/${endpoint}`,
    headers: { "Authorization": "Bearer " + access_token },
    json: true
  }, (err, res, body) => {
    callback(body);
  });
}

// Main Spotify endpoint
app.get("/spotify", (req, res) => {
  if (!access_token) {
    return res.json({
      message: "Not authenticated. Go to /spotify/login first.",
      top_tracks: [],
      now_playing: null,
      followed_artists: []
    });
  }

  let data = {};
  spotifyGet("me/top/tracks?limit=10", (topTracks) => {
    data.top_tracks = (topTracks && topTracks.items && topTracks.items.length) ? topTracks.items : [];
    spotifyGet("me/player/currently-playing", (nowPlaying) => {
      data.now_playing = (nowPlaying && Object.keys(nowPlaying).length) ? nowPlaying : null;
      spotifyGet("me/following?type=artist", (artists) => {
        data.followed_artists = (artists && artists.artists && artists.artists.items) ? artists.artists.items : [];
        res.json(data);
      });
    });
  });
});

// Stop playback
app.post("/spotify/stop", (req, res) => {
  if (!access_token) return res.sendStatus(401);
  request.put({
    url: "https://api.spotify.com/v1/me/player/pause",
    headers: { "Authorization": "Bearer " + access_token },
    json: true
  }, (err, response) => {
    res.sendStatus(response.statusCode);
  });
});

// Play a specific track
app.post("/spotify/play/:trackId", (req, res) => {
  if (!access_token) return res.sendStatus(401);
  request.put({
    url: "https://api.spotify.com/v1/me/player/play",
    headers: { "Authorization": "Bearer " + access_token },
    json: { uris: [`spotify:track:${req.params.trackId}`] }
  }, (err, response) => {
    res.sendStatus(response.statusCode);
  });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
