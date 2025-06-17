const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

app.get('/download', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format;

  try {
    if (ytdl.validateURL(url)) {
      if (format === 'mp3') {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '').slice(0, 50);
        const filePath = path.join(__dirname, `${title}.mp3`);

        const stream = ytdl(url, { filter: 'audioonly' });

        ffmpeg(stream)
          .audioBitrate(128)
          .toFormat('mp3')
          .save(filePath)
          .on('end', () => {
            res.download(filePath, `${title}.mp3`, () => fs.unlinkSync(filePath));
          })
          .on('error', (err) => {
            console.error('MP3 conversion error:', err);
            res.status(500).send('Error converting to MP3');
          });

        return;
      }

      const info = await ytdl.getInfo(url);
      const best = ytdl.chooseFormat(info.formats, { quality: 'lowest' });
      return res.json({ type: 'video', link: best.url });
    }

    if (url.includes('instagram.com')) {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(data);
      const img = $('meta[property="og:image"]').attr('content');
      const vid = $('meta[property="og:video"]').attr('content');

      if (vid) return res.json({ type: 'video', link: vid });
      if (img) return res.json({ type: 'image', link: img });

      return res.json({ type: 'unknown' });
    }

    // TikTok no-watermark download
if (url.includes('tiktok.com')) {
  const apiURL = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
  const response = await axios.get(apiURL);
  const videoData = response.data;

  if (videoData && videoData.data && videoData.data.play) {
    return res.json({ type: 'video', link: videoData.data.play });
  }

  return res.json({ type: 'unknown', error: 'TikTok video not found or private' });
}

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const img = $('meta[property="og:image"]').attr('content');
    if (img) return res.json({ type: 'image', link: img });

    return res.json({ type: 'unknown' });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
