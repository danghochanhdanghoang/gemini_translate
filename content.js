// 1. Tạo hoặc cập nhật giao diện bảng hiển thị kết quả
function showPopup(statusHtml) {
  var popup = document.getElementById('gemini-sub-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'gemini-sub-popup';
    popup.style.cssText = 'position:fixed;top:20px;right:20px;width:360px;max-height:85vh;overflow-y:auto;background:rgba(15,15,15,0.95);color:#fff;z-index:2147483647;padding:16px;border-radius:12px;font-family:sans-serif;font-size:14.5px;line-height:1.5;box-shadow:0 10px 30px rgba(0,0,0,0.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333;padding-bottom:8px;margin-bottom:10px;';

    var title = document.createElement('span');
    title.innerHTML = '⚡ <b>Gemini Sub</b> <small style="color:#888">(Phím tắt: Alt+S / F2)</small>';
    title.style.fontSize = '12px';

    var btnGroup = document.createElement('div');

    // Nút chọn lại vùng chụp
    var reselectBtn = document.createElement('span');
    reselectBtn.innerHTML = '🎯 Chọn lại vùng';
    reselectBtn.style.cssText = 'cursor:pointer;font-size:12px;color:#00e5ff;background:#222;padding:4px 8px;border-radius:4px;margin-right:6px;border:1px solid #00e5ff44;';
    reselectBtn.onclick = function() {
      popup.remove();
      startAreaSelection();
    };

    var closeBtn = document.createElement('span');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = 'cursor:pointer;font-size:12px;color:#aaa;background:#333;padding:4px 8px;border-radius:4px;';
    closeBtn.onclick = function() { popup.remove(); };

    btnGroup.appendChild(reselectBtn);
    btnGroup.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(btnGroup);

    var contentDiv = document.createElement('div');
    contentDiv.id = 'gemini-content';

    popup.appendChild(header);
    popup.appendChild(contentDiv);
    document.body.appendChild(popup);
  }
  document.getElementById('gemini-content').innerHTML = statusHtml;
}

// 2. Giao diện kéo chuột chọn vùng phụ đề (Crosshair)
function startAreaSelection() {
  document.getElementById('gemini-crop-overlay')?.remove();

  var overlay = document.createElement('div');
  overlay.id = 'gemini-crop-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);z-index:2147483646;cursor:crosshair;user-select:none;';

  var guide = document.createElement('div');
  guide.innerHTML = '🖱️ <b>Nhấn giữ và kéo chuột</b> bao quanh vùng có phụ đề phim (Nhấn ESC để hủy)';
  guide.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#111;color:#ffcc00;padding:10px 20px;border-radius:30px;font-family:sans-serif;font-size:15px;box-shadow:0 4px 15px rgba(0,0,0,0.6);border:1px solid #ffcc00;pointer-events:none;';
  overlay.appendChild(guide);

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;border:2px dashed #00ffcc;background:rgba(0,255,204,0.15);display:none;pointer-events:none;';
  overlay.appendChild(box);

  var startX, startY, isDragging = false;

  overlay.onmousedown = function(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    box.style.left = startX + 'px';
    box.style.top = startY + 'px';
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.display = 'block';
  };

  overlay.onmousemove = function(e) {
    if (!isDragging) return;
    var curX = e.clientX;
    var curY = e.clientY;
    box.style.left = Math.min(startX, curX) + 'px';
    box.style.top = Math.min(startY, curY) + 'px';
    box.style.width = Math.abs(curX - startX) + 'px';
    box.style.height = Math.abs(curY - startY) + 'px';
  };

  overlay.onmouseup = async function(e) {
    if (!isDragging) return;
    isDragging = false;
    var rect = {
      x: Math.min(startX, e.clientX),
      y: Math.min(startY, e.clientY),
      w: Math.abs(e.clientX - startX),
      h: Math.abs(e.clientY - startY)
    };
    overlay.remove();

    if (rect.w < 30 || rect.h < 15) {
      alert("Vùng chọn quá nhỏ! Hãy kéo chuột rộng hơn một chút.");
      return;
    }

    // Lưu vùng chọn cố định cho trang web hiện tại (ví dụ: tiktok.com)
    var hostKey = 'crop_' + window.location.hostname;
    await chrome.storage.local.set({ [hostKey]: rect });

    // Chụp và dịch luôn ngay sau khi chọn xong
    captureAndTranslate(rect);
  };

  var escListener = function(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      window.removeEventListener('keydown', escListener);
    }
  };
  window.addEventListener('keydown', escListener);

  document.body.appendChild(overlay);
}

// 3. Hàm cắt đúng khung phụ đề và gửi cho AI
function captureAndTranslate(rect) {
  showPopup('⚡ Đang cắt vùng phụ đề và dịch siêu tốc...');
  
  chrome.runtime.sendMessage({ action: "requestRawScreenshot" }, function(response) {
    if (!response || !response.dataUrl) {
      showPopup('❌ Không thể chụp màn hình.');
      return;
    }

    var img = new Image();
    img.onload = function() {
      // Tính tỉ lệ màn hình để cắt chính xác tọa độ
      var scaleX = img.width / window.innerWidth;
      var scaleY = img.height / window.innerHeight;

      var canvas = document.createElement('canvas');
      var cropW = rect.w * scaleX;
      var cropH = rect.h * scaleY;

      // Thu nhỏ ảnh nếu quá to để gửi qua mạng trong 0.1 giây
      var maxW = 700;
      var ratio = cropW > maxW ? (maxW / cropW) : 1;

      canvas.width = Math.round(cropW * ratio);
      canvas.height = Math.round(cropH * ratio);

      var ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        rect.x * scaleX, rect.y * scaleY, cropW, cropH,
        0, 0, canvas.width, canvas.height
      );

      // Xuất ra ảnh JPEG siêu nhẹ
      var croppedBase64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      chrome.runtime.sendMessage({ action: "translateCroppedImage", base64Data: croppedBase64 });
    };
    img.src = response.dataUrl;
  });
}

// 4. Hàm kích hoạt chính (Kiểm tra xem trang web đã có vùng chọn chưa)
window.triggerSubTranslate = async function() {
  var hostKey = 'crop_' + window.location.hostname;
  var data = await chrome.storage.local.get([hostKey]);
  if (data[hostKey]) {
    captureAndTranslate(data[hostKey]);
  } else {
    startAreaSelection();
  }
};

// 5. Cài đặt phím bấm nhanh bằng phím M
if (!window.hasGeminiSubInit) {
  window.hasGeminiSubInit = true;

  window.addEventListener('keydown', function(e) {
    // Không kích hoạt nếu đang gõ bình luận hoặc chat
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    // Đã đổi thành KeyM
    if (e.code === 'KeyM') {
      e.preventDefault();
      e.stopPropagation();
      window.triggerSubTranslate();
    }
  }, true);

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.action === "showResult") {
      var formatted = msg.text.replace(/\*\*(.*?)\*\*/g, '<b style="color:#ffcc00;">$1</b>').replace(/\n/g, '<br>');
      showPopup(formatted);
    } else if (msg.action === "showError") {
      showPopup('❌ ' + msg.text);
    } else if (msg.action === "triggerFromIcon") {
      window.triggerSubTranslate();
    }
  });
}
