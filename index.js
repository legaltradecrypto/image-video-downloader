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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

app.get('/download', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format;

  try {
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // YouTube: MP3 and video support
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

    // Instagram: Try both video and image
    if (url.includes('instagram.com')) {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(data);
      const img = $('meta[property="og:image"]').attr('content');
      const vid = $('meta[property="og:video"]').attr('content');

      if (vid) return res.json({ type: 'video', link: vid });
      if (img) {
        const imgRes = await axios.get(img, { responseType: 'arraybuffer' });
        const fileExt = img.split('.').pop().split('?')[0];
        const fileName = `instagram-image.${fileExt}`;
        res.setHeader('Content-Type', `image/${fileExt}`);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(imgRes.data);
      }

      return res.json({ type: 'unknown' });
    }

    // TikTok no-watermark
    if (url.includes('tiktok.com')) {
      const apiURL = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const response = await axios.get(apiURL);
      const videoData = response.data;

      if (videoData && videoData.data && videoData.data.play) {
        return res.json({ type: 'video', link: videoData.data.play });
      }

      return res.json({ type: 'unknown', error: 'TikTok video not found or private' });
    }

    // Direct image URL (e.g. .jpg, .png)
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const fileExt = url.split('.').pop().split('?')[0];
      const fileName = `image.${fileExt}`;
      res.setHeader('Content-Type', `image/${fileExt}`);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(response.data);
    }

    // General page: Try scraping og:image
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const img = $('meta[property="og:image"]').attr('content');
    if (img) {
      const imgRes = await axios.get(img, { responseType: 'arraybuffer' });
      const fileExt = img.split('.').pop().split('?')[0];
      const fileName = `image.${fileExt}`;
      res.setHeader('Content-Type', `image/${fileExt}`);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(imgRes.data);
    }

    return res.json({ type: 'unknown', error: 'No downloadable content found' });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
