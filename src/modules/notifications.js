// ============================================
// Notification System
// ============================================
// Toast-style notifications for errors, warnings, and success messages

let notificationContainer = null;

function ensureContainer() {
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(notificationContainer);
  }
  return notificationContainer;
}

function showNotification(message, type = 'info', duration = 5000) {
  const container = ensureContainer();

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;

  const colors = {
    error: { bg: 'rgba(239, 68, 68, 0.95)', border: '#dc2626' },
    warning: { bg: 'rgba(234, 179, 8, 0.95)', border: '#ca8a04' },
    success: { bg: 'rgba(34, 197, 94, 0.95)', border: '#16a34a' },
    info: { bg: 'rgba(59, 130, 246, 0.95)', border: '#2563eb' }
  };

  const colorScheme = colors[type] || colors.info;

  notification.style.cssText = `
    background: ${colorScheme.bg};
    border: 1px solid ${colorScheme.border};
    border-radius: 6px;
    padding: 12px 16px;
    color: white;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    animation: slideIn 0.2s ease-out;
  `;

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  messageSpan.style.flex = '1';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    opacity: 0.7;
  `;
  closeBtn.addEventListener('click', () => {
    notification.remove();
  });
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.opacity = '1';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.opacity = '0.7';
  });

  notification.appendChild(messageSpan);
  notification.appendChild(closeBtn);
  container.appendChild(notification);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.2s ease-in forwards';
      setTimeout(() => notification.remove(), 200);
    }, duration);
  }

  return notification;
}

function showError(message) {
  return showNotification(message, 'error', 8000);
}

function showWarning(message) {
  return showNotification(message, 'warning', 6000);
}

function showSuccess(message) {
  return showNotification(message, 'success', 4000);
}

function showInfo(message) {
  return showNotification(message, 'info', 5000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

export {
  showNotification,
  showError,
  showWarning,
  showSuccess,
  showInfo
};
