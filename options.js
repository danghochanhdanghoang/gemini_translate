// Lưu key vào bộ nhớ của Chrome
document.getElementById('saveBtn').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value;
  chrome.storage.local.set({ geminiApiKey: key }, () => {
    alert('Đã lưu API Key thành công! Bây giờ bạn có thể mở phim lên và dùng.');
  });
});

// Hiển thị lại key cũ nếu đã lưu
chrome.storage.local.get(['geminiApiKey'], (res) => {
  if (res.geminiApiKey) {
    document.getElementById('apiKey').value = res.geminiApiKey;
  }
});
