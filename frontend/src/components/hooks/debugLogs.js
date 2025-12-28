// Función de utilidad para ver logs de depuración desde la consola del navegador
// Ejecutar: window.viewDebugLogs()

export function viewDebugLogs() {
  console.group('🔍 LOGS DE DEPURACIÓN - REGISTRACIÓN');
  
  console.group('📝 Registration Access Logs');
  const lastLog = localStorage.getItem('last_registration_access_log');
  if (lastLog) {
    console.log('✅ Último log exitoso:', JSON.parse(lastLog));
  } else {
    console.log('⚠️ No hay logs exitosos');
  }
  console.groupEnd();
  
  console.group('❌ Registration Access Errors');
  const lastError = localStorage.getItem('last_registration_access_error');
  if (lastError) {
    console.error('❌ Último error getUser:', JSON.parse(lastError));
  } else {
    console.log('✅ No hay errores de getUser');
  }
  
  const generalError = localStorage.getItem('last_registration_access_general_error');
  if (generalError) {
    console.error('❌ Último error general:', JSON.parse(generalError));
  } else {
    console.log('✅ No hay errores generales');
  }
  console.groupEnd();
  
  console.group('💾 User Cache Logs');
  const userCacheError = localStorage.getItem('last_userCache_error');
  if (userCacheError) {
    console.error('❌ Último error userCache:', JSON.parse(userCacheError));
  } else {
    console.log('✅ No hay errores de userCache');
  }
  
  const userCacheLogs = localStorage.getItem('userCache_logs');
  if (userCacheLogs) {
    const logs = JSON.parse(userCacheLogs);
    console.log(`📊 Total de logs: ${logs.length}`);
    if (logs.length > 0) {
      console.log('📋 Últimos 10 logs:', logs.slice(-10));
    }
  } else {
    console.log('⚠️ No hay logs de userCache');
  }
  console.groupEnd();
  
  console.group('🚩 Flags de Estado');
  console.log('just_registered:', localStorage.getItem('just_registered'));
  console.log('email_just_verified:', localStorage.getItem('email_just_verified'));
  console.log('token:', localStorage.getItem('token') ? '✅ Existe' : '❌ No existe');
  console.log('emailToVerify:', localStorage.getItem('emailToVerify'));
  console.groupEnd();
  
  console.groupEnd();
}

export function clearDebugLogs() {
  localStorage.removeItem('last_registration_access_log');
  localStorage.removeItem('last_registration_access_error');
  localStorage.removeItem('last_registration_access_general_error');
  localStorage.removeItem('last_userCache_error');
  localStorage.removeItem('userCache_logs');
  console.log('✅ Logs de depuración limpiados');
}

// Auto-ejecutar si se accede directamente desde el navegador
if (typeof window !== 'undefined') {
  window.viewDebugLogs = viewDebugLogs;
  window.clearDebugLogs = clearDebugLogs;
  console.log('💡 Ejecuta viewDebugLogs() o clearDebugLogs() en la consola para ver los logs');
}

