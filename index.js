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

    // ✅ YouTube MP3 or video
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

    // ✅ Instagram Reels & Stories
    if (url.includes('instagram.com')) {
      const api = `https://instadownloader-api-dusky.vercel.app/api?url=${encodeURIComponent(url)}`;
      const response = await axios.get(api);
      const result = response.data;

      if (result.success && result.url) {
        return res.json({ type: result.type, link: result.url });
      }

      return res.status(400).json({ error: 'Instagram content not found or private' });
    }

    // ✅ TikTok No Watermark
    if (url.includes('tiktok.com')) {
      const api = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const response = await axios.get(api);
      const videoData = response.data;

      if (videoData?.data?.play) {
        return res.json({ type: 'video', link: videoData.data.play });
      }

      return res.status(400).json({ error: 'TikTok video not found or private' });
    }

    // ✅ Direct image (jpg, png, gif)
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const ext = url.split('.').pop().split('?')[0];
      res.setHeader('Content-Type', `image/${ext}`);
      res.setHeader('Content-Disposition', `attachment; filename="image.${ext}"`);
      return res.send(response.data);
    }

    // ✅ General OG Image
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const img = $('meta[property="og:image"]').attr('content');
    if (img) {
      const imgRes = await axios.get(img, { responseType: 'arraybuffer' });
      const fileExt = img.split('.').pop().split('?')[0];
      res.setHeader('Content-Type', `image/${fileExt}`);
      res.setHeader('Content-Disposition', `attachment; filename="image.${fileExt}"`);
      return res.send(imgRes.data);
    }

    return res.status(400).json({ error: 'No downloadable content found' });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
