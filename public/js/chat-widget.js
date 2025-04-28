function initChatWidget() {
    const chatBtn = document.getElementById('chat-button');
    const chatPopup = document.getElementById('chat-popup');
    const chatClose = document.getElementById('chat-close');
    const heroChatBtn = document.querySelector('.open-chat');
    const phoneInput = document.querySelector('#chat-form input[name="phone"]');
    const chatForm = document.getElementById('chat-form');
  
    function toggleChatPopup() {
      if (!chatPopup) return;
      const isOpen = chatPopup.classList.contains('active');
  
      if (isOpen) {
        chatPopup.classList.remove('active');
        setTimeout(() => {
          chatPopup.style.display = 'none';
        }, 400);
      } else {
        chatPopup.style.display = 'block';
        requestAnimationFrame(() => {
          chatPopup.classList.add('active');
        });
      }
    }
  
    if (chatBtn) chatBtn.onclick = toggleChatPopup;
    if (heroChatBtn) heroChatBtn.onclick = toggleChatPopup;
    if (chatClose) chatClose.onclick = toggleChatPopup;
  
    if (chatForm) {
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(chatForm);
        const data = Object.fromEntries(formData.entries());
  
        try {
          const res = await fetch('/.netlify/functions/sendSMS', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
  
          if (res.ok) {
            const chatBtnSend = document.getElementById('chat-now-button');
            chatBtnSend.textContent = "Message Sent ✅";
            chatBtnSend.disabled = true;
            chatBtnSend.classList.add('sent');
  
            setTimeout(() => {
              chatBtnSend.textContent = "Chat Now";
              chatBtnSend.disabled = false;
              chatBtnSend.classList.remove('sent');
            }, 4000);
  
            chatForm.reset();
            chatPopup.classList.add('hidden');
          } else {
            alert('❌ Failed to send message. Try again later.');
          }
        } catch (err) {
          console.error('Form error:', err);
          alert('❌ Network error. Try again.');
        }
      });
    }
  
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        let digits = e.target.value.replace(/\D/g, '');
        if (digits.length > 10) digits = digits.slice(0, 10);
  
        let formatted = digits;
        if (digits.length >= 7) {
          formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        } else if (digits.length >= 4) {
          formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        } else if (digits.length >= 1) {
          formatted = `(${digits}`;
        }
  
        e.target.value = formatted;
      });
    }
  }
  
  // ✅ No DOMContentLoaded — just observe
  const observer = new MutationObserver((mutations, obs) => {
    if (document.getElementById('chat-button')) {
      initChatWidget();
      obs.disconnect();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  