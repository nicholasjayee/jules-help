
// Function to detect iOS devices
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Function to detect Android devices
export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};
