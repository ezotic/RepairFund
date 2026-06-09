(function () {
  var V = ['dracula', 'matrix', 'nord', 'solarized', 'monokai', 'light', 'slack'];
  var s = localStorage.getItem('repairfund-theme');
  if (s && s !== 'dracula' && V.indexOf(s) !== -1) {
    document.getElementById('theme-stylesheet').href = '/css/' + s + '.css';
  }
})();
