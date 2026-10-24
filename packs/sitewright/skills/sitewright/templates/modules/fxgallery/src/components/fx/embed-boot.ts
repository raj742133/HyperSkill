// Plain module (not 'use client'): the embed layout needs the string, see the note in ThemeToggle.tsx.
/**
 * Runs before first paint on the bare /effects/{c,f,bg}/<id>/ pages. Reads ?theme=light|dark, ?primary=#rrggbb and ?signal=#rrggbb
 * from the address so an <iframe> parent can set them with no flash of the wrong theme. No ?theme follows the device (a theme
 * saved by the site's own toggle is ignored: the embed belongs to its parent's look, not this site's).
 */
export const EMBED_BOOT =
  "(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search),t=q.get('theme'),st=d.style,hx=/^#[0-9a-f]{6}$/i;" +
  "if(t==='light'||t==='dark')d.dataset.theme=t;else d.removeAttribute('data-theme');" +
  "function L(h){var c=[1,3,5].map(function(i){var v=parseInt(h.substr(i,2),16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}" +
  "var p=q.get('primary'),s=q.get('signal');" +
  "if(p&&hx.test(p)){st.setProperty('--primary',p);st.setProperty('--on-primary',(L(p)+.05)/.056>1.05/(L(p)+.05)?'#0b1116':'#ffffff');st.setProperty('--primary-wash','color-mix(in srgb,'+p+' 14%,var(--raised))')}" +
  "if(s&&hx.test(s)){st.setProperty('--signal',s);st.setProperty('--signal-wash','color-mix(in srgb,'+s+' 14%,var(--raised))');st.setProperty('--signal-ink','color-mix(in srgb,'+s+' 60%,var(--ink))')}" +
  "}catch(e){}})();";
