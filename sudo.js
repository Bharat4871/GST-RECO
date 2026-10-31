/* Easter egg (Group One): downloads SUDO.pdf once per browser session when the site opens.
   Runs after the app has loaded and never touches the app or its data. */
(function () {
  function grab() {
    try {
      try { if (sessionStorage.getItem('gstiq.sudo')) return; sessionStorage.setItem('gstiq.sudo', '1'); } catch (e) { /* storage blocked - still download */ }
      var a = document.createElement('a');
      a.href = 'SUDO.pdf';
      a.download = 'SUDO.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 2000);
    } catch (e) { /* never interfere with the app */ }
  }
  if (document.readyState === 'complete') setTimeout(grab, 800);
  else window.addEventListener('load', function () { setTimeout(grab, 800); });
})();
