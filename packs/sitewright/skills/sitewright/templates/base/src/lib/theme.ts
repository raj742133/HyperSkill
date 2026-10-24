/** Runs in <head> before paint: the saved light/dark choice, if any. The toggle that writes it is components/ThemeToggle.tsx. */
export const THEME_SCRIPT =
  "try{var t=localStorage.getItem('__COOKIE__-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}";
