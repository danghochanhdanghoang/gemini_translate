// Xóa popup cũ nếu bạn bấm nhiều lần
let existing = document.getElementById('gemini-sub-popup');
if (existing) existing.remove();

// Tạo popup mới
const popup = document.createElement('div');
popup.id = 'gemini-sub-popup';
// Giao diện CSS mờ ảo, hiện đại
popup.style.cssText = 'position:fixed;top:20px;right:20px;width:380px;max-height:85vh;overflow-y:auto;background:rgba(15,15,15,0.9);color:#fff;z-index:2147483647;padding:20px;border-radius:12px;font-family:sans-serif;font-size:15px;line-height:1.6;box-shadow:0 10px 30px rgba(0,0,0,0.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);';

// Nút đóng (X)
const closeBtn = document.createElement('div');
closeBtn.innerHTML = '✕ Đóng';
closeBtn.style.cssText = 'position:absolute;top:15px;right:15px;cursor:pointer;font-size:13px;color:#aaa;background:#333;padding:4px 8px;border-radius:4px;';
closeBtn.onclick = () => popup.remove();

// Vùng chứa nội dung
const contentDiv = document.createElement('div');
contentDiv.id = 'gemini-content';
contentDiv.style.marginTop = '25px';
contentDiv.innerHTML = '✨ Đang phân tích hình ảnh và phụ đề phim...';

popup.appendChild(closeBtn);
popup.appendChild(contentDiv);
document.body.appendChild(popup);

// Nhận kết quả từ background.js và hiển thị
chrome.runtime.onMessage.addListener((msg) => {
  const content = document.getElementById('gemini-content');
  if (!content) return;
  
  if (msg.action === "showResult") {
    // Chuyển markdown cơ bản thành HTML để in đậm/xuống dòng đẹp hơn
    let formattedText = msg.text.replace(/\*\*(.*?)\*\*/g, '<b style="color:#ffcc00;">$1</b>').replace(/\n/g, '<br>');
    content.innerHTML = formattedText;
  } else if (msg.action === "showError") {
    content.innerHTML = '❌ Có lỗi xảy ra: ' + msg.text;
  }
});
