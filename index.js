const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

app.get('/download', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format;

  try {
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // --- TikTok: Stream mp4 download ---
    if (url.includes('tiktok.com')) {
      const apiURL = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(apiURL);
      if (data?.data?.play) {
        const streamRes = await axios.get(data.data.play, { responseType: 'stream' });
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="tiktok.mp4"');
        return streamRes.data.pipe(res);
      }
      return res.status(404).json({ error: 'TikTok video not found' });
    }

    // --- Instagram: Stream reels/stories ---
    if (url.includes('instagram.com')) {
      const api = `https://instadownloader-api-dusky.vercel.app/api?url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(api);
      if (data.success && data.url) {
        const mediaUrl = data.url;
        const streamRes = await axios.get(mediaUrl, { responseType: 'stream' });
        const isVideo = data.type === 'video' || mediaUrl.includes('.mp4');
        const ext = isVideo ? 'mp4' : mediaUrl.split('.').pop().split('?')[0];
        res.setHeader('Content-Type', isVideo ? 'video/mp4' : `image/${ext}`);
        res.setHeader('Content-Disposition', `attachment; filename="instagram.${ext}"`);
        return streamRes.data.pipe(res);
      }
      return res.status(404).json({ error: 'Instagram media not found or private' });
    }

    // ... other handlers remain unchanged ...

    return res.status(404).json({ error: 'No downloadable content found' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
