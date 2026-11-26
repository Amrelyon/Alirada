(function (global) {
  'use strict';

  var DEFAULT_ORIGIN = (function () {
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].getAttribute('src') || '';
        if (src.indexOf('c2p-sdk.js') !== -1) {
          var url = new URL(src, global.location.href);
          return url.origin;
        }
      }
    } catch (_err) {
      // fallback below
    }
    return 'https://alirada.com';
  })();

  var sdkConfig = {
    origin: DEFAULT_ORIGIN,
  };

  function cleanStr(val) {
    return val == null ? '' : String(val).trim();
  }

  function appendReturnParams(returnUrl, payload) {
    try {
      var url = new URL(returnUrl, global.location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      url.searchParams.set('alirada_paid', '1');
      if (payload.ref_code) url.searchParams.set('ref_code', payload.ref_code);
      if (payload.order_number) url.searchParams.set('order_number', payload.order_number);
      if (payload.points_amount != null) url.searchParams.set('points', String(payload.points_amount));
      if (payload.payer_uid) url.searchParams.set('payer_uid', payload.payer_uid);
      if (payload.external_order_id) url.searchParams.set('ext_ref', payload.external_order_id);
      return url.toString();
    } catch (_err) {
      return '';
    }
  }

  function buildUrl(options) {
    var opts = options || {};
    var refCode = cleanStr(opts.refCode || opts.ref_code).toUpperCase();
    if (!refCode) {
      throw new Error('AliradaC2P: refCode is required.');
    }
    var origin = cleanStr(opts.origin) || sdkConfig.origin || 'https://alirada.com';
    var url = new URL(origin.replace(/\/$/, '') + '/');
    url.searchParams.set('pay_ref', refCode);
    if (opts.embed !== false) url.searchParams.set('embed', '1');
    if (opts.previewToken || opts.wp) url.searchParams.set('wp', cleanStr(opts.previewToken || opts.wp));
    if (opts.quantity && Number(opts.quantity) >= 1) {
      url.searchParams.set('qty', String(Math.round(Number(opts.quantity))));
    }
    if (opts.externalOrderId || opts.external_order_id || opts.extRef) {
      url.searchParams.set(
        'ext_ref',
        cleanStr(opts.externalOrderId || opts.external_order_id || opts.extRef)
      );
    }
    if (opts.note || opts.notes) {
      url.searchParams.set('note', cleanStr(opts.note || opts.notes));
    }
    if (opts.mapLink || opts.map_link) {
      url.searchParams.set('map_link', cleanStr(opts.mapLink || opts.map_link));
    }
    if (opts.returnUrl || opts.return_url) {
      url.searchParams.set('return_url', cleanStr(opts.returnUrl || opts.return_url));
    }
    if (opts.theme === 'light' || opts.theme === 'dark') {
      url.searchParams.set('theme', opts.theme);
    }
    return url.toString();
  }

  function resolveContainer(target) {
    if (typeof target === 'string') {
      return document.querySelector(target);
    }
    if (target && target.nodeType === 1) {
      return target;
    }
    return null;
  }

  function mount(target, options) {
    var opts = options || {};
    var container = resolveContainer(target);
    if (!container) {
      throw new Error('AliradaC2P.mount: Target container element not found.');
    }

    var refCode = cleanStr(opts.refCode || opts.ref_code).toUpperCase();
    var iframeSrc = buildUrl(Object.assign({}, opts, { embed: true }));
    var expectedOrigin = new URL(iframeSrc).origin;

    var iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
    iframe.title = cleanStr(opts.title) || 'Alirada C2P Checkout (' + refCode + ')';
    iframe.style.width = '100%';
    iframe.style.maxWidth = opts.maxWidth || '560px';
    iframe.style.height = String(opts.height || 660) + 'px';
    iframe.style.border = '0';
    iframe.style.borderRadius = '12px';
    iframe.style.display = 'block';
    iframe.setAttribute('allow', 'clipboard-write');

    container.innerHTML = '';
    container.appendChild(iframe);

    function postCommand(cmd) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        Object.assign({ ref_code: refCode }, cmd),
        expectedOrigin
      );
    }

    function onMessage(event) {
      if (event.origin !== expectedOrigin) return;
      if (iframe.contentWindow && event.source !== iframe.contentWindow) return;
      var data = event.data;
      if (!data || cleanStr(data.ref_code).toUpperCase() !== refCode) return;

      if (data.type === 'ALIRADA_C2P_HEIGHT' && data.height && opts.autoResize !== false) {
        iframe.style.height = Math.max(420, Number(data.height)) + 'px';
      } else if (data.type === 'ALIRADA_C2P_READY') {
        if (typeof opts.onReady === 'function') opts.onReady(data);
      } else if (data.type === 'ALIRADA_C2P_PAID') {
        if (typeof opts.onPaid === 'function') opts.onPaid(data);
        if (opts.autoRedirect && (opts.returnUrl || opts.return_url)) {
          var nextUrl = appendReturnParams(opts.returnUrl || opts.return_url, data);
          if (nextUrl) global.location.href = nextUrl;
        }
      } else if (data.type === 'ALIRADA_C2P_ERROR') {
        if (typeof opts.onError === 'function') opts.onError(data);
      } else if (data.type === 'ALIRADA_C2P_AUTH_REQUIRED') {
        if (typeof opts.onAuthRequired === 'function') opts.onAuthRequired(data);
      } else if (data.type === 'ALIRADA_C2P_CLOSED') {
        if (typeof opts.onClose === 'function') opts.onClose(data);
      }
    }

    global.addEventListener('message', onMessage);

    return {
      refCode: refCode,
      iframe: iframe,
      configure: function (patch) {
        postCommand(Object.assign({ type: 'ALIRADA_C2P_CONFIGURE' }, patch || {}));
      },
      setQuantity: function (qty) {
        postCommand({ type: 'ALIRADA_C2P_SET_QUANTITY', quantity: Number(qty) || 1 });
      },
      triggerPay: function (overrides) {
        postCommand(Object.assign({ type: 'ALIRADA_C2P_TRIGGER_PAY' }, overrides || {}));
      },
      reset: function () {
        postCommand({ type: 'ALIRADA_C2P_RESET' });
      },
      destroy: function () {
        global.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    };
  }

  function pay(options) {
    var opts = options || {};
    return new Promise(function (resolve, reject) {
      var settled = false;
      var overlay = document.createElement('div');
      overlay.setAttribute('data-alirada-c2p-overlay', 'true');
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;background:rgba(10,12,16,0.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;';

      var dialog = document.createElement('div');
      dialog.style.cssText =
        'position:relative;width:100%;max-width:580px;max-height:92vh;overflow:auto;border-radius:14px;background:#12151B;box-shadow:0 24px 60px rgba(0,0,0,0.45);';

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = '\u2715';
      closeBtn.setAttribute('aria-label', 'Close Alirada checkout');
      closeBtn.style.cssText =
        'position:absolute;top:10px;right:10px;z-index:2;width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:rgba(18,21,27,0.9);color:#f5f5f4;cursor:pointer;font-size:14px;line-height:1;';

      var mountTarget = document.createElement('div');
      dialog.appendChild(closeBtn);
      dialog.appendChild(mountTarget);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      var instance;
      function cleanup() {
        document.removeEventListener('keydown', onKeyDown);
        if (instance) instance.destroy();
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }

      function cancelModal(reason) {
        if (settled) return;
        settled = true;
        cleanup();
        if (typeof opts.onCancel === 'function') opts.onCancel(reason);
        reject(new Error(reason || 'Alirada C2P checkout closed by user.'));
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') cancelModal('Cancelled with Escape');
      }

      closeBtn.addEventListener('click', function () {
        cancelModal('Cancelled by user');
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cancelModal('Cancelled by backdrop click');
      });
      document.addEventListener('keydown', onKeyDown);

      try {
        instance = mount(
          mountTarget,
          Object.assign({}, opts, {
            maxWidth: '100%',
            onPaid: function (receipt) {
              if (settled) return;
              settled = true;
              if (typeof opts.onPaid === 'function') opts.onPaid(receipt);
              setTimeout(function () {
                cleanup();
                resolve(receipt);
              }, opts.closeDelayMs != null ? Number(opts.closeDelayMs) : 900);
            },
            onError: function (errPayload) {
              if (typeof opts.onError === 'function') opts.onError(errPayload);
            },
            onClose: function () {
              cancelModal('Closed from widget');
            },
          })
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  function bindButtons() {
    var nodes = document.querySelectorAll('[data-alirada-c2p]');
    for (var i = 0; i < nodes.length; i++) {
      (function (el) {
        if (el.getAttribute('data-alirada-bound') === '1') return;
        el.setAttribute('data-alirada-bound', '1');
        el.addEventListener('click', function (e) {
          e.preventDefault();
          var refCode = el.getAttribute('data-alirada-c2p');
          var qty = el.getAttribute('data-qty');
          var extRef = el.getAttribute('data-ext-ref');
          var note = el.getAttribute('data-note');
          var returnUrl = el.getAttribute('data-return-url');
          var theme = el.getAttribute('data-theme');
          pay({
            refCode: refCode,
            quantity: qty ? Number(qty) : undefined,
            externalOrderId: extRef || undefined,
            note: note || undefined,
            returnUrl: returnUrl || undefined,
            theme: theme || undefined,
          })
            .then(function (receipt) {
              el.dispatchEvent(
                new CustomEvent('alirada:c2p:paid', { bubbles: true, detail: receipt })
              );
            })
            .catch(function (err) {
              el.dispatchEvent(
                new CustomEvent('alirada:c2p:cancelled', {
                  bubbles: true,
                  detail: { message: err && err.message ? err.message : 'Cancelled' },
                })
              );
            });
        });
      })(nodes[i]);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindButtons);
    } else {
      bindButtons();
    }
  }

  global.AliradaC2P = {
    version: '1.0.0',
    configure: function (cfg) {
      if (cfg && cfg.origin) sdkConfig.origin = cleanStr(cfg.origin);
    },
    buildUrl: buildUrl,
    mount: mount,
    pay: pay,
    bindButtons: bindButtons,
  };
})(window);
