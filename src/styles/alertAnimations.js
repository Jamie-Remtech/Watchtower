// ============================================
// WATCHTOWER CUSTOMER ADMIN PORTAL
// With Integrated Live Detection View
// ============================================

// CSS for flashing alert animations (injected via style tag)
export const alertAnimationStyles = `
  @keyframes pulse-border-critical {
    0%, 100% {
      border-color: #ef4444;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.1);
    }
    50% {
      border-color: #fca5a5;
      box-shadow: 0 0 40px rgba(239, 68, 68, 0.9), inset 0 0 20px rgba(239, 68, 68, 0.2);
    }
  }
  
  @keyframes pulse-border-warning {
    0%, 100% {
      border-color: #f97316;
      box-shadow: 0 0 15px rgba(249, 115, 22, 0.5), inset 0 0 8px rgba(249, 115, 22, 0.1);
    }
    50% {
      border-color: #fdba74;
      box-shadow: 0 0 30px rgba(249, 115, 22, 0.8), inset 0 0 15px rgba(249, 115, 22, 0.15);
    }
  }
  
  .alert-critical {
    animation: pulse-border-critical 1s ease-in-out infinite;
    border-width: 4px;
  }
  
  .alert-warning {
    animation: pulse-border-warning 1.5s ease-in-out infinite;
    border-width: 4px;
  }
  
  /* Hide scrollbar but keep functionality */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;
