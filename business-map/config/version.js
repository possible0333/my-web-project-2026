(function(){
  const version='v1.69';
  window.BUSINESS_MAP_CONFIG=Object.freeze({
    ...(window.BUSINESS_MAP_CONFIG||{}),
    version,
    cacheTag:version.replace(/^v/,'')
  });
  window.BUSINESS_MAP_VERSION=version;
})();
