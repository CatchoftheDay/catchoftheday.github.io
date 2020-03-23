/**
 * CustomEvent() polyfill
 * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent#Polyfill
 */
(function() {
  if (typeof window.CustomEvent === 'function') return false;

  function CustomEvent(event, params) {
    params = params || { bubbles: true, cancelable: false, detail: undefined };
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(
      event,
      params.bubbles,
      params.cancelable,
      params.detail
    );
    return evt;
  }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();

(function() {
  // This code is served to the browser as-is and must support IE,
  // so keep it old-school.

  var POPUP_URL = '';
  var PKEY = undefined;
  var ON_LOAD = undefined;

  var HORIZONTAL_BUFFER = 20;
  var VERTICAL_BUFFER = 50;

  var popupOrigin = POPUP_URL.split('/')
    .slice(0, 3)
    .join('/');
  var popup = null;

  startGlobalListeners();

  if (!window.cgws) {
    window.cgws = {};
  }
  window.cgws.club = {
    openPopup: openPopup,
    getMemberEmail: getMemberEmail
  };

  if (ON_LOAD) {
    window[ON_LOAD]();
  }

  function openPopup(url) {
    POPUP_URL = url
    popupOrigin = POPUP_URL.split('/')
      .slice(0, 3)
      .join('/');
      
    if (!popup) {
      popup = createPopup();
    }

    return popup.handle;
  }

  function closePopup() {
    if (!popup) {
      return;
    }

    emitEvent(new CustomEvent('close'));
    if (popup.overlay.parentNode) {
      popup.overlay.parentNode.removeChild(popup.overlay);
    }

    popup = null;
  }

  function getMemberEmail() {}

  function createPopup(options) {
    var overlay = createOverlay();
    var iframe = createIframe();

    document.body.appendChild(overlay);
    overlay.appendChild(iframe);

    /** Interface ClubPopup */
    var handle = {
      options: options || {},
      on: function(event, handler) {
        overlay.addEventListener(event, handler);

        return handle;
      },
      close: function() {
        closePopup();
        return handle;
      },
      addEventListener: overlay.addEventListener.bind(overlay),
      removeEventListener: overlay.removeEventListener.bind(overlay)
    };

    return {
      overlay: overlay,
      iframe: iframe,
      handle: handle,
      ready: false
    };
  }

  function emitEvent(event) {
    if (popup) {
      popup.overlay.dispatchEvent(event);
    }
  }

  function createOverlay() {
    var overlay = createElement('div', {
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 10000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    });
    overlay.setAttribute('aria-modal', true);
    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) {
        closePopup();
      }
    });

    return overlay;
  }

  function createIframe() {
    var iframe = createElement('iframe', {
      visibility: 'hidden',
      border: 'none'
    });
    iframe.src = POPUP_URL;
    iframe.addEventListener('load', function(event) {
      // We use the popup informing us of its size as our load proxy
      event.stopPropagation();
    });
    iframe.setAttribute('aria-role', 'dialog');
    setIframeSize(iframe, { width: Infinity, height: Infinity });

    return iframe;
  }

  function createElement(tagName, style) {
    return styleElement(document.createElement(tagName), style);
  }

  function styleElement(element, style) {
    mixin(element.style, style);

    return element;
  }

  function setIframeSize(iframe, size) {
    iframe.width = Math.min(size.width, window.innerWidth - HORIZONTAL_BUFFER);
    iframe.height = Math.min(size.height, window.innerHeight - VERTICAL_BUFFER);
  }

  function resizePopup(size) {
    setIframeSize(popup.iframe, size);
    styleElement(popup.iframe, { visibility: 'visible' });
  }

  function startGlobalListeners() {
    window.addEventListener('message', handleMessage);
    document.addEventListener('keypress', function(event) {
      if (/^Esc(ape)?$/.test(event.key) || event.keyCode === 27) {
        closePopup();
      }
    });
  }

  function handleMessage(event) {
    if (!isValidEvent(event)) {
      return;
    }

    switch (event.data.event) {
      case 'close':
        return closePopup();
      case 'resize':
        if (!popup.ready) {
          popupReady();
        }

        return resizePopup(event.data.payload);
      default:
        return emitEvent(
          mixin(new CustomEvent(event.data.event), event.data.payload)
        );
    }
  }

  function popupReady() {
    popup.ready = true;
    popup.iframe.contentWindow.postMessage(
      {
        event: 'init',
        payload: { pkey: PKEY, email: popup.handle.options.email }
      },
      popupOrigin
    );

    emitEvent(new CustomEvent('load'));
  }

  function isValidEvent(event) {
    return (
      popup &&
      event.source === popup.iframe.contentWindow &&
      event.origin === popupOrigin &&
      event.data &&
      event.data.event
    );
  }

  function mixin(target, source) {
    for (var prop in source) {
      if (source.hasOwnProperty(prop)) {
        target[prop] = source[prop];
      }
    }
  }
})();
