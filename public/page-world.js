(function () {
  if (window.__ytContextInjected) return;
  window.__ytContextInjected = true;

  function isTimedTextUrl(url) {
    return url && (url.includes("api.timedtext") || url.includes("timedtext?"));
  }

  function extractLang(url) {
    try {
      var u = new URL(url, location.href);
      return u.searchParams.get("lang") || u.searchParams.get("tlang") || "und";
    } catch (e) {
      return "und";
    }
  }

  function isAutoCaption(url) {
    try {
      var u = new URL(url, location.href);
      return u.searchParams.get("kind") === "asr";
    } catch (e) {
      return false;
    }
  }

  function postCaption(url, xml) {
    window.postMessage(
      {
        type: "yt_timedtext",
        url: url,
        lang: extractLang(url),
        isAuto: isAutoCaption(url),
        xml: xml,
      },
      "*"
    );
  }

  // Hook fetch
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
    if (isTimedTextUrl(url)) {
      return origFetch.call(this, input, init).then(function (resp) {
        var clone = resp.clone();
        clone.text().then(function (xml) {
          postCaption(url, xml);
        });
        return resp;
      });
    }
    return origFetch.call(this, input, init);
  };

  // Hook XHR
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._ytUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (isTimedTextUrl(this._ytUrl)) {
      this.addEventListener("load", function () {
        postCaption(this._ytUrl, this.responseText);
      });
    }
    return origSend.apply(this, arguments);
  };

  // Fallback: read ytInitialPlayerResponse which is already in the page.
  // Handles the race where timedtext was fetched before our hook ran.
  function tryPlayerResponse() {
    try {
      var tracks =
        window.ytInitialPlayerResponse &&
        window.ytInitialPlayerResponse.captions &&
        window.ytInitialPlayerResponse.captions
          .playerCaptionsTracklistRenderer &&
        window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer
          .captionTracks;
      if (!tracks || !tracks.length) return;
      tracks.forEach(function (track) {
        var url = track.baseUrl;
        if (!url) return;
        var lang = track.languageCode || "und";
        var isAuto = track.kind === "asr";
        fetch(url)
          .then(function (r) {
            return r.text();
          })
          .then(function (xml) {
            window.postMessage(
              { type: "yt_timedtext", url: url, lang: lang, isAuto: isAuto, xml: xml },
              "*"
            );
          })
          .catch(function () {});
      });
    } catch (e) {}
  }
  tryPlayerResponse();
})();
