'use strict';

/**
 * المصدر المركزي الوحيد لصلاحيات وردة أشبيليا.
 * لا تعتمد الواجهة على اسم المستخدم أو البريد أو شروط الدور المتفرقة.
 */
window.PermissionsService = (() => {
  let currentUser = null;
  let permissionSet = new Set();
  let permissionsVersion = 0;
  let pollTimer = null;
  const listeners = new Set();

  function cacheKey(userId, version) {
    return `wardat:user-permissions:${userId}:${version}`;
  }
  function notify() { listeners.forEach(fn => { try { fn(snapshot()); } catch (_) {} }); }
  function snapshot() {
    return {
      userId: currentUser?.id || null,
      roleCode: currentUser?.role_code || null,
      permissionsVersion,
      permissions: [...permissionSet]
    };
  }
  function hydrate(user) {
    currentUser = user || null;
    permissionsVersion = Number(user?.permissions_version || 0);
    permissionSet = new Set(Array.isArray(user?.permissions) ? user.permissions : []);
    if (user?.id) {
      try { localStorage.setItem(cacheKey(user.id, permissionsVersion), JSON.stringify(snapshot())); } catch (_) {}
    }
    notify();
  }
  async function initialize(user) {
    hydrate(user);
    stopPolling();
    if (user?.id) pollTimer = setInterval(refreshIfChanged, 15000);
    return snapshot();
  }
  function can(permissionKey) {
    if (!currentUser || currentUser.is_active === false) return false;
    return permissionSet.has(permissionKey);
  }
  function canAny(keys = []) { return keys.some(can); }
  function requirePermission(permissionKey) {
    if (can(permissionKey)) return true;
    const error = new Error('ليس لديك صلاحية لتنفيذ هذه العملية');
    error.status = 403;
    error.permission = permissionKey;
    throw error;
  }
  async function reload() {
    const response = await window.WardatBackend.request('/api/auth/permissions', { method: 'GET', skipPermissionCheck: true });
    if (!response?.user) throw new Error('تعذر تحميل صلاحيات المستخدم');
    hydrate(response.user);
    return snapshot();
  }
  async function refreshIfChanged() {
    if (!currentUser?.id) return;
    try {
      const response = await window.WardatBackend.request('/api/auth/permissions-version', { method: 'GET', skipPermissionCheck: true });
      if (!response?.active) {
        clear();
        window.dispatchEvent(new CustomEvent('wardat:user-disabled'));
        return;
      }
      if (Number(response.version) !== permissionsVersion) {
        await reload();
        window.dispatchEvent(new CustomEvent('wardat:permissions-changed'));
      }
    } catch (_) {}
  }
  function applyDom(rules = {}) {
    Object.entries(rules).forEach(([selector, permission]) => {
      document.querySelectorAll(selector).forEach(el => {
        const allowed = Array.isArray(permission) ? canAny(permission) : can(permission);
        el.dataset.permissionChecked = '1';
        if (allowed) {
          el.hidden = false;
          el.removeAttribute('aria-disabled');
          if ('disabled' in el) el.disabled = false;
        } else {
          el.hidden = true;
          el.setAttribute('aria-disabled', 'true');
          if ('disabled' in el) el.disabled = true;
        }
      });
    });
  }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }
  function clear() {
    stopPolling();
    if (currentUser?.id) {
      try {
        Object.keys(localStorage).filter(k => k.startsWith(`wardat:user-permissions:${currentUser.id}:`)).forEach(k => localStorage.removeItem(k));
      } catch (_) {}
    }
    currentUser = null;
    permissionSet = new Set();
    permissionsVersion = 0;
    notify();
  }
  return { initialize, reload, refreshIfChanged, can, canAny, requirePermission, applyDom, onChange, clear, snapshot };
})();
