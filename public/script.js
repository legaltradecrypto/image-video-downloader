async function download() {
  const url = document.getElementById('url').value;
  const preview = document.getElementById('preview');
  preview.innerHTML = 'Loading...';

  try {
    const res = await fetch(`/download?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    preview.innerHTML = '';

    if (data.type === 'image') {
      preview.innerHTML = `
        <img src="${data.link}" width="300"><br>
        <a href="${data.link}" download>Download Image</a>
      `;
    } else if (data.type === 'video') {
      preview.innerHTML = `
        <video controls width="300" src="${data.link}"></video><br>
        <a href="${data.link}" download>Download Video</a><br>
        <a href="/download?url=${encodeURIComponent(url)}&format=mp3">Download as MP3</a>
      `;
    } else {
      preview.innerText = 'Could not detect downloadable content.';
    }

  } catch (err) {
    preview.innerText = 'Error fetching content';
    console.error(err);
  }
}
