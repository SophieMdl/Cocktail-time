const CACHE_NAME = "V1"

this.addEventListener('install', function(event) {
    event.waitUntil(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.addAll([
          'index.html',
          'global.css',
          'bundle.css.map',
          'bundle.js.map',
        ]);
      })
    );
  });

self.addEventListener('fetch', event => {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
       return cache.match(event.request).then(response => {
        return response || fetch(event.request)
        .then(response => {
            cache.put(event.request, response.clone());
            return response;
          })
        })
      })
    )
});

