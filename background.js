// Khi bấm vào icon trên thanh công cụ
chrome.action.onClicked.addListener(async (tab) => {
  const data = await chrome.storage.local.get(['geminiApiKey']);
  if (!data.geminiApiKey) {
    chrome.runtime.openOptionsPage(); 
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });

  chrome.tabs.sendMessage(tab.id, { action: "triggerFromIcon" });
});

// Lắng nghe lệnh từ phím tắt (Alt+S / F2) hoặc sau khi cắt ảnh xong
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "requestRawScreenshot") {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 60 }, (dataUrl) => {
      sendResponse({ dataUrl: dataUrl });
    });
    return true; // Giữ kết nối bất đồng bộ để trả ảnh về
  }

  if (msg.action === "translateCroppedImage") {
    chrome.storage.local.get(['geminiApiKey'], (data) => {
      if (!data.geminiApiKey) {
        chrome.runtime.openOptionsPage();
        return;
      }
      callGeminiUltraFast(data.geminiApiKey, msg.base64Data, sender.tab.id);
    });
  }
});

// Biến ghi nhớ mô hình chạy thành công để các lần bấm sau không mất công dò lại (0 giây chờ đợi)
let workingModel = null;

async function callGeminiUltraFast(apiKeyRaw, base64Data, tabId) {
  const apiKey = apiKeyRaw.trim();
  
  const prompt = "Đọc câu phụ đề tiếng Anh trong ảnh. Trả lời cực ngắn gọn theo đúng mẫu:\n* **Phụ đề:**\n* **Dịch:**\n* **Từ vựng & IPA:**\n  - từ_quan_trọng: /IPA/ (từ loại) - nghĩa tiếng Việt ngắn gọn\n* **Cụm từ liên quan:** (cụm từ ghép/collocation trong câu hoặc mở rộng + nghĩa)\n* **Ngữ cảnh:** (1 câu thật ngắn)";
  
  const payload = {
    "contents": [{
      "parts": [
        { "text": prompt },
        { "inline_data": { "mime_type": "image/jpeg", "data": base64Data } }
      ]
    }],
    "generationConfig": {
      "temperature": 0.1
    }
  };

  // Danh sách đúng các cấu hình Gemini hiện có của bạn (ưu tiên bản 3.5 Flash-Lite nhanh nhất lên đầu)
  const defaultModels = [
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.8-flash",
    "models/gemini-3.1-pro"
  ];

  // Nếu đã biết mô hình nào chạy mượt ở lần trước, đưa nó lên vị trí số 1 để chạy thẳng luôn!
  const modelsToTry = workingModel 
    ? [workingModel, ...defaultModels.filter(m => m !== workingModel)]
    : defaultModels;

  let lastError = "";

  for (const modelName of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload) 
      });
      
      const result = await res.json();
      
      if (res.ok && result.candidates && result.candidates.length > 0) {
        workingModel = modelName; // Lưu lại mô hình thành công cho các lần bấm sau
        const text = result.candidates[0].content.parts[0].text;
        chrome.tabs.sendMessage(tabId, { action: "showResult", text: text });
        return;
      } else {
        lastError = result.error?.message || res.statusText;
      }
    } catch (e) {
      lastError = e.toString();
    }
  }

  // Cơ chế dự phòng thông minh: Nếu Google đặt tên mã nội bộ khác (ví dụ có thêm đuôi -preview), tự động lấy tên chuẩn từ hệ thống
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();
    if (listData.models) {
      const fastModel = listData.models.find(m => 
        m.supportedGenerationMethods?.includes("generateContent") && m.name.includes("flash")
      );
      if (fastModel) {
        workingModel = fastModel.name; // Nhớ luôn tên chuẩn này
        const url = `https://generativelanguage.googleapis.com/v1beta/${workingModel}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok && result.candidates?.length > 0) {
          chrome.tabs.sendMessage(tabId, { action: "showResult", text: result.candidates[0].content.parts[0].text });
          return;
        }
      }
    }
  } catch (e) {}

  chrome.tabs.sendMessage(tabId, { action: "showError", text: "Lỗi: " + lastError });
}
