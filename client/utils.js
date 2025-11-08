// Simple throttle (fixes "throttle is not defined")
(function () {
  function throttle(fn, limitMs) {
    let last = 0, timer = null, lastArgs = null, lastCtx = null;
    return function throttled(...args) {
      const now = Date.now();
      if (now - last >= limitMs) {
        last = now;
        fn.apply(this, args);
      } else {
        lastArgs = args; lastCtx = this;
        clearTimeout(timer);
        timer = setTimeout(() => {
          last = Date.now();
          fn.apply(lastCtx, lastArgs);
          lastArgs = lastCtx = null;
        }, limitMs - (now - last));
      }
    };
  }
  window.throttle = throttle;
})();
