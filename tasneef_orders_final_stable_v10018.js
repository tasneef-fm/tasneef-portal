/* Disabled legacy Tasneef orders script. Redirects to clean root v10036. */
(function(){
  'use strict';
  window.__tasneefOrdersSharedSyncDisabled = true;
  window.__tasneefOrdersRootMasterV10031 = true;
  window.__tasneefOrdersRootLockV10033 = true;
  window.__tasneefOrdersMasterLockV10024 = true;
  window.__tasneefOrdersStabilityPatchV10022 = true;
  window.__tasneefOrdersFinalStabilityV10023 = true;
  if(!window.__tasneefOrdersCleanRootLoaderV10036){
    window.__tasneefOrdersCleanRootLoaderV10036 = true;
    var s=document.createElement('script');
    s.src='tasneef_orders_clean_root_v10036.js?v=10036';
    s.defer=true;
    document.head.appendChild(s);
  }
})();
