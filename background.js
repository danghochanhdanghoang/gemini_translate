chrome.action.onClicked.addListener(async (tab) => {
  // Lấy API key đã lưu
  const data = await chrome.storage.local.get(['geminiApiKey']);
  if (!data.geminiApiKey) {
    chrome.runtime.openOptionsPage(); // Mở trang cài đặt nếu chưa có key
    return;
  }

  // Tiêm script giao diện vào tab phim đang mở
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  // Chụp ảnh màn hình hiện tại
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 50 });
  
  // Gọi hàm gửi ảnh lên Gemini
  callGemini(data.geminiApiKey, dataUrl, tab.id);
});

async function callGemini(apiKey, imageBase64, tabId) {
  // Cắt bỏ phần tiền tố data:image/jpeg;base64,
  const base64Data = imageBase64.split(',')[1];
  
  const prompt = "Đây là ảnh chụp màn hình một bộ phim. Hãy tìm câu phụ đề tiếng Anh trong ảnh. Sau đó dịch sang tiếng Việt, cung cấp phiên âm (IPA) các từ khó và giải thích tại sao nhân vật dùng từ đó trong hoàn cảnh của bức ảnh. Trình bày cực kỳ ngắn gọn.";
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: base64Data } }
      ]
    }]
  };

  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json();
    const text = result.candidates[0].content.parts[0].text;
    
    // Gửi kết quả về trang web để hiển thị
    chrome.tabs.sendMessage(tabId, { action: "showResult", text: text });
  } catch (e) {
    chrome.tabs.sendMessage(tabId, { action: "showError", text: e.toString() });
  }
}
