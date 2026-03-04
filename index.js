const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp();
const app = express();
app.use(cors({ origin: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG || 'buget-jukov-2026' });
});

app.get('/ping', (req, res) => res.send('pong'));

exports.api = functions.https.onRequest(app);
