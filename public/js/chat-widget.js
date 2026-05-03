function initChatWidget() {
    const chatBtn = document.getElementById('chat-button');
    const chatPopup = document.getElementById('chat-popup');
    const chatClose = document.getElementById('chat-close');
    const chatMessageInput = document.querySelector('#chat-form textarea[name="message"]');
    const phoneInput = document.querySelector('#chat-form input[name="phone"]');
    const chatForm = document.getElementById('chat-form');
    const chatNameInput = document.querySelector('#chat-form input[name="name"]');
    let activeChatMessage = '';
  
    function openChatPopup(prefillMessage = '') {
      if (!chatPopup) return;

      activeChatMessage = prefillMessage.trim();
      chatPopup.style.display = 'block';
      requestAnimationFrame(() => {
        chatPopup.classList.add('active');
      });

      if (chatMessageInput && activeChatMessage) {
        chatMessageInput.value = activeChatMessage;
      }

      const focusTarget = chatNameInput || chatMessageInput;
      if (focusTarget) {
        window.setTimeout(() => focusTarget.focus(), 120);
      }
    }

    function closeChatPopup() {
      if (!chatPopup) return;
      chatPopup.classList.remove('active');
      setTimeout(() => {
        chatPopup.style.display = 'none';
      }, 400);
    }

    function toggleChatPopup(prefillMessage = '') {
      if (!chatPopup) return;
      const isOpen = chatPopup.classList.contains('active');

      if (isOpen) {
        if (prefillMessage && chatMessageInput) {
          activeChatMessage = prefillMessage.trim();
          chatMessageInput.value = activeChatMessage;
          chatMessageInput.focus();
          return;
        }

        closeChatPopup();
        return;
      }

      openChatPopup(prefillMessage);
    }
  
    if (chatBtn) chatBtn.onclick = toggleChatPopup;
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('.open-chat');

      if (!trigger) {
        return;
      }

      event.preventDefault();
      toggleChatPopup(trigger.dataset.chatMessage || '');
    });
    if (chatClose) chatClose.onclick = closeChatPopup;
  
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
          closeChatPopup();
          activeChatMessage = '';
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
  
